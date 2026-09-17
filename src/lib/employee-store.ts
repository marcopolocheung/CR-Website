import { getScheduleApiBase, StoreAuthError, StoreConflictError, StoreUnavailableError } from './schedule-store'
import type { Employee } from './scheduler'

export type RosterEmployee = Pick<
  Employee,
  'id' | 'name' | 'roles' | 'recurringAvailability' | 'maxDaysPerWeek' | 'maxShiftsPerWeek' | 'allowDoubles' | 'incompatibleEmployeeIds' | 'active'
>

export function toRosterEmployee(employee: Employee): RosterEmployee {
  return {
    id: employee.id,
    name: employee.name,
    roles: employee.roles,
    recurringAvailability: employee.recurringAvailability,
    maxDaysPerWeek: employee.maxDaysPerWeek,
    maxShiftsPerWeek: employee.maxShiftsPerWeek,
    allowDoubles: employee.allowDoubles,
    incompatibleEmployeeIds: employee.incompatibleEmployeeIds ?? [],
    active: employee.active,
  }
}

function isRosterEmployee(value: unknown): value is RosterEmployee {
  if (!value || typeof value !== 'object') return false
  const employee = value as Record<string, unknown>
  return (
    typeof employee.id === 'string' &&
    typeof employee.name === 'string' &&
    Array.isArray(employee.roles) &&
    !!employee.recurringAvailability &&
    typeof employee.recurringAvailability === 'object' &&
    typeof employee.allowDoubles === 'boolean' &&
    typeof employee.active === 'boolean'
  )
}

/** A stable fingerprint for dirty-checking: same roster in any order produces the same string. */
export function rosterFingerprint(employees: Employee[]): string {
  return JSON.stringify(
    [...employees].map(toRosterEmployee).sort((a, b) => a.id.localeCompare(b.id)),
  )
}

export type RosterDoc = {
  employees: RosterEmployee[]
  rev: number
  updatedAt: string | null
}

export async function fetchRoster(restaurantId?: string): Promise<RosterDoc> {
  const suffix = restaurantId ? `?restaurant=${encodeURIComponent(restaurantId)}` : ''
  const { status, body } = await requestJson(`/api/employees${suffix}`)
  if (status === 200 && body && typeof body === 'object' && 'employees' in body) {
    const { employees, rev, updatedAt } = body as { employees: unknown; rev: unknown; updatedAt: unknown }
    if (Array.isArray(employees) && employees.every(isRosterEmployee)) {
      return { employees, rev: typeof rev === 'number' ? rev : 0, updatedAt: typeof updatedAt === 'string' ? updatedAt : null }
    }
  }
  throw new StoreUnavailableError()
}

export async function saveRoster(
  employees: Employee[],
  baseRev: number,
  token: string,
  restaurantId?: string,
): Promise<{ rev: number }> {
  const suffix = restaurantId ? `?restaurant=${encodeURIComponent(restaurantId)}` : ''
  const { status, body } = await requestJson(`/api/employees${suffix}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ employees: employees.map(toRosterEmployee), baseRev }),
  })
  if (status === 401) throw new StoreAuthError()
  if (status === 503) {
    throw new StoreUnavailableError(
      'The roster store is not set up for saving yet. Set the SCHEDULE_WRITE_TOKEN secret on the Worker and try again.',
    )
  }
  if (status === 409) {
    const rev = body && typeof body === 'object' && 'rev' in body ? (body as { rev: unknown }).rev : 0
    throw new StoreConflictError(typeof rev === 'number' ? rev : 0)
  }
  if ((status === 200 || status === 201) && body && typeof body === 'object' && 'rev' in body) {
    const { rev } = body as { rev: unknown }
    if (typeof rev === 'number') return { rev }
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
