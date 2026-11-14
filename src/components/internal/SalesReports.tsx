'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useManagerSession } from './ManagerSession'
import { useWorkspaceVisible } from './WorkspaceVisibility'
import { useInternalLanguage } from './InternalLanguage'
import { Icon } from './ui/Icon'
import { Card, Columns, Segmented, Tile, shortDate } from './ReportCharts'
import type { TranslationKey } from '@/lib/internal-tools/i18n'
import { datesEnding } from '@/lib/dashboard'
import { StoreAuthError } from '@/lib/schedule-store'
import { runLimited, salesKey, salesRows, splitParts, sumSalesDays, type SalesDay, type SalesPartKey, type SalesRow, type SalesSplitKind } from '@/lib/sales'
import { fetchSalesDay, SalesUnavailableError } from '@/lib/sales-store'

const STORES = ['CR3', 'CR2'] as const
type Store = (typeof STORES)[number]
const STORE_LABELS: Record<Store, string> = { CR3: 'CR3 · W Military', CR2: 'CR2 · SW Military' }
const RANGES = [7, 14, 30] as const
// Categorical slots 1-3 and 7/4 of the dataviz reference palette, validated with its script (light surface).
// Contrast WARNs on orange/aqua/yellow are relieved by the tables, which carry every value.
const PART_COLORS: Record<SalesPartKey, string> = { am: '#2a78d6', pm: '#eb6834', lunch: '#2a78d6', dinner: '#eb6834', other: '#1baf7a' }
const DISCOUNT = '#6250d6'
const VOID = '#eda100'
/** Toast calls in flight at once; each uncached day is a few Toast requests. */
const PARALLEL_DAYS = 4

const today = () => new Date().toLocaleDateString('en-CA')
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const money = (cents: number) => usd.format(cents / 100)
const percent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 })
const partValue = (day: SalesDay, key: SalesPartKey) => (key === 'am' || key === 'pm' ? day.shift[key] : day.service[key])

/** Toast sales for the Reports page. Shown once the shared manager code is entered (Cash reports holds the gate). */
export default function SalesReports() {
  const { token, expire } = useManagerSession()
  return token ? <SalesBoard token={token} onLocked={expire} /> : null
}

