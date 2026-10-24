import { DENOMINATIONS, type Cashier } from '../cashout'
/** null means the original sheet did not retain entry status; '' is an empty new count. */
export type CashoutDraftCashier = Cashier & { countInputs?: (string | null)[] }
export type CashoutDraftSheet = { am: CashoutDraftCashier[]; pm: CashoutDraftCashier[]; zReport: string }

export function parseCountInput(value: string): number | null {
  if (value === '') return 0 // Preserve the existing financial meaning; entry status is separate.
  if (!/^\d+$/.test(value)) return null
  const count = Number(value)
  return Number.isSafeInteger(count) && count <= 100000 ? count : null
}
export function countInput(cashier: CashoutDraftCashier, index: number): string {
  return cashier.countInputs?.[index] ?? String(cashier.counts[index])
}
export function changeCount(cashier: CashoutDraftCashier, index: number, value: string): CashoutDraftCashier {
  const countInputs = [...(cashier.countInputs ?? DENOMINATIONS.map(() => null))]
  const counts = [...cashier.counts]
  countInputs[index] = value
  counts[index] = parseCountInput(value) ?? 0
  return { ...cashier, counts, countInputs }
}
/** Keep device-only raw entry/status metadata out of the established server/workbook contract. */
export function cashoutServerSheet(sheet: CashoutDraftSheet): { am: Cashier[]; pm: Cashier[]; zReport: string } {
  const strip = (cashier: CashoutDraftCashier): Cashier => ({ name: cashier.name, counts: [...cashier.counts], toast: cashier.toast })
  return { am: sheet.am.map(strip), pm: sheet.pm.map(strip), zReport: sheet.zReport }
}
export function isCashoutDraftSheet(value: unknown): value is CashoutDraftSheet {
  if (!value || typeof value !== 'object') return false
  const sheet = value as CashoutDraftSheet
  if (Object.keys(sheet).some(key => !['am','pm','zReport'].includes(key))) return false
  const cashier = (value: unknown) => {
    if (!value || typeof value !== 'object') return false
    const c = value as CashoutDraftCashier
    return Object.keys(c).every(key => ['name','counts','toast','countInputs'].includes(key)) && typeof c.name === 'string' && typeof c.toast === 'string'
      && Array.isArray(c.counts) && c.counts.length === DENOMINATIONS.length && c.counts.every(n => Number.isSafeInteger(n) && n >= 0)
      && (c.countInputs === undefined || (Array.isArray(c.countInputs) && c.countInputs.length === DENOMINATIONS.length
        && c.countInputs.every((input, index) => input === null || (typeof input === 'string' && (parseCountInput(input) ?? 0) === c.counts[index]))))
  }
  return Array.isArray(sheet.am) && Array.isArray(sheet.pm) && sheet.am.every(cashier) && sheet.pm.every(cashier) && typeof sheet.zReport === 'string'
}

/** The old key contains a sheet only. Context must come from an explicit user choice. */
export function readUnassignedCashout(raw: string): CashoutDraftSheet | null {
  try { const value: unknown = JSON.parse(raw); return isCashoutDraftSheet(value) ? value : null }
  catch { return null }
}
