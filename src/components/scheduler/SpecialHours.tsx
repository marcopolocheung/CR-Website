'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { translate } from '@/lib/internal-tools/i18n'
import { canonicalJson } from '@/lib/internal-tools/json'
import { STATION_STORES, type Locale, type StationId } from '@/lib/internal-tools/contracts'
import { formatTime, formatTimeRange, type Employee, type ScheduleAssignment, type StaffingSlot } from '@/lib/scheduler'
import { hoursBaseFingerprint, reviewedDaySlots, suggestedHoursDecisions, stationHoursStatus,
  type SpecialHoursData, type SpecialHoursRecord, type HoursReviewRecord, type HoursDecision, type PublishedDayHours } from '@/lib/scheduler/special-hours'
import { putSpecialHours, putHoursReview, SpecialHoursError } from '@/lib/scheduler/special-hours-store'
import { TimeField } from './RulesEditor'
import type { SpecialHoursSource } from './useSpecialHours'
import css from './special-hours.module.css'
import { useManagerCode } from './DemoGate'
import type { SpecialHoursPage } from '@/lib/scheduler/special-hours'
import { planningDate } from './planning-format'

export function hoursCaption(event:SpecialHoursData,locale:Locale) {
  const text=translate(locale,event.mode==='closed'?'hours.closedLabel':event.mode==='early'?'hours.closes':'hours.normal',{time:event.closeMinute===null?'':formatTime(event.closeMinute)})
  return event.label&&event.mode!=='normal'?`${text} · ${event.label}`:text
}
export function DayHoursControl({date,event,locale='en',disabled,onEdit,pending=false}:{date:string;event?:SpecialHoursData;locale?:Locale;disabled?:boolean;pending?:boolean;onEdit:()=>void}) {
  return <button type="button" className={css.dayButton} disabled={disabled} onClick={onEdit} aria-label={`${translate(locale,'hours.edit')} ${date}`}>
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

type SaveAttempt={eventBefore:SpecialHoursRecord|null;reviewBefore:HoursReviewRecord|null;eventOp:string;reviewOp:string;event?:SpecialHoursRecord;review?:HoursReviewRecord;data:SpecialHoursData;decisions:HoursDecision[]}
export default function SpecialHoursDialog({date,station,locale,source,base,assignments,employees,locked,onClose,onApplied,onDirty,selectedReview}:{
  date:string;station:StationId;locale:Locale;source:SpecialHoursSource;base:StaffingSlot[];assignments:ScheduleAssignment[];employees:Employee[];locked:boolean
  onClose:()=>void;onApplied:(event:SpecialHoursRecord,review:HoursReviewRecord)=>void;onDirty:(dirty:boolean)=>void;selectedReview:HoursReviewRecord|null
}) {
  const t=(key:string,params?:Record<string,string|number>)=>translate(locale,key,params)
  const initial=useRef(source.page?.events.find(e=>e.data.date===date)??null)
  const previousReview=useRef(source.page?.reviews.find(r=>r.data.stationId===station&&r.data.date===date)??null)
  const [data,setData]=useState<SpecialHoursData>(initial.current?.data??{version:1,date,mode:'normal',closeMinute:null,label:''})
  const [decisions,setDecisions]=useState<HoursDecision[]>(selectedReview&&initial.current?.revision===selectedReview.data.eventRevision&&selectedReview.data.baseFingerprint===hoursBaseFingerprint(base)
    ?selectedReview.data.decisions:suggestedHoursDecisions(base,data))
  const [saving,setSaving]=useState(false),[error,setError]=useState<string|null>(null),[uncertain,setUncertain]=useState(false),[partial,setPartial]=useState(false)
  const initialForm=useRef(canonicalJson([data,decisions]))
  useEffect(()=>{onDirty(saving||uncertain||canonicalJson([data,decisions])!==initialForm.current)},[data,decisions,saving,uncertain,onDirty])
  const dialog=useRef<HTMLDialogElement>(null),attempt=useRef<SaveAttempt|null>(null),mounted=useRef(true)
  useEffect(()=>{
    const trigger=document.activeElement as HTMLElement|null,panel=dialog.current
    mounted.current=true;panel?.showModal()
    return()=>{mounted.current=false;panel?.close();if(trigger?.isConnected)trigger.focus();onDirty(false)}
  },[onDirty])
  const changeEvent=(next:SpecialHoursData)=>{setData(next);setDecisions(suggestedHoursDecisions(base,next));setError(null)}
  const reviewData={version:1 as const,date,stationId:station,eventRevision:initial.current?.revision??1,event:data,baseFingerprint:hoursBaseFingerprint(base),decisions}
  const preview=reviewedDaySlots(base,reviewData)
  const removed=new Set(base.filter(slot=>!preview?.some(s=>s.id===slot.id)).map(slot=>slot.id))
  const removedAssignments=assignments.filter(a=>removed.has(a.slotId))
  const affectedSlots=data.mode==='early'?base.filter(slot=>slot.end>data.closeMinute!):[]
  const customFinishes=data.mode==='early'&&canonicalJson(decisions)!==canonicalJson(suggestedHoursDecisions(base,data))
  const disabled=saving||uncertain
  async function save() {
    if(saving||locked||preview===null||source.phase==='unconfigured')return
    setSaving(true);setError(null)
    if(!attempt.current)attempt.current={eventBefore:initial.current,reviewBefore:previousReview.current,eventOp:crypto.randomUUID(),reviewOp:crypto.randomUUID(),data:{...data},decisions:decisions.map(d=>({...d}))}
    const current=attempt.current
    try{
      current.event??=current.eventBefore&&canonicalJson(current.eventBefore.data)===canonicalJson(current.data)
        ?current.eventBefore:await putSpecialHours(STATION_STORES[station],token(),current.eventBefore,current.data,current.eventOp)
      if(mounted.current)setPartial(true)
      current.review??=await putHoursReview(STATION_STORES[station],token(),current.reviewBefore,{...reviewData,eventRevision:current.event.revision,event:current.event.data,decisions:current.decisions},base,current.reviewOp)
      const fresh=await source.reload()
      if(!fresh)throw new SpecialHoursError('unavailable')
      if(fresh.events.find(e=>e.id===current.event!.id)?.revision!==current.event.revision||fresh.reviews.find(r=>r.id===current.review!.id)?.revision!==current.review.revision)throw new SpecialHoursError('conflict')
      if(!mounted.current)return
      source.accept(current.event,current.review);onApplied(current.event,current.review);onClose()
    }catch(problem){
      if(!mounted.current)return
      const code=problem instanceof SpecialHoursError?problem.code:'unavailable'
      setError(code==='conflict'?'hours.conflict':code==='invalid'?'hours.invalid':code==='unauthorized'?'hours.unauthorized':code==='unconfigured'?'hours.unconfigured':'hours.uncertain')
      setUncertain(true);source.uncertain()
    }finally{if(mounted.current)setSaving(false)}
  }
  // The manager code remains in the existing gate context, never in a saved hours record.
  const managerToken=useManagerCode()
  function token(){return managerToken}
  async function reloadLatest(){
    setSaving(true)
    const fresh=await source.reload()
    if(fresh&&mounted.current){initial.current=fresh.events.find(e=>e.data.date===date)??null;previousReview.current=fresh.reviews.find(r=>r.data.stationId===station&&r.data.date===date)??null;attempt.current=null;setUncertain(false);setPartial(false);setError('hours.conflict')}
    if(mounted.current)setSaving(false)
  }
  return <dialog ref={dialog} className={css.dialog} aria-labelledby="special-hours-title" lang={locale} onCancel={event=>{event.preventDefault();if(!disabled)onClose()}}>
    <div className={css.body}>
      <h2 id="special-hours-title" className={css.heading}>{t('hours.title')}</h2>
      <p className={css.date}>{new Date(date+'T12:00:00Z').toLocaleDateString(locale==='es'?'es-US':'en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'UTC'})}</p>
      <p className={css.scope}>{t('hours.scope',{store:STATION_STORES[station]})}</p>
      <fieldset disabled={disabled||locked} className={css.form}>
        <div className={css.modes} role="radiogroup" aria-label={t('hours.title')}>{(['normal','closed','early'] as const).map(mode=><label key={mode}><input type="radio" name="restaurant-hours-mode" value={mode} checked={data.mode===mode} onChange={()=>changeEvent({...data,mode,closeMinute:mode==='early'?1140:null})}/>{t(`hours.${mode}`)}</label>)}</div>
        {data.mode==='early'&&<label className={css.field}>{t('hours.closeTime')}<TimeField value={data.closeMinute!} ariaLabel={t('hours.closeTime')} onChange={closeMinute=>changeEvent({...data,closeMinute})}/></label>}
        <p className={css.effect}>{t(customFinishes?'hours.customFinishes':`hours.effect.${data.mode}`)}{removedAssignments.length>0&&<> {t('hours.removeSummary',{count:removedAssignments.length,kept:removedAssignments.filter(a=>a.locked).length})}</>}</p>
        <details className={css.options}>
          <summary>{t('hours.options')}</summary>
          <label className={css.field}>{t('hours.label')}<input value={data.label} maxLength={80} onChange={e=>setData({...data,label:e.target.value})}/></label>
          {affectedSlots.length>0&&<div className={css.preview}><h3>{t('hours.finishOptions')}</h3><p className={css.muted}>{t('hours.finishHelp')}</p>
          {affectedSlots.map(slot=>{
            const assignment=assignments.find(a=>a.slotId===slot.id),choice=decisions.find(d=>d.slotId===slot.id)
            const late=slot.start>=data.closeMinute!
            return <div className={css.row} key={slot.id}><div><strong>{slot.label}</strong><p>{employees.find(e=>e.id===assignment?.employeeId)?.name??t('hours.unassigned')}{assignment?.locked?` · ${t('hours.keep')}`:''}</p><p className={css.muted}>{t('hours.original',{time:formatTimeRange(slot)})}</p></div>
              <div>
                {late&&<label><input type="checkbox" checked={choice?.end!==null} onChange={e=>setDecisions(old=>old.map(d=>d.slotId===slot.id?{...d,end:e.target.checked?slot.end:null}:d))}/>{t('hours.cleanup')}</label>}
                {choice?.end!==null&&<label>{t('hours.finish')}<TimeField value={choice?.end??slot.end} ariaLabel={`${t('hours.finish')} · ${slot.label}`} onChange={end=>setDecisions(old=>old.map(d=>d.slotId===slot.id?{...d,end}:d))}/></label>}
                {choice?.end===null&&<span>{t('hours.remove')}</span>}
              </div>
            </div>
          })}
          </div>}
        </details>
      </fieldset>
      {locked&&<p className={css.error}>{t('hours.locked')}</p>}
      {partial&&error&&<p role="status">{t('hours.partial')}</p>}
      {error&&<p role="alert" className={css.error}>{t(error)}</p>}
      {preview===null&&<p role="alert" className={css.error}>{t('hours.invalid')}</p>}
      <p className={css.muted}>{t('hours.publishHelp')}</p>
      <div className={css.actions}>
        <button type="button" className={css.primary} disabled={saving||locked||preview===null||source.phase==='unconfigured'||!initial.current&&data.mode==='normal'} onClick={()=>void save()}>{t(saving?'hours.applying':uncertain?'hours.retry':'hours.apply')}</button>
        {uncertain&&<button type="button" disabled={saving} onClick={()=>void reloadLatest()}>{t('hours.reload')}</button>}
        <button type="button" disabled={disabled} onClick={onClose}>{t('hours.cancel')}</button>
      </div>
    </div>
  </dialog>
}
