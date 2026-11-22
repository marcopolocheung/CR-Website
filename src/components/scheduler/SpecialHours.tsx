'use client'
import Link from 'next/link'
import { translate } from '@/lib/internal-tools/i18n'
import { type Locale, type StationId } from '@/lib/internal-tools/contracts'
import { formatTime, type StaffingSlot } from '@/lib/scheduler'
import { hoursBaseFingerprint, stationHoursStatus,
  type SpecialHoursData, type HoursReviewRecord, type PublishedDayHours } from '@/lib/scheduler/special-hours'
import type { SpecialHoursSource } from './useSpecialHours'
import css from './special-hours.module.css'
import type { SpecialHoursPage } from '@/lib/scheduler/special-hours'
import { planningDate } from './planning-format'

export function hoursCaption(event:SpecialHoursData,locale:Locale) {
  const text=translate(locale,event.mode==='closed'?'hours.closedLabel':event.mode==='early'?'hours.closes':'hours.normal',{time:event.closeMinute===null?'':formatTime(event.closeMinute)})
  return event.label&&event.mode!=='normal'?`${text} · ${event.label}`:text
}
export function DayHoursControl({date,event,locale='en',disabled,onEdit,pending=false}:{date:string;event?:SpecialHoursData;locale?:Locale;disabled?:boolean;pending?:boolean;onEdit:(anchor:HTMLElement)=>void}) {
  return <button type="button" className={css.dayButton} disabled={disabled} onClick={event=>onEdit(event.currentTarget)} data-hours-trigger={date} aria-expanded={false} aria-label={`${translate(locale,'hours.edit')} ${date}`}>
    {event&&event.mode!=='normal'?hoursCaption(event,locale):translate(locale,'hours.button')}{pending?` · ${translate(locale,'hours.needsReview')}`:''}
  </button>
}
export function HoursNote({day,locale='en'}:{day?:PublishedDayHours;locale?:Locale}) {
  return day&&day.mode!=='normal'?<span className={css.note} data-hours-note={day.date}>{hoursCaption(day,locale)}</span>:null
}
export function HoursSummary({days,locale='en'}:{days:readonly PublishedDayHours[];locale?:Locale}) {
  const special=days.filter(day=>day.mode!=='normal')
  return special.length?<div data-hours-summary><strong>{translate(locale,'hours.print')}</strong>{special.map(day=><p key={day.date}>{planningDate(day.date,locale)}: {hoursCaption(day,locale)}</p>)}</div>:null
}
export function HoursBanner({source,pending,locale,onReview}:{source:SpecialHoursSource;pending:string[];locale:Locale;onReview:(date:string)=>void}) {
  const key=source.phase==='unconfigured'?'hours.unconfigured':source.phase==='loading'?'hours.loading':source.phase==='failed'||source.phase==='uncertain'?'hours.unavailable':pending.length?'hours.pending':null
  return key?<div className={css.banner} role="status" data-hours-banner><span>{translate(locale,key)}</span>
    {pending.length>0&&<button onClick={()=>onReview(pending[0])}>{translate(locale,'hours.review')}</button>}
    {source.phase!=='ready'&&source.phase!=='loading'&&source.phase!=='unconfigured'&&<button onClick={()=>void source.reload()}>{translate(locale,'hours.reload')}</button>}
  </div>:null
}

export function HoursStationStatus({page,week,station,base,reviews,locale,onReview}:{page:SpecialHoursPage;week:string;station:StationId;base:StaffingSlot[];reviews:HoursReviewRecord[];locale:Locale;onReview:(date:string)=>void}) {
  return <section className={css.stations} aria-label={translate(locale,'hours.title')} data-hours-status>{page.events.map(event=><div key={event.id}>
    <strong>{planningDate(event.data.date,locale)} · {hoursCaption(event.data,locale)}</strong>
    {(['diningroom','kitchen'] as const).map(kind=>{
      const target=`${page.storeId}-${kind}` as StationId
      const review=(target===station?reviews:page.reviews).find(r=>r.data.stationId===target&&r.data.date===event.data.date)
      const saved=page.stations.find(s=>s.stationId===target&&s.date===event.data.date)
      const state=target===station?{stationId:station,date:event.data.date,baseFingerprint:hoursBaseFingerprint(base.filter(slot=>slot.date===event.data.date)),visible:saved?.visible??false,published:saved?.published??null}:saved
      const status=stationHoursStatus(event,review,state)
      return <p key={kind} data-station-hours={`${target}:${event.data.date}`}>{translate(locale,kind==='kitchen'?'hours.kitchen':'hours.dining')}: {translate(locale,`hours.${status}`)}{' '}
        {target===station?<button type="button" onClick={()=>onReview(event.data.date)}>{translate(locale,'hours.review')}</button>:<Link href={`/scheduler-demo/${target}?week=${week}&hoursDate=${event.data.date}`}>{translate(locale,'hours.review')}</Link>}</p>
    })}
  </div>)}</section>
}
