import test from 'node:test'
import assert from 'node:assert/strict'
import { canonicalJson } from '../internal-tools/json'
import { buildScheduleSnapshot, validScheduleSnapshot } from '../schedule-snapshot'
import { publishedWeekFingerprint } from '../schedule-share'
import { expandTemplate, seedTemplate } from './data'
import { generateSchedule } from './solver'
import { DAYS, type WeeklyStaffingTemplate } from './types'
import { hoursBaseFingerprint, hoursRecordId, hoursReviewId, resolveSpecialHours, reviewedDaySlots, suggestedHoursDecisions, stationHoursStatus, validHoursData,
  type SpecialHoursData, type SpecialHoursRecord, type HoursReviewRecord, type StationHoursState } from './special-hours'

const station='CR3-diningroom',week='2026-11-22',date='2026-11-26'
const template:WeeklyStaffingTemplate=Object.fromEntries(DAYS.map(day=>[day,[
  {period:'PM',role:'server',label:'Evening',start:960,end:1320,required:true},
  {period:'PM',role:'server',label:'Late cleanup',start:1200,end:1320,required:false},
]])) as WeeklyStaffingTemplate
const base=expandTemplate(template,week),day=base.filter(s=>s.date===date)
const data=(mode:SpecialHoursData['mode']='closed'):SpecialHoursData=>({version:1,date,mode,closeMinute:mode==='early'?1140:null,label:'Thanksgiving'})
function event(mode:SpecialHoursData['mode']='closed',revision=1):SpecialHoursRecord{return {schemaVersion:1,family:'schedule',id:hoursRecordId(date),storeId:'CR3',revision,context:{kind:'day',businessDate:date},createdAt:'2026-11-20T12:00:00.000Z',updatedAt:'2026-11-20T12:00:00.000Z',data:data(mode)} as SpecialHoursRecord}
function review(source=event(),revision=1):HoursReviewRecord{return {...source,id:hoursReviewId(station,date),stationId:station,revision,data:{version:1,date,stationId:station,eventRevision:source.revision,event:source.data,baseFingerprint:hoursBaseFingerprint(day),decisions:suggestedHoursDecisions(day,source.data)}} as unknown as HoursReviewRecord}

test('closure removes only the dated day, including optional spots; templates and stable IDs survive',()=>{
  const original=canonicalJson(template),result=resolveSpecialHours(base,[event()],[review()],station)
  assert.equal(result.pending.length,0);assert.equal(result.slots.length,12)
  assert.equal(result.slots.some(s=>s.date===date),false)
  assert.deepEqual(result.slots.map(s=>s.id),base.filter(s=>s.date!==date).map(s=>s.id))
  assert.equal(canonicalJson(template),original)
  const next=expandTemplate(template,'2026-11-29')
  assert.deepEqual(resolveSpecialHours(next,[],[],station).slots,next)
})
test('early close clips crossing shifts, drops late spots, and accepts explicit cleanup finish choices',()=>{
  const source=event('early'),r=review(source),initial=resolveSpecialHours(base,[source],[r],station)
  assert.equal(initial.slots.find(s=>s.id===day[0].id)?.end,1140)
  assert.equal(initial.slots.some(s=>s.id===day[1].id),false)
  r.data.decisions[0].end=1170;r.data.decisions[1].end=1290
  const cleanup=resolveSpecialHours(base,[source],[r],station)
  assert.equal(cleanup.slots.find(s=>s.id===day[0].id)?.end,1170)
  assert.equal(cleanup.slots.find(s=>s.id===day[1].id)?.end,1290)
})
test('invalid, incomplete or obsolete staffing choices remain pending',()=>{
  const source=event('early'),r=review(source)
  r.data.decisions[0].end=900
  assert.equal(reviewedDaySlots(day,r.data),null)
  r.data.decisions=[];assert.equal(reviewedDaySlots(day,r.data),null)
  const changed=base.map(s=>s.id===day[0].id?{...s,end:1260}:s)
  assert.deepEqual(resolveSpecialHours(changed,[source],[review(source)],station).pending,[date])
})
test('new restaurant revisions require each station to review; last reviewed draft remains visible',()=>{
  const old=event('early'),r=review(old),changed=event('closed',2)
  const result=resolveSpecialHours(base,[changed],[r],station)
  assert.deepEqual(result.pending,[date]);assert.equal(result.slots.find(s=>s.id===day[0].id)?.end,1140)
  assert.equal(result.days[0].eventRevision,1)
  assert.deepEqual(resolveSpecialHours(base,[changed],[r],'CR3-kitchen').pending,[date])
})
test('normal cancellation restores base staffing only after review and does not restore assignments itself',()=>{
  const source=event('normal',2),old=review(event())
  assert.equal(resolveSpecialHours(base,[source],[old],station).slots.some(s=>s.date===date),false)
  assert.deepEqual(resolveSpecialHours(base,[source],[review(source,2)],station).slots,base)
})
test('Undo selection can restore the original draft while leaving the shared event pending',()=>{
  const result=resolveSpecialHours(base,[event()],[],station)
  assert.deepEqual(result.slots,base);assert.deepEqual(result.pending,[date])
})
test('station status distinguishes review, readiness, publication and hidden publication',()=>{
  const source=event(),r=review(),published={...source.data,eventRevision:1,reviewRevision:1}
  const state:StationHoursState={stationId:station,date,baseFingerprint:r.data.baseFingerprint,published,visible:true}
  assert.equal(stationHoursStatus(source,undefined,state),'needsReview')
  assert.equal(stationHoursStatus(source,r,{...state,published:null}),'ready')
  assert.equal(stationHoursStatus(source,r,state),'published')
  assert.equal(stationHoursStatus(source,r,{...state,visible:false}),'ready')
})
test('publication fingerprints include exact day labels and source revisions; invalid/out-of-week days fail validation',()=>{
  const resolved=resolveSpecialHours(base,[event()],[review()],station),snapshot=buildScheduleSnapshot(resolved.slots,'published',resolved.days)
  assert.equal(validScheduleSnapshot(snapshot,resolved.slots.length,week),true)
  const updated=structuredClone(snapshot);updated.specialHours![0].label='Weather closure'
  const payload={weekStart:week,people:[],slotPeople:resolved.slots.map(()=>-1)}
  assert.notEqual(publishedWeekFingerprint(payload,snapshot),publishedWeekFingerprint(payload,updated))
  updated.specialHours![0].date='2026-12-03'
  assert.equal(validScheduleSnapshot(updated,resolved.slots.length,week),false)
  assert.equal(validHoursData({...data('early'),closeMinute:0}),false)
})
test('generation uses the reviewed dated layout rather than recreating closed staffing',()=>{
  const closed=Object.fromEntries(DAYS.map(d=>[d,[]])) as unknown as WeeklyStaffingTemplate
  const generated=generateSchedule({employees:[],template:seedTemplate,weekStart:week,slots:expandTemplate(closed,week)})
  assert.notEqual(generated.status,'INFEASIBLE');assert.deepEqual(generated.assignments,[])
})
