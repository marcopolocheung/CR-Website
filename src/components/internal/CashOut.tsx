'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, SetStateAction } from 'react'
import { useInternalLanguage } from './InternalLanguage'
import { LabeledInput, EmptyState, SaveFeedback, focusField, useConfirmation, type SaveState } from './Feedback'
import DraftChooser, { downloadDraftSource } from './DraftChooser'
import { newDraft, saveDraft, type Draft, type DraftContext } from '@/lib/internal-tools/drafts'
import { isCashoutDraftSheet, readUnassignedCashout, type CashoutDraftSheet } from '@/lib/internal-tools/cashout-draft'
import { businessDate } from '@/lib/internal-tools/contracts'
import { useNavigationProtection } from './NavigationProtection'
import { SingleFlight } from '@/lib/internal-tools/recovery'
import { errorKey, type Message } from '@/lib/internal-tools/i18n'
import {
  DENOMINATIONS,
  FLOAT_CENTS,
  cashierTotals,
  dayTotals,
  formatCents,
  shiftTotals,
  type Cashier,
} from '@/lib/cashout'
import {
  CASHOUT_STORES,
  fetchCashoutDay,
  fetchCashoutHistory,
  saveCashoutDay,
  type CashoutDay,
  type CashoutStore,
} from '@/lib/cashout-store'
import { StoreAuthError, verifyWriteToken } from '@/lib/schedule-store'

type Shift = 'am' | 'pm'
type Sheet = CashoutDraftSheet

export const STORE_LABELS: Record<CashoutStore, string> = { CR3: 'CR3 · W Military', CR2: 'CR2 · SW Military' }
const today = () => new Date().toLocaleDateString('en-CA')
const newCashier = (): Cashier => ({ name: '', counts: DENOMINATIONS.map(() => 0), toast: '' })
const emptySheet = (): Sheet => ({ am: [newCashier()], pm: [newCashier()], zReport: '' })

const inputClass =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500'

function Money({ cents, signed }: { cents: number | null; signed?: boolean }) {
  const { t: tr } = useInternalLanguage()
  if (cents === null) return <span className="font-mono font-semibold text-gray-400" title={tr('cash.missingFigure')}>—</span>
  const color = !signed || cents === 0 ? 'text-gray-900' : cents < 0 ? 'text-red-600' : 'text-green-700'
  return <span className={`font-mono font-semibold ${color}`}>{signed && cents > 0 ? '+' : ''}{formatCents(cents)}</span>
}

/** Manager code gate. Same token as the scheduler demo; kept in memory only, never stored. */
export function CodeGate({ onUnlock, title }: { onUnlock: (token: string) => void; title?: string }) {
  const { t: tr } = useInternalLanguage()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Message | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!code || busy) return
    setBusy(true)
    setError(null)
    try {
      await verifyWriteToken(code)
      onUnlock(code)
    } catch (caught) {
      setError({ key: errorKey(caught) })
      focusField('cashout-code')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="max-w-md my-8 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">{title ?? tr('cash.title')}</h2>
      <p className="text-sm text-gray-600 mb-4">{tr('cash.managerInstructions')}</p>
      <LabeledInput id="cashout-code" label={{ key: 'cash.managerCode' }} error={error}
        type="password" autoComplete="off" value={code} onChange={event => setCode(event.target.value)} className={inputClass} />
      <button
        type="submit"
        disabled={!code || busy}
        className="min-h-11 mt-4 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
      >
        {tr(busy ? 'cash.checking' : 'cash.unlock')}
      </button>
    </form>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between text-sm py-1">
      <span className="text-gray-600">{label}</span>
      {children}
    </div>
  )
}

export default function CashOut({ token, onUnlock, onLocked }: { token: string; onUnlock: (token: string) => void; onLocked: () => void }) {
  return <CashOutWorkspace token={token} onUnlock={onUnlock} onLocked={onLocked} />
}

