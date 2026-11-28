import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { getPlatformProxy, unstable_splitSqlQuery } from 'wrangler'
import { createJiti } from 'jiti'
const jiti = createJiti(import.meta.url)
const { default: worker } = await jiti.import('./index.ts')
const { reconcileFiles, saveFileContent } = await jiti.import('./files.ts')
const { encodeMeta, sha256Hex } = await jiti.import('../../src/lib/files.ts')
const token = 'synthetic-files-token'
const migrations = ['0001_core.sql', '0002_domain_relations.sql', '0003_atomic_history.sql', '0004_files_policy.sql']

async function database(fn, bindings = true) {
  const platform = await getPlatformProxy({ configPath: 'worker/wrangler.local.jsonc', persist: false, remoteBindings: false })
  try {
    for (const name of migrations) await platform.env.INTERNAL_DB.batch(unstable_splitSqlQuery(await readFile(`worker/migrations/${name}`, 'utf8')).map(sql => platform.env.INTERNAL_DB.prepare(sql)))
    const env = bindings ? { ...platform.env, SCHEDULE_WRITE_TOKEN: token } : { SCHEDULES: platform.env.SCHEDULES, SCHEDULE_WRITE_TOKEN: token }
    await fn(env)
  } finally { await platform.dispose() }
}
const id = prefix => `${prefix}_${crypto.randomUUID()}`
async function meta(bytes, overrides = {}) {
  return { operationId: crypto.randomUUID(), baseRevision: 0, versionId: id('ver'), name: 'Order sheet.xlsx', folder: 'Ordering/Suppliers',
    labels: ['Weekly order', 'CR3'], links: [], addedBy: 'Maria', sha256: await sha256Hex(bytes.buffer), size: bytes.byteLength, ...overrides }
}
function call(env, path, init = {}, code = token) {
  return worker.fetch(new Request('http://local' + path, { ...init, headers: { Authorization: 'Bearer ' + code, ...init.headers } }), env, {})
}
function upload(env, store, doc, bytes, info) {
  return call(env, `/api/internal/files/${store}/${doc}/content`, { method: 'PUT', body: bytes, headers: { 'X-File-Meta': encodeMeta(info), 'Content-Length': String(bytes.byteLength) } })
}
const bytesOf = text => new TextEncoder().encode(text)
const count = async (db, sql) => (await db.prepare(sql).first()).n

test('upload, list and byte-exact download keep checksum, filename and activity', async () => database(async env => {
  const bytes = bytesOf('synthetic,order\nrice,3\n'), doc = id('doc'), info = await meta(bytes)
  const saved = await upload(env, 'CR3', doc, bytes, info)
  assert.equal(saved.status, 200)
  const { record } = await saved.json()
  assert.equal(record.revision, 1); assert.equal(record.data.currentVersionId, info.versionId); assert.equal(record.data.addedBy, 'Maria')
  const page = await (await call(env, '/api/internal/files')).json()
  assert.deepEqual(page.records.map(r => r.id), [doc]); assert.deepEqual(page.folders, ['Ordering/Suppliers']); assert.deepEqual(page.labels, ['CR3', 'Weekly order'])
  const download = await call(env, `/api/internal/files/CR3/versions/${info.versionId}/content`)
  assert.equal(download.status, 200)
  assert.equal(download.headers.get('Content-Type'), 'application/octet-stream')
  assert.equal(download.headers.get('X-Content-Type-Options'), 'nosniff')
  assert.match(download.headers.get('Content-Disposition'), /^attachment; filename="Order sheet.xlsx"; filename\*=UTF-8''Order%20sheet.xlsx$/)
  const body = new Uint8Array(await download.arrayBuffer())
  assert.equal(await sha256Hex(body.buffer), info.sha256)
  const detail = await (await call(env, `/api/internal/files/CR3/${doc}`)).json()
  assert.equal(detail.versions.length, 1); assert.equal(detail.versions[0].size, bytes.byteLength)
  assert.deepEqual(detail.activity.map(a => [a.action, a.actor]), [['upload', 'Maria']])
}))

test('disallowed type, wrong size, wrong checksum and missing name store nothing', async () => database(async env => {
  const bytes = bytesOf('<script>alert(1)</script>')
  const cases = [await meta(bytes, { name: 'page.html' }), await meta(bytes, { addedBy: ' ' }), await meta(bytes, { sha256: 'a'.repeat(64) }), await meta(bytes, { size: bytes.byteLength + 1 })]
  for (const info of cases) assert.equal((await upload(env, 'CR3', id('doc'), bytes, info)).status, 400)
  assert.equal(await count(env.INTERNAL_DB, 'SELECT count(*) n FROM records'), 0)
  assert.equal((await env.ATTACHMENTS.list({ prefix: 'files/' })).objects.length, 0)
}))

