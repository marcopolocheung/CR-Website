import test from 'node:test'
import assert from 'node:assert/strict'
import { businessDate, utcTimestamp, usdCents, revision, employeeId, recordId, operationId, stationFromLegacyQuery, STATION_STORES, POLICY_OWNERS, unresolved, apiError, ERROR_STATUS } from './contracts'
import { decodeCapabilities, canWriteV1, preserveLegacy, restoreLegacy, adaptLegacyError } from './compatibility'

test('dates validate calendar dates independently of timezone or business-day policy', () => {
  for (const value of ['2024-02-29', '2026-10-24', '0001-01-01']) assert.equal(businessDate(value), value)
  for (const value of ['2026-02-29', '2024-02-30', '2026-13-01', '2026-1-01', '0000-01-01', '', null, 0]) assert.equal(businessDate(value), null)
  assert.equal(utcTimestamp('2026-10-24T12:00:00.000Z'), '2026-10-24T12:00:00.000Z')
  for (const value of ['2026-02-30T12:00:00.000Z', '2026-10-24', '2026-10-24T12:00:00-05:00']) assert.equal(utcTimestamp(value), null)
})
test('money, revision, and identity reject coercion and preserve missing versus zero', () => {
  for (const value of [0, -100, Number.MAX_SAFE_INTEGER]) assert.equal(usdCents(value), value)
  for (const value of [null, '', '0', 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.equal(usdCents(value), null)
  assert.equal(revision(0), 0)
  for (const value of [-1, '1', 1.1, null]) assert.equal(revision(value), null)
  for (const parse of [employeeId, recordId, operationId]) {
    assert.equal(parse('synthetic_opaque-1'), 'synthetic_opaque-1')
    for (const value of ['', 'employee name', 'x/y', 'x'.repeat(129), null]) assert.equal(parse(value), null)
  }
})
test('legacy restaurant query preserves all explicit station/store mappings and defaults', () => {
  assert.equal(stationFromLegacyQuery(null), 'CR3-diningroom')
  assert.equal(stationFromLegacyQuery(''), 'CR3-diningroom')
  for (const station of Object.keys(STATION_STORES)) assert.equal(stationFromLegacyQuery(station), station)
  for (const value of ['CR3', 'China Rose', '__proto__']) assert.equal(stationFromLegacyQuery(value), null)
})
test('capability detection fails closed, distinguishes unavailable, and requires atomic/idempotent writes', () => {
  assert.deepEqual(decodeCapabilities(404, null), { state: 'legacy' })
  for (const status of [401, 500, 503]) assert.equal(decodeCapabilities(status, {}).state, 'unavailable')
  for (const body of [null, {}, { schemaVersion: 2 }, { schemaVersion: 1, services: [] }, { schemaVersion: 1, services: { count: {} } }]) assert.equal(decodeCapabilities(200, body).state, 'unavailable')
  const fixture = { schemaVersion: 1, services: { count: { readVersions: [1], writeVersions: [1], atomicRevisions: true, idempotentOperations: true } } }
  assert.equal(canWriteV1(decodeCapabilities(200, fixture), 'count'), true)
  assert.equal(canWriteV1(decodeCapabilities(200, fixture), '__proto__'), false)
  fixture.services.count.atomicRevisions = false
  assert.equal(canWriteV1(decodeCapabilities(200, fixture), 'count'), false)
  assert.equal(canWriteV1(decodeCapabilities(404, null), 'count'), false)
})
test('legacy fixtures round-trip intact without claiming stronger persistence guarantees', () => {
  const fixtures = [
    { v: 2, id: 'abcdefghij', ciphertext: 'ciphertext_remains_opaque', rev: 3, visible: false, monthKey: '2026-10' },
    { v: 3, rev: 2, weekStart: '2026-10-25', week: { people: ['Original name'], slotPeople: [0] }, futureField: true },
    { employees: [], rev: 0, updatedAt: null, weekStart: '2026-10-25', inherited: true },
    { template: null, rev: 0, inherited: true },
    { sheet: { am: [], pm: [], zReport: '' }, totals: { cash: 0 }, updatedAt: 'source-time' },
    { date: '2026-10-24', counts: { unknown: '3B/2T', zero: '0', blank: '', enough: 'Enough' } },
    { id: 'form-1', form: { employee: 'Nombre original', incident: 'Texto original' }, label: 'Original', labelUpdatedAt: null },
  ]
  for (const fixture of fixtures) {
    const before = structuredClone(fixture)
    const snapshot = preserveLegacy(fixture)
    assert.deepEqual(restoreLegacy(snapshot), before)
    assert.equal(snapshot.guarantees, 'legacy-kv')
    assert.deepEqual(fixture, before)
  }
  assert.equal(preserveLegacy(fixtures[4]).knownRevision, null)
})
test('errors and policy gates remain language independent and preserve rejected input', () => {
  assert.equal(Object.keys(POLICY_OWNERS).length, 7)
  for (const decision of Object.values(POLICY_OWNERS)) assert.deepEqual(unresolved(decision), { state: 'unresolved', decision, value: null })
  const original = { error: 'conflict', rev: 4, updatedAt: 'source-time' }
  assert.deepEqual(adaptLegacyError(409, original), { envelope: apiError('revision_conflict', { currentRevision: revision(4)! }), legacyBody: original })
  for (const [status, code] of [[401, 'unauthorized'], [503, 'backend_unconfigured'], [500, 'unavailable']] as const) assert.equal(adaptLegacyError(status, null).envelope.error.code, code)
  assert.equal(ERROR_STATUS.policy_unresolved, 409)
})
