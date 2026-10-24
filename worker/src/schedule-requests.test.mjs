import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { getPlatformProxy, unstable_splitSqlQuery } from 'wrangler'
import { createJiti } from 'jiti'
const jiti = createJiti(import.meta.url)
const { requestRecord, saveRequests } = await jiti.import('./schedule-requests.ts')
const { default: worker } = await jiti.import('./index.ts')
const station = 'CR3-diningroom'
const original = (id = 'request-one') => ({ id, employee: { stationId: station, sourceEmployeeId: 'legacy-person', name: 'Sample Person' },
  kind: 'time-off', startDate: '2026-10-31', endDate: '2026-11-01', ranges: [], reason: 'Original reason / motivo',
  requestedAt: '2026-10-24T12:00:00.000Z', enteredAt: '2026-10-24T13:00:00.000Z', enteredBy: 'Sample Manager',
  policyVersion: 'DEC-01-v1', status: 'pending', review: null })
const data = (requests = [original()]) => ({ version: 1, stationId: station, requests })
const input = (base, op, next = data(), preparer = 'Sample Manager') => ({ preparer, mutation: { schemaVersion: 1, baseRevision: base, operationId: op, data: next } })
const review = (request, status, by = 'Reviewer') => ({ ...request, status, review: { by, at: '2026-10-25T12:00:00.000Z', reason: 'Decision reason' } })
async function database(fn) {
  const platform = await getPlatformProxy({ configPath: 'worker/wrangler.local.jsonc', persist: false, remoteBindings: false })
  try {
    for (const name of ['0001_core.sql', '0002_domain_relations.sql', '0003_atomic_history.sql']) {
      await platform.env.INTERNAL_DB.batch(unstable_splitSqlQuery(await readFile('worker/migrations/' + name, 'utf8')).map(sql => platform.env.INTERNAL_DB.prepare(sql)))
    }
    await fn(platform.env)
  } finally { await platform.dispose() }
}
test('atomic create/review keeps originals and replays historical success after later revisions', async () => {
  await database(async ({ INTERNAL_DB: db }) => {
    const created = await saveRequests(db, station, input(0, 'create'))
    assert.ok(created.ok); assert.equal(created.record.revision, 1)
    assert.equal((await saveRequests(db, station, input(2, 'future-base', data([])))).status, 409)
    const next = data([review(original(), 'approved')])
    const saved = await saveRequests(db, station, input(1, 'approve', next, 'Reviewer'))
    assert.ok(saved.ok); assert.equal(saved.record.revision, 2)
    assert.deepEqual(await saveRequests(db, station, input(0, 'create')), { ...created, replayed: true })
    assert.equal((await saveRequests(db, station, input(0, 'create', data([original('changed')])))).status, 409)
    assert.equal((await requestRecord(db, station)).data.requests[0].reason, original().reason)
    assert.equal((await requestRecord(db, 'CR2-diningroom')), null)
    assert.equal((await db.prepare('SELECT count(*) n FROM change_events').first()).n, 2)
    const snapshot = await db.prepare('SELECT snapshot_json FROM change_events WHERE revision=1').first()
    assert.equal(JSON.parse(snapshot.snapshot_json).data.requests[0].status, 'pending')
  })
})
test('concurrent reviewers produce one decision and a recoverable conflict without losing the request', async () => {
  await database(async ({ INTERNAL_DB: db }) => {
    await saveRequests(db, station, input(0, 'create'))
    const attempts = await Promise.all(['approved', 'declined'].map(status => saveRequests(db, station, input(1, status, data([review(original(), status)]), 'Reviewer'))))
    assert.equal(attempts.filter(result => result.ok).length, 1)
    assert.equal(attempts.find(result => !result.ok).status, 409)
    const saved = await requestRecord(db, station)
    assert.equal(saved.revision, 2); assert.equal(saved.data.requests[0].reason, original().reason)
    assert.equal((await db.prepare('SELECT count(*) n FROM change_events').first()).n, 2)
  })
})
test('approvals serialize overlapping requests, preserve recurring/staff KV and reject rewritten originals', async () => {
  await database(async ({ INTERNAL_DB: db, SCHEDULES: kv }) => {
    await kv.put('r:CR3-diningroom:employees:current', JSON.stringify({ recurringAvailability: 'untouched', suspendedFrom: '2026-12-01' }))
    const before = await kv.get('r:CR3-diningroom:employees:current')
    await saveRequests(db, station, input(0, 'one'))
    const two = data([original(), original('request-two')])
    assert.ok((await saveRequests(db, station, input(1, 'two', two))).ok)
    const approved = data([review(original(), 'approved'), original('request-two')])
    assert.ok((await saveRequests(db, station, input(2, 'approve', approved, 'Reviewer'))).ok)
    const overlap = data([approved.requests[0], review(original('request-two'), 'approved')])
    assert.equal((await saveRequests(db, station, input(3, 'overlap', overlap, 'Reviewer'))).status, 400)
    const rewrite = data([{ ...approved.requests[0], reason: 'Rewritten original' }, original('request-two')])
    assert.equal((await saveRequests(db, station, input(3, 'rewrite', rewrite, 'Reviewer'))).status, 400)
    const declined = data([approved.requests[0], review(original('request-two'), 'declined')])
    assert.ok((await saveRequests(db, station, input(3, 'decline', declined, 'Reviewer'))).ok)
    assert.equal(await kv.get('r:CR3-diningroom:employees:current'), before)
  })
})
test('authorized routes distinguish absent capability, private empty data, invalid stations and bounded bodies', async () => {
  await database(async env => {
    const configured = { ...env, SCHEDULE_WRITE_TOKEN: 'synthetic-secret' }
    const url = `http://local/api/internal/schedule-requests/${station}`
    const headers = { Authorization: 'Bearer synthetic-secret', 'Content-Type': 'application/json' }
    assert.equal((await worker.fetch(new Request(url), configured)).status, 401)
    assert.equal((await worker.fetch(new Request(url, { headers }), { SCHEDULES: env.SCHEDULES, SCHEDULE_WRITE_TOKEN: 'synthetic-secret' })).status, 503)
    const empty = await worker.fetch(new Request(url, { headers }), configured)
    assert.equal(empty.headers.get('Cache-Control'), 'no-store'); assert.deepEqual(await empty.json(), { record: null })
    assert.equal((await worker.fetch(new Request('http://local/api/internal/schedule-requests/invalid', { headers }), configured)).status, 400)
    const saved = await worker.fetch(new Request(url, { method: 'PUT', headers, body: JSON.stringify(input(0, 'route')) }), configured)
    assert.equal(saved.status, 200); assert.equal((await saved.json()).record.revision, 1)
    assert.equal((await worker.fetch(new Request(url, { method: 'PUT', headers, body: '{' }), configured)).status, 400)
    assert.equal((await worker.fetch(new Request(url, { method: 'PUT', headers, body: ' '.repeat(600001) }), configured)).status, 400)
  })
})
