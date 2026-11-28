'use client'

import { useImportResume } from './ImportResumeTransition'
import { checkpointImport } from '@/lib/converter/import-checkpoint'
import { useShellTask } from './ShellTask'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigationProtection } from './NavigationProtection'
import { useInternalLanguage } from './InternalLanguage'
import { ErrorSummary, focusField, useConfirmation, type FieldIssue } from './Feedback'
import { errorKey, type Message, type TranslationKey } from '@/lib/internal-tools/i18n'
import { readSalesFile, sourceNumber, SourceValidationError } from '@/lib/converter/validation'
import SourceFileInput, { UNCHECKED, type FileValidation } from './SourceFileInput'
import { reviewSales, updateSalesCash, type SalesReview as Review } from '@/lib/converter/sales-review'
import SalesReview from './SalesReview'
import { generateSalesOutput } from '@/lib/converter/fillTemplate'
import { downloadWorkbookOutput, type WorkbookOutput } from '@/lib/converter/workbook-output'
import { businessDate } from '@/lib/internal-tools/contracts'
import { importStore, type ImportSnapshot } from '@/lib/converter/import-snapshot'
import ImportHistory from './ImportHistory'
import ImportRecovery from './ImportRecovery'
import { InternalTheme } from './ui/Theme'
import { Paper, Button } from './ui/controls'
import styles from './sales-stages.module.css'
import type { DraftContext } from '@/lib/internal-tools/drafts'
import type { fetchCashoutSnapshot } from '@/lib/cashout-store'

type FileKey = 'general' | 'lunch' | 'dinner'
type FileMap = Record<FileKey, File | null>

export const LOCATIONS = ['CHINA ROSE #3 - 7046 W MILITARY DR', 'CHINA ROSE #2 - 2535 SW MILITARY DR']
import { weekday, salesContext, consistentSalesContext, needsContextReview, type CashoutLink } from '@/lib/converter/sales-context'
const EMPTY_FORM = {
  firstName: '', lastName: '', day: '', date: '', location: '',
  amDeposit: '', pmDeposit: '', amOverShort: '', pmOverShort: '',
}

const inputClass =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1'
const dollars = (cents: number | null) => (cents === null ? '' : (cents / 100).toFixed(2))

/**
 * Toast Excel → bookkeeping Excel. Ported from the excel-converter repo; same
 * fields, same cells, same filename. `loadCashout` fills the AM/PM deposit and
 * over/short fields from a saved cash-out day when the manager is unlocked.
 */
