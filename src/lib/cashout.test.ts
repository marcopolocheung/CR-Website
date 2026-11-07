import assert from 'node:assert/strict'
import test from 'node:test'
import { DENOMINATIONS, cashierTotals, dayTotals, formatCents, parseCashAmount, toCents, type Cashier } from './cashout'
import { saveCashoutDay } from './cashout-store'
import { StoreUnavailableError } from './schedule-store'

const counts = (byCents: Record<number, number>) => DENOMINATIONS.map(d => byCents[d] ?? 0)

// $612.50 in drawer -> $512.50 turn-in, $520 on Toast -> $7.50 short
const alice: Cashier = { name: 'Alice', counts: counts({ 10000: 5, 5000: 2, 1000: 1, 100: 2, 25: 2 }), toast: '520' }
// $210.30 -> $110.30 turn-in, Toast $110.10 -> $0.20 over
const bob: Cashier = { name: 'Bob', counts: counts({ 10000: 2, 500: 2, 10: 3 }), toast: '110.10' }

test('cashier drawer, turn-in and over/short', () => {
  assert.deepEqual(cashierTotals(alice), { drawer: 61250, turnIn: 51250, overShort: -750 })
  assert.deepEqual(cashierTotals(bob), { drawer: 21030, turnIn: 11030, overShort: 20 })
})

test('day totals add both shifts and compare deposit to the Z report', () => {
  assert.deepEqual(dayTotals([alice], [bob], '625.00'), {
    amDeposit: 51250, pmDeposit: 11030, amOverShort: -750, pmOverShort: 20,
    deposit: 62280, overShort: -730, zOverShort: -220,
  })
})

test('blank Toast or Z report leaves over/short unknown instead of $0', () => {
  const noToast = { ...bob, toast: '' }
  assert.equal(cashierTotals(noToast).overShort, null)
  const day = dayTotals([alice], [noToast], '')
  assert.equal(day.amOverShort, -750)
  assert.equal(day.pmOverShort, null)
  assert.equal(day.overShort, null)
  assert.equal(day.zOverShort, null)
  assert.equal(day.deposit, 62280)
})

test('money parsing and formatting', () => {
  assert.equal(toCents('0.1'), 10)
  assert.equal(toCents(''), 0)
  assert.equal(formatCents(-750), '-$7.50')
})

test('found cash resolves a Z shortage without rewriting cashier or shift comparisons', () => {
  const original = dayTotals([alice], [bob], '623.80')
  const adjusted = dayTotals([alice], [bob], '623.80', '1.00')
  assert.equal(original.zOverShort, -100)
  assert.deepEqual(adjusted, { ...original, deposit: 62380, zOverShort: 0 })
  assert.equal(dayTotals([alice], [bob], '623.80', '1.25').zOverShort, 25)
  assert.equal(dayTotals([alice], [bob], '', '1.00').zOverShort, null)
  assert.deepEqual(dayTotals([alice], [bob], '623.80', ''), original)
  assert.deepEqual(dayTotals([alice], [bob], '623.80', '0.00'), original)
})

test('cash amount entry accepts exact cents and rejects incomplete, signed or fractional-cent amounts', () => {
  for (const [text, cents] of [['', 0], ['0', 0], ['.25', 25], ['0.29', 29], ['1.', 100], ['60.00', 6000], ['10000000', 1000000000]] as const) {
    assert.equal(parseCashAmount(text), cents, text)
  }
  for (const text of ['.', '-1', '1.005', '1e3', 'Infinity', '1,000', ' 1', '100000000', '$1']) assert.equal(parseCashAmount(text), null, text)
})

test('extra money requires a server acknowledgement so older Workers cannot silently discard it', async (t) => {
  const sheet = { am: [alice], pm: [bob], zReport: '623.80', extraMoney: '1.00' }
  const input = { sheet, totals: dayTotals(sheet.am, sheet.pm, sheet.zReport, sheet.extraMoney) }
  let acknowledgement: Record<string, unknown> = { updatedAt: '2026-11-07T12:00:00Z' }
  t.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
    assert.equal(init.method, 'PUT')
    assert.equal(JSON.parse(init.body as string).sheet.extraMoney, sheet.extraMoney)
    return Response.json(acknowledgement)
  })
  await assert.rejects(saveCashoutDay('CR3', '2026-11-07', input, 'fixture-token'), StoreUnavailableError)
  acknowledgement = { ...acknowledgement, extraMoney: '2.00' }
  await assert.rejects(saveCashoutDay('CR3', '2026-11-07', input, 'fixture-token'), StoreUnavailableError)
  acknowledgement = { ...acknowledgement, extraMoney: '1.00' }
  await saveCashoutDay('CR3', '2026-11-07', input, 'fixture-token')
})
