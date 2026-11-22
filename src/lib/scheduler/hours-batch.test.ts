import test from 'node:test'
import assert from 'node:assert/strict'
import { expandTemplate } from './data'
import { DAYS, type WeeklyStaffingTemplate, type StaffingSlot } from './types'
import { hoursBaseFingerprint, resolveSpecialHours, suggestedHoursDecisions, type SpecialHoursData,
  type SpecialHoursPage, type SpecialHoursRecord, type HoursReviewRecord, type HoursReviewData } from './special-hours'
import { createHoursBatch, planHoursDay, previewHoursPlan, saveHoursBatch, verifyHoursBatch } from './hours-batch'
import { SpecialHoursError } from './special-hours-store'
import { recordId, type StoreId } from '../internal-tools/contracts'

const station = 'CR2-diningroom', week = '2026-11-22', thu = '2026-11-26', fri = '2026-11-27'
const template = Object.fromEntries(DAYS.map(day => [day, [
  { period: 'AM', role: 'server', label: 'Morning', start: 600, end: 960, required: true },
  { period: 'PM', role: 'server', label: 'Evening', start: 960, end: 1320, required: true },
  { period: 'PM', role: 'server', label: 'Cleanup', start: 1200, end: 1320, required: false },
]])) as WeeklyStaffingTemplate
const base = expandTemplate(template, week)
const page = (): SpecialHoursPage => ({ version: 1, storeId: 'CR2', start: week, end: '2026-11-28', events: [], reviews: [], stations: [] })
function event(date: string, mode: SpecialHoursData['mode'] = 'early', label = date): SpecialHoursRecord {
  return { schemaVersion: 1, family: 'schedule', id: `hours-${date}`, storeId: 'CR2', context: { kind: 'day', businessDate: date },
    revision: 1, createdAt: week, updatedAt: week, data: { version: 1, date, mode, closeMinute: mode === 'early' ? 1140 : null, label } } as SpecialHoursRecord
}
function review(e: SpecialHoursRecord): HoursReviewRecord {
  const day = base.filter(s => s.date === e.data.date)
  return { ...e, id: recordId(`hours-review-${station}-${e.data.date}`)!, stationId: station,
    data: { version: 1, date: e.data.date, stationId: station, event: e.data, eventRevision: e.revision,
      baseFingerprint: hoursBaseFingerprint(day), decisions: suggestedHoursDecisions(day, e.data) } } as HoursReviewRecord
}
function api(p: SpecialHoursPage) {
  const operations = new Map<string, SpecialHoursRecord | HoursReviewRecord>(), calls: string[] = []
  let failReview: string | null = null
  return { calls, fail(date: string) { failReview = date },
    async putSpecialHours(_store: StoreId, _token: string, prior: SpecialHoursRecord | null, data: SpecialHoursData, op: string) {
      calls.push(`event:${data.date}:${op}`)
      if (!operations.has(op)) {
        const current = p.events.find(e => e.data.date === data.date)
        if ((current?.revision ?? 0) !== (prior?.revision ?? 0)) throw new SpecialHoursError('conflict')
        const saved = { ...event(data.date), data: structuredClone(data), revision: (prior?.revision ?? 0) + 1 } as SpecialHoursRecord
        p.events = p.events.filter(e => e.data.date !== data.date).concat(saved); operations.set(op, saved)
      }
      return operations.get(op) as SpecialHoursRecord
    },
    async putHoursReview(_store: StoreId, _token: string, prior: HoursReviewRecord | null, data: HoursReviewData, _base: StaffingSlot[], op: string) {
      calls.push(`review:${data.date}:${op}`)
      if (!operations.has(op)) {
        const current = p.reviews.find(e => e.data.date === data.date)
        if ((current?.revision ?? 0) !== (prior?.revision ?? 0)) throw new SpecialHoursError('conflict')
        const saved = { ...review(p.events.find(e => e.data.date === data.date)!), data: structuredClone(data), revision: (prior?.revision ?? 0) + 1 } as HoursReviewRecord
        p.reviews = p.reviews.filter(e => e.data.date !== data.date).concat(saved); operations.set(op, saved)
      }
      if (failReview === data.date) { failReview = null; throw new SpecialHoursError('unavailable') }
      return operations.get(op) as HoursReviewRecord
    },
  }
}

