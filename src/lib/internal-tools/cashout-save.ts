import type { CashoutStore, CashoutTotals } from '../cashout-store'
import { isCashoutStore, isCashoutTotals, isSavedCashoutSheet, sameCashoutPayload, type SavedCashoutRecord } from '../cashout-record'
import { businessDate, utcTimestamp } from './contracts'
import { isCashoutDraftSheet, cashoutServerSheet, type CashoutDraftSheet } from './cashout-draft'
import { dayTotals } from '../cashout'
import type { Draft } from './drafts'

export type CashAttempt = { input: { sheet: ReturnType<typeof cashoutServerSheet>; totals: CashoutTotals }; source: CashoutDraftSheet; createdAt: string }
export type CashRecovery = { v: 1; draftId: string; store: CashoutStore; date: string; baseline?: string | null; attempt?: CashAttempt }
export const cashRecoveryKey = (draft: Draft<CashoutDraftSheet>) => `cr-cash-save:${draft.context.storeId}:${draft.context.businessDate}:${draft.id}`
export function cashRecovery(draft: Draft<CashoutDraftSheet>, baseline?: string | null): CashRecovery {
  return { v: 1, draftId: draft.id, store: draft.context.storeId, date: draft.context.businessDate!, ...(baseline === undefined ? {} : { baseline }) }
}
export function freezeCashAttempt(sheet: CashoutDraftSheet): CashAttempt {
  // No editor references escape into a submitted attempt.
  return structuredClone({ input: { sheet: cashoutServerSheet(sheet), totals: dayTotals(sheet.am,sheet.pm,sheet.zReport,sheet.extraMoney) }, source: sheet, createdAt: new Date().toISOString() })
}
function validRecovery(value: unknown, draft: Draft<CashoutDraftSheet>): value is CashRecovery {
  if (!value || typeof value !== 'object') return false
  const v = value as CashRecovery
  if (Object.keys(v).some(k => !['v','draftId','store','date','baseline','attempt'].includes(k)) || v.v !== 1 || v.draftId !== draft.id || !isCashoutStore(v.store) || v.store !== draft.context.storeId || !businessDate(v.date) || v.date !== draft.context.businessDate) return false
  if (v.baseline !== undefined && v.baseline !== null && (typeof v.baseline !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(v.baseline))) return false
  const a = v.attempt
  return a === undefined || (!!a && typeof a === 'object' && Object.keys(a).every(k => ['input','source','createdAt'].includes(k))
    && utcTimestamp(a.createdAt) !== null && isCashoutDraftSheet(a.source)
    && !!a.input && Object.keys(a.input).every(k => ['sheet','totals'].includes(k)) && isSavedCashoutSheet(a.input.sheet) && isCashoutTotals(a.input.totals)
    && sameCashoutPayload(a.input, freezeCashAttempt(a.source).input))
}
export type RecoveryRead = { state: 'ready'; value: CashRecovery } | { state: 'unreadable' | 'unavailable'; raw: string | null }
export function readCashRecovery(storage: Pick<Storage,'getItem'>, draft: Draft<CashoutDraftSheet>): RecoveryRead {
  let raw: string | null = null
  try {
    raw = storage.getItem(cashRecoveryKey(draft))
    if (raw === null) {
      // DraftChooser deliberately resumes into a fresh ID. Carry recovery from
      // its exact same-context source without rewriting that source's bytes.
      if (draft.sourceId) {
        const source = readCashRecovery(storage,{ ...draft, id: draft.sourceId, sourceId: null })
        return source.state === 'ready' ? { state: 'ready', value: { ...source.value, draftId: draft.id } } : source
      }
      return { state: 'ready', value: cashRecovery(draft) }
    }
    const value: unknown = JSON.parse(raw)
    return validRecovery(value,draft) ? { state: 'ready', value } : { state: 'unreadable', raw }
  } catch { return { state: raw === null ? 'unavailable' : 'unreadable', raw } }
}
export function writeCashRecovery(storage: Pick<Storage,'getItem'|'setItem'>, draft: Draft<CashoutDraftSheet>, value: CashRecovery): boolean {
  // Never overwrite corrupt, future-version or context-mismatched original bytes.
  if (!validRecovery(value,draft) || readCashRecovery(storage,draft).state !== 'ready') return false
  try { storage.setItem(cashRecoveryKey(draft),JSON.stringify(value)); return true } catch { return false }
}
export function assessCashSave(record: SavedCashoutRecord | null, recovery: CashRecovery): 'matched' | 'retry' | 'diverged' | 'replace' | 'changed' | 'new' {
  if (recovery.attempt) return record ? sameCashoutPayload(record,recovery.attempt.input) ? 'matched' : 'diverged' : 'retry'
  return record ? recovery.baseline !== undefined && record.fingerprint !== recovery.baseline ? 'changed' : 'replace' : 'new'
}
