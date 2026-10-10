'use client'

import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
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
type Sheet = { am: Cashier[]; pm: Cashier[]; zReport: string }

const STORAGE_KEY = 'cr-cash-out'
const STORE_LABELS: Record<CashoutStore, string> = { CR3: 'CR3 · W Military', CR2: 'CR2 · SW Military' }
const today = () => new Date().toLocaleDateString('en-CA')
const newCashier = (): Cashier => ({ name: '', counts: DENOMINATIONS.map(() => 0), toast: '' })
const emptySheet = (): Sheet => ({ am: [newCashier()], pm: [newCashier()], zReport: '' })

const inputClass =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500'

function Money({ cents, signed }: { cents: number | null; signed?: boolean }) {
  if (cents === null) return <span className="font-mono font-semibold text-gray-400" title="Enter the Toast or Z report figure">—</span>
  const color = !signed || cents === 0 ? 'text-gray-900' : cents < 0 ? 'text-red-600' : 'text-green-700'
  return <span className={`font-mono font-semibold ${color}`}>{signed && cents > 0 ? '+' : ''}{formatCents(cents)}</span>
}

/** Manager code gate. Same token as the scheduler demo; kept in memory only, never stored. */
function CodeGate({ onUnlock }: { onUnlock: (token: string) => void }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!code || busy) return
    setBusy(true)
    setError('')
    try {
      await verifyWriteToken(code)
      onUnlock(code)
    } catch (caught) {
      setError(caught instanceof StoreAuthError ? 'That code was not accepted.' : (caught as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="max-w-md mx-auto my-16 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Cash Out</h1>
      <p className="text-sm text-gray-600 mb-4">Enter the manager code, the same one that unlocks the scheduler demo.</p>
      <label htmlFor="cashout-code" className="block text-sm font-medium text-gray-700 mb-1">Manager code</label>
      <input
        id="cashout-code"
        type="password"
        autoComplete="off"
        value={code}
        onChange={e => setCode(e.target.value)}
        className={inputClass}
      />
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={!code || busy}
        className="mt-4 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
      >
        {busy ? 'Checking…' : 'Unlock'}
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

export default function CashOut() {
  const [token, setToken] = useState('')
  if (!token) return <CodeGate onUnlock={setToken} />
  return <CashOutSheet token={token} onLocked={() => setToken('')} />
}

function CashOutSheet({ token, onLocked }: { token: string; onLocked: () => void }) {
  const [sheet, setSheet] = useState<Sheet>(emptySheet)
  const [loaded, setLoaded] = useState(false)
  const [store, setStore] = useState<CashoutStore>('CR3')
  const [date, setDate] = useState(today)
  const [history, setHistory] = useState<CashoutDay[]>([])
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

  const refreshHistory = useCallback(
    () => run(async () => setHistory(await fetchCashoutHistory(store, today(), token))),
    [run, store, token],
  )

  useEffect(() => {
    refreshHistory()
  }, [refreshHistory])

  const loadDay = (day: string) =>
    run(async () => {
      const saved = await fetchCashoutDay(store, day, token)
      if (!saved) return `Nothing saved for ${store} on ${day}.`
      if (!confirm(`Replace the sheet on screen with the saved ${store} sheet for ${day}?`)) return
      setDate(day)
      setSheet(saved)
      return `Loaded ${store} ${day}.`
    })

  const saveDay = () =>
    run(async () => {
      await saveCashoutDay(store, date, { sheet, totals: dayTotals(sheet.am, sheet.pm, sheet.zReport) }, token)
      setHistory(await fetchCashoutHistory(store, today(), token))
      return `Saved ${store} ${date}.`
    })

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try { setSheet(JSON.parse(saved)) } catch { /* corrupt save: start fresh */ }
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(sheet))
  }, [sheet, loaded])

  const updateCashier = (shift: Shift, idx: number, patch: Partial<Cashier>) =>
    setSheet(s => ({ ...s, [shift]: s[shift].map((c, i) => (i === idx ? { ...c, ...patch } : c)) }))

  const setCount = (shift: Shift, idx: number, d: number, value: string) => {
    const counts = [...sheet[shift][idx].counts]
    counts[d] = Math.max(0, parseInt(value, 10) || 0)
    updateCashier(shift, idx, { counts })
  }

  const removeCashier = (shift: Shift, idx: number) => {
    if (confirm('Remove this cashier?')) setSheet(s => ({ ...s, [shift]: s[shift].filter((_, i) => i !== idx) }))
  }

  const day = dayTotals(sheet.am, sheet.pm, sheet.zReport)

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Cash Out</h1>
        <div className="flex gap-2 print:hidden">
          <button onClick={() => window.print()} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50">
            Print
          </button>
          <button
            onClick={() => confirm('Clear the whole sheet? This cannot be undone.') && setSheet(emptySheet())}
            className="px-4 py-2 rounded-lg border border-red-300 text-red-700 text-sm font-medium hover:bg-red-50"
          >
            Clear sheet
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-8 print:mb-4">
        <div>
          <label htmlFor="cashout-store" className="block text-sm font-medium text-gray-700 mb-1">Store</label>
          <select
            id="cashout-store"
            value={store}
            onChange={e => setStore(e.target.value as CashoutStore)}
            className={inputClass}
          >
            {CASHOUT_STORES.map(s => <option key={s} value={s}>{STORE_LABELS[s]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="cashout-date" className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input id="cashout-date" type="date" value={date} onChange={e => setDate(e.target.value)} className={inputClass} />
        </div>
        <div className="flex gap-2 print:hidden">
          <button
            onClick={() => loadDay(date)}
            disabled={busy || !date}
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            Load saved
          </button>
          <button
            onClick={saveDay}
            disabled={busy || !date}
            className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
          >
            Save day
          </button>
        </div>
        <p role="status" className="text-sm text-gray-700 print:hidden">{status}</p>
      </div>

      {(['am', 'pm'] as const).map(shift => {
        const totals = shiftTotals(sheet[shift])
        return (
          <section key={shift} className="mb-10">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-semibold text-gray-900">{shift.toUpperCase()} shift</h2>
              <button
                onClick={() => setSheet(s => ({ ...s, [shift]: [...s[shift], newCashier()] }))}
                className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 print:hidden"
              >
                + Add cashier
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
                        aria-label="Cashier name"
                        placeholder={`Cashier ${idx + 1}`}
                        value={c.name}
                        onChange={e => updateCashier(shift, idx, { name: e.target.value })}
                        className={inputClass}
                      />
                      <button
                        onClick={() => removeCashier(shift, idx)}
                        aria-label="Remove cashier"
                        className="px-3 text-gray-400 hover:text-red-600 print:hidden"
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
                      Toast cash payments
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
                      <Row label="Drawer total"><Money cents={t.drawer} /></Row>
                      <Row label={`Turn-in (− ${formatCents(FLOAT_CENTS)})`}><Money cents={t.turnIn} /></Row>
                      <Row label="Over / short"><Money cents={t.overShort} signed /></Row>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-4 bg-gray-50 rounded-xl border border-gray-200 p-4 max-w-sm ml-auto">
              <Row label={`${shift.toUpperCase()} deposit`}><Money cents={totals.deposit} /></Row>
              <Row label={`${shift.toUpperCase()} over / short`}><Money cents={totals.overShort} signed /></Row>
            </div>
          </section>
        )
      })}

      <section className="bg-white rounded-xl border-2 border-gray-300 shadow-sm p-6 max-w-md ml-auto break-inside-avoid">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">Day total</h2>
        <Row label="Actual deposit (AM + PM)"><Money cents={day.deposit} /></Row>
        <Row label="Cashier over / short (AM + PM)"><Money cents={day.overShort} signed /></Row>
        <label htmlFor="z-report" className="block text-sm font-medium text-gray-700 mt-3 mb-1">
          Z report expected cash
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
        <Row label="Over / short vs Z report"><Money cents={day.zOverShort} signed /></Row>
      </section>

      <section className="mt-10 print:hidden">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">Last 30 days · {STORE_LABELS[store]}</h2>
        {history.length === 0 ? (
          <p className="text-sm text-gray-600">No saved days yet.</p>
        ) : (
          <div className="overflow-x-auto bg-white rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  {['Date', 'AM deposit', 'PM deposit', 'AM over/short', 'PM over/short', 'Day deposit', 'Day over/short', 'vs Z report'].map(h => (
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
