'use client'
import { useManagerSession } from './ManagerSession'
import { useWorkspaceVisible } from './WorkspaceVisibility'

import { useShellTask } from './ShellTask'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Icon } from './ui/Icon'
import { CodeGate } from './CashOut'
import { useInternalLanguage } from './InternalLanguage'
import { errorKey, type TranslationKey } from '@/lib/internal-tools/i18n'
import { CASHOUT_STORES, fetchCashoutHistory, type CashoutDay, type CashoutStore } from '@/lib/cashout-store'
import { dailyRows, datesEnding, summarize } from '@/lib/dashboard'
import { Card, Columns, Segmented, Tile, shortDate } from './ReportCharts'
import { StoreAuthError } from '@/lib/schedule-store'

const STORE_LABELS: Record<CashoutStore, string> = { CR3: 'CR3 · W Military', CR2: 'CR2 · SW Military' }
// The Worker keeps 30 days, so only ranges up to 15 have a full previous period to compare against.
const RANGES = [7, 14, 30] as const
// Validated with the dataviz palette script (CVD + contrast on white).
const AM = '#2a78d6'
const PM = '#eb6834'
const OVER = '#2a78d6'
const SHORT = '#d03b3b'

const today = () => new Date().toLocaleDateString('en-CA')
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const formatCents = (cents: number) => usd.format(cents / 100)
const signed = (cents: number | null) => (cents === null ? '—' : (cents > 0 ? '+' : '') + formatCents(cents))

/** Existing cash-report adapter, now reached from Reports. */
export default function CashReports() {
  const visible = useWorkspaceVisible()
  const { t } = useInternalLanguage()
  const { token, unlock, expire } = useManagerSession()
  return token ? <CashBoard token={token} onLocked={expire} />
    : visible ? <CodeGate onUnlock={unlock} title={t('shell.reports')} /> : null
}

