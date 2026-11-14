/**
 * Toast cash figures for the cash-out sheet (read-only Toast "Standard API access").
 *
 * The client secret lives only in Worker secrets. The Worker logs in, keeps the
 * 24-hour access token in KV, and returns per-cashier cash totals plus the day's
 * expected cash. Browsers never see the secret, the token or raw Toast orders.
 */

export const TOAST_STORES = ['CR3', 'CR2'] as const
export type ToastStore = (typeof TOAST_STORES)[number]

export interface ToastEnv {
  SCHEDULES: { get(key: string): Promise<string | null>; put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> }
  TOAST_API_HOSTNAME?: string
  TOAST_CLIENT_ID?: string
  TOAST_CLIENT_SECRET?: string
  TOAST_GUID_CR2?: string
  TOAST_GUID_CR3?: string
}

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>

const DEFAULT_HOST = 'https://ws-api.toasttab.com'
const TOKEN_KEY = 'toast:token'
/** Log in again this long before Toast's expiry so a token never dies mid-request. */
const TOKEN_MARGIN_MS = 10 * 60 * 1000
const PAGE_SIZE = 100
const MAX_PAGES = 50
/** Both stores are in San Antonio. Shift split: payments before 4 PM local are AM. */
export const STORE_TIME_ZONE = 'America/Chicago'
export const PM_STARTS_AT_HOUR = 16

export class ToastError extends Error {
  constructor(readonly code: 'toast_unconfigured' | 'toast_auth' | 'toast_unavailable', message: string) {
    super(message)
    this.name = 'ToastError'
  }
}

export type ToastCashier = {
  /** Display name: chosen name or first name, plus a last initial when two match. */
  name: string
  cents: number
  payments: number
  /** First and last cash payment, local HH:MM. */
  first: string
  last: string
}
export type ToastZ = { cashPayments: number; refunds: number; cashIn: number; cashOut: number; payOuts: number; tipOuts: number; expected: number }
export type ToastCashSummary = { am: ToastCashier[]; pm: ToastCashier[]; z: ToastZ }

type Ref = { guid?: string } | null | undefined
type Payment = { type?: string; paymentStatus?: string; refundStatus?: string; amount?: number; paidDate?: string; server?: Ref; voidInfo?: unknown; refund?: { refundAmount?: number } | null }
type Order = { voided?: boolean; deleted?: boolean; checks?: { voided?: boolean; deleted?: boolean; payments?: Payment[] }[] }
type Entry = { guid?: string; type?: string; amount?: number; undoes?: Ref }
type Employee = { guid?: string; firstName?: string | null; lastName?: string | null; chosenName?: string | null }

const cents = (dollars: unknown) => (typeof dollars === 'number' && Number.isFinite(dollars) ? Math.round(dollars * 100) : 0)

