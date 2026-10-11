import assert from 'node:assert/strict'
import test from 'node:test'
import { dailyRows, datesEnding, summarize } from './dashboard'
import type { CashoutDay } from './cashout-store'

const day = (date: string, am: number, pm: number, overShort: number | null): CashoutDay => ({
  date,
  updatedAt: '',
  totals: { amDeposit: am, pmDeposit: pm, amOverShort: null, pmOverShort: null, deposit: am + pm, overShort, zOverShort: null },
})

test('datesEnding is oldest first and crosses month ends', () => {
  assert.deepEqual(datesEnding('2026-10-02', 3), ['2026-09-30', '2026-10-01', '2026-10-02'])
})

test('dailyRows sums stores and keeps blank over/short as null', () => {
  const cr3 = [day('2026-10-01', 100, 200, -50), day('2026-10-02', 10, 20, null)]
  const cr2 = [day('2026-10-01', 1000, 2000, 25)]
  const rows = dailyRows([cr3, cr2], ['2026-10-01', '2026-10-02', '2026-10-03'])
  assert.deepEqual(rows[0], { date: '2026-10-01', saved: 2, amDeposit: 1100, pmDeposit: 2200, deposit: 3300, overShort: -25, zOverShort: null })
  assert.equal(rows[1].overShort, null)
  assert.equal(rows[2].saved, 0)
})

test('summarize averages saved days and counts missing store-days before today', () => {
  const cr3 = [day('2026-10-01', 100, 200, -50), day('2026-10-02', 10, 20, null)]
  const cr2 = [day('2026-10-01', 1000, 2000, 25)]
  const rows = dailyRows([cr3, cr2], datesEnding('2026-10-03', 3))
  assert.deepEqual(summarize(rows, 2, '2026-10-03'), { deposit: 3330, avgDeposit: 1665, overShort: -25, shortDays: 1, missing: 1 })
  assert.deepEqual(summarize(dailyRows([[]], ['2026-10-01']), 1, '2026-10-03'), { deposit: 0, avgDeposit: null, overShort: null, shortDays: 0, missing: 1 })
})
