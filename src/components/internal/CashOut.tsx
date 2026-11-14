'use client'
import { internalThemeClassName } from './ui/Theme'
import { Icon } from './ui/Icon'
import styles from './cash-workspace.module.css'
import { useWorkspaceVisible } from './WorkspaceVisibility'
import { useManagerSession } from './ManagerSession'
import { managerSession } from '@/lib/internal-tools/manager-session'
import { useWorkTransitions } from './NavigationProtection'

import { useShellAvailable, useShellTask } from './ShellTask'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, SetStateAction } from 'react'
import { useInternalLanguage } from './InternalLanguage'
import { LabeledInput, EmptyState, SaveFeedback, focusField, useConfirmation, type SaveState } from './Feedback'
import DraftChooser, { downloadDraftSource } from './DraftChooser'
import { newDraft, saveDraft, type Draft, type DraftContext } from '@/lib/internal-tools/drafts'
import { isCashoutDraftSheet, readUnassignedCashout, cashoutServerSheet, changeCount, changeAmount, countInput, amountInput, parseCountInput, parseDenominationAmount, type CashoutDraftCashier, type CashoutDraftSheet } from '@/lib/internal-tools/cashout-draft'
import { businessDate } from '@/lib/internal-tools/contracts'
import { useNavigationProtection } from './NavigationProtection'
import { SingleFlight } from '@/lib/internal-tools/recovery'
import EntryWorkspace from './EntryWorkspace'
import CountKeypad from './CountKeypad'
import { errorKey, type Message } from '@/lib/internal-tools/i18n'
import {
  DENOMINATIONS,
  FLOAT_CENTS,
  cashierTotals,
  dayTotals,
  formatCents,
  parseCashAmount,
  shiftTotals,
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
const newCashier = (): CashoutDraftCashier => ({ name: '', counts: DENOMINATIONS.map(() => 0), countInputs: DENOMINATIONS.map(() => ''), toast: '' })
const emptySheet = (): Sheet => ({ am: [newCashier()], pm: [newCashier()], zReport: '', extraMoney: '' })

const inputClass =
  'min-h-11 w-full border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-red-500 print:min-h-0 print:py-2 print:text-sm'

function Money({ cents, signed }: { cents: number | null; signed?: boolean }) {
  const { t: tr } = useInternalLanguage()
  if (cents === null) return <span data-cash-money className="font-mono font-semibold text-gray-400" title={tr('cash.missingFigure')}>—</span>
  const color = !signed || cents === 0 ? 'text-gray-900' : cents < 0 ? 'text-red-600' : 'text-green-700'
  return <span data-cash-money className={`font-mono font-semibold ${color}`}>{signed && cents > 0 ? '+' : ''}{formatCents(cents)}</span>
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
      const generation = managerSession.getSnapshot().generation
      await verifyWriteToken(code)
      if (!managerSession.active || generation === managerSession.getSnapshot().generation) onUnlock(code)
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
  const visible = useWorkspaceVisible()
  const { t } = useInternalLanguage()
  const inShell = useShellAvailable()
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
  const session = useManagerSession()
  const transitions = useWorkTransitions()
  useNavigationProtection({ dirty: false, deviceSaved: !storageFailed, checkpoint: () => !activeRef.current || persist(activeRef.current.payload), leave: () => { activeRef.current = null; setActive(null); requestAnimationFrame(() => { const gate = document.querySelector<HTMLInputElement>('[data-internal-workspace]:not([hidden]) #cashout-code'); gate?.focus() }) } })
  const leave = (lock = false, nextDate?: string) => {
    const current = activeRef.current
    if (current && !persist(current.payload)) return
    activeRef.current = null
    setActive(null)
    if (nextDate) setDate(nextDate)
    if (lock) { onLocked(); requestAnimationFrame(() => focusField('cashout-code')) }
    else requestAnimationFrame(() => focusField('draft-preparer'))
  }
  useShellTask('cash', { context: token && context ? `${STORE_LABELS[store]} · ${date}` : null, onLock: token ? () => leave(true) : undefined, lockLabel: active ? 'drafts.handoff' : 'shell.lock' })
  return <div className={`${internalThemeClassName} ${styles.workspace}`}>
    {!token && visible && <CodeGate onUnlock={onUnlock} />}
    <div hidden={!token}>
    <details open={!active} className={styles.context} data-cash-context>
    <summary>{t(active ? 'cash.focus.context' : 'cash.focus.setup')}</summary>
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <div className="min-w-0 max-w-full"><label htmlFor="cashout-store" className="mb-1 block text-sm font-medium text-gray-700">{t('common.store')}</label>
        <select id="cashout-store" value={store} disabled={!!active} onChange={event => setStore(event.target.value as CashoutStore)} className={inputClass}>
          {CASHOUT_STORES.map(store => <option key={store} value={store}>{STORE_LABELS[store]}</option>)}
        </select>
      </div>
      <div className="min-w-0 max-w-full"><label htmlFor="cashout-date" className="mb-1 block text-sm font-medium text-gray-700">{t('common.date')}</label>
        <input id="cashout-date" type="date" value={date} disabled={!!active} onChange={event => setDate(event.target.value)} className={`${inputClass} min-w-0 max-w-full`} />
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
          <button type="button" onClick={() => void transitions.change(() => leave())} className="min-h-11 rounded-lg border border-gray-300 px-3 py-2 text-sm">{t('drafts.change')}</button>
          {!inShell && <button type="button" onClick={session.lock} className="min-h-11 rounded-lg border border-gray-300 px-3 py-2 text-sm">{t('drafts.handoff')}</button>}
          <button type="button" onClick={() => downloadDraftSource(JSON.stringify(activeRef.current, null, 2))} className="min-h-11 px-3 py-2 text-sm text-red-700 underline">{t('drafts.downloadCurrent')}</button>
        </div>
      </div>

    </> : <>
      {!context && <EmptyState message={{ key: 'imports.pickDate' }} />}
      {context && <DraftChooser context={context} preparer={preparer} createPayload={emptySheet} validate={isCashoutDraftSheet} onOpen={open} />}
      {legacy !== null && <div className="my-4 rounded-lg border border-amber-300 bg-amber-50 p-3 print:hidden">
        <p className="text-sm text-amber-900">{t('drafts.legacy')}</p>
        {readUnassignedCashout(legacy) ? <button type="button" disabled={!context || !preparer.trim()} onClick={assignLegacy} className="my-2 min-h-11 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-50">{t('cash.assignLegacy')}</button> : <p className="mt-2 text-sm text-red-700">{t('cash.legacyInvalid')}</p>}
        <button type="button" onClick={() => downloadDraftSource(legacy)} className="min-h-11 px-3 py-2 text-sm text-red-700 underline">{t('drafts.downloadSource')}</button>
      </div>}
    </>}
    </details>
    {active && <CashOutSheet key={active.id} token={token} onLocked={onLocked} draft={active} persist={persist} onChooseDate={day => { void transitions.change(() => leave(false, day)) }} />}
    {confirmation.dialog}
    </div>
  </div>
}