export default function SalesConverter({
  loadCashout, token = '',
}: { token?: string;
  loadCashout: ((location: string, date: string) => ReturnType<typeof fetchCashoutSnapshot>) | null
}) {
  const { t: tr } = useInternalLanguage()
  const [stage, setStage] = useState<'files' | 'review' | 'report'>('files')
  const stageHeading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { stageHeading.current?.focus() }, [stage])
  const parsed = useRef<Partial<Record<FileKey, NonNullable<Awaited<ReturnType<typeof readSalesFile>>['value']>>>>({})
  const [cashoutLink, setCashoutLink] = useState<CashoutLink | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [files, setFiles] = useState<FileMap>({ general: null, lunch: null, dinner: null })
  const [validation, setValidation] = useState<Record<FileKey, FileValidation>>({ general: UNCHECKED, lunch: UNCHECKED, dinner: UNCHECKED })
  const generation = useRef({ general: 0, lunch: 0, dinner: 0 })
  const converting = useRef(false)
  const [busy, setBusy] = useState(false)
  const [review, setReview] = useState<Review | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)
  const [output, setOutput] = useState<WorkbookOutput | null>(null)
  const [deviceSaved, setDeviceSaved] = useState(false)
  const [fileReset, setFileReset] = useState(0)
  const [resumed, setResumed] = useState(false)
  const confirmation = useConfirmation()
  const editVersion = useRef(0)
  const cashoutRequest = useRef(0)
  const [status, setStatus] = useState<Message | null>(null)
  const [issues, setIssues] = useState<FieldIssue[]>([])
  useNavigationProtection({ scope: 'sales-import', busy, checkpoint: () => {
    const dirty = Object.values(form).some(Boolean) || Object.values(files).some(Boolean) || !!review
    if (!dirty) return true
    try { return checkpointImport(localStorage, snapshot, `${form.firstName} ${form.lastName}`.trim()) } catch { return false }
  }, dirty: Object.values(form).some(Boolean) || Object.values(files).some(Boolean), deviceSaved })

  useShellTask('sales', { context: [importStore(form.location), form.date].filter(Boolean).join(' · ') })

  function invalidateReview() { editVersion.current++; setReview(null); setOutput(null); setDeviceSaved(false); setAcknowledged(false); setStatus(null) }
  const handleInput = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const name = e.target.name
    if (['amDeposit', 'pmDeposit', 'amOverShort', 'pmOverShort'].includes(name)) {
      const next = { ...form, [name]: e.target.value }
      editVersion.current++; setOutput(null); setDeviceSaved(false); setAcknowledged(false); setStatus(null); setCashoutLink(null)
      setForm(next); setReview(current => current ? { ...updateSalesCash(current, next), context: current.context ? { ...current.context, cashout: null } : undefined } : null)
      return
    }
    if (resumed && review) {
      const next = { ...form, [name]: e.target.value, ...(name === 'date' ? { day: weekday(e.target.value) } : {}) }
      editVersion.current++; setOutput(null); setDeviceSaved(false); setAcknowledged(false); setStatus(null); setCashoutLink(null); setIssues([])
      setForm(next); setReview({ ...updateSalesCash(review, next), context: review.context ? { ...review.context, cashout: null, reason: ['date','location'].includes(name) ? '' : review.context.reason } : undefined })
      return
    }
    invalidateReview()
    setStage('files')
    setCashoutLink(null)
    setForm({ ...form, [e.target.name]: e.target.value, ...(e.target.name === 'date' ? { day: weekday(e.target.value) } : {}) })
  }

  async function fillFromCashout() {
    if (!loadCashout) return
    const missing: FieldIssue[] = []
    if (!form.location) missing.push({ fieldId: 'sc-location', message: { key: 'imports.pickLocation' } })
    if (!form.date) missing.push({ fieldId: 'sc-date', message: { key: 'imports.pickDate' } })
    setIssues(missing)
    if (missing.length) { setStatus(null); focusField(missing[0].fieldId); return }
    const version = editVersion.current
    const request = ++cashoutRequest.current
    setStatus({ key: 'imports.loadingCashout' })
    try {
      const saved = await loadCashout(form.location, form.date)
      if (editVersion.current !== version || cashoutRequest.current !== request) return
      if (!saved) { setCashoutLink(null); return setStatus({ key: 'imports.noCashout', params: { date: form.date } }) }
      editVersion.current++; setOutput(null); setAcknowledged(false); setDeviceSaved(false)
      const totals = saved.totals
      setCashoutLink(saved.link)
      const next = {
        ...form,
        amDeposit: dollars(totals.amDeposit),
        pmDeposit: dollars(totals.pmDeposit),
        amOverShort: dollars(totals.amOverShort),
        pmOverShort: dollars(totals.pmOverShort),
      }
      setForm(next); setReview(current => current ? { ...updateSalesCash(current, next), context: current.context ? { ...current.context, cashout: saved.link } : undefined } : null)
      setStatus({ key: 'imports.filledCashout', params: { date: form.date } })
    } catch (err) {
      if (editVersion.current === version && cashoutRequest.current === request) setStatus({ key: errorKey(err) })
    }
  }

  async function selectFile(key: FileKey, file: File) {
    invalidateReview()
    setResumed(false); setStage('files'); delete parsed.current[key]
    const version = ++generation.current[key]
    setFiles(current => ({ ...current, [key]: file }))
    setStatus(null)
    setValidation(current => ({ ...current, [key]: { ...UNCHECKED, checking: true } }))
    const result = await readSalesFile(file, key)
    if (generation.current[key] !== version) return
    setValidation(current => ({ ...current, [key]: { checking: false, valid: !!result.value, issues: result.issues } }))
    if (result.value) parsed.current[key] = result.value
    if (parsed.current.general && parsed.current.lunch && parsed.current.dinner) {
      const metadata = consistentSalesContext(salesContext(Object.fromEntries((['general','lunch','dinner'] as const).map(slot => [slot, { name: '', workbook: parsed.current[slot]! }])) as Parameters<typeof salesContext>[0]))
      if (metadata) setForm(current => ({ ...current, date: current.date || metadata.date, day: weekday(current.date || metadata.date), location: current.location || LOCATIONS.find(location => importStore(location) === metadata.store) || '' }))
    }
  }

  async function handlePrepare() {
    if (converting.current || !files.general || !files.lunch || !files.dinner) return
    const invalid: FieldIssue[] = []
    if (!form.location) invalid.push({ fieldId: 'sc-location', message: { key: 'imports.pickLocation' } })
    if (!form.date) invalid.push({ fieldId: 'sc-date', message: { key: 'imports.pickDate' } })
    setIssues(invalid)
    if (invalid.length) { setStatus(null); focusField(invalid[0].fieldId); return }
    invalidateReview()
    converting.current = true
    setBusy(true)
    setStatus({ key: 'imports.parsing' })
    try {
      const keys = ['general', 'lunch', 'dinner'] as const
      const results = await Promise.all(keys.map(key => readSalesFile(files[key]!, key)))
      setValidation(Object.fromEntries(keys.map((key, i) => [key, { checking: false, valid: !!results[i].value, issues: results[i].issues }])) as Record<FileKey, FileValidation>)
      const firstBad = results.findIndex(result => !result.value)
      if (firstBad !== -1) { setStatus({ key: 'importValidation.blocked' }); focusField(`sc-file-${keys[firstBad]}`); return }
      const sources = {
        general: { name: files.general.name, workbook: results[0].value! },
        lunch: { name: files.lunch.name, workbook: results[1].value! },
        dinner: { name: files.dinner.name, workbook: results[2].value! },
      }
      const safeForm = { ...form, day: weekday(form.date) }
      for (const name of ['amDeposit','pmDeposit','amOverShort','pmOverShort'] as const) if (safeForm[name].trim() && sourceNumber(safeForm[name]) === null) safeForm[name] = ''
      const prepared = updateSalesCash(reviewSales(sources, safeForm), { ...form, day: weekday(form.date) })
      prepared.sources = prepared.sources.map((source, index) => ({ ...source, fingerprint: results[index].fingerprint }))
      setReview({ ...prepared, context: salesContext(sources, cashoutLink) })
      setStatus({ key: 'salesReview.prepared' }); setStage('review')
    } catch (err) {
      setStatus({ key: err instanceof SourceValidationError ? 'importValidation.blocked' : 'importValidation.exportFailed' })
    } finally { converting.current = false; setBusy(false) }
  }

  async function handleConvert(download = false) {
    if (converting.current || !businessDate(form.date) || !importStore(form.location) || cashIssues.length || !review || !acknowledged || (needsContextReview(review.context, review.form.date, importStore(review.form.location)) && !review.context?.reason.trim())) return
    editVersion.current++ // Ignore an earlier cash-out fill arriving during this snapshot’s export.
    converting.current = true
    setBusy(true)
    setStatus({ key: 'imports.parsing' })
    try {
      const generated = output ?? await generateSalesOutput(review.metrics, review.form)
      if (!output) { setOutput(generated); setDeviceSaved(false) }
      setStage('report')
      if (download) { await downloadWorkbookOutput(generated); setStatus({ key: 'salesStages.downloadStarted' }) }
      else setStatus({ key: 'salesStages.generated' })
    } catch { setStatus({ key: 'importValidation.exportFailed' }) }
    finally { converting.current = false; setBusy(false) }
  }

  const context = useMemo<DraftContext | null>(() => {
    const storeId = importStore(form.location), date = businessDate(form.date)
    return storeId && date ? { task: 'sales-import', storeId, businessDate: date } : null
  }, [form.location, form.date])
  const snapshot = useMemo<ImportSnapshot | null>(() => review && !(['amDeposit','pmDeposit','amOverShort','pmOverShort'] as const).some(name => form[name].trim() && sourceNumber(form[name]) === null) ? { version: 1, kind: 'sales', review, output } : null, [review, output, form])
  function restoreSnapshot(snapshot: ImportSnapshot) {
    if (snapshot.kind !== 'sales') return
    invalidateReview()
    for (const key of ['general','lunch','dinner'] as const) generation.current[key]++
    setCashoutLink(snapshot.review.context?.cashout ?? null); setForm({ ...snapshot.review.form, day: weekday(snapshot.review.form.date) }); setFiles({ general: null, lunch: null, dinner: null })
    setValidation({ general: UNCHECKED, lunch: UNCHECKED, dinner: UNCHECKED }); setFileReset(value => value + 1)
    setReview(snapshot.review); setOutput(snapshot.output); setAcknowledged(false); setResumed(true); setIssues([])
    parsed.current = {}; setStage('review'); setStatus({ key: 'salesStages.restored' })
  }
  useImportResume('sales', restoreSnapshot)

  async function startNext() {
    if (busy || (Object.values(form).some(Boolean) || Object.values(files).some(Boolean) || review) && !await confirmation.ask({ key: 'importRetention.startWarning' }, true)) return
    invalidateReview()
    for (const key of ['general','lunch','dinner'] as const) generation.current[key]++
    parsed.current = {}; setStage('files'); setCashoutLink(null); setForm(EMPTY_FORM); setFiles({ general: null, lunch: null, dinner: null })
    setValidation({ general: UNCHECKED, lunch: UNCHECKED, dinner: UNCHECKED }); setIssues([]); setResumed(false); setFileReset(value => value + 1)
    setTimeout(() => focusField('sc-first'), 0)
  }

  const cashIssues = (['amDeposit', 'pmDeposit', 'amOverShort', 'pmOverShort'] as const).filter(name => form[name].trim() && sourceNumber(form[name]) === null)
  const canAccept = !!businessDate(form.date) && !!importStore(form.location) && !!review && acknowledged && !cashIssues.length && !(needsContextReview(review.context, review.form.date, importStore(review.form.location)) && !review.context?.reason.trim())
  const ready = Object.values(validation).every(value => value.valid && !value.checking)

  return (
    <InternalTheme><Paper emphasis="active" className={styles.workspace}>
      <h2 className="text-xl font-semibold text-gray-900">{tr('bookkeeping.sales')}</h2>
      <ol className={styles.stages} aria-label={tr('salesStages.label')}>
        {(['files', 'review', 'report'] as const).map((item, index) => <li key={item}><button type="button" data-sales-go={item} aria-current={stage === item ? 'step' : undefined} disabled={busy || item === 'review' && !review || item === 'report' && (!output || !canAccept)} onClick={() => setStage(item)}>{index + 1}. {tr(`salesStages.${item}`)}</button></li>)}
      </ol>
      <h3 ref={stageHeading} tabIndex={-1} className="text-lg font-semibold mb-4" data-sales-stage={stage}>{tr(`salesStages.${stage}`)}</h3>
      {confirmation.dialog}
      <ErrorSummary issues={issues} />
      <fieldset hidden={stage !== 'files'} disabled={busy} className="min-w-0">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="sc-first" className={labelClass}>{tr('imports.firstName')}</label>
          <input id="sc-first" name="firstName" value={form.firstName} onChange={handleInput} autoComplete="given-name" className={inputClass} />
        </div>
        <div>
          <label htmlFor="sc-last" className={labelClass}>{tr('imports.lastName')}</label>
          <input id="sc-last" name="lastName" value={form.lastName} onChange={handleInput} autoComplete="family-name" className={inputClass} />
        </div>
        <div>
          <label htmlFor="sc-day" className={labelClass}>{tr('imports.day')}</label>
          <input id="sc-day" name="day" value={form.day ? tr(`weekday.${form.day.toLowerCase()}` as TranslationKey) : ''} readOnly className={inputClass} />
        </div>
        <div>
          <label htmlFor="sc-date" className={labelClass}>{tr('common.date')}</label>
          <input id="sc-date" aria-describedby={issues.some(issue => issue.fieldId === 'sc-date') ? 'sc-date-summary-error' : undefined} aria-invalid={issues.some(issue => issue.fieldId === 'sc-date') || undefined} name="date" type="date" value={form.date} onChange={handleInput} className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="sc-location" className={labelClass}>{tr('imports.location')}</label>
          <select id="sc-location" aria-describedby={issues.some(issue => issue.fieldId === 'sc-location') ? 'sc-location-summary-error' : undefined} aria-invalid={issues.some(issue => issue.fieldId === 'sc-location') || undefined} name="location" value={form.location} onChange={handleInput} className={inputClass}>
            <option value="" disabled>{tr('imports.selectLocation')}</option>
            {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
        {(['general', 'lunch', 'dinner'] as FileKey[]).map(key => (
          <SourceFileInput key={`${key}:${fileReset}`} id={`sc-file-${key}`} label={`imports.${key}`} accept=".xlsx,.xls,.csv"
            beforeReplace={() => files[key] || review ? confirmation.ask({ key: 'importRetention.replaceWarning' }, true) : Promise.resolve(true)}
            file={files[key]} validation={validation[key]} disabled={busy} onFile={file => { void selectFile(key, file) }} />
        ))}
      </div>

      <Button id="sc-prepare" onClick={() => { if (review) setStage('review'); else void handlePrepare() }} disabled={!review && !ready || busy} variant="primary" className="mt-4">{tr('salesReview.prepare')}</Button>
      </fieldset>
      <fieldset hidden={stage !== 'review'} disabled={busy} className="min-w-0">
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-900">{tr('dashboard.deposits')}</h3>
        {loadCashout ? (
          <button
            type="button"
            disabled={busy}
            onClick={fillFromCashout}
            className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50"
          >
            {tr('imports.fillCashout')}
          </button>
        ) : (
          <span className="text-xs text-gray-500">{tr('imports.unlockCashout')}</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4 mt-2">
        {([
          ['amDeposit', tr('cash.shiftDeposit', { shift: 'AM' })],
          ['amOverShort', tr('cash.shiftOverShort', { shift: 'AM' })],
          ['pmDeposit', tr('cash.shiftDeposit', { shift: 'PM' })],
          ['pmOverShort', tr('cash.shiftOverShort', { shift: 'PM' })],
        ] as const).map(([name, label]) => (
          <div key={name}>
            <label htmlFor={`sc-${name}`} className={labelClass}>{label}</label>
            <input id={`sc-${name}`} aria-invalid={cashIssues.includes(name) || undefined} aria-describedby={issues.some(issue => issue.fieldId === `sc-${name}`) ? `sc-${name}-summary-error` : undefined} name={name} inputMode="decimal" value={form[name]} onChange={handleInput} className={inputClass} />
          </div>
        ))}
      </div>
      {cashIssues.map(name => <p key={name} role="alert"><a href={`#sc-${name}`} onClick={event => { event.preventDefault(); focusField(`sc-${name}`) }}>{tr(name.endsWith('Deposit') ? 'importValidation.manualDeposit' : 'importValidation.manualDifference', { shift: name.startsWith('am') ? 'AM' : 'PM' })}</a></p>)}
      </fieldset>
      <p id="sc-status" role="status" className="mt-2 text-sm text-gray-700 min-h-5">{status ? tr(status.key, status.params) : null}</p>

      {resumed && <p className="mt-3 text-sm text-gray-700">{tr('salesStages.restored')}</p>}
      <fieldset hidden={stage !== 'review'} disabled={busy}>{review && <SalesReview onEditContext={() => { setStage('files'); setTimeout(() => focusField('sc-location'), 0) }} onReason={reason => { if (reason === review.context?.reason) return; editVersion.current++; setReview({ ...review, context: { ...(review.context ?? { policy: 'DEC-01-v1', sources: ['general','lunch','dinner'].map(slot => ({ slot, dates: [], stores: [], uncertain: true })), cashout: null }), reason } }); setOutput(null); setAcknowledged(false); setDeviceSaved(false) }} review={review} acknowledged={acknowledged} onAcknowledge={setAcknowledged} />}</fieldset>
      <div hidden={stage !== 'review'} className={styles.actions}>
        <Button onClick={() => setStage('files')} disabled={busy}>{tr('salesStages.backFiles')}</Button>
        <Button id="sc-accept" onClick={() => void handleConvert()} disabled={!canAccept || busy} variant="primary">{tr('salesStages.accept')}</Button>
      </div>
      <div hidden={stage !== 'report'}>
        {output && <p className="mt-3 break-all">{output.filename}</p>}
        <div className={styles.actions}>
          <Button onClick={() => setStage('review')} disabled={busy}>{tr('salesStages.backReview')}</Button>
          <Button id="sc-download" onClick={() => void handleConvert(true)} disabled={!canAccept || busy || !output} variant="primary">{tr('salesStages.download')}</Button>
          <Button id="sc-next" disabled={busy} onClick={() => void startNext()}>{tr('importRetention.startNext')}</Button>
        </div>
      </div>
      <details open={stage === 'report'}><summary>{tr('salesStages.copies')}</summary>
      <ImportHistory sources={Object.values(files).filter((file): file is File => !!file)} token={token} context={context} snapshot={snapshot} preparer={`${form.firstName} ${form.lastName}`.trim()} accepted={acknowledged} busy={busy} hasWork={!!review} onRestore={restoreSnapshot} />
      <ImportRecovery context={context} preparer={`${form.firstName} ${form.lastName}`.trim()} snapshot={snapshot}
        hasWork={Object.values(form).some(Boolean) || Object.values(files).some(Boolean) || !!review} busy={busy} onRestore={restoreSnapshot} onSaved={setDeviceSaved} />
      </details>
    </Paper></InternalTheme>
  )
}
