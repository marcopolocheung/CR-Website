'use client'

import { useState } from 'react'
import { useInternalLanguage } from './InternalLanguage'
import { errorKey, type Message, type TranslationKey } from '@/lib/internal-tools/i18n'
import * as XLSX from 'xlsx'
import { extractMetrics } from '@/lib/converter/parseToast'
import { downloadFilledWorkbook } from '@/lib/converter/fillTemplate'
import type { CashoutTotals } from '@/lib/cashout-store'

type FileKey = 'general' | 'lunch' | 'dinner'
type FileMap = Record<FileKey, File | null>

export const LOCATIONS = ['CHINA ROSE #3 - 7046 W MILITARY DR', 'CHINA ROSE #2 - 2535 SW MILITARY DR']
const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
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
  loadCashout,
}: {
  loadCashout: ((location: string, date: string) => Promise<CashoutTotals | null>) | null
}) {
  const { t: tr } = useInternalLanguage()
  const [form, setForm] = useState(EMPTY_FORM)
  const [files, setFiles] = useState<FileMap>({ general: null, lunch: null, dinner: null })
  const [status, setStatus] = useState<Message | null>(null)

  const handleInput = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value })

  async function fillFromCashout() {
    if (!loadCashout) return
    if (!form.location || !form.date) return setStatus({ key: 'imports.pickContext' })
    setStatus({ key: 'imports.loadingCashout' })
    try {
      const totals = await loadCashout(form.location, form.date)
      if (!totals) return setStatus({ key: 'imports.noCashout', params: { date: form.date } })
      setForm(f => ({
        ...f,
        amDeposit: dollars(totals.amDeposit),
        pmDeposit: dollars(totals.pmDeposit),
        amOverShort: dollars(totals.amOverShort),
        pmOverShort: dollars(totals.pmOverShort),
      }))
      setStatus({ key: 'imports.filledCashout', params: { date: form.date } })
    } catch (err) {
      setStatus({ key: errorKey(err) })
    }
  }

  async function handleConvert() {
    if (!files.general || !files.lunch || !files.dinner)
      return alert(tr('imports.uploadAll'))

    try {
      const [generalWb, lunchWb, dinnerWb] = await Promise.all(
        [files.general, files.lunch, files.dinner].map(file =>
          file.arrayBuffer().then(buf => XLSX.read(buf, { type: 'array' })),
        ),
      )

      const cellMap = extractMetrics({ generalWb, lunchWb, dinnerWb })
      await downloadFilledWorkbook(cellMap, form)

      setFiles({ general: null, lunch: null, dinner: null })
      setForm(EMPTY_FORM)
      setStatus(null)
    } catch (err) {
      console.error(err)
      alert(tr('imports.failed'))
    }
  }

  const ready = files.general && files.lunch && files.dinner

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 max-w-3xl">
      <h2 className="text-xl font-semibold text-gray-900">{tr('bookkeeping.sales')}</h2>
      <p className="text-sm text-gray-600 mt-1 mb-5">
        {tr('imports.salesInstructions')}
      </p>

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
          <select id="sc-day" name="day" value={form.day} onChange={handleInput} className={inputClass}>
            <option value="" disabled>{tr('imports.selectDay')}</option>
            {DAYS.map(d => <option key={d} value={d}>{tr(`weekday.${d.toLowerCase()}` as TranslationKey)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="sc-date" className={labelClass}>{tr('common.date')}</label>
          <input id="sc-date" name="date" type="date" value={form.date} onChange={handleInput} className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="sc-location" className={labelClass}>{tr('imports.location')}</label>
          <select id="sc-location" name="location" value={form.location} onChange={handleInput} className={inputClass}>
            <option value="" disabled>{tr('imports.selectLocation')}</option>
            {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
        {(['general', 'lunch', 'dinner'] as FileKey[]).map(key => (
          <div key={key}>
            <label htmlFor={`sc-file-${key}`} className={labelClass}>{tr(`imports.${key}`)}</label>
            <input
              id={`sc-file-${key}`}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) setFiles(f => ({ ...f, [key]: file }))
              }}
              className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-gray-200"
            />
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-900">{tr('dashboard.deposits')}</h3>
        {loadCashout ? (
          <button
            type="button"
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
            <input id={`sc-${name}`} name={name} inputMode="decimal" value={form[name]} onChange={handleInput} className={inputClass} />
          </div>
        ))}
      </div>
      <p role="status" className="mt-2 text-sm text-gray-700 min-h-5">{status ? tr(status.key, status.params) : null}</p>

      <button
        onClick={handleConvert}
        disabled={!ready}
        className="mt-4 px-6 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {tr('imports.download')}
      </button>
    </div>
  )
}
