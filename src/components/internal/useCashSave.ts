'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import type { Draft } from '@/lib/internal-tools/drafts'
import type { CashoutDraftSheet } from '@/lib/internal-tools/cashout-draft'
import { cashRecovery, readCashRecovery, writeCashRecovery, freezeCashAttempt, assessCashSave, type CashRecovery } from '@/lib/internal-tools/cashout-save'
import { fetchSavedCashoutRecord, fetchCashoutHistory, saveCashoutDay } from '@/lib/cashout-store'
import { sameCashoutPayload, type SavedCashoutRecord } from '@/lib/cashout-record'
import { canonicalJson } from '@/lib/internal-tools/json'
import { managerSession } from '@/lib/internal-tools/manager-session'
import { StoreAuthError } from '@/lib/schedule-store'
import { errorKey, type Message } from '@/lib/internal-tools/i18n'
import { useConfirmation, type SaveState } from './Feedback'

export function useCashSave(draft: Draft<CashoutDraftSheet>, latest: MutableRefObject<CashoutDraftSheet>, token: string, onLocked: () => void, readOnly: boolean) {
  const [state,setState] = useState<SaveState>('unsaved')
  const [status,setStatus] = useState<Message | null>(null)
  const [busy,setBusy] = useState(false)
  const [comparison,setComparison] = useState<{ saved: SavedCashoutRecord; attempt: CashoutDraftSheet } | null>(null)
  const [recoveryIssue,setRecoveryIssue] = useState(false)
  const [recoveryRaw,setRecoveryRaw] = useState<string | null>(null)
  const recovery = useRef<CashRecovery>(cashRecovery(draft))
  const reviewCandidate = useRef<{ fingerprint: string; attempt: ReturnType<typeof freezeCashAttempt> } | null>(null)
  const running = useRef(false), mounted = useRef(true), editVersion = useRef(0)
  const confirmation = useConfirmation()
  const store = draft.context.storeId, date = draft.context.businessDate!
  useEffect(() => {
    mounted.current = true
    if (!readOnly) {
      let result: ReturnType<typeof readCashRecovery>
      try { result = readCashRecovery(localStorage,draft) } catch { result = { state: 'unavailable', raw: null } }
      if (result.state === 'ready') {
        recovery.current = result.value
        if (result.value.attempt) { setState('waiting'); setStatus({ key: 'cash.lookup.uncertain' }) }
      } else { setRecoveryIssue(true); setRecoveryRaw(result.raw) }
    }
    return () => { mounted.current = false }
  }, [draft.id,readOnly])
  useEffect(() => {
    if (!readOnly && !busy && recovery.current.attempt && state === 'sending') {
      setState('waiting'); setStatus({ key: 'cash.lookup.uncertain' })
    }
  }, [busy,state,token,readOnly])
  const edited = useCallback((saved: boolean) => {
    editVersion.current++
    setState(saved ? 'device' : 'failed')
    setStatus(saved ? recovery.current.attempt ? { key: 'cash.lookup.uncertain' } : null
      : { key: recovery.current.attempt ? 'cash.lookup.storageUncertain' : 'feedback.storageFailed' })
  }, [])
  const save = async (reviewed = false) => {
    if (running.current || readOnly || !token) return
    running.current = true; setBusy(true); setStatus(null)
    const generation = managerSession.getSnapshot().generation
    const currentSession = () => mounted.current && (!managerSession.active || managerSession.getSnapshot().generation === generation)
    const version = editVersion.current
    const source = latest.current
    const unchanged = () => currentSession() && editVersion.current === version && canonicalJson(latest.current) === canonicalJson(attempt.source)
    const attempt = recovery.current.attempt ?? (reviewed ? reviewCandidate.current?.attempt : null) ?? freezeCashAttempt(source)
    const storeEnvelope = (value: CashRecovery) => {
      recovery.current = value // Memory retains the frozen attempt even if device writes are denied.
      let saved = false
      try { saved = writeCashRecovery(localStorage,draft,value) } catch { /* Keep memory and original device bytes. */ }
      setRecoveryIssue(!saved)
      return saved
    }
    try {
      // Every retry reads first. A failed read cannot authorize another PUT.
      const record = await fetchSavedCashoutRecord(store,date,token)
      if (!currentSession()) return
      const assessment = assessCashSave(record,recovery.current)
      if (assessment === 'matched') {
        storeEnvelope({ ...recovery.current, baseline: record!.fingerprint, attempt: undefined })
        setComparison(null)
        setState(unchanged() ? 'server' : 'device')
        setStatus({ key: unchanged() ? 'cash.lookup.matched' : 'cash.lookup.earlierMatched' })
        return
      }
      if (record) {
        setComparison({ saved: record, attempt: attempt.source })
        if (!reviewed || reviewCandidate.current?.fingerprint !== record.fingerprint || !sameCashoutPayload(reviewCandidate.current.attempt.input,attempt.input)) {
          reviewCandidate.current = { fingerprint: record.fingerprint, attempt }
          setStatus({ key: 'cash.lookup.reviewRequired' })
          return
        }
      }
      else setComparison(null)
      if (record || assessment === 'retry') {
        const key = assessment === 'changed' || assessment === 'diverged' ? 'cash.lookup.changedConfirm'
          : assessment === 'retry' ? 'cash.lookup.retryConfirm' : 'cash.lookup.replaceConfirm'
        if (!await confirmation.ask({ key, params: { store, date, time: record?.updatedAt ?? '' } },true)) return
        if (!currentSession()) return
      }
      // Persist the exact request before starting it; unreadable original bytes block overwrites.
      if (!storeEnvelope({ ...recovery.current, baseline: record?.fingerprint ?? null, attempt })) {
        setStatus({ key: 'cash.lookup.recoveryBlocked' }); return
      }
      setState('sending')
      try {
        await saveCashoutDay(store,date,attempt.input,token)
      } catch (caught) {
        if (!currentSession()) return
        setState('waiting'); setStatus({ key: 'cash.lookup.uncertain' })
        if (caught instanceof StoreAuthError) onLocked()
        return
      }
      if (!currentSession()) return
      // Acknowledgment and refresh are separate outcomes. Never retry a known acknowledgment.
      storeEnvelope({ ...recovery.current, baseline: undefined, attempt: undefined })
      setState(unchanged() ? 'server' : 'device')
      setComparison(null)
      let readBackFailed = false
      try {
        const saved = await fetchSavedCashoutRecord(store,date,token)
        if (!currentSession()) return
        if (saved && sameCashoutPayload(saved,attempt.input)) storeEnvelope({ ...recovery.current, baseline: saved.fingerprint })
        else {
          if (saved) setComparison({ saved, attempt: attempt.source })
          setState('conflict'); setStatus({ key: 'cash.lookup.savedChanged' }); return
        }
      } catch (caught) {
        if (!currentSession()) return
        if (caught instanceof StoreAuthError) onLocked()
        readBackFailed = true
      }
      try { await fetchCashoutHistory(store,new Date().toLocaleDateString('en-CA'),token) }
      catch (caught) { readBackFailed = true; if (caught instanceof StoreAuthError && currentSession()) onLocked() }
      if (currentSession()) setStatus({ key: readBackFailed ? 'cash.savedHistoryUnavailable' : unchanged() ? 'cash.saved' : 'cash.earlierVersionSaved', params: {store,date} })
    } catch (caught) {
      if (!currentSession()) return
      if (caught instanceof StoreAuthError) onLocked()
      setStatus({ key: recovery.current.attempt ? 'cash.lookup.readBeforeRetryFailed' : 'cash.lookup.preflightFailed' })
      setState(recovery.current.attempt ? 'waiting' : 'failed')
      // Translate only stable keys; arbitrary service text never enters the screen.
      if (errorKey(caught) === 'errors.unauthorized') setStatus({ key: 'errors.unauthorized' })
    } finally {
      running.current = false
      if (mounted.current) setBusy(false)
    }
  }
  return { state,status,busy,save,edited,comparison,recoveryIssue,recoveryRaw,dialog: confirmation.dialog }
}
