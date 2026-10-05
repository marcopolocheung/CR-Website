import { getScheduleApiBase, StoreAuthError, StoreConflictError, StoreUnavailableError } from './schedule-store'
import { isRosterEmployee, toRosterEmployee } from './employee-store'
import type { Employee } from './scheduler'

/**
 * Station crew store (`/api/staff`). Unlike the per-week roster, a schedule-only
 * station keeps ONE crew shared by every week, editable only after unlocking with
 * the staff password. The Worker keeps a short history of replaced crews so the
 * last saved change can be undone.
 */
export type StaffSnapshot = {
  /** null means no crew has been saved yet — callers fall back to the built-in crew. */
  employees: Employee[] | null
  rev: number
  updatedAt: string | null
  canUndo: boolean
}

/** Shape of a write (save/undo) response — the same fields as a read. */
export type StaffWriteResult = StaffSnapshot

/** Stored employees carry `newHire`; the roster fingerprint omits it, so serialize it here. */
function toStoredEmployee(employee: Employee) {
  return { ...toRosterEmployee(employee), newHire: employee.newHire ?? false }
}

/** Dirty-check fingerprint for the crew, including `newHire` (which the roster fingerprint drops). */
export function staffFingerprint(employees: Employee[]): string {
  return JSON.stringify([...employees].map(toStoredEmployee).sort((a, b) => a.id.localeCompare(b.id)))
}

function staffQuery(restaurantId?: string): string {
  return restaurantId ? `?restaurant=${encodeURIComponent(restaurantId)}` : ''
}

function parseStaffBody(body: unknown): StaffSnapshot | null {
  if (!body || typeof body !== 'object') return null
  const doc = body as Record<string, unknown>
  if (typeof doc.rev !== 'number' || !Number.isInteger(doc.rev) || doc.rev < 0) return null
  let employees: Employee[] | null = null
  if (doc.employees !== null && doc.employees !== undefined) {
    if (!Array.isArray(doc.employees) || !doc.employees.every(isRosterEmployee)) return null
    employees = doc.employees as Employee[]
  }
  return {
    employees,
    rev: doc.rev,
    updatedAt: typeof doc.updatedAt === 'string' ? doc.updatedAt : null,
    canUndo: doc.canUndo === true,
  }
}

export async function fetchStaff(restaurantId?: string): Promise<StaffSnapshot> {
  const { status, body } = await requestJson(`/api/staff${staffQuery(restaurantId)}`)
  if (status === 200) {
    const parsed = parseStaffBody(body)
    if (parsed) return parsed
  }
  if (status === 403) {
    throw new StoreUnavailableError('Staff editing is not enabled for this station.')
  }
  throw new StoreUnavailableError()
}

/** Read-only gate check for the staff editor. Resolves on the right password. */
export async function verifyStaffPassword(password: string, restaurantId?: string): Promise<void> {
  const { status } = await requestJson(`/api/staff/verify${staffQuery(restaurantId)}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${password}` },
  })
  if (status === 200) return
  if (status === 401) throw new StoreAuthError()
  if (status === 429) throw new StoreUnavailableError('Too many wrong passwords. Wait a bit and try again.')
  if (status === 503) throw new StoreUnavailableError('Staff editing is not set up on the server yet.')
  throw new StoreUnavailableError()
}

export async function saveStaff(
  employees: Employee[],
  baseRev: number,
  password: string,
  restaurantId?: string,
): Promise<StaffWriteResult> {
  const { status, body } = await requestJson(`/api/staff${staffQuery(restaurantId)}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${password}` },
    body: JSON.stringify({ employees: employees.map(toStoredEmployee), baseRev }),
  })
  return handleStaffWrite(status, body)
}

export async function undoStaff(
  baseRev: number,
  password: string,
  restaurantId?: string,
): Promise<StaffWriteResult> {
  const { status, body } = await requestJson(`/api/staff/undo${staffQuery(restaurantId)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${password}` },
    body: JSON.stringify({ baseRev }),
  })
  if (status === 409 && body && typeof body === 'object' && (body as { error?: unknown }).error === 'nothing_to_undo') {
    throw new StoreUnavailableError('There is no saved crew change left to undo.')
  }
  return handleStaffWrite(status, body)
}

function handleStaffWrite(status: number, body: unknown): StaffWriteResult {
  if (status === 401) throw new StoreAuthError()
  if (status === 403) throw new StoreUnavailableError('Staff editing is not enabled for this station.')
  if (status === 503) {
    throw new StoreUnavailableError(
      'The crew store is not set up for saving yet. Set the STAFF_EDIT_PASSWORD secret on the Worker and try again.',
    )
  }
  if (status === 409) {
    const rev = body && typeof body === 'object' && 'rev' in body ? (body as { rev: unknown }).rev : 0
    throw new StoreConflictError(typeof rev === 'number' ? rev : 0)
  }
  if (status === 200 || status === 201) {
    const parsed = parseStaffBody(body)
    if (parsed) return parsed
  }
  throw new StoreUnavailableError()
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