const localClock = new Intl.DateTimeFormat('en-US', { timeZone: STORE_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
/** Toast dates look like 2026-11-13T16:38:36.372+0000; returns local "HH:MM" or null. */
function localTime(toastDate: string | undefined): string | null {
  if (!toastDate) return null
  const ms = Date.parse(toastDate.replace(/([+-]\d{2})(\d{2})$/, '$1:$2'))
  if (Number.isNaN(ms)) return null
  const parts = Object.fromEntries(localClock.formatToParts(ms).map(p => [p.type, p.value]))
  return `${parts.hour}:${parts.minute}`
}

/** Pure: turns one business day of Toast data into the sheet's Toast figures. */
export function summarizeToastCash(raw: { orders: unknown[]; entries: unknown[]; employees: unknown[] }): ToastCashSummary {
  // Toast JSON is outside data: every field read below is optional-chained or type-checked.
  const input = raw as { orders: Order[]; entries: Entry[]; employees: Employee[] }
  type Group = { guid: string; am: number; pm: number; refunds: number; payments: number; first: string; last: string }
  const groups = new Map<string, Group>()
  let cashPayments = 0
  let refunds = 0
  for (const order of input.orders) {
    if (order.voided || order.deleted) continue
    for (const check of order.checks ?? []) {
      if (check.voided || check.deleted) continue
      for (const p of check.payments ?? []) {
        if (p.type !== 'CASH' || p.voidInfo || p.paymentStatus === 'VOIDED') continue
        const time = localTime(p.paidDate) ?? '00:00'
        const guid = p.server?.guid ?? 'unknown'
        const group = groups.get(guid) ?? { guid, am: 0, pm: 0, refunds: 0, payments: 0, first: time, last: time }
        const amount = cents(p.amount)
        if (Number(time.slice(0, 2)) < PM_STARTS_AT_HOUR) group.am += amount
        else group.pm += amount
        const refund = p.refundStatus && p.refundStatus !== 'NONE' ? cents(p.refund?.refundAmount) : 0
        group.refunds += refund
        group.payments += 1
        if (time < group.first) group.first = time
        if (time > group.last) group.last = time
        groups.set(guid, group)
        cashPayments += amount
        refunds += refund
      }
    }
  }

  const people = new Map(input.employees.filter(e => e.guid).map(e => [e.guid!, e]))
  const base = (guid: string) => {
    const e = people.get(guid)
    return e?.chosenName?.trim() || e?.firstName?.trim() || 'Unknown employee'
  }
  const sorted = [...groups.values()].sort((a, b) => a.first.localeCompare(b.first))
  const names = new Map<string, string>()
  const counts = new Map<string, number>()
  for (const g of sorted) counts.set(base(g.guid), (counts.get(base(g.guid)) ?? 0) + 1)
  const used = new Map<string, number>()
  for (const g of sorted) {
    let name = base(g.guid)
    const initial = people.get(g.guid)?.lastName?.trim()?.[0]
    if ((counts.get(name) ?? 0) > 1 && initial) name = `${name} ${initial.toUpperCase()}.`
    const seen = (used.get(name) ?? 0) + 1
    used.set(name, seen)
    names.set(g.guid, seen > 1 ? `${name} (${seen})` : name)
  }

  const am: ToastCashier[] = []
  const pm: ToastCashier[] = []
  for (const g of sorted) {
    const row = { name: names.get(g.guid)!, cents: g.am + g.pm - g.refunds, payments: g.payments, first: g.first, last: g.last }
    ;(g.am >= g.pm ? am : pm).push(row)
  }

  // Undo entries reverse an earlier entry; drop both so neither counts.
  const undone = new Set(input.entries.map(e => e.undoes?.guid).filter(Boolean))
  const total = (type: string) =>
    input.entries.filter(e => e.type === type && !e.undoes && !undone.has(e.guid)).reduce((sum, e) => sum + Math.abs(cents(e.amount)), 0)
  const z = { cashPayments, refunds, cashIn: total('CASH_IN'), cashOut: total('CASH_OUT'), payOuts: total('PAY_OUT'), tipOuts: total('TIP_OUT'), expected: 0 }
  z.expected = z.cashPayments - z.refunds + z.cashIn - z.cashOut - z.payOuts - z.tipOuts
  return { am, pm, z }
}

export function toastConfigured(env: ToastEnv): boolean {
  return !!(env.TOAST_CLIENT_ID && env.TOAST_CLIENT_SECRET && env.TOAST_GUID_CR2 && env.TOAST_GUID_CR3)
}

const host = (env: ToastEnv) => (env.TOAST_API_HOSTNAME || DEFAULT_HOST).replace(/\/+$/, '')

/** Returns a Toast access token, logging in only when the cached one is missing or near expiry. */
export async function getToastToken(env: ToastEnv, fetcher: Fetcher = fetch, now = Date.now(), forceLogin = false): Promise<string> {
  if (!toastConfigured(env)) throw new ToastError('toast_unconfigured', 'Toast credentials are not set on the Worker.')
  if (!forceLogin) {
    try {
      const cached = JSON.parse((await env.SCHEDULES.get(TOKEN_KEY)) ?? 'null') as { token?: string; expiresAt?: number } | null
      if (cached?.token && typeof cached.expiresAt === 'number' && now < cached.expiresAt - TOKEN_MARGIN_MS) return cached.token
    } catch {
      // A corrupt cache entry just means logging in again.
    }
  }
  let response: Response
  try {
    response = await fetcher(`${host(env)}/authentication/v1/authentication/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: env.TOAST_CLIENT_ID, clientSecret: env.TOAST_CLIENT_SECRET, userAccessType: 'TOAST_MACHINE_CLIENT' }),
    })
  } catch {
    throw new ToastError('toast_unavailable', 'Could not reach Toast.')
  }
  if (response.status === 401 || response.status === 403) throw new ToastError('toast_auth', 'Toast rejected the Worker credentials.')
  const body = (await response.json().catch(() => null)) as { token?: { accessToken?: string; expiresIn?: number } } | null
  const token = body?.token?.accessToken
  if (!response.ok || !token) throw new ToastError('toast_unavailable', 'Toast login failed.')
  const expiresIn = typeof body?.token?.expiresIn === 'number' ? body.token.expiresIn : 3600
  await env.SCHEDULES.put(TOKEN_KEY, JSON.stringify({ token, expiresAt: now + expiresIn * 1000 }), {
    expirationTtl: Math.max(60, expiresIn - TOKEN_MARGIN_MS / 1000),
  })
  return token
}

/** Pulls one business day for one store and summarizes it. `date` is YYYY-MM-DD. */
export async function fetchToastCash(env: ToastEnv, store: ToastStore, date: string, fetcher: Fetcher = fetch): Promise<ToastCashSummary> {
  const restaurant = store === 'CR2' ? env.TOAST_GUID_CR2 : env.TOAST_GUID_CR3
  const businessDate = date.replaceAll('-', '')
  let token = await getToastToken(env, fetcher)
  let retried = false

  const get = async (path: string): Promise<unknown> => {
    for (;;) {
      let response: Response
      try {
        response = await fetcher(`${host(env)}${path}`, { headers: { Authorization: `Bearer ${token}`, 'Toast-Restaurant-External-ID': restaurant ?? '' } })
      } catch {
        throw new ToastError('toast_unavailable', 'Could not reach Toast.')
      }
      // A token revoked early (for example after a secret rotation): log in once more.
      if (response.status === 401 && !retried) {
        retried = true
        token = await getToastToken(env, fetcher, Date.now(), true)
        continue
      }
      if (response.status === 401 || response.status === 403) throw new ToastError('toast_auth', 'Toast refused this request.')
      if (!response.ok) throw new ToastError('toast_unavailable', `Toast answered ${response.status}.`)
      return response.json()
    }
  }

  const orders: Order[] = []
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const batch = await get(`/orders/v2/ordersBulk?businessDate=${businessDate}&pageSize=${PAGE_SIZE}&page=${page}`)
    if (!Array.isArray(batch)) throw new ToastError('toast_unavailable', 'Unexpected orders response from Toast.')
    orders.push(...(batch as Order[]))
    if (batch.length < PAGE_SIZE) break
  }
  const entries = await get(`/cashmgmt/v1/entries?businessDate=${businessDate}`)
  const employees = await get('/labor/v1/employees')
  return summarizeToastCash({ orders, entries: Array.isArray(entries) ? entries : [], employees: Array.isArray(employees) ? employees : [] })
}
