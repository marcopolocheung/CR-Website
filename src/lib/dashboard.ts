import type { CashoutDay } from './cashout-store'

/** One date across the chosen stores. `saved` counts how many of those stores saved a cash-out that day. */
export type DayRow = {
  date: string
  saved: number
  amDeposit: number
  pmDeposit: number
  deposit: number
  overShort: number | null
  zOverShort: number | null
}

const addOrNull = (a: number | null, b: number | null) => (a === null || b === null ? null : a + b)

/** The `n` dates ending at `to`, oldest first (UTC date math, like the Worker). */
export function datesEnding(to: string, n: number): string[] {
  const end = Date.parse(`${to}T00:00:00Z`)
  return Array.from({ length: n }, (_, i) => new Date(end - (n - 1 - i) * 86400000).toISOString().slice(0, 10))
}

/** One row per date, summing every store's saved day. Over/short stays null if any saved store left it blank. */
export function dailyRows(histories: CashoutDay[][], dates: string[]): DayRow[] {
  return dates.map(date =>
    histories
      .flatMap(h => h.filter(d => d.date === date))
      .reduce<DayRow>(
        (r, { totals: t }) => ({
          date,
          saved: r.saved + 1,
          amDeposit: r.amDeposit + t.amDeposit,
          pmDeposit: r.pmDeposit + t.pmDeposit,
          deposit: r.deposit + t.deposit,
          overShort: addOrNull(r.overShort, t.overShort),
          zOverShort: addOrNull(r.zOverShort, t.zOverShort),
        }),
        { date, saved: 0, amDeposit: 0, pmDeposit: 0, deposit: 0, overShort: 0, zOverShort: 0 },
      ),
  )
}

/** Headline numbers for a run of rows. Missing cash-outs skip `today`, which may not be counted yet. */
export function summarize(rows: DayRow[], stores: number, today: string) {
  const saved = rows.filter(r => r.saved > 0)
  const deposit = saved.reduce((s, r) => s + r.deposit, 0)
  const known = saved.filter(r => r.overShort !== null)
  return {
    deposit,
    avgDeposit: saved.length ? Math.round(deposit / saved.length) : null,
    overShort: known.length ? known.reduce((s, r) => s + r.overShort!, 0) : null,
    shortDays: known.filter(r => r.overShort! < 0).length,
    missing: rows.filter(r => r.date < today).reduce((s, r) => s + stores - r.saved, 0),
  }
}
