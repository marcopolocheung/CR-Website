import assert from 'node:assert/strict'
import test from 'node:test'
import { DENOMINATIONS, cashierTotals, dayTotals, formatCents, toCents, type Cashier } from './cashout'

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
