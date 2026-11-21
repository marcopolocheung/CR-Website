import { businessDate, isStationId, revision, STATION_STORES, type RecordEnvelope, type StationId, type StoreId } from '../internal-tools/contracts'
import { canonicalJson } from '../internal-tools/json'
import type { StaffingSlot } from './types'

export type SpecialHoursData = { version: 1; date: string; mode: 'normal' | 'closed' | 'early'; closeMinute: number | null; label: string }
export type SpecialHoursRecord = RecordEnvelope<SpecialHoursData>
export type HoursDecision = { slotId: string; end: number | null }
export type HoursReviewData = { version: 1; date: string; stationId: StationId; eventRevision: number; event: SpecialHoursData; baseFingerprint: string; decisions: HoursDecision[] }
export type HoursReviewRecord = RecordEnvelope<HoursReviewData>
export type PublishedDayHours = SpecialHoursData & { eventRevision: number; reviewRevision: number }
export type StationHoursState = { stationId: StationId; date: string; baseFingerprint: string | null; published: PublishedDayHours | null; visible: boolean }
export type SpecialHoursPage = { version: 1; storeId: StoreId; start: string; end: string; events: SpecialHoursRecord[]; reviews: HoursReviewRecord[]; stations: StationHoursState[] }
export type DraftHoursReviews = Record<string, HoursReviewRecord | null>

export function validHoursData(value: unknown): value is SpecialHoursData {
  if (!value || typeof value !== 'object') return false
  const data = value as SpecialHoursData
  return data.version === 1 && !!businessDate(data.date) && ['normal', 'closed', 'early'].includes(data.mode)
    && typeof data.label === 'string' && data.label.length <= 80
    && (data.mode === 'early' ? Number.isInteger(data.closeMinute) && data.closeMinute! > 0 && data.closeMinute! < 1440 : data.closeMinute === null)
    && Object.keys(data).every(key => ['version', 'date', 'mode', 'closeMinute', 'label'].includes(key))
}

export function validHoursReview(value: unknown): value is HoursReviewData {
  if (!value || typeof value !== 'object') return false
  const data = value as HoursReviewData
  return data.version === 1 && !!businessDate(data.date) && isStationId(data.stationId)
    && revision(data.eventRevision) !== null && data.eventRevision > 0 && validHoursData(data.event) && data.event.date === data.date
    && typeof data.baseFingerprint === 'string' && data.baseFingerprint.length <= 20000
    && Array.isArray(data.decisions) && data.decisions.length <= 20
    && new Set(data.decisions.map(d => d?.slotId)).size === data.decisions.length
    && data.decisions.every(d => d && typeof d.slotId === 'string' && d.slotId.length > 0 && d.slotId.length <= 200
      && (d.end === null || Number.isInteger(d.end) && d.end > 0 && d.end <= 2880)
      && Object.keys(d).every(key => ['slotId', 'end'].includes(key)))
    && Object.keys(data).every(key => ['version', 'date', 'stationId', 'eventRevision', 'event', 'baseFingerprint', 'decisions'].includes(key))
}

export const hoursRecordId = (date: string) => `hours-${date}`
export const hoursReviewId = (station: StationId, date: string) => `hours-review-${station}-${date}`
export function validHoursRecord(record: unknown, store: StoreId): record is SpecialHoursRecord {
  const r = record as SpecialHoursRecord | null
  return !!r && r.schemaVersion === 1 && r.family === 'schedule' && r.storeId === store && r.stationId === undefined
    && validHoursData(r.data) && r.id === hoursRecordId(r.data.date) && r.context?.kind === 'day'
    && r.context.businessDate === r.data.date && revision(r.revision) !== null && r.revision > 0
}
export function validReviewRecord(record: unknown, store: StoreId): record is HoursReviewRecord {
  const r = record as HoursReviewRecord | null
  return !!r && r.schemaVersion === 1 && r.family === 'schedule' && r.storeId === store && validHoursReview(r.data)
    && r.stationId === r.data.stationId && STATION_STORES[r.data.stationId] === store && r.id === hoursReviewId(r.data.stationId, r.data.date)
    && r.context?.kind === 'day' && r.context.businessDate === r.data.date && revision(r.revision) !== null && r.revision > 0
}

/** Ignore dated expansion fields, but retain slot order and every staffing-rule field. */
export function hoursBaseFingerprint(slots: readonly StaffingSlot[]): string {
  return canonicalJson(slots.map(({ id, day, period, role, label, start, end, required }) => ({ id, day, period, role, label, start, end, required })))
}
export function suggestedHoursDecisions(slots: readonly StaffingSlot[], event: SpecialHoursData): HoursDecision[] {
  if (event.mode !== 'early') return []
  return slots.filter(slot => slot.end > event.closeMinute!).map(slot => ({ slotId: slot.id, end: slot.start >= event.closeMinute! ? null : event.closeMinute! }))
}

/** Apply only a fully reviewed day. Surviving IDs and unaffected slots never change. */
export function reviewedDaySlots(base: readonly StaffingSlot[], review: HoursReviewData): StaffingSlot[] | null {
  if (!validHoursReview(review) || hoursBaseFingerprint(base) !== review.baseFingerprint) return null
  if (review.event.mode !== 'early') return review.decisions.length ? null : review.event.mode === 'closed' ? [] : [...base]
  const affected = base.filter(slot => slot.end > review.event.closeMinute!)
  if (affected.length !== review.decisions.length || review.decisions.some(d => !affected.some(slot => slot.id === d.slotId))) return null
  const result: StaffingSlot[] = []
  for (const slot of base) {
    const choice = review.decisions.find(d => d.slotId === slot.id)
    if (!choice) { result.push(slot); continue }
    if (choice.end === null) { if (slot.start < review.event.closeMinute!) return null; continue }
    if (choice.end <= slot.start || choice.end > slot.end) return null
    result.push({ ...slot, end: choice.end })
  }
  return result
}

export function resolveSpecialHours(base: StaffingSlot[], events: readonly SpecialHoursRecord[], reviews: readonly HoursReviewRecord[], station: StationId) {
  let slots = [...base]
  const pending: string[] = []
  const days: PublishedDayHours[] = []
  for (const event of events) {
    const day = base.filter(slot => slot.date === event.data.date)
    const review = reviews.find(r => r.data.stationId === station && r.data.date === event.data.date)
    const effective = review ? reviewedDaySlots(day, review.data) : null
    const current = review && review.data.eventRevision === event.revision && canonicalJson(review.data.event) === canonicalJson(event.data)
    if (!current || effective === null) pending.push(event.data.date)
    // Keep the last reviewed draft visible when a shared event changes; require review before using it.
    if (effective !== null && review) {
      slots = slots.filter(slot => slot.date !== event.data.date).concat(effective)
      days.push({ ...review.data.event, eventRevision: review.data.eventRevision, reviewRevision: review.revision })
    }
  }
  const position = new Map(base.map((slot, index) => [slot.id, index]))
  slots.sort((a, b) => position.get(a.id)! - position.get(b.id)!)
  return { slots, pending, days: days.sort((a, b) => a.date.localeCompare(b.date)) }
}

export function stationHoursStatus(event: SpecialHoursRecord, review: HoursReviewRecord | undefined, state: StationHoursState | undefined) {
  if (!review || review.data.eventRevision !== event.revision || canonicalJson(review.data.event) !== canonicalJson(event.data)
    || !state?.baseFingerprint || review.data.baseFingerprint !== state.baseFingerprint) return 'needsReview' as const
  return state.visible && state.published?.eventRevision === event.revision && state.published.reviewRevision === review.revision
    ? 'published' as const : 'ready' as const
}
