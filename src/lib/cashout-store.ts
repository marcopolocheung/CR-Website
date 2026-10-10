import { getScheduleApiBase, StoreAuthError, StoreUnavailableError } from './schedule-store'
import type { Cashier, dayTotals } from './cashout'

/**
 * Cash-out day store (`/api/cashout/{store}/{date}`). Reads and writes both need
 * the manager token — the same code that unlocks the scheduler demo. Days expire
 * after 31 days, so the history covers the last 30.
 */
export const CASHOUT_STORES = ['CR3', 'CR2'] as const
export type CashoutStore = (typeof CASHOUT_STORES)[number]
export type CashoutTotals = ReturnType<typeof dayTotals>
export type CashoutSheet = { am: Cashier[]; pm: Cashier[]; zReport: string }
export type CashoutDay = { date: string; totals: CashoutTotals; updatedAt: string }

export async function fetchCashoutDay(store: CashoutStore, date: string, token: string): Promise<CashoutSheet | null> {
  const { status, body } = await requestJson(`/api/cashout/${store}/${date}`, token)
  if (status === 404) return null
  if (status === 200 && body && typeof body === 'object' && 'sheet' in body) return (body as { sheet: CashoutSheet }).sheet
  throw errorFor(status)
}

export async function fetchCashoutHistory(store: CashoutStore, to: string, token: string): Promise<CashoutDay[]> {
  const { status, body } = await requestJson(`/api/cashout/${store}?to=${to}`, token)
  if (status === 200 && body && typeof body === 'object' && Array.isArray((body as { days?: unknown }).days)) {
    return (body as { days: CashoutDay[] }).days
  }
  throw errorFor(status)
}

export async function saveCashoutDay(
  store: CashoutStore,
  date: string,
  input: { sheet: CashoutSheet; totals: CashoutTotals },
  token: string,
): Promise<void> {
  const { status } = await requestJson(`/api/cashout/${store}/${date}`, token, { method: 'PUT', body: JSON.stringify(input) })
  if (status === 200) return
  throw errorFor(status)
}

function errorFor(status: number): Error {
  if (status === 401) return new StoreAuthError()
  if (status === 429) return new StoreUnavailableError('Too many wrong codes. Wait a bit and try again.')
  if (status === 400) return new StoreUnavailableError('The server rejected this sheet. Check for very large counts or amounts.')
  if (status === 503) return new StoreUnavailableError('Saving is not set up yet. Set the SCHEDULE_WRITE_TOKEN secret on the Worker.')
  return new StoreUnavailableError('Could not reach the cash-out store.')
}

async function requestJson(path: string, token: string, init?: RequestInit): Promise<{ status: number; body: unknown }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  try {
    const response = await fetch(`${getScheduleApiBase()}${path}`, {
      ...init,
      cache: 'no-store',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    })
    let body: unknown = null
    try {
      body = await response.json()
    } catch {
      body = null
    }
    return { status: response.status, body }
  } catch {
    throw new StoreUnavailableError('Could not reach the cash-out store.')
  } finally {
    clearTimeout(timer)
  }
}
