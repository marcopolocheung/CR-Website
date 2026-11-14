import { businessDate } from './internal-tools/contracts'
import { canonicalJson } from './internal-tools/json'
import { DENOMINATIONS, parseCashAmount, type CashoutSheet } from './cashout'
import type { CashoutDay, CashoutStore, CashoutTotals } from './cashout-store'

export type SavedCashoutRecord = { store: CashoutStore; date: string; sheet: CashoutSheet; totals: CashoutTotals; updatedAt: string; fingerprint: string }
export const isCashoutStore = (value: unknown): value is CashoutStore => value === 'CR2' || value === 'CR3'
const money = (value: unknown) => typeof value === 'string' && /^-?\d{0,7}(\.\d{0,2})?$/.test(value)
export function isSavedCashoutSheet(value: unknown): value is CashoutSheet {
  if (!value || typeof value !== 'object') return false
  const s = value as CashoutSheet
  const drawer = (c: CashoutSheet['am'][number]) => c && typeof c === 'object' && typeof c.name === 'string' && c.name.length <= 60 && money(c.toast)
    && Array.isArray(c.counts) && c.counts.length === DENOMINATIONS.length && c.counts.every(n => Number.isSafeInteger(n) && n >= 0 && n <= 100000)
    && Object.keys(c).every(k => ['name','counts','toast'].includes(k))
  return Object.keys(s).every(k => ['am','pm','zReport','extraMoney'].includes(k)) && money(s.zReport)
    && (s.extraMoney === undefined || (typeof s.extraMoney === 'string' && parseCashAmount(s.extraMoney) !== null))
    && [s.am,s.pm].every(shift => Array.isArray(shift) && shift.length <= 20 && shift.every(drawer))
}
function savedTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false
  const date = new Date(value)
  return Number.isFinite(date.getTime()) && date.toISOString() === value.replace(/(?<=:\d{2})Z$/,'.000Z')
}
export function isCashoutTotals(value: unknown): value is CashoutTotals {
  if (!value || typeof value !== 'object') return false
  const t = value as CashoutTotals
  return ['amDeposit','pmDeposit','deposit'].every(k => Number.isSafeInteger(t[k as keyof CashoutTotals]))
    && ['amOverShort','pmOverShort','overShort','zOverShort'].every(k => t[k as keyof CashoutTotals] === null || Number.isSafeInteger(t[k as keyof CashoutTotals]))
    && Object.keys(t).every(k => ['amDeposit','pmDeposit','deposit','amOverShort','pmOverShort','overShort','zOverShort'].includes(k))
}
export function lookupDates(to: string): string[] {
  if (!businessDate(to)) throw new Error('invalid_cash_date')
  const end = Date.parse(to + 'T00:00:00Z')
  return Array.from({ length: 30 }, (_, i) => new Date(end - i * 86400000).toISOString().slice(0,10))
}
/** Parameters select an exact current store/day, never a historical revision. */
export function parseCashoutLookup(search: string): { store: CashoutStore; date: string | null } | null {
  const params = new URLSearchParams(search)
  if (params.getAll('store').length > 1 || params.getAll('date').length > 1) return null
  const store = params.get('store'), date = params.get('date')
  if (date !== null && (!isCashoutStore(store) || !businessDate(date))) return null
  if (store !== null && !isCashoutStore(store)) return null
  return { store: (store ?? 'CR3') as CashoutStore, date }
}
export async function comparisonFingerprint(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalJson(value)))
  return 'sha256:' + Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2,'0')).join('')
}
export async function readCashoutRecord(value: unknown, store: CashoutStore, date: string): Promise<SavedCashoutRecord> {
  if (!isCashoutStore(store) || !businessDate(date) || !value || typeof value !== 'object') throw new Error('invalid_cash_record')
  const d = value as SavedCashoutRecord
  if (d.store !== store || d.date !== date || !savedTimestamp(d.updatedAt) || !isSavedCashoutSheet(d.sheet) || !isCashoutTotals(d.totals)) throw new Error('invalid_cash_record')
  const record = { store, date, sheet: structuredClone(d.sheet), totals: structuredClone(d.totals), updatedAt: d.updatedAt }
  return { ...record, fingerprint: await comparisonFingerprint(record) }
}
export function readCashoutHistory(value: unknown, to: string): CashoutDay[] {
  const dates = new Set(lookupDates(to))
  if (!value || typeof value !== 'object' || !('days' in value) || !Array.isArray(value.days) || value.days.length > 30) throw new Error('invalid_cash_history')
  const seen = new Set<string>()
  for (const d of value.days) {
    if (!d || !dates.has(d.date) || seen.has(d.date) || !isCashoutTotals(d.totals) || !savedTimestamp(d.updatedAt)) throw new Error('invalid_cash_history')
    seen.add(d.date)
  }
  return structuredClone(value.days).sort((a,b) => b.date.localeCompare(a.date))
}
/** Payload equality ignores only the legacy optional empty Extra money field. */
export function sameCashoutPayload(a: { sheet: CashoutSheet; totals: CashoutTotals }, b: { sheet: CashoutSheet; totals: CashoutTotals }): boolean {
  const normalize = (v: typeof a) => ({ sheet: { ...v.sheet, extraMoney: v.sheet.extraMoney ?? '' }, totals: v.totals })
  return canonicalJson(normalize(a)) === canonicalJson(normalize(b))
}
