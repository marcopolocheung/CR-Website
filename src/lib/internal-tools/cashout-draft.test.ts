import test from 'node:test'
import assert from 'node:assert/strict'
import { readUnassignedCashout, changeCount, countInput, parseCountInput, cashoutServerSheet, isCashoutDraftSheet } from './cashout-draft'
import { DENOMINATIONS, dayTotals } from '../cashout'
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
test('blank, explicit zero and historical unknown entry states survive serialization independently', () => {
  let cashier = { ...source().am[0], countInputs: DENOMINATIONS.map(() => '') as (string | null)[], counts: DENOMINATIONS.map(() => 0) }
  cashier = changeCount(cashier, 0, '0') as typeof cashier
  const sheet = { ...source(), am: [cashier] }
  const restored = readUnassignedCashout(JSON.stringify(sheet))!
  assert.equal(countInput(restored.am[0], 0), '0')
  assert.equal(countInput(restored.am[0], 1), '')
  assert.equal(restored.am[0].counts[0], restored.am[0].counts[1])
  const older = changeCount(source().am[0], 1, '0')
  assert.equal(older.countInputs?.[0], null)
  assert.equal(older.countInputs?.[1], '0')
  assert.equal(countInput(older, 0), '3')
})
test('invalid count text is retained for recovery and never truncated into another number', () => {
  for (const input of ['-1','1.5','2abc','1e3','100001','9007199254740993']) {
    assert.equal(parseCountInput(input), null)
    const cashier = changeCount(source().am[0], 0, input)
    assert.equal(cashier.counts[0], 0)
    assert.equal(countInput(cashier, 0), input)
    assert.ok(isCashoutDraftSheet({ ...source(), am: [cashier] }))
    assert.equal(readUnassignedCashout(JSON.stringify({ ...source(), am: [cashier] }))?.am[0].countInputs?.[0], input)
  }
  assert.equal(parseCountInput('100000'), 100000)
  assert.equal(parseCountInput('00'), 0)
  const inconsistent = { ...source(), am: [{ ...source().am[0], countInputs: ['1', ...DENOMINATIONS.slice(1).map(() => null)] }] }
  assert.equal(isCashoutDraftSheet(inconsistent), false)
})
test('server payload strips local status and preserves integer-cent totals and Toast/Z workbook semantics', () => {
  const am = changeCount(source().am[0], 0, '3')
  const pm = changeCount({ ...source().am[0], name: 'PM', toast: '0', counts: DENOMINATIONS.map(() => 0) }, 1, '2')
  const draft = { am: [am], pm: [pm], zReport: '200' }
  const wire = cashoutServerSheet(draft)
  assert.equal('countInputs' in wire.am[0], false)
  assert.deepEqual(Object.keys(wire.am[0]).sort(), ['counts','name','toast'])
  assert.deepEqual(dayTotals(draft.am, draft.pm, draft.zReport), dayTotals(wire.am, wire.pm, wire.zReport))
  assert.equal(dayTotals(wire.am, wire.pm, wire.zReport).deposit, 20000)
  wire.am[0].counts[0] = 99
  assert.equal(draft.am[0].counts[0], 3)
})
