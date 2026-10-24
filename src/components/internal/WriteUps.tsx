'use client'

import { useCallback, useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { CodeGate } from './CashOut'
import { StoreAuthError } from '@/lib/schedule-store'
import {
  ACTIONS,
  VIOLATIONS,
  fetchWriteUp,
  fetchWriteUps,
  saveWriteUp,
  saveWriteUpLabel,
  type WriteUpDoc,
  type WriteUpForm,
} from '@/lib/writeup-store'
import { NO_FILTER, SAVED_FORM_TYPES, filterSavedForms, isFiltered, type SavedFormFilter, type SavedFormRow } from '@/lib/forms'
import { useInternalLanguage } from './InternalLanguage'
import { EmptyState, focusField } from './Feedback'

const today = () => new Date().toLocaleDateString('en-CA')
const emptyForm = (): WriteUpForm => ({
  date: today(),
  employee: '',
  manager: '',
  violations: [],
  otherSpecify: '',
  actions: [],
  incident: '',
  incidentCont: '',
  expected: '',
  employeeComments: '',
  employeeSignature: '',
  employeeSignedDate: '',
  managerSignature: '',
  managerSignedDate: '',
})

type View = { kind: 'list' } | { kind: 'new' } | { kind: 'saved'; doc: WriteUpDoc }

const button = 'min-h-11 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50'
const primary = `${button} bg-red-600 text-white hover:bg-red-700`
const secondary = `${button} border border-gray-300 text-gray-700 hover:bg-gray-50`

/** Employee write-ups: a list of saved records plus the paper form, behind the manager code. */
export default function WriteUps() {
  // Manager token lives in memory only, like cash out.
  const [token, setToken] = useState('')
  if (!token) {
    return (
      <div className="max-w-6xl mx-auto px-4">
        <CodeGate onUnlock={setToken} title="Employee write-ups" />
      </div>
    )
  }
  return <WriteUpBook token={token} onLocked={() => setToken('')} />
}

function WriteUpBook({ token, onLocked }: { token: string; onLocked: () => void }) {
  const [view, setView] = useState<View>({ kind: 'list' })
  const [list, setList] = useState<SavedFormRow[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  const run = useCallback(
    async (task: () => Promise<string | void>) => {
      setBusy(true)
      setStatus('')
      try {
        const message = await task()
        if (message) setStatus(message)
      } catch (caught) {
        if (caught instanceof StoreAuthError) onLocked()
        else setStatus((caught as Error).message)
      } finally {
        setBusy(false)
      }
    },
    [onLocked],
  )

  const refresh = useCallback(
    () =>
      run(async () => {
        setLoadFailed(false)
        try {
          setList((await fetchWriteUps(token)).map(w => ({ type: 'write-up' as const, ...w })))
        } catch (caught) {
          // Keep the last good list on screen so a failed refresh never reads as "no records".
          if (!(caught instanceof StoreAuthError)) setLoadFailed(true)
          throw caught
        }
      }),
    [run, token],
  )

  useEffect(() => {
    refresh()
  }, [refresh])

  const open = (row: SavedFormRow) => run(async () => setView({ kind: 'saved', doc: await fetchWriteUp(row.id, token) }))
  const back = () => {
    setView({ kind: 'list' })
    refresh()
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 print:hidden">
        <h1 className="text-2xl font-bold text-gray-900">Employee write-ups</h1>
        <div className="flex gap-2">
          {view.kind !== 'list' && (
            <button type="button" onClick={back} className={secondary}>
              Back to list
            </button>
          )}
          {view.kind !== 'list' && (
            <button type="button" onClick={() => window.print()} className={secondary}>
              Print
            </button>
          )}
          {view.kind === 'list' && (
            <button type="button" onClick={() => setView({ kind: 'new' })} className={primary}>
              New write-up
            </button>
          )}
        </div>
      </div>
      {status && !(view.kind === 'list' && loadFailed) && (
        <p role="status" className="mb-4 text-sm text-red-700 print:hidden">
          {status}
        </p>
      )}

      {view.kind === 'list' && <SavedFormsList list={list} failed={loadFailed} busy={busy} onOpen={open} onRetry={refresh} />}
      {view.kind === 'new' && (
        <NewWriteUp
          busy={busy}
          onSave={form =>
            run(async () => {
              const id = await saveWriteUp(form, token)
              setView({ kind: 'saved', doc: await fetchWriteUp(id, token) })
              return 'Saved.'
            })
          }
        />
      )}
      {view.kind === 'saved' && (
        <>
          <LabelEditor
            key={view.doc.id}
            doc={view.doc}
            busy={busy}
            onSave={label =>
              run(async () => {
                await saveWriteUpLabel(view.doc.id, label, token)
                setView({ kind: 'saved', doc: { ...view.doc, label } })
                return 'Label saved.'
              })
            }
          />
          <PaperForm form={view.doc.form} />
        </>
      )}
    </div>
  )
}

const field = 'mt-1 block w-full min-h-11 rounded-lg border border-gray-300 bg-white px-3 py-2 text-base font-normal text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900'

/** Search/filter over the saved list; `list` null with `failed` means the last load did not arrive. */
function SavedFormsList({ list, failed, busy, onOpen, onRetry }: { list: SavedFormRow[] | null; failed: boolean; busy: boolean; onOpen: (row: SavedFormRow) => void; onRetry: () => void }) {
  const { t } = useInternalLanguage()
  const [filter, setFilter] = useState<SavedFormFilter>(NO_FILTER)
  const set = (patch: Partial<SavedFormFilter>) => setFilter(f => ({ ...f, ...patch }))
  const shown = list ? filterSavedForms(list, filter) : []
  return (
    <section aria-labelledby="saved-forms-title">
      <h2 id="saved-forms-title" className="text-lg font-semibold text-gray-900 mb-3">{t('forms.savedTitle')}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-3">
        <div>
          <label htmlFor="saved-forms-search" className="text-sm font-medium text-gray-700">{t('forms.search')}</label>
          <input id="saved-forms-search" type="search" value={filter.query} onChange={e => set({ query: e.target.value })} className={field} />
        </div>
        <div>
          <label htmlFor="saved-forms-type" className="text-sm font-medium text-gray-700">{t('forms.type')}</label>
          <select id="saved-forms-type" value={filter.type} onChange={e => set({ type: e.target.value as SavedFormFilter['type'] })} className={field}>
            <option value="">{t('forms.allTypes')}</option>
            {SAVED_FORM_TYPES.map(type => <option key={type} value={type}>{t(`forms.type.${type}`)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="saved-forms-from" className="text-sm font-medium text-gray-700">{t('forms.from')}</label>
          <input id="saved-forms-from" type="date" value={filter.from} max={filter.to || undefined} onChange={e => set({ from: e.target.value })} className={field} />
        </div>
        <div>
          <label htmlFor="saved-forms-to" className="text-sm font-medium text-gray-700">{t('forms.to')}</label>
          <input id="saved-forms-to" type="date" value={filter.to} min={filter.from || undefined} onChange={e => set({ to: e.target.value })} className={field} />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p role="status" aria-live="polite" className="text-sm text-gray-700">{list ? t('forms.count', { shown: shown.length, total: list.length }) : busy ? t('common.loading') : ''}</p>
        {isFiltered(filter) && <button type="button" onClick={() => { setFilter(NO_FILTER); focusField('saved-forms-search') }} className={secondary}>{t('forms.clearFilters')}</button>}
      </div>
      {failed && (
        <div role="alert" className="mb-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          <p>✕ {t('forms.loadFailed')}</p>
          <button type="button" disabled={busy} onClick={onRetry} className={`${secondary} mt-2`}>{t('forms.retry')}</button>
        </div>
      )}
      {list && list.length === 0 && <EmptyState message={{ key: 'forms.none' }} />}
      {list && list.length > 0 && shown.length === 0 && <EmptyState message={{ key: 'forms.noMatches' }} />}
      {shown.length > 0 && (
        <table className="w-full text-base border border-gray-200 rounded">
          <thead className="bg-gray-50 text-left text-sm text-gray-700">
            <tr>
              <th className="px-3 py-2 font-medium">{t('forms.colDate')}</th>
              <th className="px-3 py-2 font-medium hidden sm:table-cell">{t('forms.colType')}</th>
              <th className="px-3 py-2 font-medium">{t('forms.colEmployee')}</th>
              <th className="px-3 py-2 font-medium hidden sm:table-cell">{t('forms.colLabel')}</th>
              <th className="px-3 py-2"><span className="sr-only">{t('forms.open')}</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {shown.map(row => (
              <tr key={`${row.type}:${row.id}`}>
                <td className="px-3 py-2 tabular-nums whitespace-nowrap">{row.date}<span className="block text-sm text-gray-600 sm:hidden">{t(`forms.type.${row.type}`)}</span></td>
                <td className="px-3 py-2 hidden sm:table-cell">{t(`forms.type.${row.type}`)}</td>
                <td className="px-3 py-2 break-words">{row.employee}<span className="block text-sm text-gray-600 sm:hidden">{row.label}</span></td>
                <td className="px-3 py-2 text-gray-700 hidden sm:table-cell">{row.label}</td>
                <td className="px-3 py-2 text-right">
                  <button type="button" disabled={busy} onClick={() => onOpen(row)}
                    aria-label={t('forms.openNamed', { type: t(`forms.type.${row.type}`), employee: row.employee, date: row.date })}
                    className={secondary}>{t('forms.open')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

function NewWriteUp({ busy, onSave }: { busy: boolean; onSave: (form: WriteUpForm) => void }) {
  const [form, setForm] = useState<WriteUpForm>(emptyForm)

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!busy) onSave(form)
  }

  return (
    <form onSubmit={submit}>
      <PaperForm form={form} onChange={patch => setForm(f => ({ ...f, ...patch }))} />
      <div className="max-w-[8.5in] mx-auto mt-4 flex items-center justify-end gap-3 print:hidden">
        <p className="text-sm text-gray-500">Once saved, the form can't be edited. Only its label can.</p>
        <button type="submit" disabled={busy || !form.employee.trim() || !form.date} className={primary}>
          {busy ? 'Saving…' : 'Save write-up'}
        </button>
      </div>
    </form>
  )
}

function LabelEditor({ doc, busy, onSave }: { doc: WriteUpDoc; busy: boolean; onSave: (label: string) => void }) {
  const [label, setLabel] = useState(doc.label)
  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        if (!busy) onSave(label.trim())
      }}
      className="max-w-[8.5in] mx-auto mb-4 flex flex-wrap items-end gap-2 print:hidden"
    >
      <label className="flex-1 min-w-60 text-sm font-medium text-gray-700">
        Label <span className="font-normal text-gray-500">(managers only, not part of the form)</span>
        <input
          value={label}
          maxLength={120}
          onChange={e => setLabel(e.target.value)}
          placeholder="e.g. Second attendance warning"
          className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-red-500"
        />
      </label>
      <button type="submit" disabled={busy || label.trim() === doc.label} className={primary}>
        Save label
      </button>
      <p className="w-full text-xs text-gray-500">
        Saved {new Date(doc.createdAt).toLocaleString()}
        {doc.labelUpdatedAt && ` · label updated ${new Date(doc.labelUpdatedAt).toLocaleString()}`}
      </p>
    </form>
  )
}

// --- The paper form: mirrors docs/forms/25-1024 CHINA ROSE WRITE_UP_Form.xlsx (two sheets, Arial, bold boxes). ---

type Change = (patch: Partial<WriteUpForm>) => void
const line = 'border-0 border-b border-black bg-transparent px-1 font-normal focus:outline-none focus:bg-yellow-50 disabled:text-black'

function Sheet({ children, pageBreak }: { children: ReactNode; pageBreak?: boolean }) {
  return (
    <div className={`max-w-[8.5in] mx-auto bg-white border border-gray-300 shadow-sm px-10 py-8 mb-6 font-[Arial,Helvetica,sans-serif] font-bold text-black print:border-0 print:shadow-none print:m-0 print:p-0 ${pageBreak ? 'print:break-before-page' : ''}`}>
      <img src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/imgs/china-rose-logo.png`} alt="China Rose" className="h-9 mb-2" />
      <h2 className="text-[25px] text-center border-b-2 border-black pb-2 mb-4 print:mb-2">RECORD OF EMPLOYEE CORRECTIVE ACTION</h2>
      {children}
      <p className="text-right text-xs mt-3">OCT, 2025</p>
    </div>
  )
}

function Box({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="border-2 border-black mb-4 print:mb-2">
      {title && <h3 className="border-b-2 border-black px-2 py-2 text-lg print:py-1 print:text-base">{title}</h3>}
      <div className="px-3 py-3 print:py-1">{children}</div>
    </section>
  )
}

function Check({ label, checked, onToggle }: { label: string; checked: boolean; onToggle?: () => void }) {
  return (
    <label className="flex items-center gap-2 text-lg">
      {/* Not disabled when read-only: disabled checkboxes print grey, and the tick must stay legible. */}
      <input type="checkbox" checked={checked} aria-readonly={!onToggle} onChange={onToggle ?? (() => {})} className={`size-5 accent-black ${onToggle ? '' : 'pointer-events-none'}`} />
      {label}
    </label>
  )
}

function Area({ label, value, rows, onChange }: { label: string; value: string; rows: number; onChange?: (v: string) => void }) {
  return (
    <Box title={label}>
      <textarea
        aria-label={label.replace(/ :$/, '')}
        value={value}
        rows={rows}
        maxLength={3000}
        disabled={!onChange}
        onChange={e => onChange?.(e.target.value)}
        className="w-full resize-none bg-transparent font-normal text-base leading-10 focus:outline-none focus:bg-yellow-50 disabled:text-black print:hidden"
      />
      {/* A textarea prints only its visible rows, so paper gets the full text instead. */}
      <p data-print-text className="hidden whitespace-pre-wrap break-words font-normal text-base leading-7 print:block" style={{ minHeight: `${rows * 1.75}rem` }}>
        {value}
      </p>
    </Box>
  )
}

/** Editable when `onChange` is given, otherwise a read-only copy of a saved write-up. */
function PaperForm({ form, onChange }: { form: WriteUpForm; onChange?: Change }) {
  const readOnly = !onChange
  const set = <K extends keyof WriteUpForm>(key: K) => (onChange ? (value: WriteUpForm[K]) => onChange({ [key]: value }) : undefined)
  const toggle = (key: 'violations' | 'actions', id: string) =>
    onChange ? () => onChange({ [key]: form[key].includes(id) ? form[key].filter(x => x !== id) : [...form[key], id] }) : undefined
  const violation = (id: string) => VIOLATIONS.find(v => v.id === id)!.label
  const action = (id: string) => ACTIONS.find(a => a.id === id)!.label

  return (
    <>
      <Sheet>
        <Box>
          <label className="flex items-center gap-3 text-base mb-6 print:mb-2">
            DATE
            <input type="date" required value={form.date} disabled={readOnly} onChange={e => set('date')?.(e.target.value)} className={`${line} w-48`} />
          </label>
          <div className="grid grid-cols-2 gap-10 text-base">
            <label className="flex flex-col-reverse gap-1">
              EMPLOYEE
              <input required maxLength={60} value={form.employee} disabled={readOnly} onChange={e => set('employee')?.(e.target.value)} className={line} />
            </label>
            <label className="flex flex-col-reverse gap-1">
              MANAGER / SUPERVISOR
              <input maxLength={60} value={form.manager} disabled={readOnly} onChange={e => set('manager')?.(e.target.value)} className={line} />
            </label>
          </div>
        </Box>
        <Box>
          <p className="text-[13px] leading-6">
            This is a record of correction action taken to address infrractions of company policy, attendance, job performance
            infractions, conduct or behavior infractions or other voilations of the operational policies, procedures or code of
            conduct per operation guidance.
          </p>
        </Box>
        <Box title="This corrective action is being taken for violation(s) of following conducts">
          <div className="grid grid-cols-3 gap-x-4 gap-y-5 py-2 print:gap-y-2 print:py-0">
            <Check label={violation('attendance')} checked={form.violations.includes('attendance')} onToggle={toggle('violations', 'attendance')} />
            <Check label={violation('job-performance')} checked={form.violations.includes('job-performance')} onToggle={toggle('violations', 'job-performance')} />
            <Check label={violation('others')} checked={form.violations.includes('others')} onToggle={toggle('violations', 'others')} />
            <Check label={violation('conduct')} checked={form.violations.includes('conduct')} onToggle={toggle('violations', 'conduct')} />
            <Check label={violation('company-policy')} checked={form.violations.includes('company-policy')} onToggle={toggle('violations', 'company-policy')} />
            <label className="flex items-center gap-2 text-base">
              SPECIFY :
              <input maxLength={60} value={form.otherSpecify} disabled={readOnly} onChange={e => set('otherSpecify')?.(e.target.value)} className={`${line} min-w-0 flex-1`} />
            </label>
          </div>
        </Box>
        <Box title="Type of Warning / Actions by Company :">
          <div className="grid grid-cols-3 gap-x-4 gap-y-5 py-2 print:gap-y-2 print:py-0">
            <Check label={action('verbal')} checked={form.actions.includes('verbal')} onToggle={toggle('actions', 'verbal')} />
            <Check label={action('written')} checked={form.actions.includes('written')} onToggle={toggle('actions', 'written')} />
            <span />
            <Check label={action('suspension')} checked={form.actions.includes('suspension')} onToggle={toggle('actions', 'suspension')} />
            <Check label={action('termination')} checked={form.actions.includes('termination')} onToggle={toggle('actions', 'termination')} />
          </div>
        </Box>
        <Area label="Incident Descriptions :" rows={4} value={form.incident} onChange={set('incident')} />
      </Sheet>

      <Sheet pageBreak>
        <Area label="Incident Descriptions (Cont'd) :" rows={4} value={form.incidentCont} onChange={set('incidentCont')} />
        <Area label="Expected Correction Action(s) from Manager / Supervisor :" rows={5} value={form.expected} onChange={set('expected')} />
        <Area label="Employee Comments :" rows={5} value={form.employeeComments} onChange={set('employeeComments')} />
        <Box>
          {(
            [
              ['Employee Signature :', 'employeeSignature', 'employeeSignedDate'],
              ['Manager Signature :', 'managerSignature', 'managerSignedDate'],
            ] as const
          ).map(([label, name, date]) => (
            <div key={name} className="grid grid-cols-[13rem_1fr_auto_10rem] items-end gap-3 text-lg py-3">
              <span>{label}</span>
              <input aria-label={label.replace(' :', '')} maxLength={60} value={form[name]} disabled={readOnly} onChange={e => set(name)?.(e.target.value)} className={line} />
              <span>Date</span>
              <input type="date" aria-label={`${label.replace(' Signature :', '')} signed date`} value={form[date]} disabled={readOnly} onChange={e => set(date)?.(e.target.value)} className={line} />
            </div>
          ))}
        </Box>
      </Sheet>
    </>
  )
}
