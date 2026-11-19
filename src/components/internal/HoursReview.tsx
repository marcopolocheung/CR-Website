'use client'
import { useState } from 'react'
import { useInternalLanguage } from './InternalLanguage'
import type { mapHours } from '@/lib/converter/employee-mapping'
import { HOURS_COLUMNS, sourceNumber } from '@/lib/converter/validation'
import type { reviewHours } from '@/lib/converter/hours-review'
import styles from './hours-stages.module.css'

type Review = ReturnType<typeof reviewHours>
type Identity = ReturnType<typeof mapHours>[number]
type Queue = 'all' | 'excluded' | 'identity' | 'ambiguous' | 'unmatched'

export default function HoursReview({ review, acknowledged, onAcknowledge, identities = [], mappingBlocked = review.blocked }: {
  identities?: Identity[]; mappingBlocked?: boolean; review: Review; acknowledged: boolean; onAcknowledge: (value: boolean) => void
}) {
  const { t } = useInternalLanguage()
  const [filter, setFilter] = useState<Queue>('all')
  const number = (value: number | null) => value === null ? t('salesReview.missingValue') : String(Math.round(value * 1000000) / 1000000)
  const identity = (sourceRow: number) => identities.find(item => item.sourceRow === sourceRow)
  const names = new Map<string, Set<string>>()
  for (const row of review.included) {
    const name = row.values.Employee.trim(), ids = names.get(name) ?? new Set<string>()
    ids.add(identity(row.sourceRow)?.key ?? `row:${row.sourceRow}`); names.set(name, ids)
  }
  const reasons = (row: Review['rows'][number]): Queue[] => {
    const mapped = identity(row.sourceRow)
    const flags: Queue[] = []
    if (!row.included) flags.push('excluded')
    if (!row.values.Employee.trim() || !row.values['Employee External Id'].trim() && !mapped?.employee) flags.push('identity')
    if (row.included && (names.get(row.values.Employee.trim())?.size ?? 0) > 1 && !mapped?.employee) flags.push('ambiguous')
    if (row.included && !mapped?.employee) flags.push('unmatched')
    return flags
  }
  const queue = review.rows.filter(row => reasons(row).length)
  const employeeGroups = new Map<string, { name: string; shared: string; external: Set<string>; rows: number[]; total: number; regular: number; overtime: number }>()
  for (const row of review.included) {
    const mapped = identity(row.sourceRow)
    const key = mapped?.employee ? `shared:${mapped.employee.id}` : mapped?.key ?? `row:${row.sourceRow}`
    const group = employeeGroups.get(key) ?? { name: mapped?.employee?.name ?? row.values.Employee, shared: mapped?.employee?.id ?? '', external: new Set<string>(), rows: [], total: 0, regular: 0, overtime: 0 }
    group.external.add(row.values['Employee External Id']); group.rows.push(row.sourceRow)
    group.total += sourceNumber(row.values['Total Hours'], false) ?? 0
    group.regular += sourceNumber(row.values['Regular Hours'], false) ?? 0
    group.overtime += sourceNumber(row.values['Overtime Hours'], false) ?? 0
    employeeGroups.set(key, group)
  }
  function showRow(sourceRow: number) {
    const details = document.getElementById('hours-source-details') as HTMLDetailsElement | null
    if (details) details.open = true
    document.querySelector<HTMLElement>(`[data-hours-row="${sourceRow}"]`)?.focus()
  }
  return <section aria-labelledby="hours-review-title" className="mt-5 border-t pt-4">
    <h3 id="hours-review-title" className="text-lg font-semibold">{t('hoursReview.title')}</h3>
    <p className="mt-2 text-sm">{t('hoursReview.rule')}</p>
    <p className="mt-2 font-semibold" data-hours-counts>{t('hoursReview.counts', { source: review.rows.length, included: review.included.length, excluded: review.excluded.length })}</p>
    <dl className={styles.summary}>{Object.entries(review.totals).map(([key, value]) => <div key={key}><dt>{t(`hoursReview.${key}` as 'hoursReview.source')}</dt><dd>{number(value)}</dd></div>)}</dl>
    <h4 className="mt-5 font-semibold">{t('hoursStages.employees')}</h4>
    <ul className="mt-3 space-y-3">{Array.from(employeeGroups, ([key, group]) => <li key={key} data-hours-employee={key} className="border-b pb-3 break-words">
      <p className="font-semibold">{group.name || t('salesReview.missingValue')}</p>
      <p className="text-sm">{Array.from(group.external).map(value => value || t('mapping.noExternal')).join(' · ')}{group.shared && ` · ${group.shared}`}</p>
      <dl className={styles.summary}>{(['total', 'regular', 'overtime'] as const).map(kind => <div key={kind}><dt>{t(`hoursStages.${kind}`)}</dt><dd>{number(group[kind])}</dd></div>)}</dl>
      <p className="text-sm">{t('hoursStages.rows', { rows: group.rows.join(', ') })}</p>
    </li>)}</ul>
    <h4 className="mt-5 font-semibold">{t('hoursStages.queue')}</h4>
    <p className="mt-2 text-sm">{t('hoursStages.unmatchedPolicy')}</p>
    <label htmlFor="hours-queue-filter" className="block mt-3 font-semibold">{t('hoursStages.queue')}</label>
    <select id="hours-queue-filter" value={filter} onChange={e => setFilter(e.target.value as Queue)} className="w-full border p-2">
      {(['all','excluded','identity','ambiguous','unmatched'] as const).map(kind => <option key={kind} value={kind}>{t(`hoursStages.${kind}`)} ({kind === 'all' ? queue.length : queue.filter(row => reasons(row).includes(kind)).length})</option>)}
    </select>
    <ul className="mt-3 space-y-3">{queue.filter(row => filter === 'all' || reasons(row).includes(filter)).map(row => <li key={row.sourceRow} data-hours-issue={row.sourceRow} className="border-l-4 border-amber-600 pl-3 text-sm break-words">
      <p className="font-semibold">{t('salesReview.row', { row: row.sourceRow })} · {row.values.Employee || t('salesReview.missingValue')} · {reasons(row).map(kind => t(`hoursStages.${kind}`)).join(' · ')}</p>
      {row.issues.filter(issue => issue !== 'identity' || !identity(row.sourceRow)?.employee || !row.values.Employee.trim()).map(issue => <p key={issue}>{t(`hoursReview.${issue}`)}</p>)}
      <button type="button" onClick={() => showRow(row.sourceRow)} className="min-h-11 underline mr-3">{t('hoursStages.details')}</button>
      {row.included && !identity(row.sourceRow)?.employee && <button type="button" onClick={() => (document.getElementById(`mapping-row-${row.sourceRow}`) ?? document.getElementById('mapping-title'))?.focus()} className="min-h-11 underline">{t('hoursStages.mapping')}</button>}
    </li>)}</ul>
    {mappingBlocked && <p role="alert" className="mt-3 text-red-800">{t('hoursReview.identity')}</p>}
    <details id="hours-source-details" className="mt-4"><summary>{t('hoursStages.details')}</summary>
      <div className="mt-3 max-w-full overflow-auto" tabIndex={0} role="region" aria-label={t('hoursReview.title')}>
        <table className="min-w-[65rem] border-collapse text-left text-sm"><thead><tr>{['salesReview.row','hoursReview.result', ...HOURS_COLUMNS.map((_, i) => `hoursReview.column${i}`)].map(key => <th className="border-b p-2" key={key}>{key === 'salesReview.row' ? t('salesReview.row', { row: '' }) : t(key as 'hoursReview.result')}</th>)}</tr></thead>
          <tbody>{review.rows.map(row => <tr key={row.sourceRow} data-hours-row={row.sourceRow} tabIndex={-1}><th scope="row" className="border-b p-2">{row.sourceRow}</th><td className="border-b p-2">{t(row.included ? 'hoursReview.include' : 'hoursReview.exclude')}{identities.length > 0 && <p>{identity(row.sourceRow)?.employee?.id ?? t('mapping.unmatched')}</p>}{row.issues.filter(issue => issue !== 'identity' || !identity(row.sourceRow)?.employee || !row.values.Employee.trim()).map(issue => <p key={issue}>{t(`hoursReview.${issue}`)}</p>)}</td>{HOURS_COLUMNS.map(column => <td key={column} className="border-b p-2">{row.values[column]}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </details>
    <label className="mt-4 flex min-h-11 items-start gap-3 text-sm font-medium"><input id="hours-reviewed" type="checkbox" checked={acknowledged} onChange={e => onAcknowledge(e.target.checked)} className="mt-1 size-5 shrink-0 accent-red-700" /><span>{t('hoursReview.acknowledge')}</span></label>
  </section>
}
