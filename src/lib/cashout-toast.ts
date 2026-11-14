import type { CashoutDraftCashier, CashoutDraftSheet } from './internal-tools/cashout-draft'

/** Shape returned by the Worker's `GET /api/toast/cash/{store}/{date}`. Money is integer cents. */
export type ToastCashierFill = { name: string; cents: number; payments: number; first: string; last: string }
export type ToastCashFill = {
  store: string
  date: string
  am: ToastCashierFill[]
  pm: ToastCashierFill[]
  z: { cashPayments: number; refunds: number; cashIn: number; cashOut: number; payOuts: number; tipOuts: number; expected: number }
  fetchedAt: string
}

export function centsToInput(cents: number): string {
  return (cents < 0 ? '-' : '') + (Math.abs(cents) / 100).toFixed(2)
}

const key = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ')
const untouched = (c: CashoutDraftCashier) => !c.name.trim() && !c.toast.trim() && c.counts.every(n => n === 0)

/**
 * Puts Toast figures on the sheet without touching any counts. A Toast cashier
 * fills the drawer with the same name (either shift, so a manager's placement
 * wins), else an untouched blank drawer in its shift, else a new drawer.
 * Drawers Toast doesn't know about are left as they are. Z is replaced.
 */
export function applyToastFill(sheet: CashoutDraftSheet, fill: ToastCashFill, newCashier: () => CashoutDraftCashier) {
  const next: CashoutDraftSheet = { ...sheet, am: [...sheet.am], pm: [...sheet.pm], zReport: centsToInput(fill.z.expected) }
  let filled = 0
  let added = 0
  for (const shift of ['am', 'pm'] as const) {
    const other = shift === 'am' ? 'pm' : 'am'
    for (const row of fill[shift]) {
      const toast = centsToInput(row.cents)
      const sameShift = next[shift].findIndex(c => key(c.name) === key(row.name))
      const otherShift = sameShift < 0 ? next[other].findIndex(c => key(c.name) === key(row.name)) : -1
      if (sameShift >= 0) next[shift][sameShift] = { ...next[shift][sameShift], toast }
      else if (otherShift >= 0) next[other][otherShift] = { ...next[other][otherShift], toast }
      else {
        const blank = next[shift].findIndex(untouched)
        if (blank >= 0) next[shift][blank] = { ...next[shift][blank], name: row.name, toast }
        else { next[shift].push({ ...newCashier(), name: row.name, toast }); added += 1 }
      }
      filled += 1
    }
  }
  return { sheet: next, filled, added }
}
