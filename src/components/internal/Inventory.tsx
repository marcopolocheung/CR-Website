'use client'

import { useCallback, useEffect, useState } from 'react'
import { CodeGate } from './CashOut'
import { CHECK, SHEETS, ordersBySupplier, suggestOrder, type InventoryCounts, type InventoryItem, type InventorySheet } from '@/lib/inventory'
import { fetchInventoryHistory, saveInventoryDay, type InventoryDay } from '@/lib/inventory-store'
import { StoreAuthError } from '@/lib/schedule-store'

const STORAGE_KEY = 'cr-inventory'
// The paper sheets have five INV / ORDER pairs: four earlier counts plus today.
const PAST_COLUMNS = 4
// Printed row shading and pen color from the clipboard sheets.
const GRAY = 'bg-[#c9c9c9]'
const INK = 'text-blue-800'

const today = () => new Date().toLocaleDateString('en-CA')
const shortDate = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8))}`
const button = 'px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50'
const cellBorder = 'border border-black'
// Earlier days are hidden on phones so today's INV / ORDER fit without scrolling.
const pastOnly = 'max-sm:hidden'

/** CR3 supply inventory: the clipboard sheets on screen, behind the manager code. */
export default function Inventory() {
  // Manager token lives in memory only, like cash out.
  const [token, setToken] = useState('')
  const lock = useCallback(() => setToken(''), [])
  if (!token) return <CodeGate onUnlock={setToken} title="Inventory" />
  return <InventoryBook token={token} onLocked={lock} />
}

function InventoryBook({ token, onLocked }: { token: string; onLocked: () => void }) {
  const [date, setDate] = useState(today)
  const [counts, setCounts] = useState<InventoryCounts>({})
  const [history, setHistory] = useState<InventoryDay[]>([])
  const [loaded, setLoaded] = useState(false)
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

  // Restore the unsaved draft, then fill in from the server if the draft is empty.
  useEffect(() => {
    let draft: { date: string; counts: InventoryCounts } | null = null
    try { draft = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') } catch { /* corrupt save: start fresh */ }
    const start = draft?.date ?? today()
    if (draft) {
      setDate(draft.date)
      setCounts(draft.counts)
    }
    setLoaded(true)
    run(async () => {
      const days = await fetchInventoryHistory(start, token)
      setHistory(days)
      const saved = days.find(d => d.date === start)
      if (saved && !Object.keys(draft?.counts ?? {}).length) setCounts(saved.counts)
    })
  }, [run, token])

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify({ date, counts }))
  }, [date, counts, loaded])

  const changeDate = (next: string) => {
    if (!next) return
    if (Object.keys(counts).length && !confirm('Switch dates? Counts on screen that are not saved will be lost.')) return
    setDate(next)
    setCounts({})
    run(async () => {
      const days = await fetchInventoryHistory(next, token)
      setHistory(days)
      setCounts(days.find(d => d.date === next)?.counts ?? {})
    })
  }

  const save = () =>
    run(async () => {
      await saveInventoryDay(date, counts, token)
      setHistory(await fetchInventoryHistory(date, token))
      return `Saved ${date}.`
    })

  const setInv = (item: InventoryItem, inv: string) =>
    setCounts(c => ({ ...c, [item.id]: { inv, order: suggestOrder(item.use, inv) } }))
  const setOrder = (item: InventoryItem, order: string) =>
    setCounts(c => ({ ...c, [item.id]: { inv: c[item.id]?.inv ?? '', order } }))

  const past = history.filter(d => d.date < date).slice(0, PAST_COLUMNS).reverse()
  const orders = ordersBySupplier(counts)
  const orderText = [`CR3 order ${date}`, ...orders.map(g => `\n${g.sup}\n${g.lines.map(l => `  ${l.item.name}: ${l.order}`).join('\n')}`)].join('\n')

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-6 print:hidden">
        <div>
          <label htmlFor="inventory-date" className="block text-sm font-medium text-gray-700 mb-1">Count date</label>
          <input
            id="inventory-date"
            type="date"
            value={date}
            onChange={e => changeDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
        <button onClick={save} disabled={busy} className={`${button} bg-red-600 text-white hover:bg-red-700`}>Save count</button>
        <button onClick={() => window.print()} className={`${button} border border-gray-300 hover:bg-gray-50`}>Print</button>
        <button
          onClick={() => confirm('Clear every count on screen? Saved counts are not touched.') && setCounts({})}
          className={`${button} border border-red-300 text-red-700 hover:bg-red-50`}
        >
          Clear
        </button>
        <p role="status" className="text-sm text-gray-700">{status}</p>
      </div>
      <p className="text-sm text-gray-600 mb-6 print:hidden">
        Write a count in INV, or tap {CHECK} if there is enough. ORDER fills in with what it takes to get back to Use; change it if needed.
      </p>

      {SHEETS.map(sheet => (
        <SheetTable key={sheet.id} sheet={sheet} date={date} past={past} counts={counts} onInv={setInv} onOrder={setOrder} />
      ))}

      <section className="mt-10 max-w-xl print:break-before-page">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold text-gray-900">Order list · {shortDate(date)}</h2>
          {orders.length > 0 && (
            <button
              onClick={() => navigator.clipboard.writeText(orderText).then(() => setStatus('Order list copied.'), () => setStatus('Could not copy. Select the list and copy it by hand.'))}
              className={`${button} border border-gray-300 hover:bg-gray-50 print:hidden`}
            >
              Copy
            </button>
          )}
        </div>
        {orders.length === 0 ? (
          <p className="text-sm text-gray-600">Nothing to order yet.</p>
        ) : (
          orders.map(g => (
            <div key={g.sup} className="mb-4 break-inside-avoid">
              <h3 className="font-bold text-gray-900 border-b border-black mb-1">{g.sup}</h3>
              <ul className="text-sm">
                {g.lines.map(l => (
                  <li key={l.item.id} className="flex justify-between py-0.5">
                    <span>{l.item.name}</span>
                    <span className={`font-semibold ${INK}`}>{l.order}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  )
}

function SheetTable({
  sheet,
  date,
  past,
  counts,
  onInv,
  onOrder,
}: {
  sheet: InventorySheet
  date: string
  past: InventoryDay[]
  counts: InventoryCounts
  onInv: (item: InventoryItem, inv: string) => void
  onOrder: (item: InventoryItem, order: string) => void
}) {
  const columns = [...past.map(d => d.date), date]
  return (
    <section className="mb-10 overflow-x-auto print:overflow-visible print:break-after-page">
      <div className="w-max max-w-full">
      {sheet.title && (
        <div className="flex justify-between items-end gap-4 mb-1 font-bold">
          <h2 className="underline">{sheet.title}</h2>
          <span>ACCOUNT # : {sheet.account}</span>
        </div>
      )}
      <table className="border-collapse border-2 border-black text-sm bg-white font-sans">
        <thead>
          <tr>
            <th className="border-0" colSpan={sheet.showSup ? 3 : 2} />
            {columns.map(d => (
              <th key={d} colSpan={2} className={`border-0 font-normal text-base ${INK} ${d === date ? '' : pastOnly}`}>{shortDate(d)}</th>
            ))}
          </tr>
          <tr className="font-bold">
            <th scope="col" className={`${cellBorder} px-2 py-1 sm:w-56`}>ITEM</th>
            {sheet.showSup && <th scope="col" className={`${cellBorder} px-1 py-1`}>SUP</th>}
            <th scope="col" className={`${cellBorder} px-2 py-1 leading-tight`}>{sheet.useLabel}</th>
            {columns.map(d => (
              <PairHeader key={d} past={d !== date} />
            ))}
          </tr>
        </thead>
        <tbody>
          {sheet.items.map(item => {
            const cell = counts[item.id] ?? { inv: '', order: '' }
            return (
              <tr key={item.id} className={item.gray ? GRAY : ''}>
                <th scope="row" className={`${cellBorder} px-2 py-1 font-bold text-center`}>
                  {item.name}
                  {item.note && <span className={`ml-1 font-normal ${INK}`}>{item.note}</span>}
                </th>
                {sheet.showSup && <td className={`${cellBorder} px-1 text-center font-bold`}>{item.sup}</td>}
                <td className={`${cellBorder} px-2 text-center font-bold`}>{item.use}</td>
                {past.map(d => (
                  <PastPair key={d.date} cell={d.counts[item.id]} />
                ))}
                <td className={`${cellBorder} p-0 w-20`}>
                  <div className="flex items-center">
                    <input
                      aria-label={`${item.name} inventory`}
                      value={cell.inv}
                      maxLength={12}
                      onChange={e => onInv(item, e.target.value)}
                      className={`w-12 bg-transparent text-center text-base py-1 focus:outline-none focus:ring-2 focus:ring-red-500 ${INK}`}
                    />
                    {!cell.inv && (
                      <button
                        onClick={() => onInv(item, CHECK)}
                        aria-label={`${item.name}: enough`}
                        className="w-8 text-gray-500 hover:text-blue-800 print:hidden"
                      >
                        {CHECK}
                      </button>
                    )}
                  </div>
                </td>
                <td className={`${cellBorder} p-0 w-16`}>
                  <input
                    aria-label={`${item.name} order`}
                    value={cell.order}
                    maxLength={12}
                    onChange={e => onOrder(item, e.target.value)}
                    className={`w-16 bg-transparent text-center text-base py-1 focus:outline-none focus:ring-2 focus:ring-red-500 ${INK}`}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      </div>
    </section>
  )
}

function PairHeader({ past }: { past: boolean }) {
  const hide = past ? pastOnly : ''
  return (
    <>
      <th scope="col" className={`${cellBorder} px-2 py-1 ${hide}`}>INV</th>
      <th scope="col" className={`${cellBorder} px-2 py-1 ${hide}`}>ORDER</th>
    </>
  )
}

function PastPair({ cell }: { cell?: { inv: string; order: string } }) {
  return (
    <>
      <td className={`${cellBorder} px-2 text-center text-base w-14 ${INK} ${pastOnly}`}>{cell?.inv}</td>
      <td className={`${cellBorder} px-2 text-center text-base w-14 ${INK} ${pastOnly}`}>{cell?.order}</td>
    </>
  )
}
