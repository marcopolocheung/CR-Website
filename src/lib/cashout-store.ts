import { managerSession, SessionChangedError } from './internal-tools/manager-session'
import { canonicalJson } from './internal-tools/json'
import type { CashoutLink } from './converter/sales-context'
import { getScheduleApiBase, StoreAuthError, StoreUnavailableError } from './schedule-store'
import { parseCashAmount, type CashoutSheet, type dayTotals } from './cashout'
export type { CashoutSheet } from './cashout'

/**
 * Cash-out day store (`/api/cashout/{store}/{date}`). Reads and writes both need
 * the manager token — the same code that unlocks the scheduler demo. Days expire
 * after 31 days, so the history covers the last 30.
 */
export const CASHOUT_STORES = ['CR3', 'CR2'] as const
export type CashoutStore = (typeof CASHOUT_STORES)[number]
export type CashoutTotals = ReturnType<typeof dayTotals>
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
  const { status, body } = await requestJson(`/api/cashout/${store}/${date}`, token, { method: 'PUT', body: JSON.stringify(input) })
  if (status === 200) {
    // Older Workers accept the sheet but discard unknown fields. Confirm found
    // cash was retained before reporting a successful save during rollout.
    if (parseCashAmount(input.sheet.extraMoney ?? '') !== 0) {
      if (!body || typeof body !== 'object' || !('extraMoney' in body) || body.extraMoney !== input.sheet.extraMoney) {
        throw new StoreUnavailableError('Extra money saving is not set up on the server yet. Your device draft is retained.')
      }
    }
    return
  }
  throw errorFor(status)
}

function errorFor(status: number): Error {
  if (status === 401) return new StoreAuthError()
  if (status === 429) return new StoreUnavailableError('Too many wrong codes. Wait a bit and try again.')
  if (status === 400) return new StoreUnavailableError('The server rejected this sheet. Check for very large counts or amounts.')
  if (status === 503) return new StoreUnavailableError('Saving is not set up yet. Set the SCHEDULE_WRITE_TOKEN secret on the Worker.')
  return new StoreUnavailableError('Could not reach the cash-out store.')
}

/** Manager-token request to the Worker. Shared with the write-up store. */
export async function requestJson(
  path: string,
  token: string,
  init?: RequestInit,
  unreachable = 'Could not reach the cash-out store.',
): Promise<{ status: number; body: unknown }> {
  const checkSession = managerSession.capture(token)
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
    checkSession()
    return { status: response.status, body }
  } catch (caught) {
    if (caught instanceof SessionChangedError) throw caught
    throw new StoreUnavailableError(unreachable)
  } finally {
    clearTimeout(timer)
  }
}

/** Exact legacy saved document identity; the digest is not an atomic server revision. */
export async function fetchCashoutSnapshot(store: CashoutStore, date: string, token: string): Promise<{ totals: CashoutTotals; link: CashoutLink } | null> {
  const { status, body } = await requestJson(`/api/cashout/${store}/${date}`, token)
  if (status === 404) return null
  if (status !== 200) throw errorFor(status)
  const doc = body as {store?: string; date?: string; updatedAt?: string; totals?: CashoutTotals; sheet?: CashoutSheet} | null
  if (!doc || doc.store !== store || doc.date !== date || !doc.updatedAt || !Number.isFinite(Date.parse(doc.updatedAt)) || !doc.sheet || !doc.totals || !['amDeposit','pmDeposit','amOverShort','pmOverShort'].every(key => { const value = doc.totals![key as keyof CashoutTotals]; return value === null || Number.isSafeInteger(value) })) throw new StoreUnavailableError('Saved cash-out context is unavailable.')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalJson(doc)))
  const revision = 'sha256:' + Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2,'0')).join('')
  return { totals: doc.totals, link: { storeId: store, date, updatedAt: doc.updatedAt, revision } }
}
