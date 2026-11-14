import assert from 'node:assert/strict'
import test from 'node:test'
import { applyToastFill, centsToInput, type ToastCashFill } from './cashout-toast'
import { DENOMINATIONS } from './cashout'
import type { CashoutDraftCashier, CashoutDraftSheet } from './internal-tools/cashout-draft'

const blank = (name = ''): CashoutDraftCashier => ({ name, counts: DENOMINATIONS.map(() => 0), countInputs: DENOMINATIONS.map(() => ''), toast: '' })
const counted = (name: string): CashoutDraftCashier => ({ ...blank(name), counts: DENOMINATIONS.map((_, i) => (i === 0 ? 3 : 0)), countInputs: DENOMINATIONS.map((_, i) => (i === 0 ? '3' : '')) })
const z = { cashPayments: 0, refunds: 0, cashIn: 0, cashOut: 0, payOuts: 0, tipOuts: 0, expected: 0 }
const row = (name: string, cents: number) => ({ name, cents, payments: 1, first: '11:00', last: '15:00' })
const fill = (am: ReturnType<typeof row>[], pm: ReturnType<typeof row>[], expected = 0): ToastCashFill =>
  ({ store: 'CR3', date: '2026-11-13', am, pm, z: { ...z, expected }, fetchedAt: '2026-11-14T00:00:00.000Z' })

test('cents become plain dollar inputs the sheet accepts', () => {
  assert.equal(centsToInput(77326), '773.26')
  assert.equal(centsToInput(5), '0.05')
  assert.equal(centsToInput(0), '0.00')
  assert.equal(centsToInput(-550), '-5.50')
})

test('an empty sheet takes Toast names, amounts and Z, reusing the starter blank drawer', () => {
  const sheet: CashoutDraftSheet = { am: [blank()], pm: [blank()], zReport: '', extraMoney: '' }
  const result = applyToastFill(sheet, fill([row('Ana', 21250), row('Luis', 20000)], [row('Mia', 41250)], 82500), blank)
  assert.deepEqual(result.sheet.am.map(c => [c.name, c.toast]), [['Ana', '212.50'], ['Luis', '200.00']])
  assert.deepEqual(result.sheet.pm.map(c => [c.name, c.toast]), [['Mia', '412.50']])
  assert.equal(result.sheet.zReport, '825.00')
  assert.equal(result.filled, 3)
  assert.equal(result.added, 1)
})

test('existing drawers keep their counts; names match ignoring case and spaces, even in the other shift', () => {
  const sheet: CashoutDraftSheet = { am: [counted('ana ')], pm: [counted('LUIS'), counted('Walk-in helper')], zReport: '1.00', extraMoney: '5' }
  const result = applyToastFill(sheet, fill([row('Ana', 1000), row('Luis', 2000)], []), blank)
  assert.deepEqual(result.sheet.am.map(c => [c.name, c.toast, c.counts[0]]), [['ana ', '10.00', 3]])
  assert.deepEqual(result.sheet.pm.map(c => [c.name, c.toast, c.counts[0]]), [['LUIS', '20.00', 3], ['Walk-in helper', '', 3]])
  assert.equal(result.sheet.zReport, '0.00')
  assert.equal(result.sheet.extraMoney, '5')
  assert.equal(result.added, 0)
})

test('a counted but unnamed drawer is not overwritten; Toast cashiers are added after it', () => {
  const sheet: CashoutDraftSheet = { am: [counted('')], pm: [], zReport: '', extraMoney: '' }
  const result = applyToastFill(sheet, fill([row('Ana', 1000)], []), blank)
  assert.deepEqual(result.sheet.am.map(c => [c.name, c.toast]), [['', ''], ['Ana', '10.00']])
})
