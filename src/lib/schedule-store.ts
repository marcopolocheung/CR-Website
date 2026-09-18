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
    super('That write token did not work. Ask for the current one and try again.')
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
}

function isGoldenWeekDoc(body: unknown): body is GoldenWeekDoc {
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
    Array.isArray(week.slotPeople)
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
        weeks: notModified === true ? [] : weeks.filter(isGoldenWeekDoc),
        rev: typeof rev === 'number' ? rev : 0,
        notModified: notModified === true,
      }
    }
  }
  throw new StoreUnavailableError()
}

export async function saveGoldenWeek(
  weekStart: string,
  input: { week: GoldenWeekPayload; templateHash: string; visible: boolean; baseRev: number },
  token: string,
  restaurantId?: string,
): Promise<{ rev: number; updatedAt: string | null }> {
  const suffix = restaurantId ? `?restaurant=${encodeURIComponent(restaurantId)}` : ''
  const { status, body } = await requestJson(`/api/schedule/${weekStart}${suffix}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  })
  if (status === 404) throw new StoreNotFoundError()
  if (status === 401) throw new StoreAuthError()
  if (status === 503) {
    throw new StoreUnavailableError(
      'The schedule store is not set up for saving yet. Set the SCHEDULE_WRITE_TOKEN secret on the Worker and try again.',
    )
  }
  if (status === 409) {
    const rev = body && typeof body === 'object' && 'rev' in body ? (body as { rev: unknown }).rev : 0
    throw new StoreConflictError(typeof rev === 'number' ? rev : 0)
  }
  if ((status === 200 || status === 201) && body && typeof body === 'object' && 'rev' in body) {
    const { rev, updatedAt } = body as { rev: unknown; updatedAt: unknown }
    if (typeof rev === 'number') return { rev, updatedAt: typeof updatedAt === 'string' ? updatedAt : null }
  }
  throw new StoreUnavailableError()
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
  })
  if (status === 200) return
  if (status === 401) throw new StoreAuthError()
  if (status === 429) {
    throw new StoreUnavailableError('Too many wrong codes. Wait a bit and try again.')
  }
  throw new StoreUnavailableError()
}

export class StoreUnavailableError extends Error {
  constructor(message = 'Could not reach the schedule store.') {
    super(message)
    this.name = 'StoreUnavailableError'
  }
}

async function requestJson(path: string, init?: RequestInit): Promise<{ status: number; body: unknown }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  try {
    const response = await fetch(`${getScheduleApiBase()}${path}`, {
      ...init,
      cache: 'no-store',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    })
    let body: unknown = null
    try {
      body = await response.json()
    } catch {
      body = null
    }
    return { status: response.status, body }
  } catch {
    throw new StoreUnavailableError()
  } finally {
    clearTimeout(timer)
  }
}
