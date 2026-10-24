'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { CodeGate } from './CashOut'
import { useInternalLanguage } from './InternalLanguage'
import { errorKey, type TranslationKey } from '@/lib/internal-tools/i18n'
import { CASHOUT_STORES, fetchCashoutHistory, type CashoutDay, type CashoutStore } from '@/lib/cashout-store'
import { dailyRows, datesEnding, summarize, type DayRow } from '@/lib/dashboard'
import { StoreAuthError } from '@/lib/schedule-store'

const PAGES = [
  { href: '/internal/bookkeeping', title: 'nav.bookkeeping', blurb: 'nav.bookkeepingDescription' },
  { href: '/internal/inventory', title: 'nav.inventory', blurb: 'nav.inventoryDescription' },
  { href: '/scheduler-demo', title: 'nav.scheduler', blurb: 'nav.schedulerDescription' },
  { href: '/internal/forms', title: 'nav.forms', blurb: 'nav.formsDescription' },
] as const

const STORE_LABELS: Record<CashoutStore, string> = { CR3: 'CR3 · W Military', CR2: 'CR2 · SW Military' }
// The Worker keeps 30 days, so only ranges up to 15 have a full previous period to compare against.
const RANGES = [7, 14, 30] as const
// Validated with the dataviz palette script (CVD + contrast on white).
const AM = '#2a78d6'
const PM = '#eb6834'
const OVER = '#2a78d6'
const SHORT = '#d03b3b'

const today = () => new Date().toLocaleDateString('en-CA')
const compact = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 })
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const formatCents = (cents: number) => usd.format(cents / 100)
const signed = (cents: number | null) => (cents === null ? '—' : (cents > 0 ? '+' : '') + formatCents(cents))
const shortDate = (date: string, weekday?: 'short', locale = 'en-US') => new Date(`${date}T00:00:00`).toLocaleDateString(locale, { weekday, month: 'short', day: 'numeric' })

/** Internal home: links to every tool, then the cash numbers behind the manager code. */
export default function Dashboard() {
  const { t: tr } = useInternalLanguage()
  // Manager token lives in memory only, like cash out.
  const [token, setToken] = useState('')
  const lock = useCallback(() => setToken(''), [])
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">{tr('nav.home')}</h1>
      <nav aria-label={tr('nav.tools')} className="grid gap-3 sm:grid-cols-3 mb-8">
        {PAGES.map(p => (
          <Link key={p.href} href={p.href} className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm hover:border-red-300 hover:shadow">
            <span className="font-semibold text-red-700">{tr(p.title)}</span>
            <span className="block text-sm text-gray-600">{tr(p.blurb)}</span>
          </Link>
        ))}
      </nav>
      {token ? <CashBoard token={token} onLocked={lock} /> : <CodeGate onUnlock={setToken} title={tr('cash.dashboard')} />}
    </div>
  )
}

