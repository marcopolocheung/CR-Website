import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { getPlatformProxy, unstable_splitSqlQuery } from 'wrangler'

const sql = async path => readFile(new URL(path, import.meta.url), 'utf8')
const migrations = ['0001_core.sql', '0002_domain_relations.sql']
async function environment(fn) {
  const proxy = await getPlatformProxy({ configPath: 'worker/wrangler.local.jsonc', persist: false, remoteBindings: false })
  try { await fn(proxy.env) } finally { await proxy.dispose() }
}
async function executeSql(db, text) {
  return db.batch(unstable_splitSqlQuery(text).map(statement => db.prepare(statement)))
}
async function migrate(db, names = migrations) {
  for (const name of names) await executeSql(db, await sql(`./migrations/${name}`))
}
async function scalar(db, query) { return db.prepare(query).first() }
const rejects = (db, query) => assert.rejects(db.prepare(query).run(), /constraint|CHECK|FOREIGN KEY|UNIQUE/i)

test('empty local D1 accepts every migration; local KV and private R2 round-trip independently', async () => {
  await environment(async ({ INTERNAL_DB: db, SCHEDULES: kv, ATTACHMENTS: r2 }) => {
    await migrate(db)
    assert.equal((await scalar(db, 'SELECT count(*) AS n FROM stores')).n, 2)
    assert.equal((await scalar(db, 'SELECT count(*) AS n FROM stations')).n, 4)
    assert.equal((await scalar(db, 'SELECT count(*) AS n FROM policy_versions')).n, 0)
    assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results, [])
    const tables = (await db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()).results.map(r => r.name)
    for (const table of ['employees','employee_memberships','employee_mappings','records','record_lineage','cash_closes','catalogs','count_sessions','count_lines','purchase_orders','order_lines','receipts','receipt_lines','schedules','schedule_requests','import_jobs','forms','follow_ups','attachments','stock_events']) assert.ok(tables.includes(table), table)
    await kv.put('fixture-key', 'original', { metadata: { fixture: true } })
    assert.equal(await kv.get('fixture-key'), 'original')
    await r2.put('fixture-private-object', 'synthetic bytes')
    assert.equal(await (await r2.get('fixture-private-object')).text(), 'synthetic bytes')
  })
})
test('upgrade prior fixture retains names, raw lineage and cents; unknown policies stay disabled', async () => {
  await environment(async ({ INTERNAL_DB: db }) => {
    await migrate(db, migrations.slice(0,1))
    await executeSql(db, await sql('./fixtures/0001_prior.sql'))
    const before = await scalar(db, "SELECT * FROM records WHERE id='fixture-close-1'")
    await migrate(db, migrations.slice(1))
    await executeSql(db, await sql('./fixtures/0002_domains.sql'))
    assert.deepEqual(await scalar(db, "SELECT * FROM records WHERE id='fixture-close-1'"), before)
    assert.equal((await scalar(db, 'SELECT display_name FROM employees')).display_name, 'Persona de prueba')
    assert.equal((await scalar(db, 'SELECT count(*) AS n FROM record_lineage')).n, 1)
    const close = await scalar(db, 'SELECT * FROM cash_closes')
    assert.equal(close.expected_cents, null)
    assert.equal(close.actual_deposit_cents, 0)
    assert.equal(close.policy_version, null)
    const lines = (await db.prepare('SELECT response,quantity_raw,quantity_encoding FROM count_lines ORDER BY id').all()).results
    assert.equal(lines.length, 5)
    assert.ok(lines.some(l => l.response === 'measured' && l.quantity_raw === '3B/2T' && l.quantity_encoding === null))
    assert.ok(lines.some(l => l.response === 'measured-zero' && l.quantity_raw === '0'))
    assert.ok(lines.some(l => l.response === 'uncounted' && l.quantity_raw === null))
    await rejects(db, "UPDATE cash_closes SET state='submitted'")
    await rejects(db, "UPDATE count_lines SET quantity_encoding='assumed-decimal'")
    await rejects(db, "UPDATE cash_closes SET actual_deposit_cents=1.5")
    await rejects(db, "UPDATE records SET revision=0")
    await rejects(db, "UPDATE records SET revision=9007199254740992")
    await rejects(db, "UPDATE records SET station_id='CR2-kitchen' WHERE store_id='CR3'")
    await rejects(db, "INSERT INTO employee_memberships (id,employee_id,store_id) VALUES ('bad','missing','CR3')")
    await rejects(db, "UPDATE employee_mappings SET state='reviewed'")
    await rejects(db, "UPDATE records SET context_kind='period' WHERE id='fixture-close-1'")
    await rejects(db, "DELETE FROM records WHERE id='fixture-catalog-1'")
    await rejects(db, "UPDATE count_sessions SET store_id='CR2'")
    assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results, [])
    await assert.rejects(db.batch([
      db.prepare('UPDATE cash_closes SET actual_deposit_cents=100'),
      db.prepare("UPDATE records SET revision=0 WHERE id='fixture-close-1'"),
    ]), /constraint|CHECK/i)
    // A failed multi-statement transaction rolls back its earlier update as well.
    assert.equal((await scalar(db, 'SELECT actual_deposit_cents FROM cash_closes')).actual_deposit_cents, 0)
  })
})
