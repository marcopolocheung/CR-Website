'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { STORE_LABELS } from './CashOut'
import DraftChooser, { downloadDraftSource } from './DraftChooser'
import { LabeledInput, focusField } from './Feedback'
import { useInternalLanguage } from './InternalLanguage'
import { useNavigationProtection } from './NavigationProtection'
import { CASHOUT_STORES, type CashoutStore } from '@/lib/cashout-store'
import { businessDate, type Json } from '@/lib/internal-tools/contracts'
import { saveDraft, type Draft, type DraftContext } from '@/lib/internal-tools/drafts'
import type { TranslationKey } from '@/lib/internal-tools/i18n'

const field = 'mt-1 block min-h-11 rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 disabled:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900'
const small = 'min-h-11 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50'
const today = () => new Date().toLocaleDateString('en-CA')

/** The stored draft: the form plus the server record it became, so a reload cannot quietly save it twice. */
export type FormDraftPayload<F> = { form: F; savedId: string | null }

export type FormEditorProps<F> = {
  draft: Draft<FormDraftPayload<F>>
  /** Write the latest form to the device; false when storage refused it. */
  persist: (form: F) => boolean
  /** The server accepted this draft as record `id`. */
  markSaved: (id: string) => void
}

export function formDraftValidator<F>(validForm: (value: unknown) => value is F) {
  return (value: unknown): value is FormDraftPayload<F> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const p = value as Record<string, unknown>
    return Object.keys(p).length === 2 && validForm(p.form) && (p.savedId === null || (typeof p.savedId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(p.savedId)))
  }
}

/**
 * Store/date/preparer chooser plus device autosave and leave-page protection for one paper form type.
 * Saved drafts stay on the device (no disposal until DEC-03) and remember their record, so resuming one warns first.
 */
export default function FormDraftWorkspace<F extends Json>({ formType, title, createForm, validateForm, children }: {
  formType: string
  title: TranslationKey
  createForm: (date: string) => F
  validateForm: (value: unknown) => value is F
  children: (props: FormEditorProps<F>) => React.ReactNode
}) {
  type T = FormDraftPayload<F>
  const validate = useMemo(() => formDraftValidator(validateForm), [validateForm])
  const { t } = useInternalLanguage()
  const [store, setStore] = useState<CashoutStore>('CR3')
  const [date, setDate] = useState(today)
  const [preparer, setPreparer] = useState('')
  const [active, setActive] = useState<Draft<T> | null>(null)
  const activeRef = useRef<Draft<T> | null>(null)
  const [storageFailed, setStorageFailed] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  useNavigationProtection({ dirty: !!active && dirty && !active.payload.savedId, deviceSaved: !storageFailed })

  const context = useMemo<DraftContext | null>(() => {
    const parsed = businessDate(date)
    return parsed ? { task: 'form', formType, storeId: store, businessDate: parsed } : null
  }, [formType, store, date])

  const write = useCallback((payload: T): boolean => {
    const current = activeRef.current
    if (!current) return false
    const draft = { ...current, updatedAt: new Date().toISOString(), payload }
    activeRef.current = draft
    setActive(draft)
    try {
      const saved = saveDraft(localStorage, draft, validate).state === 'saved'
      setStorageFailed(!saved)
      if (saved) setLastSavedAt(draft.updatedAt)
      return saved
    } catch {
      setStorageFailed(true)
      return false
    }
  }, [validate])
  const persist = useCallback((form: F) => {
    setDirty(true)
    // Editing a draft that was already saved starts a new record; the saved one never changes.
    return write({ form, savedId: null })
  }, [write])
  const markSaved = useCallback((id: string) => {
    if (activeRef.current) write({ form: activeRef.current.payload.form, savedId: id })
    setDirty(false)
  }, [write])

  const open = (draft: Draft<T>) => {
    if (draft.context.task !== 'form' || draft.context.formType !== formType || !draft.context.businessDate) return
    setStore(draft.context.storeId)
    setDate(draft.context.businessDate)
    setLastSavedAt(null)
    activeRef.current = draft
    setActive(draft)
    write(draft.payload)
    setDirty(false)
  }

  const close = () => {
    const current = activeRef.current
    if (current && !write(current.payload)) return
    activeRef.current = null
    setActive(null)
    setDirty(false)
    requestAnimationFrame(() => focusField('form-draft-preparer'))
  }

  if (active) {
    return (
      <>
        <div className="max-w-[8.5in] mx-auto mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 print:hidden">
          <p className="break-words text-sm font-medium text-gray-900">{t('drafts.active', { store: STORE_LABELS[active.context.storeId], date: active.context.businessDate!, preparer: active.preparer })}</p>
          <p role="status" aria-live="polite" className="text-sm text-gray-700">
            {active.payload.savedId ? `✓ ${t('formDrafts.saved')}` : storageFailed ? `✕ ${t('drafts.storageUnavailable')}` : lastSavedAt ? `✓ ${t('drafts.savedAt', { time: new Date(lastSavedAt).toLocaleTimeString() })}` : `! ${t('common.unsaved')}`}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={close} className={small}>{t('drafts.change')}</button>
            <button type="button" onClick={() => downloadDraftSource(JSON.stringify(activeRef.current, null, 2))} className="min-h-11 px-3 py-2 text-sm text-red-700 underline">{t('drafts.downloadCurrent')}</button>
          </div>
        </div>
        {children({ draft: active, persist, markSaved })}
      </>
    )
  }

  return (
    <section aria-labelledby="form-draft-title" className="max-w-3xl print:hidden">
      <h2 id="form-draft-title" className="text-lg font-semibold text-gray-900">{t(title)}</h2>
      <p className="mt-1 text-sm text-gray-700">{t('formDrafts.intro')}</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="form-draft-store" className="text-sm font-medium text-gray-700">{t('common.store')}</label>
          <select id="form-draft-store" value={store} onChange={e => setStore(e.target.value as CashoutStore)} className={field}>
            {CASHOUT_STORES.map(s => <option key={s} value={s}>{STORE_LABELS[s]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="form-draft-date" className="text-sm font-medium text-gray-700">{t('common.date')}</label>
          <input id="form-draft-date" type="date" value={date} onChange={e => setDate(e.target.value)} className={field} />
        </div>
        <div>
          <LabeledInput id="form-draft-preparer" label={{ key: 'drafts.preparer' }} maxLength={120} value={preparer} onChange={e => setPreparer(e.target.value)} className={field} aria-describedby="form-draft-preparer-help" />
          <p id="form-draft-preparer-help" className="mt-1 max-w-sm text-sm text-gray-600">{t('drafts.preparerHelp')}</p>
        </div>
      </div>
      {storageFailed && <p role="alert" className="my-3 text-sm text-red-700">{t('drafts.storageUnavailable')}</p>}
      {context
        ? <DraftChooser context={context} preparer={preparer} createPayload={() => ({ form: createForm(context.businessDate!), savedId: null })} validate={validate} onOpen={open} />
        : <p className="my-3 text-sm text-gray-700">{t('imports.pickDate')}</p>}
    </section>
  )
}
