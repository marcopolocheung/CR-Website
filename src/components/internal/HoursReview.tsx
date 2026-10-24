'use client'
import { useInternalLanguage } from './InternalLanguage'
import type { mapHours } from '@/lib/converter/employee-mapping'
import { HOURS_COLUMNS } from '@/lib/converter/validation'
import type { reviewHours } from '@/lib/converter/hours-review'
export default function HoursReview({review,acknowledged,onAcknowledge,identities=[],mappingBlocked=review.blocked}:{identities?:ReturnType<typeof mapHours>;mappingBlocked?:boolean;review:ReturnType<typeof reviewHours>;acknowledged:boolean;onAcknowledge:(value:boolean)=>void}){
 const {t}=useInternalLanguage()
 const number=(value:number|null)=>value===null?t('salesReview.missingValue'):String(Math.round(value*1000000)/1000000)
 return <section aria-labelledby="hours-review-title" className="mt-5 border-t pt-4">
  <h3 id="hours-review-title" className="text-lg font-semibold">{t('hoursReview.title')}</h3>
  <p className="mt-2 text-sm">{t('hoursReview.rule')}</p>
  <p className="mt-2 text-sm">{t('hoursReview.counts',{source:review.rows.length,included:review.included.length,excluded:review.excluded.length})}</p>
  <dl className="mt-2 text-sm">{Object.entries(review.totals).map(([key,value])=><div key={key}><dt className="inline font-semibold">{t(`hoursReview.${key}` as 'hoursReview.source')}: </dt><dd className="inline">{number(value)}</dd></div>)}</dl>
  <div className="mt-3 max-w-full overflow-auto" tabIndex={0} role="region" aria-label={t('hoursReview.title')}>
   <table className="min-w-[65rem] border-collapse text-left text-sm"><thead><tr>{['salesReview.row','hoursReview.result',...HOURS_COLUMNS.map((_,i)=>`hoursReview.column${i}`)].map(key=><th className="border-b p-2" key={key}>{key==='salesReview.row'?t('salesReview.row',{row:''}):t(key as 'hoursReview.result')}</th>)}</tr></thead>
    <tbody>{review.rows.map(row=><tr key={row.sourceRow} data-hours-row={row.sourceRow}><th scope="row" className="border-b p-2">{row.sourceRow}</th><td className="border-b p-2">{t(row.included?'hoursReview.include':'hoursReview.exclude')}{identities.length>0 && <p>{identities.find(item=>item.sourceRow===row.sourceRow)?.employee?.id ?? t('mapping.unmatched')}</p>}{row.issues.filter(issue=>issue!=='identity'||!identities.find(item=>item.sourceRow===row.sourceRow)?.employee).map(issue=><p key={issue}>{t(`hoursReview.${issue}`)}</p>)}</td>{HOURS_COLUMNS.map(column=><td key={column} className="border-b p-2">{row.values[column]}</td>)}</tr>)}</tbody>
   </table>
  </div>
  {mappingBlocked&&<p role="alert" className="mt-3 text-sm text-red-800">{t('hoursReview.identity')}</p>}
  <label className="mt-4 flex min-h-11 items-start gap-3 text-sm font-medium"><input id="hours-reviewed" type="checkbox" checked={acknowledged} onChange={e=>onAcknowledge(e.target.checked)} className="mt-1 size-5 shrink-0 accent-red-700"/><span>{t('hoursReview.acknowledge')}</span></label>
 </section>
}
