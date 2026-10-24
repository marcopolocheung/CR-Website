'use client'

import { useState } from 'react'
import { useNavigationProtection } from './NavigationProtection'
import { useInternalLanguage } from './InternalLanguage'
import type { Message } from '@/lib/internal-tools/i18n'
import { parseCsvAndExport } from '@/lib/converter/parseCSV'
import { LOCATIONS } from './SalesConverter'

const inputClass =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

/** Toast hours CSV → grouped employee hour log. Ported from the excel-converter repo unchanged in behavior. */
export default function HoursConverter() {
  const { t: tr } = useInternalLanguage()
  const [plant, setPlant] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [status, setStatus] = useState<Message | null>(null)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  useNavigationProtection({ dirty: !!(plant || startDate || endDate || csvFile), deviceSaved: false })

  const handleConvertAndDownload = () => {
    if (!csvFile) return setStatus({ key: 'imports.noFile' })
    if (!plant) return setStatus({ key: 'imports.chooseLocation' })
    if (!startDate || !endDate) return setStatus({ key: 'imports.pickDates' })

    setStatus({ key: 'imports.parsing' })
    parseCsvAndExport(
      csvFile,
      () => setStatus({ key: 'imports.downloaded' }),
      (err: unknown) => {
        console.error('Parse error:', err)
        setStatus({ key: 'imports.failed' })
      },
      { location: plant, startDate, endDate },
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 max-w-xl">
      <h2 className="text-xl font-semibold text-gray-900 mb-5">{tr('imports.hoursTitle')}</h2>
      <div className="space-y-4">
        <div>
          <label htmlFor="hc-location" className={labelClass}>{tr('imports.location')}</label>
          <select id="hc-location" value={plant} onChange={e => setPlant(e.target.value)} className={inputClass}>
            <option value="">{tr('imports.selectLocation')}</option>
            {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="hc-start" className={labelClass}>{tr('imports.startDate')}</label>
            <input id="hc-start" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="hc-end" className={labelClass}>{tr('imports.endDate')}</label>
            <input id="hc-end" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div>
          <label htmlFor="hc-file" className={labelClass}>{tr('imports.hoursCsv')}</label>
          <input
            id="hc-file"
            type="file"
            accept=".csv"
            onChange={e => {
              const file = e.target.files?.[0]
              if (!file) return
              setCsvFile(file)
              setStatus({ key: 'imports.fileReady' })
            }}
            className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-gray-200"
          />
        </div>
      </div>
      <button
        onClick={handleConvertAndDownload}
        disabled={!csvFile || status?.key === 'imports.parsing'}
        className="mt-5 px-6 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
      >
        {tr('imports.download')}
      </button>
      <p role="status" className="mt-2 text-sm text-gray-600">{status ? tr(status.key, status.params) : null}</p>
    </div>
  )
}
