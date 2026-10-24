import { businessDate, isStationId, recordId, utcTimestamp, type RecordEnvelope, type StationId } from '../internal-tools/contracts'
import { canonicalJson } from '../internal-tools/json'
import { DAYS, type Employee } from './types'
import { dateForDay } from './week'

export const REQUEST_POLICY = 'DEC-01-v1' as const
export const MAX_REQUESTS = 200
export type RequestRange = { start: number; end: number }
export type ScheduleRequest = {
  id: string
  employee: { stationId: StationId; sourceEmployeeId: string; name: string }
  kind: 'time-off' | 'availability'
  startDate: string
  endDate: string
  ranges: RequestRange[]
  reason: string
  requestedAt: string
  enteredBy: string
  enteredAt: string
  policyVersion: typeof REQUEST_POLICY
  status: 'pending' | 'approved' | 'declined'
  review: { by: string; at: string; reason: string } | null
}
export type RequestData = { version: 1; stationId: StationId; requests: ScheduleRequest[] }
export type RequestRecord = RecordEnvelope<RequestData>

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
function keys(value: Record<string, unknown>, names: string[]) {
  return Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name))
}
function text(value: unknown, max: number, required = true): value is string {
  return typeof value === 'string' && value.length <= max && (!required || value.trim().length > 0)
}
export function validRequest(value: unknown, station: StationId): value is ScheduleRequest {
  if (!object(value) || !keys(value, ['id','employee','kind','startDate','endDate','ranges','reason','requestedAt','enteredBy','enteredAt','policyVersion','status','review'])) return false
  if (!recordId(value.id) || !object(value.employee) || !keys(value.employee, ['stationId','sourceEmployeeId','name'])
    || value.employee.stationId !== station || !text(value.employee.sourceEmployeeId, 128) || !text(value.employee.name, 120)) return false
  if (!businessDate(value.startDate) || !businessDate(value.endDate) || (value.startDate as string) > (value.endDate as string)
    || Date.parse(value.endDate as string) - Date.parse(value.startDate as string) > 365 * 86400000) return false
  if (value.policyVersion !== REQUEST_POLICY || !utcTimestamp(value.requestedAt) || !utcTimestamp(value.enteredAt)
    || (value.requestedAt as string) > (value.enteredAt as string) || !text(value.enteredBy, 120) || !text(value.reason, 1000, false)) return false
  if (value.kind !== 'time-off' && value.kind !== 'availability') return false
  if (!Array.isArray(value.ranges) || value.ranges.length > 8 || (value.kind === 'time-off' ? value.ranges.length !== 0 : value.ranges.length === 0)) return false
  let previousEnd = -1
  for (const range of value.ranges) {
    if (!object(range) || !keys(range, ['start','end']) || !Number.isInteger(range.start) || !Number.isInteger(range.end)) return false
    const start = range.start as number, end = range.end as number
    if (start < 0 || start >= 1440 || end <= start || end > start + 1440 || start < previousEnd) return false
    previousEnd = end
  }
  if (value.status === 'pending') return value.review === null
  return (value.status === 'approved' || value.status === 'declined') && object(value.review)
    && keys(value.review, ['by','at','reason']) && text(value.review.by, 120) && text(value.review.reason, 1000, false)
    && utcTimestamp(value.review.at) !== null && (value.review.at as string) >= (value.enteredAt as string)
}
export function requestsOverlap(a: ScheduleRequest, b: ScheduleRequest) {
  return a.employee.stationId === b.employee.stationId && a.employee.sourceEmployeeId === b.employee.sourceEmployeeId
    && a.startDate <= b.endDate && b.startDate <= a.endDate
}
export function validRequestData(value: unknown, station: StationId): value is RequestData {
  if (!isStationId(station) || !object(value) || !keys(value, ['version','stationId','requests']) || value.version !== 1 || value.stationId !== station
    || !Array.isArray(value.requests) || value.requests.length > MAX_REQUESTS || !value.requests.every(item => validRequest(item, station))) return false
  const requests = value.requests as ScheduleRequest[]
  if (new Set(requests.map(item => item.id)).size !== requests.length) return false
  const approved = requests.filter(item => item.status === 'approved')
  return !approved.some((item, index) => approved.slice(index + 1).some(other => requestsOverlap(item, other)))
}

/** One append or one pending-to-final review; originals and prior decisions remain immutable. */
export function requestTransitionIssue(previous: RequestData | null, next: RequestData, preparer: string): string | null {
  const before = previous?.requests ?? []
  if (next.requests.length === before.length + 1) {
    if (before.some((item, i) => canonicalJson(item) !== canonicalJson(next.requests[i]))) return 'preserve_original_request'
    const added = next.requests.at(-1)!
    return added.status === 'pending' && added.enteredBy === preparer ? null : 'entry_provenance_required'
  }
  if (next.requests.length !== before.length) return 'preserve_original_request'
  const changed = before.filter((item, i) => canonicalJson(item) !== canonicalJson(next.requests[i]))
  if (changed.length !== 1) return 'one_request_per_operation'
  const old = changed[0], current = next.requests[before.indexOf(old)]
  if (old.status !== 'pending' || current.status === 'pending' || current.review?.by !== preparer) return 'review_provenance_required'
  return canonicalJson({ ...current, status: old.status, review: old.review }) === canonicalJson(old) ? null : 'preserve_original_request'
}

/** Approved requests become dated overrides for one week; pending/declined never affect scheduling. Suspension stays separate. */
export function withApprovedRequests(employees: Employee[], data: RequestData | null | undefined, weekStart: string): Employee[] {
  const approved = data?.requests.filter(item => item.status === 'approved') ?? []
  if (!weekStart || approved.length === 0) return employees
  const dates = DAYS.map(day => dateForDay(weekStart, day))
  return employees.map(employee => {
    const overrides = dates.flatMap(date => {
      const request = approved.find(item => item.employee.sourceEmployeeId === employee.id && item.startDate <= date && date <= item.endDate)
      return request ? [{ date, ranges: request.ranges.map(range => ({ ...range })) }] : []
    })
    return overrides.length ? { ...employee, availabilityOverrides: [...overrides, ...(employee.availabilityOverrides ?? [])] } : employee
  })
}