function CashOutWorkspace({ token, onUnlock, onLocked }: { token: string; onUnlock: (token: string) => void; onLocked: () => void }) {
  const { t } = useInternalLanguage()
  const [store, setStore] = useState<CashoutStore>('CR3')
  const [date, setDate] = useState(today)
  const [preparer, setPreparer] = useState('')
  const [active, setActive] = useState<Draft<Sheet> | null>(null)
  const activeRef = useRef<Draft<Sheet> | null>(null)
  const [storageFailed, setStorageFailed] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [legacy, setLegacy] = useState<string | null>(null)
  const [legacyChanged, setLegacyChanged] = useState(false)
  const confirmation = useConfirmation()
  const context = useMemo<DraftContext | null>(() => {
    const parsed = businessDate(date)
    return parsed ? { task: 'cash-out', storeId: store, businessDate: parsed } : null
  }, [store, date])
  useEffect(() => {
    if (!token) return
    try { setLegacy(localStorage.getItem('cr-cash-out')) }
    catch { setStorageFailed(true) }
  }, [token])
  const persist = useCallback((payload: Sheet): boolean => {
    const current = activeRef.current
    if (!current) return false
    const draft = { ...current, updatedAt: new Date().toISOString(), payload }
    activeRef.current = draft
    setActive(draft)
    try {
      const saved = saveDraft(localStorage, draft, isCashoutDraftSheet).state === 'saved'
      setStorageFailed(!saved)
      if (saved) setLastSavedAt(draft.updatedAt)
      return saved
    } catch { setStorageFailed(true); return false }
  }, [])
  const open = (draft: Draft<Sheet>) => { if (draft.context.task !== 'cash-out' || !draft.context.businessDate) return; setStore(draft.context.storeId); setDate(draft.context.businessDate); setLastSavedAt(null); activeRef.current = draft; setActive(draft); persist(draft.payload) }
  const assignLegacy = async () => {
    if (!context || legacy === null || !preparer.trim()) return
    const sourceStillCurrent = () => {
      try {
        const current = localStorage.getItem('cr-cash-out')
        if (current === legacy) return true
        setLegacy(current); setLegacyChanged(true); return false
      } catch { setStorageFailed(true); return false }
    }
    if (!sourceStillCurrent()) return
    const payload = readUnassignedCashout(legacy)
    if (!payload) return
    const approved = await confirmation.ask({ key: 'cash.legacyConfirm', params: { store: context.storeId, date: context.businessDate! } })
    if (!approved || !sourceStillCurrent()) return
    setLegacyChanged(false)
    // This points to the actual retained legacy source key, not a guessed record ID/date.
    open({ ...newDraft(context, preparer, payload), sourceId: 'cr-cash-out' })
  }
  const leave = (lock = false, nextDate?: string) => {
    const current = activeRef.current
    if (current && !persist(current.payload)) return
    activeRef.current = null
    setActive(null)
    if (nextDate) setDate(nextDate)
    if (lock) { onLocked(); requestAnimationFrame(() => focusField('cashout-code')) }
    else requestAnimationFrame(() => focusField('draft-preparer'))
  }
  return <div>
    {!token && <CodeGate onUnlock={onUnlock} />}
    <div hidden={!token}>
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <div><label htmlFor="cashout-store" className="mb-1 block text-sm font-medium text-gray-700">{t('common.store')}</label>
        <select id="cashout-store" value={store} disabled={!!active} onChange={event => setStore(event.target.value as CashoutStore)} className={inputClass}>
          {CASHOUT_STORES.map(store => <option key={store} value={store}>{STORE_LABELS[store]}</option>)}
        </select>
      </div>
      <div><label htmlFor="cashout-date" className="mb-1 block text-sm font-medium text-gray-700">{t('common.date')}</label>
        <input id="cashout-date" type="date" value={date} disabled={!!active} onChange={event => setDate(event.target.value)} className={inputClass} />
      </div>
      {!active && <div className="print:hidden">
        <LabeledInput id="draft-preparer" label={{ key: 'drafts.preparer' }} maxLength={120} value={preparer} onChange={event => setPreparer(event.target.value)} className={inputClass} aria-describedby="draft-preparer-help" />
        <p id="draft-preparer-help" className="mt-1 max-w-sm text-xs text-gray-600">{t('drafts.preparerHelp')}</p>
      </div>}
    </div>
    {legacyChanged && <p role="alert" className="my-3 text-sm text-amber-900">{t('cash.legacyChanged')}</p>}
    {storageFailed && <p role="alert" className="my-3 text-sm text-red-700">{t('drafts.storageUnavailable')}</p>}
    {active ? <>
      <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 print:hidden">
        <p className="break-words text-sm font-medium">{t('drafts.active', { store, date, preparer: active.preparer })}</p>
        <p className="text-xs text-gray-600">{lastSavedAt ? t('drafts.savedAt', { time: lastSavedAt }) : t('common.unsaved')}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => leave()} className="min-h-11 rounded-lg border border-gray-300 px-3 py-2 text-sm">{t('drafts.change')}</button>
          <button type="button" onClick={() => leave(true)} className="min-h-11 rounded-lg border border-gray-300 px-3 py-2 text-sm">{t('drafts.handoff')}</button>
          <button type="button" onClick={() => downloadDraftSource(JSON.stringify(activeRef.current, null, 2))} className="min-h-11 px-3 py-2 text-sm text-red-700 underline">{t('drafts.downloadCurrent')}</button>
        </div>
      </div>
      <CashOutSheet key={active.id} token={token} onLocked={onLocked} draft={active} persist={persist} onChooseDate={day => leave(false, day)} />
    </> : <>
      {!context && <EmptyState message={{ key: 'imports.pickDate' }} />}
      {context && <DraftChooser context={context} preparer={preparer} createPayload={emptySheet} validate={isCashoutDraftSheet} onOpen={open} />}
      {legacy !== null && <div className="my-4 rounded-lg border border-amber-300 bg-amber-50 p-3 print:hidden">
        <p className="text-sm text-amber-900">{t('drafts.legacy')}</p>
        {readUnassignedCashout(legacy) ? <button type="button" disabled={!context || !preparer.trim()} onClick={assignLegacy} className="my-2 min-h-11 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-50">{t('cash.assignLegacy')}</button> : <p className="mt-2 text-sm text-red-700">{t('cash.legacyInvalid')}</p>}
        <button type="button" onClick={() => downloadDraftSource(legacy)} className="min-h-11 px-3 py-2 text-sm text-red-700 underline">{t('drafts.downloadSource')}</button>
      </div>}
    </>}
    {confirmation.dialog}
    </div>
  </div>
}

