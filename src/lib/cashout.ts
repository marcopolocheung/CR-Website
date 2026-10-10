// All money is integer cents so sums never pick up float error.
export const FLOAT_CENTS = 10000
export const DENOMINATIONS = [10000, 5000, 2000, 1000, 500, 100, 50, 25, 10, 5, 1]

export type Cashier = { name: string; counts: number[]; toast: string }

export function toCents(dollars: string): number {
  const n = parseFloat(dollars)
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

export function formatCents(cents: number): string {
  return (cents < 0 ? '-$' : '$') + (Math.abs(cents) / 100).toFixed(2)
}

// Over/short is null until its Toast or Z figure is typed, so a blank never reads as $0.
export function cashierTotals(c: Cashier) {
  const drawer = DENOMINATIONS.reduce((sum, d, i) => sum + d * (c.counts[i] || 0), 0)
  const turnIn = drawer - FLOAT_CENTS
  return { drawer, turnIn, overShort: c.toast.trim() === '' ? null : turnIn - toCents(c.toast) }
}

const addOrNull = (a: number | null, b: number | null) => (a === null || b === null ? null : a + b)

export function shiftTotals(cashiers: Cashier[]) {
  return cashiers.map(cashierTotals).reduce<{ deposit: number; overShort: number | null }>(
    (t, c) => ({ deposit: t.deposit + c.turnIn, overShort: addOrNull(t.overShort, c.overShort) }),
    { deposit: 0, overShort: 0 },
  )
}

export function dayTotals(am: Cashier[], pm: Cashier[], zReport: string) {
  const a = shiftTotals(am)
  const p = shiftTotals(pm)
  const deposit = a.deposit + p.deposit
  return {
    amDeposit: a.deposit,
    pmDeposit: p.deposit,
    amOverShort: a.overShort,
    pmOverShort: p.overShort,
    deposit,
    overShort: addOrNull(a.overShort, p.overShort),
    zOverShort: zReport.trim() === '' ? null : deposit - toCents(zReport),
  }
}
