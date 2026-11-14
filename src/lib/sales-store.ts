import { RequestTimeoutError, requestJson } from './cashout-store'
import { StoreAuthError, StoreUnavailableError } from './schedule-store'
import type { SalesDay } from './sales'

export type SalesProblem = 'unconfigured' | 'outdated' | 'busy' | 'timeout' | 'failed'

/**
 * Sales could not load: `unconfigured` until the Worker has Toast settings, `outdated` when the deployed
 * Worker predates the sales route (it answers 404), `busy` when Toast is rate-limiting, `timeout` when no
 * answer came in time, else other Toast/network trouble.
 */
export class SalesUnavailableError extends Error {
  constructor(readonly reason: SalesProblem) {
    super(`Toast sales ${reason}`)
    this.name = 'SalesUnavailableError'
  }
}

/** An uncached day pages through Toast orders on the Worker, which can take well over the usual 10 s. */
const DAY_TIMEOUT_MS = 30000
/** The range read only touches the Worker's cache. */
const RANGE_TIMEOUT_MS = 15000
const UNREACHABLE = 'Could not reach Toast.'

async function request(path: string, token: string, timeoutMs: number) {
  try {
    return await requestJson(path, token, undefined, UNREACHABLE, timeoutMs)
  } catch (caught) {
    if (caught instanceof RequestTimeoutError) throw new SalesUnavailableError('timeout')
    throw caught
  }
}

const errorCode = (body: unknown) => (body && typeof body === 'object' ? (body as { error?: unknown }).error : undefined)

/** One store's business day of Toast sales (`/api/toast/sales/{store}/{date}`). Needs the manager code. */
export async function fetchSalesDay(store: string, date: string, token: string): Promise<SalesDay> {
  const { status, body } = await request(`/api/toast/sales/${store}/${date}`, token, DAY_TIMEOUT_MS)
  if (status === 200 && body && typeof body === 'object' && typeof (body as SalesDay).net === 'number') return body as SalesDay
  if (status === 401) throw new StoreAuthError()
  if (status === 503 && errorCode(body) === 'toast_unconfigured') throw new SalesUnavailableError('unconfigured')
  if (status === 503 && errorCode(body) === 'toast_busy') throw new SalesUnavailableError('busy')
  if (status === 404) throw new SalesUnavailableError('outdated')
  throw new SalesUnavailableError('failed')
}

/**
 * Every day the Worker already has cached for `from`–`to` (`/api/toast/sales/{store}?from&to`), plus the dates it
 * doesn't. Returns null when the range read isn't available (older Worker, or trouble), so the caller asks day by day.
 */
export async function fetchSalesRange(store: string, from: string, to: string, token: string): Promise<{ days: Record<string, SalesDay>; missing: string[] } | null> {
  let response: { status: number; body: unknown }
  try {
    response = await request(`/api/toast/sales/${store}?from=${from}&to=${to}`, token, RANGE_TIMEOUT_MS)
  } catch (caught) {
    if (caught instanceof SalesUnavailableError || caught instanceof StoreUnavailableError) return null
    throw caught
  }
  const { status, body } = response
  if (status === 401) throw new StoreAuthError()
  if (status === 503 && errorCode(body) === 'toast_unconfigured') throw new SalesUnavailableError('unconfigured')
  const data = body as { days?: unknown; missing?: unknown } | null
  if (status !== 200 || !data || typeof data.days !== 'object' || data.days === null || !Array.isArray(data.missing)) return null
  return { days: data.days as Record<string, SalesDay>, missing: data.missing.filter((d): d is string => typeof d === 'string') }
}
