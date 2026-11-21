import { requestJson } from '../cashout-store'
import { canonicalJson } from '../internal-tools/json'
import { businessDate, isStationId, STATION_STORES, type StationId, type StoreId } from '../internal-tools/contracts'
import { buildScheduleSnapshot, validScheduleSnapshot } from '../schedule-snapshot'
import type { StaffingSlot } from './types'
import { validHoursRecord, validReviewRecord, type SpecialHoursData, type SpecialHoursRecord, type HoursReviewData, type HoursReviewRecord, type SpecialHoursPage } from './special-hours'

export class SpecialHoursError extends Error {
  constructor(public code: 'unconfigured'|'unavailable'|'conflict'|'invalid'|'unauthorized') { super(code) }
}
function failure(status: number, body: unknown) {
  const code=(body as {error?:{code?:string}}|null)?.error?.code
  return new SpecialHoursError(status===404||code==='backend_unconfigured'?'unconfigured':status===409?'conflict':status===400?'invalid':status===401||status===403?'unauthorized':'unavailable')
}
export function validHoursPage(raw: unknown, store: StoreId, start: string, end: string): raw is SpecialHoursPage {
  const page=raw as SpecialHoursPage|null
  return !!page && page.version===1 && page.storeId===store && page.start===start && page.end===end
    && Array.isArray(page.events) && page.events.length<=31 && page.events.every(e=>validHoursRecord(e,store)&&e.data.date>=start&&e.data.date<=end)
    && new Set(page.events.map(e=>e.data.date)).size===page.events.length
    && Array.isArray(page.reviews) && page.reviews.length<=62 && page.reviews.every(r=>validReviewRecord(r,store)&&r.data.date>=start&&r.data.date<=end)
    && new Set(page.reviews.map(r=>r.id)).size===page.reviews.length
    && Array.isArray(page.stations) && page.stations.length===page.events.length*2 && page.stations.every(s=>isStationId(s.stationId)&&STATION_STORES[s.stationId]===store
      && !!businessDate(s.date)&&page.events.some(e=>e.data.date===s.date)&&(s.baseFingerprint===null||typeof s.baseFingerprint==='string')
      && typeof s.visible==='boolean' && (s.published===null || s.published.date===s.date && validScheduleSnapshot({version:1,basis:'published',slots:[],specialHours:[s.published]},0)))
    && new Set(page.stations.map(s=>s.stationId+':'+s.date)).size===page.stations.length
}
export async function fetchSpecialHours(store: StoreId,start: string,end: string,token: string): Promise<SpecialHoursPage> {
  const {status,body}=await requestJson(`/api/internal/special-hours/${store}?start=${start}&end=${end}`,token)
  if(status!==200)throw failure(status,body)
  if(!validHoursPage(body,store,start,end))throw new SpecialHoursError('invalid')
  return body
}
export async function putSpecialHours(store: StoreId,token: string,previous: SpecialHoursRecord|null,data: SpecialHoursData,operationId: string) {
  const {status,body}=await requestJson(`/api/internal/special-hours/${store}/${data.date}`,token,{method:'PUT',body:JSON.stringify({mutation:{schemaVersion:1,baseRevision:previous?.revision??0,operationId,data}})})
  if(status!==200)throw failure(status,body)
  const record=(body as {record?:unknown}|null)?.record
  if(!validHoursRecord(record,store)||record.revision!==(previous?.revision??0)+1||canonicalJson(record.data)!==canonicalJson(data))throw new SpecialHoursError('invalid')
  return record
}
export async function putHoursReview(store:StoreId,token:string,previous:HoursReviewRecord|null,data:HoursReviewData,base:StaffingSlot[],operationId:string) {
  const {status,body}=await requestJson(`/api/internal/special-hours/${store}/${data.date}/review/${data.stationId}`,token,{method:'PUT',body:JSON.stringify({
    mutation:{schemaVersion:1,baseRevision:previous?.revision??0,operationId,data},baseSlots:buildScheduleSnapshot(base).slots})})
  if(status!==200)throw failure(status,body)
  const record=(body as {record?:unknown}|null)?.record
  if(!validReviewRecord(record,store)||record.revision!==(previous?.revision??0)+1||canonicalJson(record.data)!==canonicalJson(data))throw new SpecialHoursError('invalid')
  return record
}
