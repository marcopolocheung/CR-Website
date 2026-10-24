import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getPlatformProxy, unstable_splitSqlQuery } from 'wrangler';
import { createJiti } from 'jiti';
const jiti = createJiti(import.meta.url);
const { canonicalJson, mutateRecord } = await jiti.import('./record-mutations.ts');
const { operationId, revision } = await jiti.import('../../src/lib/internal-tools/contracts.ts');
async function database(fn) {
    const proxy = await getPlatformProxy({ configPath: 'worker/wrangler.local.jsonc', persist: false, remoteBindings: false });
    try {
        for (const name of ['0001_core.sql', '0002_domain_relations.sql', '0003_atomic_history.sql']) {
            const sql = await readFile(`worker/migrations/${name}`, 'utf8');
            await proxy.env.INTERNAL_DB.batch(unstable_splitSqlQuery(sql).map(sql => proxy.env.INTERNAL_DB.prepare(sql)));
        }
        await fn(proxy.env.INTERNAL_DB);
    }
    finally {
        await proxy.dispose();
    }
}
const context = {
    storeId: 'CR3', stationId: 'CR3-kitchen', family: 'form', id: 'fixture-form',
    context: { kind: 'undated' }, callerScope: 'fixture-manager-scope', action: 'save',
    actor: { kind: 'entered-label', label: 'Preparador de prueba' },
};
function input(base, op, data = { narrative: 'Texto original', expectedCents: null, actualCents: 0 }) {
    return { schemaVersion: 1, baseRevision: revision(base), operationId: operationId(op), data };
}
const valid = () => [];
async function events(db) { return (await db.prepare('SELECT * FROM change_events ORDER BY revision').all()).results; }
test('create, update and historical retry preserve authoritative result, creation time and snapshots', async () => {
    await database(async (db) => {
        const first = await mutateRecord(db, context, input(0, 'create'), valid);
        assert.ok(first.ok);
        assert.equal(first.record.revision, 1);
        const second = await mutateRecord(db, context, input(1, 'update', { narrative: 'new' }), valid);
        assert.ok(second.ok);
        assert.equal(second.record.revision, 2);
        assert.equal(second.record.createdAt, first.record.createdAt);
        const retry = await mutateRecord(db, context, input(0, 'create'), () => [{ path: 'narrative', code: 'later_policy' }]);
        assert.deepEqual(retry, { ...first, replayed: true });
        const history = await events(db);
        assert.equal(history.length, 2);
        assert.deepEqual(JSON.parse(history[0].snapshot_json).data, input(0, 'create').data);
        assert.equal(JSON.parse(history[0].actor_json).kind, 'entered-label');
        await assert.rejects(db.prepare("UPDATE change_events SET action='rewrite'").run(), /history_append_only/);
        await assert.rejects(db.prepare('DELETE FROM change_events').run(), /history_append_only/);
        await assert.rejects(db.prepare('DELETE FROM mutation_operations').run(), /operation_immutable/);
    });
});
test('concurrent same-base requests produce exactly one success and a recoverable conflict', async () => {
    await database(async (db) => {
        assert.ok((await mutateRecord(db, context, input(0, 'create'), valid)).ok);
        const attempts = await Promise.all([
            mutateRecord(db, context, input(1, 'writer-a', { value: 'A' }), valid),
            mutateRecord(db, context, input(1, 'writer-b', { value: 'B' }), valid),
        ]);
        assert.equal(attempts.filter(r => r.ok).length, 1);
        const conflict = attempts.find(r => !r.ok);
        assert.ok(!conflict.ok);
        assert.equal(conflict.status, 409);
        assert.equal(conflict.body.error.code, 'revision_conflict');
        assert.equal(conflict.body.error.currentRevision, 2);
        assert.equal((await events(db)).length, 2);
        assert.equal((await db.prepare('SELECT count(*) AS n FROM mutation_operations').first()).n, 2);
        const record = await db.prepare('SELECT revision,data_json FROM records').first();
        assert.equal(record.revision, 2);
        const winner = attempts.find(r => r.ok);
        assert.ok(winner.ok);
        assert.deepEqual(JSON.parse(record.data_json), winner.record.data);
    });
});
test('concurrent create and concurrent identical retries do not duplicate submissions/events', async () => {
    await database(async (db) => {
        const attempts = await Promise.all(Array.from({ length: 6 }, () => mutateRecord(db, context, input(0, 'same-operation'), valid)));
        assert.ok(attempts.every(r => r.ok));
        assert.equal(attempts.filter(r => r.ok && !r.replayed).length, 1);
        assert.equal((await events(db)).length, 1);
        const other = await mutateRecord(db, context, input(0, 'another-create'), valid);
        assert.ok(!other.ok);
        assert.equal(other.body.error.code, 'revision_conflict');
    });
});
test('operation reuse with different content rejects, while reordered object keys replay', async () => {
    await database(async (db) => {
        const first = await mutateRecord(db, context, input(0, 'same', { a: 1, b: 2 }), valid);
        assert.ok(first.ok);
        assert.deepEqual(await mutateRecord(db, context, input(0, 'same', { b: 2, a: 1 }), valid), { ...first, replayed: true });
        const changed = await mutateRecord(db, context, input(0, 'same', { a: 3, b: 2 }), valid);
        assert.ok(!changed.ok);
        assert.equal(changed.body.error.code, 'operation_reused');
        const actorChanged = await mutateRecord(db, { ...context, actor: { kind: 'authenticated', subject: 'different-person' } }, input(0, 'same', { a: 1, b: 2 }), valid);
        assert.ok(!actorChanged.ok);
        assert.equal(actorChanged.body.error.code, 'operation_reused');
        assert.equal((await events(db)).length, 1);
    });
});
test('validation and malformed inputs do not write records, receipts or history', async () => {
    await database(async (db) => {
        const rejected = await mutateRecord(db, context, input(0, 'invalid'), () => [{ path: 'amount', code: 'required' }]);
        assert.ok(!rejected.ok);
        assert.equal(rejected.body.error.code, 'validation_failed');
        for (const badContext of [
            { ...context, stationId: 'CR2-kitchen' },
            { ...context, context: { kind: 'day', businessDate: '2026-02-30' } },
            { ...context, actor: { kind: 'entered-label', label: '' } },
        ])
            assert.equal((await mutateRecord(db, badContext, input(0, 'invalid'), valid)).ok, false);
        for (const payload of [input(-1, 'negative'), input(Number.MAX_SAFE_INTEGER, 'exhausted'), input(0, 'invalid', { amount: NaN })])
            assert.equal((await mutateRecord(db, context, payload, valid)).ok, false);
        for (const table of ['records', 'mutation_operations', 'change_events'])
            assert.equal((await db.prepare(`SELECT count(*) AS n FROM ${table}`).first()).n, 0);
    });
});
test('history failure rolls back the receipt and business update; same operation can safely retry', async () => {
    await database(async (db) => {
        assert.ok((await mutateRecord(db, context, input(0, 'create'), valid)).ok);
        await db.prepare("CREATE TRIGGER fixture_history_failure BEFORE INSERT ON change_events WHEN NEW.revision=2 BEGIN SELECT RAISE(ABORT,'fixture_failure'); END").run();
        const failed = await mutateRecord(db, context, input(1, 'retry-after-failure', { narrative: 'new' }), valid);
        assert.ok(!failed.ok);
        assert.equal(failed.body.error.code, 'unavailable');
        assert.equal((await db.prepare('SELECT revision FROM records').first()).revision, 1);
        assert.equal((await events(db)).length, 1);
        assert.equal((await db.prepare('SELECT count(*) AS n FROM mutation_operations').first()).n, 1);
        await db.prepare('DROP TRIGGER fixture_history_failure').run();
        const retried = await mutateRecord(db, context, input(1, 'retry-after-failure', { narrative: 'new' }), valid);
        assert.ok(retried.ok);
        assert.equal(retried.record.revision, 2);
        assert.equal((await events(db)).length, 2);
    });
});
test('operation identity is scoped by authorized caller, target record/store and action', async () => {
    await database(async (db) => {
        assert.ok((await mutateRecord(db, context, input(0, 'shared'), valid)).ok);
        assert.ok((await mutateRecord(db, { ...context, storeId: 'CR2', stationId: 'CR2-kitchen' }, input(0, 'shared'), valid)).ok);
        assert.ok((await mutateRecord(db, { ...context, id: 'fixture-form-other' }, input(0, 'shared'), valid)).ok);
        assert.ok((await mutateRecord(db, { ...context, callerScope: 'another-authorized-scope', action: 'amend' }, input(1, 'shared'), valid)).ok);
        assert.equal((await events(db)).length, 4);
    });
});
test('canonical JSON rejects lossy values and keeps arrays ordered', () => {
    assert.equal(canonicalJson({ z: [2, 1], a: null }), '{"a":null,"z":[2,1]}');
    const cycle = [];
    cycle.push(cycle);
    for (const invalid of [undefined, NaN, Infinity, [undefined], new Array(1), new Date(), cycle, { missing: undefined }])
        assert.throws(() => canonicalJson(invalid));
});
