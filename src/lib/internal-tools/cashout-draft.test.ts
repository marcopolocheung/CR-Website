import test from 'node:test'
import assert from 'node:assert/strict'
import { readUnassignedCashout } from './cashout-draft'
import { DENOMINATIONS } from '../cashout'
const source = () => ({ am: [{ name: 'Nombre original', counts: DENOMINATIONS.map((_,i) => i === 0 ? 3 : 0), toast: '125.50' }], pm: [], zReport: '600.25' })
test('unassigned legacy sheet retains counts, AM/PM, source names and Toast/Z text without inventing context', () => {
  const original = source(); const raw = JSON.stringify(original)
  const sheet = readUnassignedCashout(raw)
  assert.deepEqual(sheet, original)
  assert.equal(sheet?.am[0].counts[0], 3)
  assert.equal(sheet?.am[0].toast, '125.50')
  assert.equal(sheet?.zReport, '600.25')
  assert.equal('store' in sheet!, false)
  assert.equal('date' in sheet!, false)
  assert.equal(raw, JSON.stringify(original))
})
test('malformed legacy sources are rejected without coercing invalid values to zero or fabricating a sheet', () => {
  for (const raw of ['{broken source', 'null', '[]', '{}', JSON.stringify({ ...source(), am: [{ ...source().am[0], counts: [0] }] }), JSON.stringify({ ...source(), am: [{ ...source().am[0], counts: DENOMINATIONS.map(() => null) }] }), JSON.stringify({ ...source(), zReport: 0 })]) assert.equal(readUnassignedCashout(raw), null)
})
test('unknown context and credential-bearing legacy objects remain unassigned for recovery', () => {
  for (const additional of [{ store: 'CR3', date: '2026-10-24' }, { managerToken: 'synthetic-not-to-be-persisted' }, { am: [{ ...source().am[0], secret: 'synthetic' }] }]) assert.equal(readUnassignedCashout(JSON.stringify({ ...source(), ...additional })), null)
})
