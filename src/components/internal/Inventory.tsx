'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CodeGate } from './CashOut'
import { useInternalLanguage } from './InternalLanguage'
import { useConfirmation, focusField } from './Feedback'
import { useNavigationProtection } from './NavigationProtection'
import RecoveryPanel from './RecoveryPanel'
import { SingleFlight } from '@/lib/internal-tools/recovery'
import { inventoryComparison, isInventorySheets } from '@/lib/internal-tools/inventory-recovery'
import { errorKey, type Message } from '@/lib/internal-tools/i18n'
import {
  CHECK,
  DEFAULT_SHEETS,
  listProblem,
  newItemId,
  ordersBySupplier,
  suggestOrder,
  type InventoryCounts,
  type InventoryItem,
  type InventorySheet,
} from '@/lib/inventory'
import { fetchInventoryHistory, fetchInventoryList, saveInventoryDay, saveInventoryList, type InventoryDay } from '@/lib/inventory-store'
import { StoreAuthError, StoreConflictError, StoreUnavailableError } from '@/lib/schedule-store'

const STORAGE_KEY = 'cr-inventory'
// The paper sheets have five INV / ORDER pairs: four earlier counts plus today.
const PAST_COLUMNS = 4
// Printed row shading and pen color from the clipboard sheets.
const GRAY = 'bg-[#c9c9c9]'
const INK = 'text-blue-800'

