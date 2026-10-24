'use client'

import { useRef, useState } from 'react'
import { useNavigationProtection } from './NavigationProtection'
import { useInternalLanguage } from './InternalLanguage'
import type { Message } from '@/lib/internal-tools/i18n'
import { exportHoursRows, readHoursFile } from '@/lib/converter/parseCSV'
import { SourceValidationError, type SourceResult, type HoursRow } from '@/lib/converter/validation'
import SourceFileInput, { UNCHECKED, type FileValidation } from './SourceFileInput'
import { ErrorSummary, focusField, type FieldIssue } from './Feedback'
import { LOCATIONS } from './SalesConverter'

const inputClass =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

/** Validate Toast source rows before generating the familiar grouped hour log. */
export default function HoursConverter() {
  const { t: tr } = useInternalLanguage()
  const [plant, setPlant] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [status, setStatus] = useState<Message | null>(null)
  const [validation, setValidation] = useState<FileValidation>(UNCHECKED)
  const [issues, setIssues] = useState<FieldIssue[]>([])
  const generation = useRef(0)
  const converting = useRef(false)
  const [busy, setBusy] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  useNavigationProtection({ dirty: !!(plant || startDate || endDate || csvFile), deviceSaved: false })

  async function selectFile(file: File) {
    const version = ++generation.current
    setCsvFile(file)
    setStatus(null)
    setValidation({ ...UNCHECKED, checking: true })
    const result: SourceResult<HoursRow[]> = await readHoursFile(file)
    if (generation.current !== version) return
    setValidation({ checking: false, valid: !!result.value, issues: result.issues })
  }

  async function handleConvertAndDownload() {
    if (converting.current || !csvFile) return
    const missing: FieldIssue[] = []
    if (!plant) missing.push({ fieldId: 'hc-location', message: { key: 'imports.chooseLocation' } })
    if (!startDate) missing.push({ fieldId: 'hc-start', message: { key: 'imports.pickDates' } })
    if (!endDate) missing.push({ fieldId: 'hc-end', message: { key: 'imports.pickDates' } })
    if (startDate && endDate && startDate > endDate) missing.push({ fieldId: 'hc-end', message: { key: 'importValidation.period' } })
    setIssues(missing)
    if (missing.length) { setStatus(null); focusField(missing[0].fieldId); return }
    converting.current = true
    setBusy(true)
    setStatus({ key: 'imports.parsing' })
    try {
      const result: SourceResult<HoursRow[]> = await readHoursFile(csvFile)
      setValidation({ checking: false, valid: !!result.value, issues: result.issues })
      if (!result.value) { setStatus({ key: 'importValidation.blocked' }); focusField('hc-file'); return }
      await exportHoursRows(result.value, { location: plant, startDate, endDate })
      setStatus({ key: 'imports.downloaded' })
    } catch (err) {
      setStatus({ key: err instanceof SourceValidationError ? 'importValidation.blocked' : 'importValidation.exportFailed' })
    } finally { converting.current = false; setBusy(false) }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 max-w-xl">
      <h2 className="text-xl font-semibold text-gray-900 mb-5">{tr('imports.hoursTitle')}</h2>
      <ErrorSummary issues={issues} />
      <fieldset disabled={busy} className="min-w-0 space-y-4">
        <div>
          <label htmlFor="hc-location" className={labelClass}>{tr('imports.location')}</label>
          <select id="hc-location" aria-invalid={issues.some(issue => issue.fieldId === 'hc-location') || undefined} aria-describedby={issues.some(issue => issue.fieldId === 'hc-location') ? 'hc-location-summary-error' : undefined} value={plant} onChange={e => setPlant(e.target.value)} className={inputClass}>
            <option value="">{tr('imports.selectLocation')}</option>
            {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="hc-start" className={labelClass}>{tr('imports.startDate')}</label>
            <input id="hc-start" aria-invalid={issues.some(issue => issue.fieldId === 'hc-start') || undefined} aria-describedby={issues.some(issue => issue.fieldId === 'hc-start') ? 'hc-start-summary-error' : undefined} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="hc-end" className={labelClass}>{tr('imports.endDate')}</label>
            <input id="hc-end" aria-invalid={issues.some(issue => issue.fieldId === 'hc-end') || undefined} aria-describedby={issues.some(issue => issue.fieldId === 'hc-end') ? 'hc-end-summary-error' : undefined} type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputClass} />
          </div>
        </div>
        <SourceFileInput id="hc-file" label="imports.hoursCsv" accept=".csv" file={csvFile} validation={validation}
          onFile={file => { void selectFile(file) }} />
      </fieldset>
      <button
        onClick={handleConvertAndDownload}
        disabled={!validation.valid || validation.checking || busy}
        className="mt-5 min-h-11 px-6 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
      >
        {tr('imports.download')}
      </button>
      <p role="status" className="mt-2 text-sm text-gray-600">{status ? tr(status.key, status.params) : null}</p>
    </div>
  )
}
