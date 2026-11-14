'use client'
// Shared Reports pieces (moved unchanged from CashReports so Sales can reuse them).
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useInternalLanguage } from './InternalLanguage'

const compact = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 })
export const shortDate = (date: string, weekday?: 'short', locale = 'en-US') => new Date(`${date}T00:00:00`).toLocaleDateString(locale, { weekday, month: 'short', day: 'numeric' })

export function Segmented<T extends string | number>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: readonly (readonly [T, string])[] }) {
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

export function Tile({ label, value, note }: { label: string; value: string; note: ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-600">{label}</p>
      <p className="text-xl sm:text-2xl font-semibold text-gray-900 mt-1">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{note}</p>
    </div>
  )
}

export function Card({ title, legend, children }: { title: string; legend: [string, string][]; children: ReactNode }) {
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
export function Columns<R extends { date: string }>({
  rows,
  segments,
  tooltip,
}: {
  rows: R[]
  segments: (r: R) => { value: number; color: string }[]
  tooltip: (r: R) => [string, string, string?][]
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
