'use client'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useManagerSession } from './ManagerSession'
import { useWorkspaceVisible } from './WorkspaceVisibility'
import { useInternalLanguage } from './InternalLanguage'
import { Icon } from './ui/Icon'
import { Card, Columns, Segmented, Tile, shortDate } from './ReportCharts'
import type { TranslationKey } from '@/lib/internal-tools/i18n'
import { datesEnding } from '@/lib/dashboard'
import { StoreAuthError } from '@/lib/schedule-store'
import { salesKey, salesRows, splitParts, storeTotals, sumSalesDays, type SalesDay, type SalesPartKey, type SalesRow, type SalesSplitKind } from '@/lib/sales'
import { SalesUnavailableError, type SalesProblem } from '@/lib/sales-store'
import { SALES_STORES, salesCache, type SalesSnapshot } from '@/lib/sales-cache'

const STORES = SALES_STORES
type Store = (typeof STORES)[number]
const STORE_LABELS: Record<Store, string> = { CR3: 'CR3 · W Military', CR2: 'CR2 · SW Military' }
const RANGES = [7, 14, 30] as const
// Categorical slots 1-3 and 7/4 of the dataviz reference palette, validated with its script (light surface).
// Contrast WARNs on orange/aqua/yellow are relieved by the tables, which carry every value.
const PART_COLORS: Record<SalesPartKey, string> = { am: '#2a78d6', pm: '#eb6834', lunch: '#2a78d6', dinner: '#eb6834', other: '#1baf7a' }
const DISCOUNT = '#6250d6'
const VOID = '#eda100'
// Stores take the unused categorical slots 5 (magenta) and 6 (green) so no color means two things; validated with the
// dataviz script (light surface). The magenta contrast WARN is relieved by tooltips and the per-store table values.
const STORE_COLORS: Record<Store, string> = { CR3: '#e87ba4', CR2: '#008300' }
const NOTHING_LOADED: SalesSnapshot = {}

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
  const [split, setSplit] = useState<SalesSplitKind>('store')
  const [now] = useState(today)
  // Shared with the preload in InternalShell, so days loaded on other internal pages show at once.
  const loaded = useSyncExternalStore(salesCache.subscribe, salesCache.getSnapshot, () => NOTHING_LOADED)
  const [problem, setProblem] = useState<SalesProblem | null>(null)
  const [retry, setRetry] = useState(0)

  const stores = useMemo<Store[]>(() => (store === 'all' ? [...STORES] : [store]), [store])
  // "By store" only means something with both stores shown; one store falls back to AM/PM (the choice is remembered).
  const shownSplit: SalesSplitKind = split === 'store' && store !== 'all' ? 'shift' : split
  const dates = useMemo(() => datesEnding(now, range), [now, range])

  useEffect(() => {
    if (!visible) return
    // Loaded days are kept for the session, so switching store or range (or coming back) only fetches what's new.
    let live = true
    setProblem(null)
    salesCache.ensure(stores, dates, token).catch(caught => {
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
        <Segmented label={t('sales.split')} value={shownSplit} onChange={setSplit} options={[...(store === 'all' ? [['store', t('sales.byStore')] as const] : []), ['shift', t('sales.byShift')], ['service', t('sales.byService')]]} />
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
  const perStore = storeTotals(rows, stores)
  const bothStores = stores.length > 1
  // The pieces each net sales bar is stacked from: the stores, or the AM/PM or meal-period parts.
  const pieces: { key: string; label: string; color: string; net: number; orders: number; rowNet: (r: SalesRow) => number }[] = shownSplit === 'store'
    ? stores.map(s => ({ key: s, label: s, color: STORE_COLORS[s], net: perStore[s].net, orders: perStore[s].orders, rowNet: r => r.byStore[s]?.net ?? 0 }))
    : splitParts(total, shownSplit).map(p => ({ key: p.key, label: partLabel(p.key), color: PART_COLORS[p.key], net: p.net, orders: p.orders, rowNet: r => (r.day ? partValue(r.day, p.key).net : 0) }))
  const legend = pieces.map(p => [p.label, p.color] as [string, string])
  const storeLegend = stores.map(s => [s, STORE_COLORS[s]] as [string, string])
  /** Discounts or voids per day, stacked CR3 + CR2 (shown when both stores are selected). */
  const storeChart = (title: string, value: (d: SalesDay) => number) => (
    <Card title={title} legend={storeLegend}>
      <Columns<SalesRow>
        rows={rows}
        segments={r => (r.day ? stores.map(s => ({ value: r.byStore[s] ? value(r.byStore[s]) : 0, color: STORE_COLORS[s] })) : [])}
        tooltip={r => r.day
          ? [...stores.map(s => [s, r.byStore[s] ? money(value(r.byStore[s])) : '—', STORE_COLORS[s]] as [string, string, string]), [t('dashboard.bothStores'), money(value(r.day))]]
          : [[t('sales.none'), '']]}
      />
    </Card>
  )
  /** Small per-store line under a combined table cell, so the table carries every charted value. */
  const storeSplit = (r: SalesRow, value: (d: SalesDay) => number) => bothStores && (
    <span className="block text-xs text-gray-500 whitespace-nowrap">{stores.map(s => `${s} ${r.byStore[s] ? money(value(r.byStore[s])) : '—'}`).join(' · ')}</span>
  )

  return (
    <section aria-labelledby="sales-heading" className="mb-10">
      {header}

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
        <Tile label={t('sales.net')} value={money(total.net)} note={t('sales.grossNote', { amount: money(total.gross) })} />
        <Tile label={t('sales.orders')} value={total.orders.toLocaleString(locale)} note={total.orders ? t('sales.averageNote', { amount: money(Math.round(total.net / total.orders)) }) : '—'} />
        <Tile label={t('sales.discounts')} value={money(total.discounts)} note={total.net ? t('sales.discountShare', { percent: percent.format(total.discounts / total.net) }) : '—'} />
        <Tile label={t('sales.voids')} value={money(total.voids.amount)} note={t('sales.voidNote', { items: total.voids.items, orders: total.voids.orders })} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <div className={`min-w-0 ${bothStores ? 'lg:col-span-2' : ''}`}>
          <Card title={t('sales.dailyNet')} legend={legend}>
            <Columns<SalesRow>
              rows={rows}
              segments={r => (r.day ? pieces.map(p => ({ value: p.rowNet(r), color: p.color })) : [])}
              tooltip={r => r.day
                ? [...pieces.map(p => [p.label, money(p.rowNet(r)), p.color] as [string, string, string]), [t('sales.net'), money(r.day.net)]]
                : [[t('sales.none'), '']]}
            />
          </Card>
        </div>
        {bothStores ? (
          <>
            {storeChart(t('sales.dailyDiscounts'), d => d.discounts)}
            {storeChart(t('sales.dailyVoids'), d => d.voids.amount)}
          </>
        ) : (
          <Card title={t('sales.dailyLosses')} legend={[[t('sales.discounts'), DISCOUNT], [t('sales.voids'), VOID]]}>
            <Columns<SalesRow>
              rows={rows}
              segments={r => (r.day ? [{ value: r.day.discounts, color: DISCOUNT }, { value: r.day.voids.amount, color: VOID }] : [])}
              tooltip={r => r.day ? [[t('sales.discounts'), money(r.day.discounts), DISCOUNT], [t('sales.voids'), money(r.day.voids.amount), VOID]] : [[t('sales.none'), '']]}
            />
          </Card>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mb-6">
        <SmallTable caption={t('sales.splitTotals')} headings={['', t('sales.net'), t('sales.orders'), t('sales.share')]}
          rows={pieces.map(p => [p.label, money(p.net), p.orders.toLocaleString(locale), total.net ? percent.format(p.net / total.net) : '—'])} empty={t('sales.none')} />
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
              {[t('common.date'), ...pieces.map(p => p.label), t('sales.net'), t('sales.orders'), t('sales.discounts'), t('sales.voids')].map((h, i) => (
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
                    {pieces.map(p => <td key={p.key} className="px-3 py-2 text-right">{money(p.rowNet(r))}</td>)}
                    <td className="px-3 py-2 text-right font-medium">{money(r.day.net)}</td>
                    <td className="px-3 py-2 text-right">{r.day.orders.toLocaleString(locale)}</td>
                    <td className="px-3 py-2 text-right">{money(r.day.discounts)}{storeSplit(r, d => d.discounts)}</td>
                    <td className="px-3 py-2 text-right">{money(r.day.voids.amount)}{storeSplit(r, d => d.voids.amount)}</td>
                  </>
                ) : (
                  <td colSpan={pieces.length + 4} className="px-3 py-2 text-gray-500">{t('sales.none')}</td>
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
