import { getScheduleApiBase, StoreAuthError, StoreUnavailableError } from './schedule-store'
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
/** The range read and the access check only touch the Worker. */
const QUICK_TIMEOUT_MS = 15000

/**
 * GET with the sales code. Sales have their own code, so this deliberately doesn't use the cash-out helper
 * (`requestJson`), which is tied to the manager session and would lock it on a 401.
 * 401 (wrong or changed code) and 403 (a store this code doesn't open) both throw `StoreAuthError`.
 */
async function salesGet(path: string, token: string, timeoutMs: number): Promise<{ status: number; body: unknown }> {
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; controller.abort() }, timeoutMs)
  let response: Response
  try {
    response = await fetch(`${getScheduleApiBase()}${path}`, { cache: 'no-store', signal: controller.signal, headers: { Authorization: `Bearer ${token}` } })
  } catch {
    if (timedOut) throw new SalesUnavailableError('timeout')
    throw new StoreUnavailableError('Could not reach Toast.')
  } finally {
    clearTimeout(timer)
  }
  const body: unknown = await response.json().catch(() => null)
  if (response.status === 401 || response.status === 403) throw new StoreAuthError()
  return { status: response.status, body }
}

const errorCode = (body: unknown) => (body && typeof body === 'object' ? (body as { error?: unknown }).error : undefined)

/**
 * Which stores a sales code opens (`/api/toast/sales/access`). Wrong code → `StoreAuthError`; too many wrong codes →
 * "Too many…" (shown as rate limited); a Worker without sales codes yet → `outdated`.
 */
export async function verifySalesCode(code: string): Promise<string[]> {
  let response: { status: number; body: unknown }
  try {
    response = await salesGet('/api/toast/sales/access', code, QUICK_TIMEOUT_MS)
  } catch (caught) {
    if (caught instanceof SalesUnavailableError) throw new StoreUnavailableError()
    throw caught
  }
  const { status, body } = response
  const stores = (body as { stores?: unknown } | null)?.stores
  if (status === 200 && Array.isArray(stores)) return stores.filter((s): s is string => s === 'CR3' || s === 'CR2')
  if (status === 429) throw new StoreUnavailableError('Too many wrong codes. Wait a bit and try again.')
  if (status === 404) throw new SalesUnavailableError('outdated')
  throw new StoreUnavailableError()
}

/** One store's business day of Toast sales (`/api/toast/sales/{store}/{date}`). Needs a sales code for that store. */
export async function fetchSalesDay(store: string, date: string, token: string): Promise<SalesDay> {
  const { status, body } = await salesGet(`/api/toast/sales/${store}/${date}`, token, DAY_TIMEOUT_MS)
  if (status === 200 && body && typeof body === 'object' && typeof (body as SalesDay).net === 'number') return body as SalesDay
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
    response = await salesGet(`/api/toast/sales/${store}?from=${from}&to=${to}`, token, QUICK_TIMEOUT_MS)
  } catch (caught) {
    if (caught instanceof SalesUnavailableError || caught instanceof StoreUnavailableError) return null
    throw caught
  }
  const { status, body } = response
  if (status === 503 && errorCode(body) === 'toast_unconfigured') throw new SalesUnavailableError('unconfigured')
  const data = body as { days?: unknown; missing?: unknown } | null
  if (status !== 200 || !data || typeof data.days !== 'object' || data.days === null || !Array.isArray(data.missing)) return null
  return { days: data.days as Record<string, SalesDay>, missing: data.missing.filter((d): d is string => typeof d === 'string') }
}