function CashOutSheet({ token, onLocked, draft, persist, onChooseDate }: { token: string; onLocked: () => void; draft: Draft<Sheet>; persist: (payload: Sheet) => boolean; onChooseDate: (day: string) => void }) {
  const visible = useWorkspaceVisible()
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
  const [activeCount, setActiveCount] = useState<{ shift: Shift; index: number; denomination: number } | null>(null)
  const [activeDrawer, setActiveDrawer] = useState<{ shift: Shift; index: number } | null>({ shift: 'am', index: 0 })
  const [keypadOpen, setKeypadOpen] = useState(false)
  const saving = useRef(new SingleFlight<void>())
  useNavigationProtection({ dirty: saveState !== 'server', deviceSaved, busy: saveState === 'sending', checkpoint: () => persist(latestSheet.current) })
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
    () => { if (!token || !visible) return Promise.resolve(); return run(async () => {
      const days = await fetchCashoutHistory(store, today(), token)
      if (mounted.current && currentEdit.current.store === store) setHistory(days)
    }) },
    [run, store, token, visible],
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
      setKeypadOpen(false)
      setActiveCount(null)
      setActiveDrawer(null)
      setSheet(saved)
      return { key: 'cash.loaded', params: { store, date: day } }
    })

  const focusEntry = (id: string) => {
    const target = /^(am|pm)-(\d+)-/.exec(id)
    if (target) setActiveDrawer({ shift: target[1] as Shift, index: Number(target[2]) })
    requestAnimationFrame(() => focusField(id))
  }
  const chooseDrawer = (shift: Shift, index: number, focus = false) => {
    setActiveDrawer({ shift, index }); setActiveCount(null); setKeypadOpen(false)
    if (focus) requestAnimationFrame(() => focusField(`${shift}-${index}-name`))
  }

  const saveDay = () => saving.current.run(() => run(async () => {
    if (!token) return
    const invalid = (['am', 'pm'] as const).flatMap(shift => sheet[shift].flatMap((cashier, index) =>
      DENOMINATIONS.flatMap((d, denomination) => parseCountInput(countInput(cashier, denomination)) === null ? [`${shift}-${index}-${d}`]
        : parseDenominationAmount(amountInput(cashier, denomination), d) === null ? [`${shift}-${index}-${d}-amount`] : [])))
    if (invalid.length) { setKeypadOpen(false); focusEntry(invalid[0]); return { key: 'cash.fixCounts' } }
    if (parseCashAmount(sheet.extraMoney ?? '') === null) { setKeypadOpen(false); focusField('extra-money'); return { key: 'cash.invalidExtraMoney' } }
    const stillCurrent = () => mounted.current && currentEdit.current.store === store && currentEdit.current.date === date && latestSheet.current === sheet
    setSaveState('sending')
    try {
      await saveCashoutDay(store, date, { sheet: cashoutServerSheet(sheet), totals: dayTotals(sheet.am, sheet.pm, sheet.zReport, sheet.extraMoney) }, token)
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

  const updateCashier = (shift: Shift, idx: number, patch: Partial<CashoutDraftCashier>) =>
    setSheet(s => ({ ...s, [shift]: s[shift].map((c, i) => (i === idx ? { ...c, ...patch } : c)) }))

  const setCount = (shift: Shift, idx: number, d: number, value: string) => {
    setSheet(s => ({ ...s, [shift]: s[shift].map((cashier, index) => index === idx ? changeCount(cashier, d, value) : cashier) }))
  }
  const setAmount = (shift: Shift, idx: number, d: number, value: string) => {
    setSheet(s => ({ ...s, [shift]: s[shift].map((cashier, index) => index === idx ? changeAmount(cashier, d, value) : cashier) }))
  }

  const removeCashier = async (shift: Shift, idx: number) => {
    if (await confirmation.ask({ key: 'cash.removeConfirm' }, true)) {
      setKeypadOpen(false); setActiveCount(null); setActiveDrawer(null)
      setSheet(s => ({ ...s, [shift]: s[shift].filter((_, i) => i !== idx) }))
      requestAnimationFrame(() => focusField(`${shift}-add-cashier`))
    }
  }

  const day = dayTotals(sheet.am, sheet.pm, sheet.zReport, sheet.extraMoney)
  const invalidExtraMoney = parseCashAmount(sheet.extraMoney ?? '') === null
  const visibleDrawer = activeDrawer && sheet[activeDrawer.shift][activeDrawer.index] ? activeDrawer
    : sheet.am.length ? { shift: 'am' as const, index: 0 } : sheet.pm.length ? { shift: 'pm' as const, index: 0 } : null
  const selectedCashier = visibleDrawer ? sheet[visibleDrawer.shift][visibleDrawer.index] : null
  const countCashier = activeCount ? sheet[activeCount.shift][activeCount.index] : null
  const countFields = (['am','pm'] as const).flatMap(shift => sheet[shift].flatMap((_, index) => DENOMINATIONS.map((_, denomination) => ({ shift, index, denomination }))))
  const selectedIndex = activeCount ? countFields.findIndex(field => field.shift === activeCount.shift && field.index === activeCount.index && field.denomination === activeCount.denomination) : -1
  const selectCount = (field: { shift: Shift; index: number; denomination: number }) => { setActiveCount(field); setActiveDrawer(field) }
  const closeKeypad = () => {
    setKeypadOpen(false)
    if (activeCount) requestAnimationFrame(() => focusField(`${activeCount.shift}-${activeCount.index}-${DENOMINATIONS[activeCount.denomination]}`))
  }
  const invalidCounts = (['am','pm'] as const).some(shift => sheet[shift].some(c => DENOMINATIONS.some((d, i) => parseCountInput(countInput(c, i)) === null || parseDenominationAmount(amountInput(c, i), d) === null)))

  useEffect(() => { document.querySelector<HTMLInputElement>('#cashout-editor input:not([disabled])')?.focus() }, [])

  return (
    <div id="cashout-editor">
      <div className={styles.heading}>
        <h2>{tr('cash.focus.entry')}</h2>
        <details className={styles.tools} data-cash-tools>
          <summary>{tr('cash.focus.tools')}</summary>
          <div className={styles.toolActions}>
            <button type="button" onClick={() => window.print()}><Icon name="print" />{tr('common.print')}</button>
            <button type="button" disabled={busy || !date} onClick={() => loadDay(date)}>{tr('cash.load')}</button>
            <button type="button" onClick={async () => { if (await confirmation.ask({ key: 'cash.clearConfirm' }, true)) { setKeypadOpen(false); setActiveCount(null); setActiveDrawer(null); setSheet(emptySheet()) } }}><Icon name="close" />{tr('cash.clear')}</button>
          </div>
        </details>
      </div>
      <EntryWorkspace appearance="paper" helpMode="details" finishId="cashout-save" summary={<>
        <div className={styles.finishRow} data-day-summary>
          <div><span>{tr('cash.dayDeposit')}</span><strong><Money cents={day.deposit} /></strong></div>
          <button id="cashout-save" type="button" onClick={saveDay} disabled={busy || !date} className={styles.save}><Icon name="check" />{tr('cash.save')}</button>
        </div>
        {selectedCashier && visibleDrawer && <div className={styles.summaryDrawer} data-drawer-summary>
          <span>{tr('cash.countContext', { shift: visibleDrawer.shift.toUpperCase(), name: selectedCashier.name || tr('cash.cashierPlaceholder', { number: visibleDrawer.index + 1 }) })}</span>
          <span>{tr('cash.drawer')} <Money cents={cashierTotals(selectedCashier).drawer} /></span>
          <span>{tr('cash.turnIn', { amount: formatCents(FLOAT_CENTS) })} <Money cents={cashierTotals(selectedCashier).turnIn} /></span>
        </div>}
        <div className={styles.feedbackRow}>
          <SaveFeedback appearance="paper" state={saveState} message={busy && saveState !== 'sending' ? { key: 'common.loading' } : status} />
          <button type="button" disabled={!countFields.length} aria-expanded={keypadOpen}
            onClick={() => { if (keypadOpen) closeKeypad(); else { if (!activeCount && visibleDrawer) selectCount({ ...visibleDrawer, denomination: 0 }); setKeypadOpen(true) } }}
            className={styles.keypadButton}><Icon name="cash" />{tr('cash.keypad')}</button>
        </div>
        {keypadOpen && activeCount && countCashier && <CountKeypad
          label={tr('cash.countFor', { amount: formatCents(DENOMINATIONS[activeCount.denomination]) })}
          value={countInput(countCashier, activeCount.denomination)}
          onChange={value => setCount(activeCount.shift, activeCount.index, activeCount.denomination, value)}
          onPrevious={selectedIndex > 0 ? () => selectCount(countFields[selectedIndex - 1]) : null}
          onNext={selectedIndex >= 0 && selectedIndex < countFields.length - 1 ? () => selectCount(countFields[selectedIndex + 1]) : null}
          onClose={closeKeypad} />}
      </>}>
      <div className={styles.drawerPicker} role="tablist" aria-label={tr('cash.focus.drawers')}>
        {(['am', 'pm'] as const).map(shift => <div key={shift} className={styles.shiftChoices}>
          <span>{shift.toUpperCase()}</span>
          {sheet[shift].map((cashier, index) => <button key={index} type="button" role="tab"
            id={`select-${shift}-${index}`} data-drawer-select={`${shift}-${index}`} aria-controls={`cash-drawer-${shift}-${index}`}
            aria-selected={visibleDrawer?.shift === shift && visibleDrawer.index === index}
            tabIndex={visibleDrawer?.shift === shift && visibleDrawer.index === index ? 0 : -1}
            onKeyDown={event => {
              const drawers = (['am', 'pm'] as const).flatMap(s => sheet[s].map((_, i) => ({ shift: s, index: i })))
              const at = drawers.findIndex(d => d.shift === shift && d.index === index)
              const next = event.key === 'ArrowRight' ? (at + 1) % drawers.length : event.key === 'ArrowLeft' ? (at + drawers.length - 1) % drawers.length : event.key === 'Home' ? 0 : event.key === 'End' ? drawers.length - 1 : null
              if (next === null) return
              event.preventDefault(); chooseDrawer(drawers[next].shift, drawers[next].index)
              requestAnimationFrame(() => focusField(`select-${drawers[next].shift}-${drawers[next].index}`))
            }}
            onClick={() => chooseDrawer(shift, index)}>{shift.toUpperCase()} · {cashier.name || tr('cash.cashierPlaceholder', { number: index + 1 })}</button>)}
          <button id={`${shift}-add-cashier`} type="button" onClick={() => { const index = sheet[shift].length; setSheet(s => ({ ...s, [shift]: [...s[shift], newCashier()] })); chooseDrawer(shift, index, true) }} aria-label={tr('cash.focus.addDrawer', { shift: shift.toUpperCase() })}>{tr('cash.addCashier')}</button>
        </div>)}
      </div>
      <p id="cash-count-help" className={styles.countHelp}>{tr('cash.focus.alternatives')}</p>
      <details className={styles.help}><summary>{tr('cash.focus.help')}</summary><p>{tr('cash.countHelp')}</p></details>
      {invalidCounts && <p role="alert" className="mb-4 text-sm font-medium text-red-700"><Icon name="warning" />{tr('cash.fixCounts')}</p>}
      {(['am', 'pm'] as const).map(shift => {
        const totals = shiftTotals(sheet[shift])
        return (
          <section key={shift} className={styles.shiftSection}>
            <h2 className={styles.printOnly}>{tr('cash.shift', { shift: shift.toUpperCase() })}</h2>
            <div className={styles.drawerGrid}>
              {sheet[shift].map((c, idx) => {
                const t = cashierTotals(c)
                const id = `${shift}-${idx}`
                return (
                  <div key={idx} id={`cash-drawer-${id}`} data-inactive={visibleDrawer?.shift !== shift || visibleDrawer.index !== idx ? true : undefined} data-active-drawer={visibleDrawer?.shift === shift && visibleDrawer.index === idx ? id : undefined} data-cashier-card={id} role="tabpanel" aria-labelledby={`select-${id}`} aria-label={tr('cash.countContext', { shift: shift.toUpperCase(), name: c.name || tr('cash.cashierPlaceholder', { number: idx + 1 }) })} onFocusCapture={event => {
                    setActiveDrawer({ shift, index: idx })
                    if (event.target instanceof HTMLInputElement && !event.target.hasAttribute('data-count-input')) { setActiveCount(null); setKeypadOpen(false) }
                  }} className={styles.drawer}>
                    <div className="flex gap-2 mb-3">
                      <input
                        data-entry-field
                        id={`${id}-name`}
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
                        <Icon name="close" />
                      </button>
                    </div>

                    <div className="mb-3 border-b border-gray-200 pb-2 print:hidden">
                      <p className="text-xs text-gray-600">{tr('cash.countProgress', { number: c.countInputs?.filter(value => typeof value === 'string' && value !== '' && parseCountInput(value) !== null).length ?? 0, total: DENOMINATIONS.length })}</p>
                      {(!c.countInputs || c.countInputs.some(value => value === null)) && <p className="mt-1 text-xs text-amber-900">{tr('cash.legacyCountState')}</p>}
                    </div>

                    <table className="w-full table-fixed text-sm mb-3">
                      <thead>
                        <tr className="text-left text-xs text-gray-600">
                          <th scope="col" className="pb-1 pr-2 font-medium">{tr('cash.denomination')}</th>
                          <th scope="col" className="pb-1 pr-2 text-right font-medium">{tr('cash.count')}</th>
                          <th scope="col" className="pb-1 text-right font-medium">{tr('cash.amount')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {DENOMINATIONS.map((d, di) => {
                          const value = countInput(c, di)
                          const invalid = parseCountInput(value) === null
                          const amount = amountInput(c, di)
                          const invalidAmount = parseDenominationAmount(amount, d) === null
                          return (
                          <tr key={d}>
                            <td className="py-0.5 pr-2 text-gray-700 w-16">
                              <label htmlFor={`${id}-${d}`}>{formatCents(d)}</label>
                            </td>
                            <td data-entry-label={tr('cash.count')} className="py-0.5 pr-2">
                              <input
                                data-entry-field
                                data-count-input
                                id={`${id}-${d}`}
                                aria-label={tr('cash.countFor', { amount: formatCents(d) })}
                                type="text"
                                inputMode={keypadOpen ? 'none' : 'numeric'}
                                enterKeyHint="next"
                                autoComplete="off"
                                spellCheck={false}
                                aria-invalid={invalid || undefined}
                                aria-describedby={`cash-count-help${invalid ? ` ${id}-${d}-error` : ''}`}
                                value={value}
                                placeholder="—"
                                onFocus={() => selectCount({ shift, index: idx, denomination: di })}
                                onChange={e => setCount(shift, idx, di, e.target.value)}
                                className="min-h-11 w-full min-w-0 border border-gray-300 rounded px-2 py-1 text-base text-right focus:outline-none focus:ring-2 focus:ring-red-500 print:min-h-0 print:text-sm"
                              />
                              {invalid && <p id={`${id}-${d}-error`} className="mt-1 text-xs text-red-700"><Icon name="warning" />{tr('cash.invalidCount')}</p>}
                            </td>
                            <td data-entry-label={tr('cash.amount')} className="py-0.5 text-right w-28">
                              <input
                                data-entry-field
                                id={`${id}-${d}-amount`}
                                aria-label={tr('cash.amountFor', { amount: formatCents(d) })}
                                type="text"
                                inputMode="decimal"
                                enterKeyHint="next"
                                autoComplete="off"
                                spellCheck={false}
                                aria-invalid={invalidAmount || undefined}
                                aria-describedby={`cash-count-help${invalidAmount ? ` ${id}-${d}-amount-error` : ''}`}
                                value={amount}
                                placeholder="0.00"
                                onChange={e => setAmount(shift, idx, di, e.target.value)}
                                className="min-h-11 w-full min-w-0 border border-gray-300 rounded px-2 py-1 text-base text-right focus:outline-none focus:ring-2 focus:ring-red-500 print:hidden"
                              />
                              {invalidAmount && <p id={`${id}-${d}-amount-error`} className="mt-1 text-xs text-red-700 print:hidden"><Icon name="warning" />{tr('cash.invalidAmount', { amount: formatCents(d) })}</p>}
                              <span className="hidden print:inline">{formatCents(d * c.counts[di])}</span>
                            </td>
                          </tr>
                        )})}
                      </tbody>
                    </table>

                    <label htmlFor={`${id}-toast`} className="block text-sm font-medium text-gray-700 mb-1">
                      {tr('cash.toast')}
                    </label>
                    <input
                      data-entry-field
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

            <div className={styles.printOnly}>
              <Row label={tr('cash.shiftDeposit', { shift: shift.toUpperCase() })}><Money cents={totals.deposit} /></Row>
              <Row label={tr('cash.shiftOverShort', { shift: shift.toUpperCase() })}><Money cents={totals.overShort} signed /></Row>
            </div>
          </section>
        )
      })}

      <section className={styles.daySummary} data-cash-day-fields>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">{tr('cash.dayTotal')}</h2>
        <Row label={tr('cash.actualDeposit')}><Money cents={day.deposit} /></Row>
        <Row label={tr('cash.cashierDifference')}><Money cents={day.overShort} signed /></Row>
        <label htmlFor="z-report" className="block text-sm font-medium text-gray-700 mt-3 mb-1">
          {tr('cash.zExpected')}
        </label>
        <input
          data-entry-field
          id="z-report"
          type="number"
          inputMode="decimal"
          step="0.01"
          value={sheet.zReport}
          placeholder="0.00"
          onChange={e => setSheet(s => ({ ...s, zReport: e.target.value }))}
          className={`${inputClass} mb-3`}
        />
        <label htmlFor="extra-money" className="block text-sm font-medium text-gray-700 mb-1">
          {tr('cash.extraMoney')}
        </label>
        <input
          data-entry-field
          id="extra-money"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={sheet.extraMoney ?? ''}
          placeholder="0.00"
          aria-invalid={invalidExtraMoney || undefined}
          aria-describedby={`extra-money-help${invalidExtraMoney ? ' extra-money-error' : ''}`}
          onChange={e => setSheet(s => ({ ...s, extraMoney: e.target.value }))}
          className={inputClass}
        />
        <p id="extra-money-help" className="mt-1 mb-3 text-xs text-gray-600">{tr('cash.extraMoneyHelp')}</p>
        {invalidExtraMoney && <p id="extra-money-error" role="alert" className="mb-3 text-sm text-red-700">{tr('cash.invalidExtraMoney')}</p>}
        <Row label={tr('cash.zDifference')}><Money cents={day.zOverShort} signed /></Row>
      </section>
      </EntryWorkspace>

      {confirmation.dialog}
      <details className={`${styles.history} print:hidden`} data-cash-history>
        <summary>{tr('cash.focus.history')}</summary>
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
                      <button onClick={() => loadDay(h.date)} disabled={busy} className="min-h-11 px-2 text-red-700 underline hover:text-red-900 focus-visible:outline-2 focus-visible:outline-red-700">
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
      </details>
    </div>
  )
}
