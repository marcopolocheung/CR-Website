import { captureSchedulerSession, schedulerRequestJson, type SchedulerAuthScope, type SchedulerRequestScope } from './scheduler-http'
import { DAYS, type WeeklyStaffingTemplate } from './scheduler'
import { getScheduleApiBase, isGoldenWeekDoc, requireScheduleSnapshots, StoreAuthError, StoreConflictError, StoreRejectedError, StoreUnavailableError, type GoldenWeekDoc } from './schedule-store'

function isValidTemplate(value: unknown): value is WeeklyStaffingTemplate {
  if (!value || typeof value !== 'object') return false
  const template = value as Record<string, unknown>
  return DAYS.every((day) => Array.isArray(template[day]))
}

export type TemplateDoc = {
  template: WeeklyStaffingTemplate | null
  rev: number
  updatedAt: string | null
  weekStart?: string
  inherited?: boolean
}

function templateQuery(restaurantId?: string, weekStart?: string): string {
  const params = new URLSearchParams()
  if (restaurantId) params.set('restaurant', restaurantId)
  if (weekStart) params.set('weekStart', weekStart)
  const query = params.toString()
  return query ? `?${query}` : ''
}

export async function fetchTemplate(restaurantId?: string, weekStart?: string): Promise<TemplateDoc> {
  const { status, body } = await requestJson(`/api/template${templateQuery(restaurantId, weekStart)}`)
  if (status === 200 && body && typeof body === 'object' && 'template' in body) {
    const { template, rev, updatedAt, inherited } = body as {
      template: unknown
      rev: unknown
      updatedAt: unknown
      inherited: unknown
    }
    if (template === null || isValidTemplate(template)) {
      return {
        template: template === null ? null : template,
        rev: typeof rev === 'number' ? rev : 0,
        updatedAt: typeof updatedAt === 'string' ? updatedAt : null,
        weekStart,
        inherited: inherited === true,
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
  weekStart?: string,
  authScope: SchedulerAuthScope = 'manager',
): Promise<{ rev: number; updatedAt: string | null; preservedPublication?: GoldenWeekDoc }> {
  const check = captureSchedulerSession(authScope, token)
  await requireScheduleSnapshots()
  check()
  const { status, body } = await requestJson(`/api/template${templateQuery(restaurantId, weekStart)}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ template, baseRev }),
  }, authScope, token)
  if (status === 401 || status === 403) throw new StoreAuthError()
  if (status === 400) throw new StoreRejectedError('The server refused these shift rules. Open Shift rules in Employee settings and fix the spots marked in red.')
  if (status === 503) {
    throw new StoreUnavailableError(
      'Saving is not set up on the server yet. Ask whoever manages the website to finish setup.',
    )
  }
  if (status === 409) {
    if ((body as { error?: string } | null)?.error === 'publication_preservation_failed') {
      throw new StoreRejectedError('The published shift times could not be preserved. Your rules were not saved. Reload and review the published week before trying again.')
    }
    const rev = body && typeof body === 'object' && 'rev' in body ? (body as { rev: unknown }).rev : 0
    throw new StoreConflictError(typeof rev === 'number' ? rev : 0)
  }
  if ((status === 200 || status === 201) && body && typeof body === 'object' && 'rev' in body) {
    const { rev, updatedAt, preservedPublication } = body as { rev: unknown; updatedAt: unknown; preservedPublication?: unknown }
    if (preservedPublication !== undefined && !isGoldenWeekDoc(preservedPublication)) throw new StoreUnavailableError()
    if (typeof rev === 'number') return { rev, updatedAt: typeof updatedAt === 'string' ? updatedAt : null,
      ...(preservedPublication ? { preservedPublication } : {}) }
  }
  throw new StoreUnavailableError()
}

/** A stable fingerprint for dirty-checking. */
export function templateFingerprint(template: WeeklyStaffingTemplate): string {
  return JSON.stringify(template)
}

async function requestJson(path: string, init?: RequestInit, scope: SchedulerRequestScope = 'public', credential?: string): Promise<{ status: number; body: unknown }> {
  return schedulerRequestJson(`${getScheduleApiBase()}${path}`, init, scope, () => new StoreUnavailableError(), credential)
}