function SalesBoard({ token, onLocked }: { token: string; onLocked: () => void }) {
  const { locale, t } = useInternalLanguage()
  const visible = useWorkspaceVisible()
  const [store, setStore] = useState<Store | 'all'>('all')
  const [range, setRange] = useState<(typeof RANGES)[number]>(7)
  const [split, setSplit] = useState<SalesSplitKind>('shift')
  const [now] = useState(today)
  const [loaded, setLoaded] = useState<Record<string, SalesDay>>({})
  const loadedRef = useRef(loaded)
  loadedRef.current = loaded
  const [problem, setProblem] = useState<'unconfigured' | 'outdated' | 'failed' | null>(null)
  const [retry, setRetry] = useState(0)

  const stores = useMemo<Store[]>(() => (store === 'all' ? [...STORES] : [store]), [store])
  const dates = useMemo(() => datesEnding(now, range), [now, range])

  useEffect(() => {
    if (!visible) return
    // Days already loaded this visit are kept, so switching store or range only fetches what's new.
    const wanted = stores.flatMap(s => dates.map(date => ({ store: s, date }))).filter(x => !loadedRef.current[salesKey(x.store, x.date)])
    if (!wanted.length) return
    let live = true
    setProblem(null)
    runLimited(wanted, PARALLEL_DAYS, async ({ store: s, date }) => {
      if (!live) throw new Error('stale')
      const day = await fetchSalesDay(s, date, token)
      if (live) setLoaded(previous => ({ ...previous, [salesKey(s, date)]: day }))
    }).catch(caught => {
      if (!live) return
      if (caught instanceof StoreAuthError) onLocked()
      else setProblem(caught instanceof SalesUnavailableError ? caught.reason : 'failed')
    })
    return () => {
      live = false
    }
  }, [stores, dates, token, visible, retry, onLocked])

  const needed = stores.length * dates.length
  const have = stores.reduce((n, s) => n + dates.filter(d => loaded[salesKey(s, d)]).length, 0)
  const partLabel = (key: SalesPartKey) => t(`sales.part.${key}` as TranslationKey)
  const dateLabel = (date: string) => shortDate(date, 'short', locale)

  const header = (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <h2 id="sales-heading" className="text-xl font-semibold text-gray-900 mr-auto">{t('sales.title')}</h2>
        <Segmented label={t('common.store')} value={store} onChange={setStore} options={[['all', t('dashboard.bothStores')], ...STORES.map(s => [s, STORE_LABELS[s]] as const)]} />
        <Segmented label={t('dashboard.range')} value={range} onChange={setRange} options={RANGES.map(r => [r, t('dashboard.days', { number: r })] as const)} />
        <Segmented label={t('sales.split')} value={split} onChange={setSplit} options={[['shift', t('sales.byShift')], ['service', t('sales.byService')]]} />
      </div>
      <p className="mb-4 max-w-3xl text-xs text-gray-600">{t('sales.help')}</p>
    </>
  )

  if (problem) {
    return (
      <section aria-labelledby="sales-heading" className="mb-10">
        {header}
        <div role="alert" className="border-2 border-red-800 bg-white p-4">
          <p className="flex items-center gap-2"><Icon name="warning" />{t(`sales.${problem}`)}</p>
          {problem !== 'unconfigured' && <button type="button" className="min-h-11 underline" onClick={() => setRetry(value => value + 1)}>{t('reports.retry')}</button>}
        </div>
      </section>
    )
  }
  if (have < needed) {
    return (
      <section aria-labelledby="sales-heading" className="mb-10">
        {header}
        <p role="status" className="text-sm text-gray-600">{t('sales.loading', { loaded: have, total: needed })}</p>
      </section>
    )
  }

  const rows = salesRows(dates, stores, loaded)
  const total = sumSalesDays(rows.flatMap(r => (r.day ? [r.day] : [])))
  const parts = splitParts(total, split)
  const legend = parts.map(p => [partLabel(p.key), PART_COLORS[p.key]] as [string, string])

  return (
    <section aria-labelledby="sales-heading" className="mb-10">
      {header}

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
        <Tile label={t('sales.net')} value={money(total.net)} note={t('sales.grossNote', { amount: money(total.gross) })} />
        <Tile label={t('sales.orders')} value={total.orders.toLocaleString(locale)} note={total.orders ? t('sales.averageNote', { amount: money(Math.round(total.net / total.orders)) }) : '—'} />
        <Tile label={t('sales.discounts')} value={money(total.discounts)} note={total.gross ? t('sales.discountShare', { percent: percent.format(total.discounts / total.gross) }) : '—'} />
        <Tile label={t('sales.voids')} value={money(total.voids.amount)} note={t('sales.voidNote', { items: total.voids.items, orders: total.voids.orders })} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <Card title={t('sales.dailyNet')} legend={legend}>
          <Columns<SalesRow>
            rows={rows}
            segments={r => (r.day ? parts.map(p => ({ value: partValue(r.day!, p.key).net, color: PART_COLORS[p.key] })) : [])}
            tooltip={r => r.day
              ? [...parts.map(p => [partLabel(p.key), money(partValue(r.day!, p.key).net), PART_COLORS[p.key]] as [string, string, string]), [t('sales.net'), money(r.day.net)]]
              : [[t('sales.none'), '']]}
          />
        </Card>
        <Card title={t('sales.dailyLosses')} legend={[[t('sales.discounts'), DISCOUNT], [t('sales.voids'), VOID]]}>
          <Columns<SalesRow>
            rows={rows}
            segments={r => (r.day ? [{ value: r.day.discounts, color: DISCOUNT }, { value: r.day.voids.amount, color: VOID }] : [])}
            tooltip={r => r.day ? [[t('sales.discounts'), money(r.day.discounts), DISCOUNT], [t('sales.voids'), money(r.day.voids.amount), VOID]] : [[t('sales.none'), '']]}
          />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mb-6">
        <SmallTable caption={t('sales.splitTotals')} headings={['', t('sales.net'), t('sales.orders'), t('sales.share')]}
          rows={parts.map(p => [partLabel(p.key), money(p.net), p.orders.toLocaleString(locale), total.net ? percent.format(p.net / total.net) : '—'])} empty={t('sales.none')} />
        <SmallTable caption={t('sales.discountsByName')} headings={['', t('sales.timesUsed'), t('sales.amount')]}
          rows={total.discountsByName.map(d => [d.name, d.count.toLocaleString(locale), money(d.amount)])} empty={t('sales.none')} />
        <SmallTable caption={t('sales.voidsByReason')} headings={['', t('sales.items'), t('sales.amount')]}
          rows={total.voidsByReason.map(v => [v.name, v.items.toLocaleString(locale), money(v.amount)])} empty={t('sales.none')} />
      </div>

      <div className="overflow-x-auto bg-white rounded-xl border border-gray-200">
        <table className="w-full text-sm tabular-nums">
          <caption className="text-left px-3 py-2 font-semibold text-gray-900">{t('sales.byDay')}</caption>
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              {[t('common.date'), ...parts.map(p => partLabel(p.key)), t('sales.net'), t('sales.orders'), t('sales.discounts'), t('sales.voids')].map((h, i) => (
                <th key={h} scope="col" className={`px-3 py-2 font-medium whitespace-nowrap ${i ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map(r => (
              <tr key={r.date} className="border-t border-gray-100">
                <th scope="row" className="px-3 py-2 text-left font-normal whitespace-nowrap">
                  {dateLabel(r.date)}
                  {r.date === now && <span className="ml-2 text-xs text-gray-500">{t('sales.today')}</span>}
                  {stores.length > 1 && r.stores > 0 && r.stores < stores.length && <span className="ml-2 text-xs text-gray-500">{t('sales.oneStore')}</span>}
                </th>
                {r.day ? (
                  <>
                    {parts.map(p => <td key={p.key} className="px-3 py-2 text-right">{money(partValue(r.day!, p.key).net)}</td>)}
                    <td className="px-3 py-2 text-right font-medium">{money(r.day.net)}</td>
                    <td className="px-3 py-2 text-right">{r.day.orders.toLocaleString(locale)}</td>
                    <td className="px-3 py-2 text-right">{money(r.day.discounts)}</td>
                    <td className="px-3 py-2 text-right">{money(r.day.voids.amount)}</td>
                  </>
                ) : (
                  <td colSpan={parts.length + 4} className="px-3 py-2 text-gray-500">{t('sales.none')}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function SmallTable({ caption, headings, rows, empty }: { caption: string; headings: string[]; rows: string[][]; empty: string }) {
  return (
    <div className="min-w-0 overflow-x-auto bg-white rounded-xl border border-gray-200">
      <table className="w-full text-sm tabular-nums">
        <caption className="text-left px-3 py-2 font-semibold text-gray-900">{caption}</caption>
        <thead className="bg-gray-50 text-gray-600">
          <tr>{headings.map((h, i) => <th key={i} scope="col" className={`px-3 py-2 font-medium whitespace-nowrap ${i ? 'text-right' : 'text-left'}`}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0
            ? <tr><td colSpan={headings.length} className="px-3 py-2 text-gray-500">{empty}</td></tr>
            : rows.map(row => (
              <tr key={row[0]} className="border-t border-gray-100">
                {row.map((cell, i) => i === 0
                  ? <th key={i} scope="row" className="px-3 py-2 text-left font-normal break-words">{cell}</th>
                  : <td key={i} className="px-3 py-2 text-right whitespace-nowrap">{cell}</td>)}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  )
}
