import { SessionChangedError } from './internal-tools/manager-session'
import { captureSchedulerSession, schedulerRequestJson, type SchedulerRequestScope } from './scheduler-http'
import { validScheduleSnapshot, type ScheduleSnapshot } from './schedule-snapshot'
import { templateHashForSlots } from './schedule-share'

export const DEFAULT_SCHEDULE_API = 'https://chinarose-schedule-api.crbrucecheung.workers.dev'

export function getScheduleApiBase(): string {
  const configured = (process.env.NEXT_PUBLIC_SCHEDULE_API ?? '').trim().replace(/\/+$/, '')
  if (configured) return configured
  return DEFAULT_SCHEDULE_API
}

export class StoreNotFoundError extends Error {
  constructor() {
    super('That week is not on the server yet.')
    this.name = 'StoreNotFoundError'
  }
}

export class StoreConflictError extends Error {
  rev: number
  constructor(rev: number) {
    super('Someone else saved this schedule first.')
    this.name = 'StoreConflictError'
    this.rev = rev
  }
}

export class StoreAuthError extends Error {
  constructor() {
    super('That code did not work. Ask for the current one and try again.')
    this.name = 'StoreAuthError'
  }
}

// --- Golden schedule (one persistent codeless schedule, edited by scheduler-demo) ---

export type GoldenWeekPayload = {
  version: number
  weekStart: string
  name: string
  people: string[]
  slotPeople: number[]
}

export type GoldenWeekDoc = {
  v: number
  weekStart: string
  rev: number
  week: GoldenWeekPayload
  visible: boolean
  templateHash: string
  updatedAt: string
  snapshot?: ScheduleSnapshot
}

export function isGoldenWeekDoc(body: unknown): body is GoldenWeekDoc {
  if (!body || typeof body !== 'object') return false
  const doc = body as Record<string, unknown>
  const week = doc.week as Record<string, unknown> | undefined
  return (
    typeof doc.weekStart === 'string' &&
    typeof doc.rev === 'number' &&
    typeof doc.templateHash === 'string' &&
    typeof doc.updatedAt === 'string' &&
    !!week &&
    typeof week.weekStart === 'string' &&
    typeof week.name === 'string' &&
    Array.isArray(week.people) &&
    Array.isArray(week.slotPeople) &&
    (doc.snapshot === undefined || (validScheduleSnapshot(doc.snapshot, week.slotPeople.length, doc.weekStart as string)
      && templateHashForSlots(doc.snapshot.slots) === doc.templateHash))
  )
}

export async function fetchGoldenWeek(weekStart: string, restaurantId?: string): Promise<GoldenWeekDoc | null> {
  const suffix = restaurantId ? `?restaurant=${encodeURIComponent(restaurantId)}` : ''
  const { status, body } = await requestJson(`/api/schedule/${weekStart}${suffix}`)
  if (status === 404) return null
  if (status === 200 && isGoldenWeekDoc(body)) {
    return { ...body, visible: body.visible !== false }
  }
  throw new StoreUnavailableError()
}

export type GoldenMonth = {
  weeks: GoldenWeekDoc[]
  /** Month revision: bumped by every golden save touching this month. */
  rev: number
  /** True when the server confirms nothing changed since knownRev — weeks is empty. */
  notModified: boolean
}

export async function fetchGoldenMonth(month: string, knownRev = 0, restaurantId?: string): Promise<GoldenMonth> {
  const restaurantQuery = restaurantId ? `&restaurant=${encodeURIComponent(restaurantId)}` : ''
  const query =
    knownRev > 0
      ? `?month=${encodeURIComponent(month)}&knownRev=${knownRev}${restaurantQuery}`
      : `?month=${encodeURIComponent(month)}${restaurantQuery}`
  const { status, body } = await requestJson(`/api/schedule${query}`)
  if (status === 400) return { weeks: [], rev: 0, notModified: false }
  if (status === 200 && body && typeof body === 'object' && 'weeks' in body) {
    const { weeks, rev, notModified } = body as { weeks: unknown; rev: unknown; notModified: unknown }
    if (Array.isArray(weeks)) {
      return {
        weeks: notModified === true ? [] : weeks.map(week => {
          if (!isGoldenWeekDoc(week)) throw new StoreUnavailableError('A published schedule could not be read safely.')
          return week
        }),
        rev: typeof rev === 'number' ? rev : 0,
        notModified: notModified === true,
      }
    }
  }
  throw new StoreUnavailableError()
}