function CashBoard({ token, onLocked }: { token: string; onLocked: () => void }) {
  const { locale, t: tr } = useInternalLanguage()
  const dateLabel = (date: string, weekday?: 'short') => shortDate(date, weekday, locale)
  const [histories, setHistories] = useState<Record<CashoutStore, CashoutDay[]> | null>(null)
  const [error, setError] = useState<TranslationKey | null>(null)
  const [store, setStore] = useState<CashoutStore | 'all'>('all')
  const [range, setRange] = useState<(typeof RANGES)[number]>(14)
  const [now] = useState(today)

  useEffect(() => {
    let live = true
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
  }, [now, token, onLocked])

  if (error) return <p className="text-sm text-red-700">{tr(error)}</p>
  if (!histories) return <p className="text-sm text-gray-600">{tr('dashboard.loading')}</p>

  const stores = store === 'all' ? [...CASHOUT_STORES] : [store]
  const dates = datesEnding(now, range * 2)
  const all = dailyRows(stores.map(s => histories[s]), dates)
  const rows = all.slice(range)
  const cur = summarize(rows, stores.length, now)
  const prev = range * 2 <= 30 ? summarize(all.slice(0, range), stores.length, now) : null
  const change = prev?.avgDeposit && cur.avgDeposit !== null ? (cur.avgDeposit - prev.avgDeposit) / prev.avgDeposit : null

  return (
    <section aria-labelledby="cash-heading">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h2 id="cash-heading" className="text-xl font-semibold text-gray-900 mr-auto">{tr('dashboard.cash')}</h2>
        <Segmented label={tr('common.store')} value={store} onChange={setStore} options={[['all', tr('dashboard.bothStores')], ...CASHOUT_STORES.map(s => [s, STORE_LABELS[s]] as const)]} />
        <Segmented label={tr('dashboard.range')} value={range} onChange={setRange} options={RANGES.map(r => [r, tr('dashboard.days', { number: r })] as const)} />
      </div>

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

function Segmented<T extends string | number>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: readonly (readonly [T, string])[] }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex max-w-full overflow-x-auto rounded-lg border border-gray-300 bg-white p-0.5 text-sm">
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={v === value}
          onClick={() => onChange(v)}
          className={`px-3 py-1 rounded-md whitespace-nowrap ${v === value ? 'bg-red-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

function Tile({ label, value, note }: { label: string; value: string; note: ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-600">{label}</p>
      <p className="text-xl sm:text-2xl font-semibold text-gray-900 mt-1">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{note}</p>
    </div>
  )
}

function Card({ title, legend, children }: { title: string; legend: [string, string][]; children: ReactNode }) {
  return (
    <figure className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2">
        <span className="font-semibold text-gray-900 mr-auto">{title}</span>
        {legend.map(([name, color]) => (
          <span key={name} className="inline-flex items-center gap-1.5 text-xs text-gray-600">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
            {name}
          </span>
        ))}
      </figcaption>
      {children}
    </figure>
  )
}

const W = 600
const H = 200
const PAD = { top: 8, right: 8, bottom: 22, left: 48 }

/** Round tick step (1/2/5 × 10^k) giving at most four gridlines. */
function niceStep(span: number) {
  const raw = span / 4 || 1
  const pow = 10 ** Math.floor(Math.log10(raw))
  return ([1, 2, 5, 10].find(m => m * pow >= raw) ?? 10) * pow
}

/** Column chart, one column per day. Segments stack away from zero, so one signed value per day also works. */
function Columns({
  rows,
  segments,
  tooltip,
}: {
  rows: DayRow[]
  segments: (r: DayRow) => { value: number; color: string }[]
  tooltip: (r: DayRow) => [string, string, string?][]
}) {
  const { locale, t: tr } = useInternalLanguage()
  const dateLabel = (date: string) => shortDate(date, undefined, locale)
  const [active, setActive] = useState<number | null>(null)
  const sums = rows.map(r => segments(r).reduce((s, x) => s + x.value, 0))
  const step = niceStep(Math.max(0, ...sums) - Math.min(0, ...sums))
  const top = Math.ceil(Math.max(0, ...sums) / step) * step || step
  const bottom = Math.floor(Math.min(0, ...sums) / step) * step
  const y = (v: number) => PAD.top + ((top - v) / (top - bottom)) * (H - PAD.top - PAD.bottom)
  const band = (W - PAD.left - PAD.right) / rows.length
  const barW = Math.min(24, band * 0.6)
  const ticks = Array.from({ length: Math.round((top - bottom) / step) + 1 }, (_, i) => bottom + i * step)
  const labelEvery = Math.ceil(rows.length / 7)

  return (
    <div className="relative overflow-x-auto" onMouseLeave={() => setActive(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[480px]" role="img" aria-label={tr('dashboard.chart')}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? '#c3c2b7' : '#e1e0d9'} />
            <text x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill="#898781" className="tabular-nums">
              {compact.format(t / 100)}
            </text>
          </g>
        ))}
        {rows.map((r, i) => {
          const cx = PAD.left + band * (i + 0.5)
          let base = 0
          const segs = segments(r).filter(s => s.value !== 0)
          return (
            <g
              key={r.date}
              tabIndex={0}
              aria-label={`${dateLabel(r.date)}: ${tooltip(r).map(([k, v]) => `${k} ${v}`).join(', ')}`}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className="outline-none"
            >
              <rect x={cx - band / 2} y={PAD.top} width={band} height={H - PAD.top - PAD.bottom} fill={active === i ? '#f3f2ee' : 'transparent'} />
              {segs.map((s, j) => {
                const from = y(base)
                base += s.value
                const to = y(base)
                const last = j === segs.length - 1
                // 2px surface gap between stacked segments; only the outer end is rounded.
                const gap = j > 0 ? 2 : 0
                const up = s.value > 0
                const h = Math.max(Math.abs(to - from) - gap, 1)
                const yTop = up ? to : from + gap
                return <Segment key={j} x={cx - barW / 2} y={yTop} w={barW} h={h} color={s.color} round={last ? (up ? 'top' : 'bottom') : null} />
              })}
              {i % labelEvery === (rows.length - 1) % labelEvery && (
                <text x={cx} y={H - 6} textAnchor="middle" fontSize="11" fill="#898781">
                  {dateLabel(r.date)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      {active !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-md whitespace-nowrap"
          style={{ left: `${((PAD.left + band * (active + 0.5)) / W) * 100}%`, transform: `translateX(${active > rows.length / 2 ? '-105%' : '5%'})` }}
        >
          <p className="text-gray-500 mb-1">{dateLabel(rows[active].date)}</p>
          {tooltip(rows[active]).map(([k, v, color]) => (
            <p key={k} className="flex items-center gap-2">
              {color && <span className="h-0.5 w-3" style={{ background: color }} />}
              <span className="font-semibold text-gray-900 tabular-nums">{v}</span>
              <span className="text-gray-600">{k}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

/** A bar segment with a 4px rounded outer end and a square end toward the baseline. */
function Segment({ x, y, w, h, color, round }: { x: number; y: number; w: number; h: number; color: string; round: 'top' | 'bottom' | null }) {
  const r = round ? Math.min(4, h, w / 2) : 0
  const d =
    round === 'top'
      ? `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
      : round === 'bottom'
        ? `M${x},${y}V${y + h - r}Q${x},${y + h} ${x + r},${y + h}H${x + w - r}Q${x + w},${y + h} ${x + w},${y + h - r}V${y}Z`
        : `M${x},${y}h${w}v${h}h${-w}Z`
  return <path d={d} fill={color} />
}
