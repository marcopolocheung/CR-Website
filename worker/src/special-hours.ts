import type { D1Database } from '@cloudflare/workers-types'
import { apiError, businessDate, STATION_STORES, type MutationEnvelope, type RecordEnvelope, type StationId, type StoreId } from '../../src/lib/internal-tools/contracts'
import { canonicalJson } from '../../src/lib/internal-tools/json'
import { validScheduleSnapshot } from '../../src/lib/schedule-snapshot'
import { DAYS } from '../../src/lib/scheduler/types'
import { hoursRecordId, hoursReviewId, reviewedDaySlots, validHoursData, validHoursRecord, validHoursReview, validReviewRecord,
  type SpecialHoursData, type SpecialHoursRecord, type HoursReviewData, type HoursReviewRecord } from '../../src/lib/scheduler/special-hours'
import { mutateRecord } from './record-mutations'

async function readRecord<T>(db: D1Database, store: StoreId, id: string): Promise<RecordEnvelope<T> | null> {
  const row = await db.prepare("SELECT data_json,revision,created_at,updated_at,station_id,business_date FROM records WHERE store_id=? AND family='schedule' AND id=?")
    .bind(store, id).first<{data_json:string;revision:number;created_at:string;updated_at:string;station_id:StationId|null;business_date:string}>()
  if (!row) return null
  return { schemaVersion: 1, family: 'schedule', id, storeId: store, ...(row.station_id ? {stationId: row.station_id} : {}),
    context: {kind:'day', businessDate: businessDate(row.business_date)!}, revision:row.revision, createdAt:row.created_at, updatedAt:row.updated_at, data:JSON.parse(row.data_json) } as RecordEnvelope<T>
}

export async function hoursEvent(db: D1Database, store: StoreId, date: string): Promise<SpecialHoursRecord | null> {
  const record = await readRecord<SpecialHoursData>(db, store, hoursRecordId(date))
  if (record && !validHoursRecord(record, store)) throw new Error('Invalid hours record')
  return record
}
export async function hoursRecords(db: D1Database, store: StoreId, start: string, end: string) {
  const rows = await db.prepare("SELECT id FROM records WHERE store_id=? AND family='schedule' AND business_date>=? AND business_date<=? AND id LIKE 'hours-%' ORDER BY business_date,id LIMIT 100")
    .bind(store, start, end).all<{id:string}>()
  const events: SpecialHoursRecord[] = [], reviews: HoursReviewRecord[] = []
  for (const row of rows.results) {
    const record = await readRecord<SpecialHoursData | HoursReviewData>(db, store, row.id)
    if (validHoursRecord(record, store)) events.push(record)
    else if (validReviewRecord(record, store)) reviews.push(record)
    else throw new Error('Invalid hours record')
  }
  return {events, reviews}
}
export async function saveHoursEvent(db: D1Database, store: StoreId, date: string, raw: unknown) {
  const body = raw as {mutation?:MutationEnvelope<SpecialHoursData>} | null
  if (!body?.mutation || !validHoursData(body.mutation.data) || body.mutation.data.date !== date) {
    return {ok:false as const,status:400,body:apiError('validation_failed')}
  }
  return mutateRecord(db, {storeId:store,family:'schedule',id:hoursRecordId(date),context:{kind:'day',businessDate:businessDate(date)!},
    callerScope:'manager',action:'edit-hours',actor:{kind:'authenticated',subject:'manager'}},body.mutation,
  data => validHoursData(data) && data.date === date ? [] : [{path:'data',code:'invalid_hours'}])
}

export async function saveHoursReview(db: D1Database, store: StoreId, station: StationId, date: string, raw: unknown) {
  const body = raw as {mutation?:MutationEnvelope<HoursReviewData>;baseSlots?:unknown} | null
  if (!body?.mutation || !validHoursReview(body.mutation.data) || body.mutation.data.stationId !== station
    || STATION_STORES[station] !== store || body.mutation.data.date !== date || !Array.isArray(body.baseSlots)
    || body.baseSlots.length > 20 || !validScheduleSnapshot({version:1,basis:'published',slots:body.baseSlots},body.baseSlots.length)) {
    return {ok:false as const,status:400,body:apiError('validation_failed')}
  }
  const base = body.baseSlots as Parameters<typeof reviewedDaySlots>[0]
  if (base.some(slot => slot.day !== DAYS[new Date(date+'T00:00:00Z').getUTCDay()]) || reviewedDaySlots(base,body.mutation.data) === null) {
    return {ok:false as const,status:400,body:apiError('validation_failed')}
  }
  const event = await hoursEvent(db,store,date)
  const result = await mutateRecord(db,{storeId:store,family:'schedule',id:hoursReviewId(station,date),stationId:station,
    context:{kind:'day',businessDate:businessDate(date)!},callerScope:'manager',action:'review-hours',actor:{kind:'authenticated',subject:'manager'}},body.mutation,
  data => !event || event.revision !== data.eventRevision || canonicalJson(event.data) !== canonicalJson(data.event)
    ? [{path:'eventRevision',code:'stale_event'}] : [])
  if (!result.ok && result.body.error.fields?.some(issue=>issue.code==='stale_event')) {
    return {ok:false as const,status:409,body:apiError('revision_conflict')}
  }
  return result
}
