'use client'

import { useImportResume } from './ImportResumeTransition'
import { checkpointImport } from '@/lib/converter/import-checkpoint'
import { useShellTask } from './ShellTask'

import EmployeeMapping from './EmployeeMapping'
import { mapHours, ambiguousNames, type ImportDirectory } from '@/lib/converter/employee-mapping'
import type { DirectoryRecord } from '@/lib/converter/import-api'
import { reviewHours } from '@/lib/converter/hours-review'
import HoursReview from './HoursReview'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigationProtection } from './NavigationProtection'
import { useInternalLanguage } from './InternalLanguage'
import type { Message } from '@/lib/internal-tools/i18n'
import { generateHoursOutput, readHoursFile } from '@/lib/converter/parseCSV'
import { SourceValidationError, type SourceResult, type HoursRow } from '@/lib/converter/validation'
import SourceFileInput, { UNCHECKED, type FileValidation } from './SourceFileInput'
import { ErrorSummary, focusField, useConfirmation, type FieldIssue } from './Feedback'
import { downloadWorkbookOutput, type WorkbookOutput } from '@/lib/converter/workbook-output'
import { businessDate } from '@/lib/internal-tools/contracts'
import { importStore, type ImportSnapshot } from '@/lib/converter/import-snapshot'
import type { DraftContext } from '@/lib/internal-tools/drafts'
import ImportHistory from './ImportHistory'
import ImportRecovery from './ImportRecovery'
import { InternalTheme } from './ui/Theme'
import { Paper, Button } from './ui/controls'
import styles from './hours-stages.module.css'
import { LOCATIONS } from './SalesConverter'

const inputClass =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

