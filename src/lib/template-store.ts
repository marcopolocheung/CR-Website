import { DAYS, type WeeklyStaffingTemplate } from './scheduler'
import { getScheduleApiBase, StoreAuthError, StoreConflictError, StoreUnavailableError } from './schedule-store'

function isValidTemplate(value: unknown): value is WeeklyStaffingTemplate {
  if (!value || typeof value !== 'object') return false
  const template = value as Record<string, unknown>
  return DAYS.every((day) => Array.isArray(template[day]))
}

export type TemplateDoc = {
  template: WeeklyStaffingTemplate | null
  rev: number
  updatedAt: string | null
}

export async function fetchTemplate(restaurantId?: string): Promise<TemplateDoc> {
  const suffix = restaurantId ? `?restaurant=${encodeURIComponent(restaurantId)}` : ''
  const { status, body } = await requestJson(`/api/template${suffix}`)
  if (status === 200 && body && typeof body === 'object' && 'template' in body) {
    const { template, rev, updatedAt } = body as { template: unknown; rev: unknown; updatedAt: unknown }
    if (template === null || isValidTemplate(template)) {
      return {
        template: template === null ? null : template,
        rev: typeof rev === 'number' ? rev : 0,
        updatedAt: typeof updatedAt === 'string' ? updatedAt : null,
      }
    }
  }
  throw new StoreUnavailableError()
}

export async function saveTemplate(
  template: WeeklyStaffingTemplate,
  baseRev: number,
  token: string,
  restaurantId?: string,
): Promise<{ rev: number; updatedAt: string | null }> {
  const suffix = restaurantId ? `?restaurant=${encodeURIComponent(restaurantId)}` : ''
  const { status, body } = await requestJson(`/api/template${suffix}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ template, baseRev }),
  })
  if (status === 401) throw new StoreAuthError()
  if (status === 503) {
    throw new StoreUnavailableError(
      'The template store is not set up for saving yet. Set the SCHEDULE_WRITE_TOKEN secret on the Worker and try again.',
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

/** A stable fingerprint for dirty-checking. */
export function templateFingerprint(template: WeeklyStaffingTemplate): string {
  return JSON.stringify(template)
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