test('same-base replaces: one wins, the loser gets 409 and its object is removed; an identical retry replays', async () => database(async env => {
  const first = bytesOf('v1'), doc = id('doc'), created = await meta(first)
  assert.equal((await upload(env, 'CR2', doc, first, created)).status, 200)
  const a = bytesOf('v2-a'), b = bytesOf('v2-b'), metaA = await meta(a, { baseRevision: 1 }), metaB = await meta(b, { baseRevision: 1 })
  const results = await Promise.all([upload(env, 'CR2', doc, a, metaA), upload(env, 'CR2', doc, b, metaB)])
  const statuses = results.map(r => r.status).sort()
  assert.deepEqual(statuses, [200, 409])
  const loser = results[0].status === 409 ? metaA : metaB
  assert.equal((await results.find(r => r.status === 409).json()).error.code, 'revision_conflict')
  assert.equal(await env.ATTACHMENTS.head(`files/CR2/${loser.versionId}`), null)
  const winner = results[0].status === 200 ? metaA : metaB, winnerBytes = winner === metaA ? a : b
  const retry = await upload(env, 'CR2', doc, winnerBytes, winner)
  assert.equal(retry.status, 200); assert.equal((await retry.json()).replayed, true)
  const detail = await (await call(env, `/api/internal/files/CR2/${doc}`)).json()
  assert.equal(detail.versions.length, 2); assert.equal(detail.record.revision, 2)
}))

test('a failed projection rolls back document, receipt and history together', async () => database(async env => {
  const db = env.INTERNAL_DB, bytes = bytesOf('x')
  await db.prepare("DELETE FROM policy_versions WHERE decision_id='DEC-03'").run()
  const result = await saveFileContent(db, env.ATTACHMENTS, 'CR3', id('doc'), await meta(bytes), bytes.buffer)
  assert.equal(result.ok, false); assert.equal(result.status, 503)
  for (const table of ['records', 'mutation_operations', 'change_events', 'attachments']) assert.equal(await count(db, `SELECT count(*) n FROM ${table}`), 0, table)
  assert.deepEqual(await reconcileFiles(db, env.ATTACHMENTS), [(await env.ATTACHMENTS.list({ prefix: 'files/' })).objects[0].key])
}))

test('rename, trash and restore each add one activity entry and keep every version downloadable', async () => database(async env => {
  const bytes = bytesOf('keep'), doc = id('doc'), info = await meta(bytes, { links: [{ kind: 'import', key: 'imp_fixture' }] })
  await upload(env, 'CR3', doc, bytes, info)
  const change = (body) => call(env, `/api/internal/files/CR3/${doc}`, { method: 'POST', body: JSON.stringify({ operationId: crypto.randomUUID(), addedBy: 'Luis', ...body }) })
  assert.equal((await change({ action: 'update', baseRevision: 1, name: 'Renamed.xlsx', folder: 'Archive', labels: ['old'] })).status, 200)
  const trash = { action: 'trash', baseRevision: 2, operationId: crypto.randomUUID() }
  assert.equal((await change(trash)).status, 200)
  const retried = await change(trash)
  assert.equal(retried.status, 200); assert.equal((await retried.json()).replayed, true)
  assert.equal((await (await call(env, '/api/internal/files')).json()).records.length, 0)
  assert.equal((await (await call(env, '/api/internal/files?trash=1')).json()).records.length, 1)
  assert.equal((await call(env, `/api/internal/files/CR3/versions/${info.versionId}/content`)).status, 200)
  assert.equal((await change({ action: 'restore', baseRevision: 3 })).status, 200)
  assert.equal((await change({ action: 'restore', baseRevision: 4 })).status, 400)
  const detail = await (await call(env, `/api/internal/files/CR3/${doc}`)).json()
  assert.deepEqual(detail.activity.map(a => a.action), ['restore', 'trash', 'update', 'upload'])
  assert.equal(detail.record.data.name, 'Renamed.xlsx')
  const linked = await (await call(env, '/api/internal/files?link=import:imp_fixture')).json()
  assert.deepEqual(linked.records.map(r => r.id), [doc])
  assert.equal((await call(env, '/api/internal/files?link=nonsense')).status, 400)
  assert.equal((await (await call(env, '/api/internal/files?store=CR2')).json()).records.length, 0)
}))

test('manager gate and unbound storage', async () => {
  await database(async env => {
    assert.equal((await call(env, '/api/internal/files', {}, 'wrong-code')).status, 401)
  })
  await database(async env => {
    const response = await call(env, '/api/internal/files')
    assert.equal(response.status, 503); assert.equal((await response.json()).error.code, 'backend_unconfigured')
  }, false)
})