function CashBoard({ token, onLocked }: { token: string; onLocked: () => void }) {
  const { locale, t: tr } = useInternalLanguage()
  const visible = useWorkspaceVisible()
  const dateLabel = (date: string, weekday?: 'short') => shortDate(date, weekday, locale)
  const [histories, setHistories] = useState<Record<CashoutStore, CashoutDay[]> | null>(null)
  const [retry, setRetry] = useState(0)
  const [error, setError] = useState<TranslationKey | null>(null)
  const [store, setStore] = useState<CashoutStore | 'all'>('all')
  const [range, setRange] = useState<(typeof RANGES)[number]>(14)
  const [now] = useState(today)
  useShellTask('reports-context', { context: `${store === 'all' ? tr('shell.bothStores') : STORE_LABELS[store]} · ${now} · ${tr('shell.days', { days: range })}` })

  useEffect(() => {
    if (!visible) return
    let live = true
    setError(null); setHistories(null)
    Promise.all(CASHOUT_STORES.map(s => fetchCashoutHistory(s, now, token)))
      .then(all => live && setHistories(Object.fromEntries(CASHOUT_STORES.map((s, i) => [s, all[i]])) as Record<CashoutStore, CashoutDay[]>))
      .catch(caught => {
        if (!live) return
        if (caught instanceof StoreAuthError) onLocked()
        else setError(errorKey(caught))
      })
    return () => {
      live = false
    }
  }, [now, token, onLocked, visible, retry])

  if (error) return <div role="alert" className="border-2 border-red-800 bg-white p-4"><p className="flex items-center gap-2"><Icon name="warning" />{tr('reports.loadFailed')}</p><p>{tr(error)}</p><button type="button" className="min-h-11 underline" onClick={() => setRetry(value => value + 1)}>{tr('reports.retry')}</button></div>
  if (!histories) return <p className="text-sm text-gray-600">{tr('dashboard.loading')}</p>

  const stores = store === 'all' ? [...CASHOUT_STORES] : [store]
  const dates = datesEnding(now, range * 2)
  const all = dailyRows(stores.map(s => histories[s]), dates)
  const rows = all.slice(range)
  const cur = summarize(rows, stores.length, now)
  const prev = range * 2 <= 30 ? summarize(all.slice(0, range), stores.length, now) : null
  const change = prev?.avgDeposit && cur.avgDeposit !== null ? (cur.avgDeposit - prev.avgDeposit) / prev.avgDeposit : null

  const header = (
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h2 id="cash-heading" className="text-xl font-semibold text-gray-900 mr-auto">{tr('dashboard.cash')}</h2>
        <Segmented label={tr('common.store')} value={store} onChange={setStore} options={[['all', tr('dashboard.bothStores')], ...CASHOUT_STORES.map(s => [s, STORE_LABELS[s]] as const)]} />
        <Segmented label={tr('dashboard.range')} value={range} onChange={setRange} options={RANGES.map(r => [r, tr('dashboard.days', { number: r })] as const)} />
      </div>
  )
  if (!rows.some(row => row.saved)) return <section aria-labelledby="cash-heading">{header}<p role="status" className="border border-gray-300 bg-white p-4">{tr('reports.empty')}</p></section>

  return (
    <section aria-labelledby="cash-heading">
      {header}

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
        <Tile label={tr('dashboard.deposits')} value={formatCents(cur.deposit)} note={tr('dashboard.lastDays', { number: range })} />
        <Tile
          label={tr('dashboard.average')}
          value={cur.avgDeposit === null ? '—' : formatCents(cur.avgDeposit)}
          note={
            change === null ? (
              tr('dashboard.noComparison')
            ) : (
              <>
                <span className={change >= 0 ? 'text-green-800 font-medium' : 'text-red-700 font-medium'}>
                  {change >= 0 ? '▲' : '▼'} {Math.abs(change * 100).toFixed(1)}%
                </span>{' '}
                {tr('dashboard.previous', { number: range })}
              </>
            )
          }
        />
        <Tile
          label={tr('dashboard.netDifference')}
          value={signed(cur.overShort)}
          note={cur.shortDays ? tr('dashboard.shortDays', { number: cur.shortDays }) : tr('dashboard.noShortDays')}
        />
        <Tile
          label={tr('dashboard.missing')}
          value={String(cur.missing)}
          note={
            cur.missing ? (
              <Link href="/internal/bookkeeping#cash-out" className="text-red-700 underline">
                {tr('dashboard.fillIn')}
              </Link>
            ) : (
              tr('dashboard.everyDay')
            )
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <Card title={tr('dashboard.dailyDeposits')} legend={[['AM', AM], ['PM', PM]]}>
          <Columns
            rows={rows}
            segments={r => (r.saved ? [{ value: r.amDeposit, color: AM }, { value: r.pmDeposit, color: PM }] : [])}
            tooltip={r => (r.saved ? [['AM', formatCents(r.amDeposit), AM], ['PM', formatCents(r.pmDeposit), PM], [tr('dashboard.day'), formatCents(r.deposit)]] : [[tr('dashboard.noCashout'), '']])}
          />
        </Card>
        <Card title={tr('dashboard.vsToast')} legend={[[tr('dashboard.over'), OVER], [tr('dashboard.short'), SHORT]]}>
          <Columns
            rows={rows}
            segments={r => (r.overShort ? [{ value: r.overShort, color: r.overShort > 0 ? OVER : SHORT }] : [])}
            tooltip={r => [[r.saved ? (r.overShort === null ? tr('dashboard.noToast') : tr('cash.overShort')) : tr('dashboard.noCashout'), r.saved ? signed(r.overShort) : '']]}
          />
        </Card>
      </div>

      <div className="overflow-x-auto bg-white rounded-xl border border-gray-200">
        <table className="w-full text-sm tabular-nums">
          <caption className="text-left px-3 py-2 font-semibold text-gray-900">{tr('dashboard.byDay')}</caption>
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              {[tr('common.date'), tr('cash.shiftDeposit', { shift: 'AM' }), tr('cash.shiftDeposit', { shift: 'PM' }), tr('cash.dayDeposit'), tr('cash.overShort'), tr('cash.vsZ')].map((h, i) => (
                <th key={h} scope="col" className={`px-3 py-2 font-medium whitespace-nowrap ${i ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map(r => (
              <tr key={r.date} className="border-t border-gray-100">
                <th scope="row" className="px-3 py-2 text-left font-normal whitespace-nowrap">
                  {dateLabel(r.date, 'short')}
                  {stores.length > 1 && r.saved > 0 && r.saved < stores.length && <span className="ml-2 text-xs text-gray-500">{tr('dashboard.oneStore')}</span>}
                </th>
                {r.saved ? (
                  <>
                    <td className="px-3 py-2 text-right">{formatCents(r.amDeposit)}</td>
                    <td className="px-3 py-2 text-right">{formatCents(r.pmDeposit)}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatCents(r.deposit)}</td>
                    <td className={`px-3 py-2 text-right ${r.overShort !== null && r.overShort < 0 ? 'text-red-700' : ''}`}>{signed(r.overShort)}</td>
                    <td className={`px-3 py-2 text-right ${r.zOverShort !== null && r.zOverShort < 0 ? 'text-red-700' : ''}`}>{signed(r.zOverShort)}</td>
                  </>
                ) : (
                  <td colSpan={5} className="px-3 py-2 text-gray-500">{r.date < now ? tr('dashboard.noCashout') : tr('dashboard.notCounted')}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
