import { DENOMINATIONS, parseCashAmount, type Cashier, type CashoutSheet } from '../cashout'
/** null means the original sheet did not retain entry status; '' is an empty new count. */
export type CashoutDraftCashier = Cashier & { countInputs?: (string | null)[]; amountInputs?: (string | null)[] }
export type CashoutDraftSheet = Omit<CashoutSheet, 'am' | 'pm'> & { am: CashoutDraftCashier[]; pm: CashoutDraftCashier[] }

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
  const amountInputs = cashier.amountInputs ? [...cashier.amountInputs] : undefined
  if (amountInputs) amountInputs[index] = null
  return { ...cashier, counts, countInputs, ...(amountInputs ? { amountInputs } : {}) }
}
export function parseDenominationAmount(value: string, denomination: number): number | null {
  const cents = parseCashAmount(value)
  if (cents === null || cents % denomination !== 0) return null
  const count = cents / denomination
  return count <= 100000 ? count : null
}
export function amountInput(cashier: CashoutDraftCashier, index: number): string {
  const raw = cashier.amountInputs?.[index]
  if (raw !== undefined && raw !== null) return raw
  const count = countInput(cashier, index)
  return count === '' || parseCountInput(count) === null ? '' : (cashier.counts[index] * DENOMINATIONS[index] / 100).toFixed(2)
}
export function changeAmount(cashier: CashoutDraftCashier, index: number, value: string): CashoutDraftCashier {
  const count = parseDenominationAmount(value, DENOMINATIONS[index])
  const next = changeCount(cashier, index, value === '' || count === null ? '' : String(count))
  const amountInputs = [...(next.amountInputs ?? DENOMINATIONS.map(() => null))]
  amountInputs[index] = value
  return { ...next, amountInputs }
}
/** Keep device-only raw entry/status metadata out of the established server/workbook contract. */
export function cashoutServerSheet(sheet: CashoutDraftSheet): CashoutSheet {
  const strip = (cashier: CashoutDraftCashier): Cashier => ({ name: cashier.name, counts: [...cashier.counts], toast: cashier.toast })
  return { am: sheet.am.map(strip), pm: sheet.pm.map(strip), zReport: sheet.zReport, ...(sheet.extraMoney === undefined ? {} : { extraMoney: sheet.extraMoney }) }
}
export function isCashoutDraftSheet(value: unknown): value is CashoutDraftSheet {
  if (!value || typeof value !== 'object') return false
  const sheet = value as CashoutDraftSheet
  if (Object.keys(sheet).some(key => !['am','pm','zReport','extraMoney'].includes(key))) return false
  const cashier = (value: unknown) => {
    if (!value || typeof value !== 'object') return false
    const c = value as CashoutDraftCashier
    return Object.keys(c).every(key => ['name','counts','toast','countInputs','amountInputs'].includes(key)) && typeof c.name === 'string' && typeof c.toast === 'string'
      && Array.isArray(c.counts) && c.counts.length === DENOMINATIONS.length && c.counts.every(n => Number.isSafeInteger(n) && n >= 0)
      && (c.countInputs === undefined || (Array.isArray(c.countInputs) && c.countInputs.length === DENOMINATIONS.length
        && c.countInputs.every((input, index) => input === null || (typeof input === 'string' && (parseCountInput(input) ?? 0) === c.counts[index]))))
      && (c.amountInputs === undefined || (Array.isArray(c.amountInputs) && c.amountInputs.length === DENOMINATIONS.length
        && c.amountInputs.every((input, index) => input === null || (typeof input === 'string' && (parseDenominationAmount(input, DENOMINATIONS[index]) ?? 0) === c.counts[index]))))
  }
  return Array.isArray(sheet.am) && Array.isArray(sheet.pm) && sheet.am.every(cashier) && sheet.pm.every(cashier) && typeof sheet.zReport === 'string'
    && (sheet.extraMoney === undefined || typeof sheet.extraMoney === 'string')
}

/** The old key contains a sheet only. Context must come from an explicit user choice. */
export function readUnassignedCashout(raw: string): CashoutDraftSheet | null {
  try { const value: unknown = JSON.parse(raw); return isCashoutDraftSheet(value) ? value : null }
  catch { return null }
}