export async function saveGoldenWeek(
  weekStart: string,
  input: { week: GoldenWeekPayload; templateHash: string; visible: boolean; baseRev: number; snapshot?: ScheduleSnapshot },
  token: string,
  restaurantId?: string,
): Promise<{ rev: number; updatedAt: string | null }> {
  const check = captureSchedulerSession('manager', token)
  if (input.snapshot) await requireScheduleSnapshots()
  check()
  const suffix = restaurantId ? `?restaurant=${encodeURIComponent(restaurantId)}` : ''
  const { status, body } = await requestJson(`/api/schedule/${weekStart}${suffix}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  }, 'manager', token)
  if (status === 404) throw new StoreNotFoundError()
  if (status === 401 || status === 403) throw new StoreAuthError()
  if (status === 400) throw new StoreRejectedError('The server refused this week. Reload the page and publish again.')
  if (status === 503) {
    throw new StoreUnavailableError(
      'Saving is not set up on the server yet. Ask whoever manages the website to finish setup.',
    )
  }
  if (status === 409) {
    if ((body as {error?:string}|null)?.error==='special_hours_changed') throw new StoreRejectedError('Restaurant hours changed. Reload and review Hours before publishing.')
    const rev = body && typeof body === 'object' && 'rev' in body ? (body as { rev: unknown }).rev : 0
    throw new StoreConflictError(typeof rev === 'number' ? rev : 0)
  }
  if ((status === 200 || status === 201) && body && typeof body === 'object' && 'rev' in body) {
    const { rev, updatedAt } = body as { rev: unknown; updatedAt: unknown }
    if (typeof rev === 'number') return { rev, updatedAt: typeof updatedAt === 'string' ? updatedAt : null }
  }
  throw new StoreUnavailableError()
}

/** Check before any dependent write: older Workers silently discard unknown fields. */
export async function requireScheduleSnapshots(): Promise<void> {
  const { status, body } = await requestJson('/api/health')
  if (status !== 200 || !body || typeof body !== 'object' || !('scheduleSnapshotVersion' in body)
    || body.scheduleSnapshotVersion !== 1) {
    throw new StoreUnavailableError('The schedule server needs an update before these changes can be saved.')
  }
}

/**
 * Read-only gate check for the scheduler demo entry screen. Same manager
 * token as the PUTs above — resolves when the code is accepted, throws
 * StoreAuthError on a wrong code and StoreUnavailableError otherwise.
 */
export async function verifyWriteToken(token: string): Promise<void> {
  const { status } = await requestJson('/api/auth/verify', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  }, 'verification')
  if (status === 200) return
  if (status === 401 || status === 403) throw new StoreAuthError()
  if (status === 429) {
    throw new StoreUnavailableError('Too many wrong codes. Wait a bit and try again.')
  }
  throw new StoreUnavailableError()
}

/** The Worker refused the data itself (HTTP 400) — retrying the same thing will not help. */
export class StoreRejectedError extends Error {
  constructor(message = 'The server refused this data. Check the highlighted fields and try again.') {
    super(message)
    this.name = 'StoreRejectedError'
  }
}

export class StoreUnavailableError extends Error {
  constructor(message = 'Could not reach the server.') {
    super(message)
    this.name = 'StoreUnavailableError'
  }
}

async function requestJson(path: string, init?: RequestInit, scope: SchedulerRequestScope = 'public', credential?: string): Promise<{ status: number; body: unknown }> {
  return schedulerRequestJson(`${getScheduleApiBase()}${path}`, init, scope, () => new StoreUnavailableError(), credential)
}

/**
 * One message for any scheduler save or check failure. `what` names the thing being saved, e.g.
 * "staff list". Conflicts say to reload because the other person's copy is on the server now.
 */
export function saveErrorMessage(caught: unknown, what: string): string {
  if (caught instanceof SessionChangedError) return caught.message
  if (caught instanceof StoreAuthError) return 'That code was not accepted. Check for typos and try again.'
  if (caught instanceof StoreConflictError) return `Someone else saved the ${what} first. Reload the page to see their copy, then try again.`
  if (caught instanceof StoreRejectedError) return caught.message
  if (caught instanceof StoreNotFoundError) return 'The schedule store did not recognize this request. Reload the page and try again.'
  if (caught instanceof StoreUnavailableError) return `${caught.message} Your edits are safe on this screen — try again in a moment.`
  return `Something went wrong saving the ${what}.`
}