/** Validate Toast source rows before generating the familiar grouped hour log. */
export default function HoursConverter({token = ''}: {token?: string}) {
  const { t: tr } = useInternalLanguage()
  const [stage, setStage] = useState<'files' | 'review' | 'report'>('files')
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus() }, [stage])
  const [mappingDirty,setMappingDirty] = useState(false)
  const contextChoice = useRef(0)
  const [fingerprint,setFingerprint] = useState('')
  const [mapping,setMapping] = useState<{revision:number;directory:ImportDirectory}|null>(null)
  const [plant, setPlant] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [status, setStatus] = useState<Message | null>(null)
  const [validation, setValidation] = useState<FileValidation>(UNCHECKED)
  const [issues, setIssues] = useState<FieldIssue[]>([])
  const generation = useRef(0)
  const exportVersion = useRef(0)
  const converting = useRef(false)
  const [busy, setBusy] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)
  const [rows, setRows] = useState<HoursRow[] | null>(null)
  const [sourceName, setSourceName] = useState('')
  const [preparer, setPreparer] = useState('')
  const [output, setOutput] = useState<WorkbookOutput | null>(null)
  const [deviceSaved, setDeviceSaved] = useState(false)
  const [resumed, setResumed] = useState(false)
  const [fileReset, setFileReset] = useState(0)
  const confirmation = useConfirmation()
  useShellTask('hours', { context: [importStore(plant), startDate, endDate].filter(Boolean).join(' · ') })
  function invalidateOutput() { exportVersion.current++; setAcknowledged(false); setOutput(null); setDeviceSaved(false); setStatus(null) }
  const mappingChanged = useCallback((dirty: boolean) => { setMappingDirty(dirty); if (dirty) { exportVersion.current++; setAcknowledged(false); setOutput(null); setDeviceSaved(false); setStatus(null) } }, [])
  useNavigationProtection({ scope: 'hours-import', busy, checkpoint: () => {
    const dirty = !!(plant || startDate || endDate || preparer || csvFile || rows)
    if (!dirty) return true
    try { return checkpointImport(localStorage, snapshot, preparer) } catch { return false }
  }, dirty: !!(plant || startDate || endDate || preparer || csvFile), deviceSaved })

  async function changeContext(field:'plant'|'start'|'end',value:string) {
    const choice = ++contextChoice.current
    if (mappingDirty && !await confirmation.ask({key:'mapping.contextWarning'},true)) return
    if (choice !== contextChoice.current) return
    invalidateOutput(); setMappingDirty(false); setStage('files')
    if (field === 'plant') { setMapping(null); setPlant(value) }
    else if (field === 'start') setStartDate(value)
    else setEndDate(value)
  }

  async function selectFile(file: File) {
    contextChoice.current++
    invalidateOutput(); setStage('files'); setRows(null); setFingerprint(''); setMapping(null); setResumed(false); setSourceName(file.name)
    const version = ++generation.current
    setCsvFile(file)
    setStatus(null)
    setValidation({ ...UNCHECKED, checking: true })
    const result: SourceResult<HoursRow[]> = await readHoursFile(file, true)
    if (generation.current !== version) return
    if (!result.value) { setValidation({checking:false,valid:false,issues:result.issues}); return }
    let digest: ArrayBuffer
    try { digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer()) }
    catch { if (generation.current === version) setValidation({checking:false,valid:false,issues:[{key:'importValidation.unreadable'}]}); return }
    if (generation.current !== version) return
    setFingerprint('sha256:' + Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2,'0')).join(''))
    setRows(result.value)
    setValidation({ checking: false, valid: !!result.value && !result.issues.length, issues: result.issues })
  }

  async function handleConvertAndDownload(download = false) {
    if (converting.current || (!csvFile && !rows)) return
    const missing: FieldIssue[] = []
    if (!plant) missing.push({ fieldId: 'hc-location', message: { key: 'imports.chooseLocation' } })
    if (!startDate) missing.push({ fieldId: 'hc-start', message: { key: 'imports.pickDates' } })
    if (!endDate) missing.push({ fieldId: 'hc-end', message: { key: 'imports.pickDates' } })
    if (startDate && endDate && startDate > endDate) missing.push({ fieldId: 'hc-end', message: { key: 'importValidation.period' } })
    setIssues(missing)
    if (missing.length) { setStage('files'); setStatus(null); setTimeout(() => focusField(missing[0].fieldId), 0); return }
    converting.current = true
    setBusy(true)
    setStatus({ key: 'imports.parsing' })
    const exportAt = exportVersion.current
    try {
      if (!preview || !acknowledged || mappingBlocked || !preview.validPeriod || !preview.included.length) return
      const included = preview.included.map(row => { const mapped = identities.find(item => item.sourceRow === row.sourceRow); return row.values['Employee External Id'].trim() || !mapped?.employee ? row.values : { ...row.values, 'Employee External Id': mapped.employee.id } })
      const generated = output ?? await generateHoursOutput(included, { location: plant, startDate, endDate })
      if (exportAt !== exportVersion.current) return
      if (!output) { setOutput(generated); setDeviceSaved(false) }
      setStage('report')
      if (download) { await downloadWorkbookOutput(generated); setStatus({ key: 'hoursStages.downloadStarted' }) }
      else setStatus({ key: 'hoursStages.generated' })
    } catch (err) {
      setStatus({ key: err instanceof SourceValidationError ? 'importValidation.blocked' : 'importValidation.exportFailed' })
    } finally { converting.current = false; setBusy(false) }
  }

  const preview = useMemo(() => rows ? reviewHours(rows, startDate, endDate) : null, [rows, startDate, endDate])
  const identities = useMemo(() => mapHours(rows ?? [], mapping?.directory ?? null, importStore(plant) ?? 'CR3', fingerprint), [rows, mapping, plant, fingerprint])
  const mappingBlocked = !!preview?.included.some(row => !row.values.Employee.trim() || (!row.values['Employee External Id'].trim() && !identities.find(item => item.sourceRow === row.sourceRow)?.employee)) || ambiguousNames(preview?.included.map(row=>row.values) ?? [], identities.filter(item=>preview?.included.some(row=>row.sourceRow===item.sourceRow)))
  function acceptDirectory(record:DirectoryRecord|null) { invalidateOutput(); setStage(current => current === 'report' ? 'review' : current); setMapping(record ? { revision: record.revision, directory: record.data } : null) }
  const context = useMemo<DraftContext | null>(() => {
    const storeId = importStore(plant), start = businessDate(startDate), end = businessDate(endDate)
    return storeId && start && end && start <= end ? { task: 'hours-import', storeId, period: { start, end } } : null
  }, [plant, startDate, endDate])
  const snapshot = useMemo<ImportSnapshot | null>(() => rows && context ? { version: 1, kind: 'hours', sourceName, rows, metadata: { location: plant, startDate, endDate, preparer, ...(fingerprint ? {fingerprint} : {}), ...(mapping ? {mapping} : {}) }, output } : null, [rows, context, sourceName, plant, startDate, endDate, preparer, output, fingerprint, mapping])
  function restoreSnapshot(snapshot: ImportSnapshot) {
    contextChoice.current++
    if (snapshot.kind !== 'hours') return
    generation.current++; exportVersion.current++; setStage('review'); setMappingDirty(false); setDeviceSaved(false); setAcknowledged(false)
    setPlant(snapshot.metadata.location); setStartDate(snapshot.metadata.startDate); setEndDate(snapshot.metadata.endDate); setPreparer(snapshot.metadata.preparer)
    setFingerprint(snapshot.metadata.fingerprint ?? ''); setMapping(snapshot.metadata.mapping ?? null); setRows(snapshot.rows); setSourceName(snapshot.sourceName); setOutput(reviewHours(snapshot.rows, snapshot.metadata.startDate, snapshot.metadata.endDate).excluded.length ? null : snapshot.output); setCsvFile(null); setResumed(true)
    setValidation(UNCHECKED); setIssues([]); setFileReset(value => value + 1); setStatus({ key: 'importRetention.resumed' })
  }
  useImportResume('hours', restoreSnapshot)

  async function startNext() {
    if (busy || (plant || startDate || endDate || preparer || csvFile || rows) && !await confirmation.ask({ key: 'importRetention.startWarning' }, true)) return
    contextChoice.current++; generation.current++; invalidateOutput(); setStage('files'); setRows(null); setFingerprint(''); setMapping(null); setSourceName(''); setPreparer(''); setPlant(''); setStartDate(''); setEndDate(''); setCsvFile(null)
    setValidation(UNCHECKED); setIssues([]); setResumed(false); setFileReset(value => value + 1); setTimeout(() => focusField('hc-location'), 0)
  }

  return (
<InternalTheme><Paper emphasis="active" className={styles.workspace}>
      <h2 className="text-xl font-semibold text-gray-900 mb-5">{tr('imports.hoursTitle')}</h2>
      <ol className={styles.stages} aria-label={tr('hoursStages.label')}>
        {(['files','review','report'] as const).map((item,index) => <li key={item}><button data-hours-go={item} type="button" aria-current={stage === item ? 'step' : undefined} disabled={busy || item === 'review' && (!rows || !context) || item === 'report' && (!output || !acknowledged || mappingBlocked)} onClick={() => setStage(item)}>{index+1}. {tr(`hoursStages.${item}`)}</button></li>)}
      </ol>
      <h3 ref={heading} tabIndex={-1} data-hours-stage={stage} className="text-lg font-semibold mb-4">{tr(`hoursStages.${stage}`)}</h3>
      {confirmation.dialog}
      <ErrorSummary issues={issues} />
      <fieldset hidden={stage !== 'files'} disabled={busy} className="min-w-0 space-y-4">
        <div>
          <label htmlFor="hc-location" className={labelClass}>{tr('imports.location')}</label>
          <select id="hc-location" aria-invalid={issues.some(issue => issue.fieldId === 'hc-location') || undefined} aria-describedby={issues.some(issue => issue.fieldId === 'hc-location') ? 'hc-location-summary-error' : undefined} value={plant} onChange={e => { void changeContext('plant',e.target.value) }} className={inputClass}>
            <option value="">{tr('imports.selectLocation')}</option>
            {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="hc-start" className={labelClass}>{tr('imports.startDate')}</label>
            <input id="hc-start" aria-invalid={issues.some(issue => issue.fieldId === 'hc-start') || undefined} aria-describedby={issues.some(issue => issue.fieldId === 'hc-start') ? 'hc-start-summary-error' : undefined} type="date" value={startDate} onChange={e => { void changeContext('start',e.target.value) }} className={inputClass} />
          </div>
          <div>
            <label htmlFor="hc-end" className={labelClass}>{tr('imports.endDate')}</label>
            <input id="hc-end" aria-invalid={issues.some(issue => issue.fieldId === 'hc-end') || undefined} aria-describedby={issues.some(issue => issue.fieldId === 'hc-end') ? 'hc-end-summary-error' : undefined} type="date" value={endDate} onChange={e => { void changeContext('end',e.target.value) }} className={inputClass} />
          </div>
        </div>
        <div><label htmlFor="hc-preparer" className={labelClass}>{tr('importRetention.preparer')}</label>
          <input id="hc-preparer" value={preparer} maxLength={120} onChange={e => { invalidateOutput(); setPreparer(e.target.value) }} className={inputClass} /></div>
        <SourceFileInput key={fileReset} id="hc-file" label="imports.hoursCsv" accept=".csv" file={csvFile} validation={validation}
          beforeReplace={() => csvFile || rows ? confirmation.ask({ key: mappingDirty ? 'mapping.contextWarning' : 'importRetention.replaceWarning' }, true) : Promise.resolve(true)}
          onFile={file => { void selectFile(file) }} />
        <Button id="hc-prepare" variant="primary" disabled={!rows || validation.checking || busy} onClick={() => {
          const missing: FieldIssue[] = []
          if (!plant) missing.push({ fieldId: 'hc-location', message: { key: 'imports.chooseLocation' } })
          if (!businessDate(startDate)) missing.push({ fieldId: 'hc-start', message: { key: 'imports.pickDates' } })
          if (!businessDate(endDate) || startDate > endDate) missing.push({ fieldId: 'hc-end', message: { key: 'importValidation.period' } })
          setIssues(missing); if (missing.length) { focusField(missing[0].fieldId); return }; setStage('review')
        }}>{tr('hoursStages.continue')}</Button>
      </fieldset>
      {resumed && <p className="mt-3 break-words text-sm text-gray-700">{tr('importRetention.resumed')} {sourceName}</p>}
      {preview && <fieldset hidden={stage !== 'review'} disabled={busy} className="min-w-0"><HoursReview review={preview} identities={identities} mappingBlocked={mappingBlocked} acknowledged={acknowledged} onAcknowledge={setAcknowledged} /></fieldset>}
      {rows && context && <fieldset hidden={stage !== 'review'} disabled={busy} className="min-w-0"><EmployeeMapping key={`${fileReset}:${plant}:${startDate}:${endDate}:${fingerprint}`} store={context.storeId} rows={rows} fingerprint={fingerprint} token={token} preparer={preparer} onRecord={acceptDirectory} onDirty={mappingChanged} /></fieldset>}
      <div hidden={stage !== 'review'} className={styles.actions}>
        <Button onClick={() => setStage('files')} disabled={busy}>{tr('hoursStages.backFiles')}</Button>
        <Button id="hc-accept" onClick={() => void handleConvertAndDownload()} variant="primary" disabled={!preview || !context || !acknowledged || !preview.validPeriod || mappingBlocked || !preview.included.length || validation.checking || busy}>{tr('hoursStages.accept')}</Button>
      </div>
      <div hidden={stage !== 'report'}>
        {output && <p className="mt-3 break-all">{output.filename}</p>}
        <div className={styles.actions}>
          <Button onClick={() => setStage('review')} disabled={busy}>{tr('hoursStages.backReview')}</Button>
          <Button id="hc-download" onClick={() => void handleConvertAndDownload(true)} variant="primary" disabled={!output || !acknowledged || mappingBlocked || busy}>{tr('hoursStages.download')}</Button>
          <Button id="hc-next" disabled={busy} onClick={() => void startNext()}>{tr('importRetention.startNext')}</Button>
        </div>
      </div>
      <details open={stage === 'report'} data-hours-copies><summary>{tr('hoursStages.copies')}</summary>
      <ImportHistory sources={csvFile ? [csvFile] : []} token={token} context={context} snapshot={snapshot} preparer={preparer} accepted={acknowledged && !mappingBlocked} busy={busy} hasWork={!!rows} onRestore={restoreSnapshot} />
      <ImportRecovery context={context} preparer={preparer} snapshot={snapshot} hasWork={!!(plant || startDate || endDate || preparer || csvFile || rows)} busy={busy} onRestore={restoreSnapshot} onSaved={setDeviceSaved} />
      </details>
      <p id="hc-status" role="status" className="mt-2 text-sm text-gray-600">{status ? tr(status.key, status.params) : null}</p>
    </Paper></InternalTheme>
  )
}