function CashOutSheet({ token, onLocked, draft, persist, onChooseDate }: { token: string; onLocked: () => void; draft: Draft<Sheet>; persist: (payload: Sheet) => boolean; onChooseDate: (day: string) => void }) {
  const { t: tr } = useInternalLanguage()
  const [sheet, setSheetState] = useState<Sheet>(() => draft.payload)
  const latestSheet = useRef(sheet)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const store = draft.context.storeId
  const date = draft.context.businessDate! // Opened only from the exact cash-out day context above.
  const [history, setHistory] = useState<CashoutDay[]>([])
  const [status, setStatus] = useState<Message | null>(null)
  const [busy, setBusy] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('unsaved')
  const [deviceSaved,setDeviceSaved] = useState(false)
  const saving = useRef(new SingleFlight<void>())
  useNavigationProtection({ dirty: saveState !== 'server', deviceSaved })
  const confirmation = useConfirmation()
  const tokenRef = useRef(token); tokenRef.current = token
  const currentEdit = useRef({ store, date, sheet })
  currentEdit.current = { store, date, sheet }

  const run = useCallback(
    async (task: () => Promise<Message | void>) => {
      setBusy(true)
      setStatus(null)
      try {
        const message = await task()
        if (mounted.current && tokenRef.current === token && message) setStatus(message)
      } catch (caught) {
        if (!mounted.current || tokenRef.current !== token) return
        if (caught instanceof StoreAuthError) onLocked()
        else setStatus({ key: errorKey(caught) })
      } finally {
        if (mounted.current) setBusy(false)
      }
    },
    [onLocked, token],
  )

  const refreshHistory = useCallback(
    () => { if (!token) return Promise.resolve(); return run(async () => {
      const days = await fetchCashoutHistory(store, today(), token)
      if (mounted.current && currentEdit.current.store === store) setHistory(days)
    }) },
    [run, store, token],
  )

  useEffect(() => {
    refreshHistory()
  }, [refreshHistory])

  const loadDay = (day: string) =>
    run(async () => {
      if (day !== date) { onChooseDate(day); return }
      const saved = await fetchCashoutDay(store, day, token)
      if (!mounted.current) return
      if (!saved) return { key: 'cash.notSaved', params: { store, date: day } }
      if (!await confirmation.ask({ key: 'cash.replaceConfirm', params: { store, date: day } }, true)) return
      setSheet(saved)
      return { key: 'cash.loaded', params: { store, date: day } }
    })

  const saveDay = () => saving.current.run(() => run(async () => {
    if (!token) return
    const stillCurrent = () => mounted.current && currentEdit.current.store === store && currentEdit.current.date === date && latestSheet.current === sheet
    setSaveState('sending')
    try {
      await saveCashoutDay(store, date, { sheet, totals: dayTotals(sheet.am, sheet.pm, sheet.zReport) }, token)
    } catch (caught) {
      const key = errorKey(caught)
      if (stillCurrent()) setSaveState(key === 'errors.conflict' ? 'conflict' : key === 'errors.unavailable' ? 'waiting' : 'failed')
      throw caught
    }
    if (stillCurrent()) setSaveState('server')
    try {
      const days = await fetchCashoutHistory(store, today(), token)
      if (mounted.current && currentEdit.current.store === store) setHistory(days)
    }
    catch { return { key: stillCurrent() ? 'cash.savedHistoryUnavailable' : 'cash.earlierVersionSaved', params: { store, date } } }
    return { key: stillCurrent() ? 'cash.saved' : 'cash.earlierVersionSaved', params: { store, date } }
  }))

  const saveOnDevice = useCallback((payload: Sheet) => {
    const saved = persist(payload)
    setDeviceSaved(saved)
    if (saved) {
      setSaveState('device')
      setStatus(previous => previous && ['cash.saved', 'cash.savedHistoryUnavailable', 'cash.earlierVersionSaved'].includes(previous.key) ? null : previous)
    } else { setSaveState('failed'); setStatus({ key: 'feedback.storageFailed' }) }
  }, [persist])
  const setSheet = useCallback((update: SetStateAction<Sheet>) => {
    const next = typeof update === 'function' ? update(latestSheet.current) : update
    latestSheet.current = next
    setSheetState(next)
    // Update the working copy before a context/handoff action can unmount this editor.
    saveOnDevice(next)
  }, [saveOnDevice])
  useEffect(() => { saveOnDevice(latestSheet.current) }, [saveOnDevice])

  const updateCashier = (shift: Shift, idx: number, patch: Partial<Cashier>) =>
    setSheet(s => ({ ...s, [shift]: s[shift].map((c, i) => (i === idx ? { ...c, ...patch } : c)) }))

  const setCount = (shift: Shift, idx: number, d: number, value: string) => {
    const counts = [...sheet[shift][idx].counts]
    counts[d] = Math.max(0, parseInt(value, 10) || 0)
    updateCashier(shift, idx, { counts })
  }

  const removeCashier = async (shift: Shift, idx: number) => {
    if (await confirmation.ask({ key: 'cash.removeConfirm' }, true)) setSheet(s => ({ ...s, [shift]: s[shift].filter((_, i) => i !== idx) }))
  }

  const day = dayTotals(sheet.am, sheet.pm, sheet.zReport)

  useEffect(() => { document.querySelector<HTMLInputElement>('#cashout-editor input:not([disabled])')?.focus() }, [])

  return (
    <div id="cashout-editor">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">{tr('cash.title')}</h2>
        <div className="flex gap-2 print:hidden">
          <button onClick={() => window.print()} className="min-h-11 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50">
            {tr('common.print')}
          </button>
          <button
            onClick={async () => { if (await confirmation.ask({ key: 'cash.clearConfirm' }, true)) setSheet(emptySheet()) }}
            className="min-h-11 px-4 py-2 rounded-lg border border-red-300 text-red-700 text-sm font-medium hover:bg-red-50"
          >
            {tr('cash.clear')}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-8 print:mb-4">
        <div className="flex gap-2 print:hidden">
          <button
            onClick={() => loadDay(date)}
            disabled={busy || !date}
            className="min-h-11 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            {tr('cash.load')}
          </button>
          <button
            onClick={saveDay}
            disabled={busy || !date}
            className="min-h-11 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
          >
            {tr('cash.save')}
          </button>
        </div>
        <SaveFeedback state={saveState} message={busy && saveState !== 'sending' ? { key: 'common.loading' } : status} />
      </div>

      {(['am', 'pm'] as const).map(shift => {
        const totals = shiftTotals(sheet[shift])
        return (
          <section key={shift} className="mb-10">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-semibold text-gray-900">{tr('cash.shift', { shift: shift.toUpperCase() })}</h2>
              <button
                onClick={() => setSheet(s => ({ ...s, [shift]: [...s[shift], newCashier()] }))}
                className="min-h-11 px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 print:hidden"
              >
                {tr('cash.addCashier')}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sheet[shift].map((c, idx) => {
                const t = cashierTotals(c)
                const id = `${shift}-${idx}`
                return (
                  <div key={idx} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 break-inside-avoid">
                    <div className="flex gap-2 mb-3">
                      <input
                        aria-label={tr('cash.cashierName')}
                        placeholder={tr('cash.cashierPlaceholder', { number: idx + 1 })}
                        value={c.name}
                        onChange={e => updateCashier(shift, idx, { name: e.target.value })}
                        className={inputClass}
                      />
                      <button
                        onClick={() => removeCashier(shift, idx)}
                        aria-label={tr('cash.removeCashier')}
                        className="min-h-11 min-w-11 px-3 text-gray-400 hover:text-red-600 print:hidden"
                      >
                        ✕
                      </button>
                    </div>

                    <table className="w-full text-sm mb-3">
                      <tbody>
                        {DENOMINATIONS.map((d, di) => (
                          <tr key={d}>
                            <td className="py-0.5 pr-2 text-gray-700 w-16">
                              <label htmlFor={`${id}-${d}`}>{formatCents(d)}</label>
                            </td>
                            <td className="py-0.5 pr-2">
                              <input
                                id={`${id}-${d}`}
                                type="number"
                                inputMode="numeric"
                                min={0}
                                value={c.counts[di] || ''}
                                placeholder="0"
                                onChange={e => setCount(shift, idx, di, e.target.value)}
                                className="w-full border border-gray-300 rounded px-2 py-1 text-right focus:outline-none focus:ring-2 focus:ring-red-500"
                              />
                            </td>
                            <td className="py-0.5 text-right font-mono text-gray-500 w-24">
                              {formatCents(d * (c.counts[di] || 0))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <label htmlFor={`${id}-toast`} className="block text-sm font-medium text-gray-700 mb-1">
                      {tr('cash.toast')}
                    </label>
                    <input
                      id={`${id}-toast`}
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={c.toast}
                      placeholder="0.00"
                      onChange={e => updateCashier(shift, idx, { toast: e.target.value })}
                      className={`${inputClass} mb-3`}
                    />

                    <div className="border-t border-gray-200 pt-2">
                      <Row label={tr('cash.drawer')}><Money cents={t.drawer} /></Row>
                      <Row label={tr('cash.turnIn', { amount: formatCents(FLOAT_CENTS) })}><Money cents={t.turnIn} /></Row>
                      <Row label={tr('cash.overShort')}><Money cents={t.overShort} signed /></Row>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-4 bg-gray-50 rounded-xl border border-gray-200 p-4 max-w-sm ml-auto">
              <Row label={tr('cash.shiftDeposit', { shift: shift.toUpperCase() })}><Money cents={totals.deposit} /></Row>
              <Row label={tr('cash.shiftOverShort', { shift: shift.toUpperCase() })}><Money cents={totals.overShort} signed /></Row>
            </div>
          </section>
        )
      })}

      <section className="bg-white rounded-xl border-2 border-gray-300 shadow-sm p-6 max-w-md ml-auto break-inside-avoid">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">{tr('cash.dayTotal')}</h2>
        <Row label={tr('cash.actualDeposit')}><Money cents={day.deposit} /></Row>
        <Row label={tr('cash.cashierDifference')}><Money cents={day.overShort} signed /></Row>
        <label htmlFor="z-report" className="block text-sm font-medium text-gray-700 mt-3 mb-1">
          {tr('cash.zExpected')}
        </label>
        <input
          id="z-report"
          type="number"
          inputMode="decimal"
          step="0.01"
          value={sheet.zReport}
          placeholder="0.00"
          onChange={e => setSheet(s => ({ ...s, zReport: e.target.value }))}
          className={`${inputClass} mb-3`}
        />
        <Row label={tr('cash.zDifference')}><Money cents={day.zOverShort} signed /></Row>
      </section>

      {confirmation.dialog}
      <section className="mt-10 print:hidden">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">{tr('cash.history', { store: STORE_LABELS[store] })}</h2>
        {history.length === 0 ? (
          <EmptyState message={{ key: 'cash.empty' }} />
        ) : (
          <div className="overflow-x-auto bg-white rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  {[tr('common.date'), tr('cash.shiftDeposit', { shift: 'AM' }), tr('cash.shiftDeposit', { shift: 'PM' }), tr('cash.shiftOverShort', { shift: 'AM' }), tr('cash.shiftOverShort', { shift: 'PM' }), tr('cash.dayDeposit'), tr('cash.dayDifference'), tr('cash.vsZ')].map(h => (
                    <th key={h} scope="col" className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.date} className="border-t border-gray-100">
                    <td className="px-3 py-2">
                      <button onClick={() => loadDay(h.date)} disabled={busy} className="text-red-700 underline hover:text-red-900">
                        {h.date}
                      </button>
                    </td>
                    <td className="px-3 py-2"><Money cents={h.totals.amDeposit} /></td>
                    <td className="px-3 py-2"><Money cents={h.totals.pmDeposit} /></td>
                    <td className="px-3 py-2"><Money cents={h.totals.amOverShort} signed /></td>
                    <td className="px-3 py-2"><Money cents={h.totals.pmOverShort} signed /></td>
                    <td className="px-3 py-2"><Money cents={h.totals.deposit} /></td>
                    <td className="px-3 py-2"><Money cents={h.totals.overShort} signed /></td>
                    <td className="px-3 py-2"><Money cents={h.totals.zOverShort} signed /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
