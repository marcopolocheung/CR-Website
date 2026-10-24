import { DENOMINATIONS, type Cashier } from '../cashout'
export type CashoutDraftSheet = { am: Cashier[]; pm: Cashier[]; zReport: string }
export function isCashoutDraftSheet(value: unknown): value is CashoutDraftSheet {
  if (!value || typeof value !== 'object') return false
  const sheet = value as CashoutDraftSheet
  if (Object.keys(sheet).some(key => !['am','pm','zReport'].includes(key))) return false
  const cashier = (value: unknown) => {
    if (!value || typeof value !== 'object') return false
    const c = value as Cashier
    return Object.keys(c).every(key => ['name','counts','toast'].includes(key)) && typeof c.name === 'string' && typeof c.toast === 'string'
      && Array.isArray(c.counts) && c.counts.length === DENOMINATIONS.length && c.counts.every(n => Number.isSafeInteger(n) && n >= 0)
  }
  return Array.isArray(sheet.am) && Array.isArray(sheet.pm) && sheet.am.every(cashier) && sheet.pm.every(cashier) && typeof sheet.zReport === 'string'
}