test('normal dates with no exception need no records, but final verification detects a concurrent closure', async () => {
  const p = page(), service = api(p), plan = planHoursDay(p, station, base, thu, { mode: 'normal', closeMinute: 1140 }, [])
  assert.equal(plan.needsApply, false)
  const batch = createHoursBatch([plan]); await saveHoursBatch(batch, station, '', () => true, () => {}, service)
  assert.deepEqual(service.calls, []); assert.deepEqual(verifyHoursBatch(batch, p, station, base), [])
  p.events.push(event(thu, 'closed')); assert.throws(() => verifyHoursBatch(batch, p, station, base), /conflict/)
})
test('bulk preserves per-date labels and valid cleanup decisions; explicit labels can replace or clear them', () => {
  const p = page(); p.events = [event(thu), event(fri)]; p.reviews = p.events.map(review)
  p.reviews[0].data.decisions[0].end = 1170
  const choice = { mode: 'early' as const, closeMinute: 1140 }
  const plans = p.events.map(e => planHoursDay(p, station, base, e.data.date, choice, p.reviews))
  assert.deepEqual(plans.map(p => p.data.label), [thu, fri]); assert.equal(plans[0].decisions[0].end, 1170)
  assert.equal(plans[0].needsApply, false)
  assert.equal(planHoursDay(p, station, base, thu, { ...choice, label: '' }, p.reviews).data.label, '')
  assert.equal(planHoursDay(p, station, base, thu, { ...choice, label: 'Holiday' }, p.reviews).data.label, 'Holiday')
  const changed = planHoursDay(p, station, base, thu, { mode: 'early', closeMinute: 1080 }, p.reviews)
  assert.deepEqual(changed.decisions.map(d => d.end), [1080, null])
})
test('a full-week closure saves in date order and resolves all dates together without changing templates', async () => {
  const p = page(), service = api(p), original = structuredClone(template)
  const dates = [...new Set(base.map(s => s.date!))].reverse()
  const batch = createHoursBatch(dates.map(d => planHoursDay(p, station, base, d, { mode: 'closed', closeMinute: 1140 }, [])))
  await saveHoursBatch(batch, station, '', () => true, () => {}, service)
  assert.deepEqual(batch.map(r => r.date), [...dates].sort()); assert.equal(service.calls.length, 14)
  const results = verifyHoursBatch(batch, p, station, base)
  assert.equal(results.length, 7); assert.deepEqual(resolveSpecialHours(base, p.events, results.map(r => r.review), station).slots, [])
  assert.deepEqual(template, original)
})
test('a partial save resumes only unfinished dates, reusing the failed review operation even if it was accepted', async () => {
  const p = page(), service = api(p), dates = ['2026-11-25', thu, fri]
  const batch = createHoursBatch(dates.map(d => planHoursDay(p, station, base, d, { mode: 'closed', closeMinute: 1140 }, [])))
  service.fail(thu)
  await assert.rejects(saveHoursBatch(batch, station, '', () => true, () => {}, service), /unavailable/)
  assert.deepEqual(batch.map(r => r.done), [true, false, false]); assert.equal(p.events.length, 2)
  assert.throws(() => verifyHoursBatch(batch, p, station, base), /conflict/)
  await saveHoursBatch(batch, station, '', () => true, () => {}, service)
  assert.equal(verifyHoursBatch(batch, p, station, base).length, 3)
  const counts = service.calls.reduce((map, call) => map.set(call, (map.get(call) ?? 0) + 1), new Map<string, number>())
  assert.equal(counts.get(`review:${thu}:${batch[1].reviewOp}`), 2)
  assert.equal(service.calls.length, 7); assert.deepEqual(p.events.map(e => e.revision), [1, 1, 1])
  assert.deepEqual(p.reviews.map(r => r.revision), [1, 1, 1])
})
test('unchanged server records can be applied after Undo without writing new revisions', async () => {
  const p = page(); p.events = [event(thu, 'closed')]; p.reviews = p.events.map(review)
  const plan = planHoursDay(p, station, base, thu, { mode: 'closed', closeMinute: 1140 }, [])
  assert.equal(plan.needsApply, true)
  const batch = createHoursBatch([plan]), service = api(p)
  await saveHoursBatch(batch, station, '', () => true, () => {}, service)
  assert.deepEqual(service.calls, []); assert.equal(verifyHoursBatch(batch, p, station, base).length, 1)
})
test('final verification rejects newer source revisions and a changed shift layout', async () => {
  const p = page(), service = api(p), batch = createHoursBatch([planHoursDay(p, station, base, thu, { mode: 'early', closeMinute: 1140 }, [])])
  await saveHoursBatch(batch, station, '', () => true, () => {}, service)
  const changed = base.map(s => s.date === thu ? { ...s, end: s.end - 15 } : s)
  assert.throws(() => verifyHoursBatch(batch, p, station, changed), /conflict/)
  p.events = p.events.map(e => ({ ...e, revision: (e.revision + 1) as typeof e.revision }))
  assert.throws(() => verifyHoursBatch(batch, p, station, base), /conflict/)
})
test('a context change after the event write stops before its review or the next date', async () => {
  const p = page(), service = api(p), batch = createHoursBatch([thu, fri].map(d => planHoursDay(p, station, base, d, { mode: 'closed', closeMinute: 1140 }, [])))
  await assert.rejects(saveHoursBatch(batch, station, '', () => service.calls.length === 0, () => {}, service), /hours_context_changed/)
  assert.equal(service.calls.length, 1); assert.equal(p.reviews.length, 0)
})
test('invalid cleanup decisions are rejected by preview and normal cancellation restores only shift positions', () => {
  const p = page(); p.events = [event(thu, 'closed')]; p.reviews = p.events.map(review)
  const normal = planHoursDay(p, station, base, thu, { mode: 'normal', closeMinute: 1140 }, p.reviews)
  assert.equal(previewHoursPlan(normal, station)?.length, 3)
  const early = planHoursDay(p, station, base, thu, { mode: 'early', closeMinute: 1140 }, p.reviews, [{ slotId: 'wrong', end: 900 }])
  assert.equal(previewHoursPlan(early, station), null)
})
