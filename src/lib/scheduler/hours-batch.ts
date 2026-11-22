import { canonicalJson } from '../internal-tools/json'
import { STATION_STORES, type StationId } from '../internal-tools/contracts'
import type { StaffingSlot } from './types'
import { hoursBaseFingerprint, reviewedDaySlots, suggestedHoursDecisions,
  type HoursDecision, type HoursReviewData, type HoursReviewRecord, type SpecialHoursData,
  type SpecialHoursPage, type SpecialHoursRecord } from './special-hours'
import { putHoursReview, putSpecialHours, SpecialHoursError } from './special-hours-store'

export type HoursResult = { event: SpecialHoursRecord; review: HoursReviewRecord }
export type HoursChoice = { mode: SpecialHoursData['mode']; closeMinute: number; label?: string }
export type HoursPlan = {
  date: string; base: StaffingSlot[]; data: SpecialHoursData; decisions: HoursDecision[]
  before: SpecialHoursRecord | null; reviewBefore: HoursReviewRecord | null; needsApply: boolean
}
export type HoursBatch = Array<HoursPlan & {
  eventOp: string; reviewOp: string; event?: SpecialHoursRecord; review?: HoursReviewRecord; done: boolean
}>

export function planHoursDay(page: SpecialHoursPage, station: StationId, base: StaffingSlot[],
  date: string, choice: HoursChoice, activeReviews: readonly HoursReviewRecord[], override?: HoursDecision[]): HoursPlan {
  const before = page.events.find(e => e.data.date === date) ?? null
  const reviewBefore = page.reviews.find(r => r.data.date === date && r.data.stationId === station) ?? null
  const active = activeReviews.find(r => r.data.date === date && r.data.stationId === station)
  const data: SpecialHoursData = { version: 1, date, mode: choice.mode,
    closeMinute: choice.mode === 'early' ? choice.closeMinute : null, label: choice.label ?? before?.data.label ?? '' }
  const day = base.filter(s => s.date === date)
  const compatible = [active, reviewBefore].find(r => r && before && r.data.eventRevision === before.revision
    && canonicalJson(r.data.event) === canonicalJson(before.data) && reviewedDaySlots(day, r.data) !== null)
  const sameHours = before?.data.mode === data.mode && before.data.closeMinute === data.closeMinute
  const decisions = (override ?? (sameHours && compatible ? compatible.data.decisions : suggestedHoursDecisions(day, data))).map(d => ({ ...d }))
  const desired = { ...dataReview(station, data, day, decisions), eventRevision: before?.revision ?? 1 }
  const sameEvent = !!before && canonicalJson(before.data) === canonicalJson(data)
  const sameReview = sameEvent && !!reviewBefore && canonicalJson(reviewBefore.data) === canonicalJson(desired)
  return { date, base: day, data, decisions, before, reviewBefore,
    needsApply: !before && data.mode === 'normal' ? false : !sameReview || active?.revision !== reviewBefore?.revision }
}

function dataReview(station: StationId, data: SpecialHoursData, base: StaffingSlot[], decisions: HoursDecision[]): Omit<HoursReviewData, 'eventRevision'> {
  return { version: 1, date: data.date, stationId: station, event: data, baseFingerprint: hoursBaseFingerprint(base), decisions }
}
export function previewHoursPlan(plan: HoursPlan, station: StationId) {
  return reviewedDaySlots(plan.base, { ...dataReview(station, plan.data, plan.base, plan.decisions), eventRevision: plan.before?.revision ?? 1 })
}
export function createHoursBatch(plans: readonly HoursPlan[]): HoursBatch {
  return [...plans].sort((a, b) => a.date.localeCompare(b.date)).map(p => ({ ...structuredClone(p),
    eventOp: crypto.randomUUID(), reviewOp: crypto.randomUUID(), done: false }))
}

/** Retain each acknowledged write; an interrupted retry must use the same operation IDs. */
export async function saveHoursBatch(batch: HoursBatch, station: StationId, token: string,
  current: () => boolean, progress: () => void,
  api = { putSpecialHours, putHoursReview }): Promise<void> {
  const check = () => { if (!current()) throw new Error('hours_context_changed') }
  for (const row of batch) {
    check()
    if (row.done) continue
    if (!row.before && row.data.mode === 'normal') { row.done = true; progress(); continue }
    row.event ??= row.before && canonicalJson(row.before.data) === canonicalJson(row.data) ? row.before
      : await api.putSpecialHours(STATION_STORES[station], token, row.before, row.data, row.eventOp)
    check()
    const desired: HoursReviewData = { ...dataReview(station, row.event.data, row.base, row.decisions), eventRevision: row.event.revision }
    row.review ??= row.reviewBefore && canonicalJson(row.reviewBefore.data) === canonicalJson(desired) ? row.reviewBefore
      : await api.putHoursReview(STATION_STORES[station], token, row.reviewBefore, desired, row.base, row.reviewOp)
    check(); row.done = true; progress()
  }
}

export function verifyHoursBatch(batch: HoursBatch, page: SpecialHoursPage, station: StationId, base: StaffingSlot[]): HoursResult[] {
  const results: HoursResult[] = []
  for (const row of batch) {
    const event = page.events.find(e => e.data.date === row.date)
    const review = page.reviews.find(r => r.data.stationId === station && r.data.date === row.date)
    if (!row.done || hoursBaseFingerprint(base.filter(s => s.date === row.date)) !== hoursBaseFingerprint(row.base)
      || (!row.event ? !!event : event?.revision !== row.event.revision || canonicalJson(event.data) !== canonicalJson(row.event.data)
        || review?.revision !== row.review?.revision || canonicalJson(review?.data) !== canonicalJson(row.review?.data))) {
      throw new SpecialHoursError('conflict')
    }
    if (row.event && row.review) results.push({ event: row.event, review: row.review })
  }
  return results
}
