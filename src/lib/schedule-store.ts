export const DEFAULT_SCHEDULE_API = 'https://chinarose-schedule-api.crbrucecheung.workers.dev'

export function getScheduleApiBase(): string {
  const configured = (process.env.NEXT_PUBLIC_SCHEDULE_API ?? '').trim().replace(/\/+$/, '')
  if (configured) return configured
  return DEFAULT_SCHEDULE_API
}

export type StoredWeekDoc = {
  v: number
  id: string
  rev: number
  ciphertext: string
  templateHash: string
  weekStart: string
  updatedAt: string
}

export class StoreNotFoundError extends Error {
  constructor() {
    super('This link does not match any saved schedule.')
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

export class StoreUnavailableError extends Error {
  constructor() {
    super('Could not reach the schedule store.')
    this.name = 'StoreUnavailableError'
  }
}

async function requestJson(path: string, init?: RequestInit): Promise<{ status: number; body: unknown }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  try {
    const response = await fetch(`${getScheduleApiBase()}${path}`, {
      ...init,
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

export async function createSharedWeek(input: {
  ciphertext: string
  templateHash: string
  weekStart: string
}): Promise<{ id: string; rev: number }> {
  const { status, body } = await requestJson('/api/weeks', { method: 'POST', body: JSON.stringify(input) })
  if (status === 201 && body && typeof body === 'object' && 'id' in body && 'rev' in body) {
    const { id, rev } = body as { id: unknown; rev: unknown }
    if (typeof id === 'string' && typeof rev === 'number') return { id, rev }
  }
  throw new StoreUnavailableError()
}

export async function fetchSharedWeek(id: string): Promise<StoredWeekDoc> {
  const { status, body } = await requestJson(`/api/weeks/${id}`)
  if (status === 404) throw new StoreNotFoundError()
  if (status === 200 && body && typeof body === 'object' && 'ciphertext' in body && 'rev' in body) {
    return body as StoredWeekDoc
  }
  throw new StoreUnavailableError()
}

export async function updateSharedWeek(
  id: string,
  input: { ciphertext: string; baseRev: number },
): Promise<{ rev: number }> {
  const { status, body } = await requestJson(`/api/weeks/${id}`, { method: 'PUT', body: JSON.stringify(input) })
  if (status === 404) throw new StoreNotFoundError()
  if (status === 409) {
    const rev = body && typeof body === 'object' && 'rev' in body ? (body as { rev: unknown }).rev : 0
    throw new StoreConflictError(typeof rev === 'number' ? rev : 0)
  }
  if (status === 200 && body && typeof body === 'object' && 'rev' in body) {
    const { rev } = body as { rev: unknown }
    if (typeof rev === 'number') return { rev }
  }
  throw new StoreUnavailableError()
}