const today = () => new Date().toLocaleDateString('en-CA')
const shortDate = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8))}`
const button = 'min-h-11 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50'
const cellBorder = 'border border-black'
// Earlier days are hidden on phones so today's INV / ORDER fit without scrolling.
const pastOnly = 'max-sm:hidden'
// New rows get a temporary id until the list is saved; real ids never start with "-".
const isNewId = (id: string) => id.startsWith('-')
let nextNewId = 0

/** CR3 supply inventory: the clipboard sheets on screen, behind the manager code. */
export default function Inventory() {
  // Manager token lives in memory only, like cash out.
  const [token, setToken] = useState('')
  const lock = useCallback(() => setToken(''), [])
  return <InventoryBook token={token} onUnlock={setToken} onLocked={lock} />
}

function InventoryBook({ token, onUnlock, onLocked }: { token: string; onUnlock: (token: string) => void; onLocked: () => void }) {
  const { t: tr } = useInternalLanguage()
  const confirmation = useConfirmation()
  const tokenRef = useRef(token); tokenRef.current = token
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const restored = useRef(false)
  const listSaving = useRef(new SingleFlight<void>())
  const [date, setDate] = useState(today)
  const [counts, setCounts] = useState<InventoryCounts>({})
  const [history, setHistory] = useState<InventoryDay[]>([])
  const [loaded, setLoaded] = useState(false)
  const [status, setStatus] = useState<string | Message>('')
  const [busy, setBusy] = useState(false)
  const [sheets, setSheets] = useState<InventorySheet[]>(DEFAULT_SHEETS)
  const [listRev, setListRev] = useState(0)
  // The item list being edited, or null while counting.
  const [draft, setDraft] = useState<InventorySheet[] | null>(null)
  const draftRef = useRef(draft); draftRef.current = draft
  const dateRef = useRef(date); dateRef.current = date
  const countsRef = useRef(counts); countsRef.current = counts
  const listRevRef = useRef(listRev); listRevRef.current = listRev
  const [conflict,setConflict] = useState(false)
  const [serverList,setServerList] = useState<{rev:number;sheets:InventorySheet[] | null} | null>(null)
  const [countDirty,setCountDirty] = useState(false)
  const [deviceSaved,setDeviceSaved] = useState(false)
  useNavigationProtection({ dirty: !!draft || countDirty, deviceSaved: !draft && deviceSaved })

  const run = useCallback(
    async (task: () => Promise<string | Message | void>) => {
      setBusy(true)
      setStatus('')
      try {
        const message = await task()
        if (mounted.current && tokenRef.current === token && message) setStatus(message)
      } catch (caught) {
        if (!mounted.current || tokenRef.current !== token) return
        setStatus({key:errorKey(caught)})
        if (caught instanceof StoreAuthError) onLocked()
      } finally {
        if (mounted.current && tokenRef.current === token) setBusy(false)
      }
    },
    [onLocked, token],
  )

  // Restore once; reauthentication must not replace on-screen list/count edits.
  useEffect(() => {
    if (!token) return
    let start = dateRef.current
    if (!restored.current) {
      let saved: { date: string; counts: InventoryCounts } | null = null
      try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') } catch { /* original draft behavior; retain entered values on later failures */ }
      start = saved?.date ?? today()
      if (saved) { setDate(saved.date); setCounts(saved.counts); setCountDirty(!!Object.keys(saved.counts).length) }
      setLoaded(true)
      restored.current = true
    }
    run(async () => {
      const list = await fetchInventoryList(token)
      if (!Number.isSafeInteger(list.rev) || list.rev < 0 || (list.sheets !== null && !isInventorySheets(list.sheets))) throw new StoreUnavailableError()
      if (!mounted.current || tokenRef.current !== token) return
      if (!draftRef.current) { setSheets(list.sheets ?? DEFAULT_SHEETS); setListRev(list.rev) }
      else if (list.rev !== listRevRef.current) { setConflict(true); setServerList(list) }
      const days = await fetchInventoryHistory(start, token)
      if (!mounted.current || tokenRef.current !== token || dateRef.current !== start) return
      setHistory(days)
      const saved = days.find(d => d.date === start)
      if (saved && !Object.keys(countsRef.current).length) setCounts(saved.counts)
    })
  }, [run, token])

  useEffect(() => {
    if (!loaded) return
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ date, counts })); setDeviceSaved(true) }
    catch { setDeviceSaved(false); setStatus({key:'feedback.storageFailed'}) }
  }, [date, counts, loaded])

  const changeDate = (next: string) => {
    if (!next) return
    if (Object.keys(counts).length && !confirm('Switch dates? Counts on screen that are not saved will be lost.')) return
    setDate(next)
    setCounts({})
    run(async () => {
      const days = await fetchInventoryHistory(next, token)
      if (mounted.current && dateRef.current === next && tokenRef.current === token) {
        setHistory(days)
        if (!Object.keys(countsRef.current).length) setCounts(days.find(d => d.date === next)?.counts ?? {})
      }
    })
  }

  const save = () =>
    run(async () => {
      await saveInventoryDay(date, counts, token)
      if (countsRef.current === counts && dateRef.current === date) setCountDirty(false)
      setHistory(await fetchInventoryHistory(date, token))
      return `Saved ${date}.`
    })

  const saveList = () => {
    if (!draft || conflict) return
    const problem = listProblem(draft)
    if (problem) return setStatus(problem)
    const candidate = draft
    return listSaving.current.run(() => run(async () => {
      const taken = new Set(candidate.flatMap(sh => sh.items.map(i => i.id)))
      const next = candidate.map(sh => ({ ...sh, items: sh.items.map(i => ({ ...i, name: i.name.trim(), id: isNewId(i.id) ? newItemId(i.name, taken) : i.id })) }))
      try {
        const rev = await saveInventoryList(next, listRev, token)
        if (!mounted.current || tokenRef.current !== token) return
        setListRev(rev)
      } catch (caught) {
        if (!mounted.current || tokenRef.current !== token) return
        if (caught instanceof StoreConflictError) {
          // Keep the original base revision. Reading a newer revision must not
          // silently turn the next save into permission to overwrite it.
          setConflict(true); setServerList(null)
          return {key:'recovery.conflict'}
        }
        throw caught
      }
      setSheets(next)
      if (draftRef.current === candidate) setDraft(null)
      return {key:'recovery.listSaved'}
    }))
  }
  const reloadList = () => run(async () => {
    const latest = await fetchInventoryList(token)
    if (!Number.isSafeInteger(latest.rev) || latest.rev < 0 || (latest.sheets !== null && !isInventorySheets(latest.sheets))) throw new StoreUnavailableError()
    if (mounted.current && tokenRef.current === token) setServerList(latest)
  })
  const useServer = async () => {
    if (!serverList || !await confirmation.ask({key:'recovery.replaceConfirm'},true,{key:'recovery.useServer'})) return
    setSheets(serverList.sheets ?? DEFAULT_SHEETS); setListRev(serverList.rev)
    setDraft(null); setConflict(false); setServerList(null)
    requestAnimationFrame(() => focusField('inventory-edit-list'))
  }
  const cancelList = async () => {
    if (!await confirmation.ask({key:'recovery.dropList'},true)) return
    setDraft(null); setConflict(false); setServerList(null)
    requestAnimationFrame(() => focusField('inventory-edit-list'))
  }

  const setInv = (item: InventoryItem, inv: string) => { setCountDirty(true); setCounts(c => ({ ...c, [item.id]: { inv, order: suggestOrder(item.use, inv) } })) }
  const setOrder = (item: InventoryItem, order: string) => { setCountDirty(true); setCounts(c => ({ ...c, [item.id]: { inv: c[item.id]?.inv ?? '', order } })) }

  const past = history.filter(d => d.date < date).slice(0, PAST_COLUMNS).reverse()
  const orders = ordersBySupplier(sheets, counts)
  const orderText = [`CR3 order ${date}`, ...orders.map(g => `\n${g.sup}\n${g.lines.map(l => `  ${l.item.name}: ${l.order}`).join('\n')}`)].join('\n')

  return (
    <div>
      {!token && <CodeGate onUnlock={onUnlock} title={tr('nav.inventory')} />}
      <div hidden={!token}>
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
        {draft ? (
          <>
            <button onClick={saveList} disabled={busy || conflict} className={`${button} bg-red-600 text-white hover:bg-red-700`}>{tr('recovery.saveList')}</button>
            <button onClick={cancelList} disabled={busy} className={`${button} border border-gray-300 hover:bg-gray-50`}>
              {tr('feedback.cancel')}
            </button>
          </>
        ) : (
          <>
            <button onClick={save} disabled={busy} className={`${button} bg-red-600 text-white hover:bg-red-700`}>Save count</button>
            <button onClick={() => window.print()} className={`${button} border border-gray-300 hover:bg-gray-50`}>Print</button>
            <button
              onClick={() => confirm('Clear every count on screen? Saved counts are not touched.') && setCounts({})}
              className={`${button} border border-red-300 text-red-700 hover:bg-red-50`}
            >
              Clear
            </button>
            <button id="inventory-edit-list" onClick={() => { setConflict(false); setServerList(null); setDraft(structuredClone(sheets)) }} disabled={busy} className={`${button} border border-gray-300 hover:bg-gray-50`}>
              {tr('recovery.editList')}
            </button>
          </>
        )}
        <p role="status" className="text-sm text-gray-700">{typeof status === 'string' ? status : tr(status.key,status.params)}</p>
      </div>
      <p className="text-sm text-gray-600 mb-6 print:hidden">
        {draft
          ? 'Change names, suppliers, and Use numbers, shade rows gray, reorder, add, or remove items. Counts already saved stay with their item even if it is renamed.'
          : `Write a count in INV, or tap ${CHECK} if there is enough. ORDER fills in with what it takes to get back to Use; change it if needed.`}
      </p>

      {draft && <RecoveryPanel message={{key:conflict ? 'recovery.conflict' : 'recovery.localList'}}
        copyText={() => JSON.stringify({storeId:'CR3',baseRevision:listRev,sheets:draft},null,2)}
        busy={busy} retryLabel={{key:'recovery.retryLegacy'}} onRetry={!conflict ? saveList : undefined} onReload={conflict ? reloadList : undefined}
        onUseServer={serverList ? useServer : undefined}
        rows={serverList ? inventoryComparison(draft,serverList.sheets ?? DEFAULT_SHEETS,tr) : undefined} />}
      {draft
        ? <fieldset disabled={busy} className="min-w-0">{draft.map((sheet, si) => (
            <EditSheetTable
              key={sheet.id}
              sheet={sheet}
              onChange={items => setDraft(d => d && d.map((sh, i) => (i === si ? { ...sh, items } : sh)))}
            />
          ))}</fieldset>
        : sheets.map(sheet => (
            <SheetTable key={sheet.id} sheet={sheet} date={date} past={past} counts={counts} onInv={setInv} onOrder={setOrder} />
          ))}

      {!draft && (
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
      )}
      {confirmation.dialog}
      </div>
    </div>
  )
}

function EditSheetTable({ sheet, onChange }: { sheet: InventorySheet; onChange: (items: InventoryItem[]) => void }) {
  const items = sheet.items
  const update = (index: number, patch: Partial<InventoryItem>) => onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  const move = (index: number, by: number) => {
    const next = [...items]
    const [item] = next.splice(index, 1)
    next.splice(index + by, 0, item)
    onChange(next)
  }
  const remove = (index: number) => {
    const name = items[index].name.trim()
    if (!name || confirm(`Remove ${name}? Its saved counts stay on the server but stop showing.`)) onChange(items.filter((_, i) => i !== index))
  }
  const add = () => onChange([...items, { id: `-new-${nextNewId++}`, name: '', sup: '', use: '', gray: false }])
  const field = 'bg-transparent px-1 py-1 text-center font-bold border border-dashed border-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500'
  const icon = 'w-7 h-7 rounded hover:bg-white/70 disabled:opacity-30'

  return (
    <section className="mb-10 overflow-x-auto">
      <div className="w-max max-w-full">
        {sheet.title && <h2 className="font-bold underline mb-1">{sheet.title}</h2>}
        <table className="border-collapse border-2 border-black text-sm bg-white font-sans">
          <thead>
            <tr className="font-bold">
              <th scope="col" className={`${cellBorder} px-2 py-1`}>ITEM</th>
              {sheet.showSup && <th scope="col" className={`${cellBorder} px-1 py-1`}>SUP</th>}
              <th scope="col" className={`${cellBorder} px-2 py-1 leading-tight`}>{sheet.useLabel}</th>
              <th scope="col" className={`${cellBorder} px-2 py-1`}>Gray</th>
              <th scope="col" className={`${cellBorder} px-2 py-1`}><span className="sr-only">Move or remove</span></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const label = item.name.trim() || `Row ${i + 1}`
              return (
                <tr key={item.id} className={item.gray ? GRAY : ''}>
                  <td className={`${cellBorder} p-1`}>
                    <input aria-label={`${label} name`} value={item.name} maxLength={60} onChange={e => update(i, { name: e.target.value })} className={`${field} w-28 sm:w-80`} />
                  </td>
                  {sheet.showSup && (
                    <td className={`${cellBorder} p-1`}>
                      <input aria-label={`${label} supplier`} value={item.sup} maxLength={10} onChange={e => update(i, { sup: e.target.value })} className={`${field} w-10 sm:w-14`} />
                    </td>
                  )}
                  <td className={`${cellBorder} p-1`}>
                    <input aria-label={`${label} use`} value={item.use} maxLength={12} onChange={e => update(i, { use: e.target.value })} className={`${field} w-10 sm:w-14`} />
                  </td>
                  <td className={`${cellBorder} px-2 text-center`}>
                    <input type="checkbox" aria-label={`${label} gray`} checked={item.gray} onChange={e => update(i, { gray: e.target.checked })} className="w-4 h-4 accent-gray-600" />
                  </td>
                  <td className={`${cellBorder} px-1 whitespace-nowrap`}>
                    <button onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${label} up`} className={icon}>↑</button>
                    <button onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={`Move ${label} down`} className={icon}>↓</button>
                    <button onClick={() => remove(i)} aria-label={`Remove ${label}`} className={`${icon} text-red-700`}>✕</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <button onClick={add} className="mt-2 px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700">+ Add item</button>
      </div>
    </section>
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
