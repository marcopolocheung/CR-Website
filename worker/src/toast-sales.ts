/**
 * Daily sales summaries from Toast for the Reports page (read-only Standard API access).
 *
 * One request = one store's business day. Finished days are cached in KV so a
 * 30-day view only asks Toast for days it has never seen; yesterday and today are
 * cached for 10 minutes because late voids and open checks still change them.
 */
import { PM_STARTS_AT_HOUR, STORE_TIME_ZONE, ToastError, toastClient, type Fetcher, type ToastEnv, type ToastStore } from './toast'

export type SalesSplit = { net: number; orders: number }
/** All money is integer cents. */
export type ToastSalesDay = {
  net: number
  gross: number
  discounts: number
  orders: number
  shift: { am: SalesSplit; pm: SalesSplit }
  service: { lunch: SalesSplit; dinner: SalesSplit; other: SalesSplit }
  voids: { items: number; amount: number; orders: number }
  discountsByName: { name: string; count: number; amount: number }[]
  voidsByReason: { name: string; items: number; amount: number }[]
}
type Named = { guid?: string; name?: string }
export type ToastSalesConfig = { services: Named[]; voidReasons: Named[] }

type Ref = { guid?: string } | null | undefined
type Discount = { name?: string; discountAmount?: number }
type Selection = { preDiscountPrice?: number; price?: number; voided?: boolean; voidReason?: Ref; appliedDiscounts?: Discount[] }
type Check = { amount?: number; voided?: boolean; deleted?: boolean; appliedDiscounts?: Discount[]; selections?: Selection[] }
type Order = { openedDate?: string; restaurantService?: Ref; voided?: boolean; deleted?: boolean; checks?: Check[] }

const SALES_KEY_VERSION = 'v1'
const FINISHED_DAY_TTL = 40 * 86400
const RECENT_DAY_TTL = 600
const CONFIG_TTL = 86400
const NO_REASON = 'No reason given'

const cents = (dollars: unknown) => (typeof dollars === 'number' && Number.isFinite(dollars) ? Math.round(dollars * 100) : 0)

const localHourFormat = new Intl.DateTimeFormat('en-US', { timeZone: STORE_TIME_ZONE, hour: '2-digit', hourCycle: 'h23' })
function localHour(toastDate: string | undefined): number | null {
  if (!toastDate) return null
  const ms = Date.parse(toastDate.replace(/([+-]\d{2})(\d{2})$/, '$1:$2'))
  return Number.isNaN(ms) ? null : Number(localHourFormat.format(ms))
}

/** Pure: one business day of Toast orders → the Reports page's numbers. */
export function summarizeToastSales(rawOrders: unknown[], config: ToastSalesConfig): ToastSalesDay {
  const orders = rawOrders as Order[]
  const serviceKind = new Map<string, 'lunch' | 'dinner'>()
  for (const s of config.services) {
    const name = s.name?.trim().toLowerCase()
    if (s.guid && (name === 'lunch' || name === 'dinner')) serviceKind.set(s.guid, name)
  }
  const reasons = new Map(config.voidReasons.filter(r => r.guid && r.name).map(r => [r.guid!, r.name!.trim()]))

  const day: ToastSalesDay = {
    net: 0, gross: 0, discounts: 0, orders: 0,
    shift: { am: { net: 0, orders: 0 }, pm: { net: 0, orders: 0 } },
    service: { lunch: { net: 0, orders: 0 }, dinner: { net: 0, orders: 0 }, other: { net: 0, orders: 0 } },
    voids: { items: 0, amount: 0, orders: 0 },
    discountsByName: [], voidsByReason: [],
  }
  const discountNames = new Map<string, { count: number; amount: number }>()
  const voidReasons = new Map<string, { items: number; amount: number }>()
  const addDiscount = (d: Discount) => {
    const amount = cents(d.discountAmount)
    const name = d.name?.trim() || 'Discount'
    const row = discountNames.get(name) ?? { count: 0, amount: 0 }
    row.count += 1
    row.amount += amount
    discountNames.set(name, row)
    day.discounts += amount
  }

  for (const order of orders) {
    if (order.deleted) continue
    if (order.voided) day.voids.orders += 1
    let orderNet = 0
    let sold = false
    for (const check of order.checks ?? []) {
      if (check.deleted) continue
      const checkVoided = !!(order.voided || check.voided)
      for (const s of check.selections ?? []) {
        if (checkVoided || s.voided) {
          // A whole voided check/order counts each of its items once.
          const reason = (s.voidReason?.guid && reasons.get(s.voidReason.guid)) || NO_REASON
          const row = voidReasons.get(reason) ?? { items: 0, amount: 0 }
          const amount = cents(s.preDiscountPrice ?? s.price)
          row.items += 1
          row.amount += amount
          voidReasons.set(reason, row)
          day.voids.items += 1
          day.voids.amount += amount
        } else {
          for (const d of s.appliedDiscounts ?? []) addDiscount(d)
        }
      }
      if (checkVoided) continue
      for (const d of check.appliedDiscounts ?? []) addDiscount(d)
      orderNet += cents(check.amount)
      sold = true
    }
    if (!sold) continue
    day.orders += 1
    day.net += orderNet
    const shift = (localHour(order.openedDate) ?? 0) < PM_STARTS_AT_HOUR ? day.shift.am : day.shift.pm
    shift.net += orderNet
    shift.orders += 1
    const kind = (order.restaurantService?.guid && serviceKind.get(order.restaurantService.guid)) || 'other'
    day.service[kind].net += orderNet
    day.service[kind].orders += 1
  }

  day.gross = day.net + day.discounts
  day.discountsByName = [...discountNames].map(([name, r]) => ({ name, ...r })).sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))
  day.voidsByReason = [...voidReasons].map(([name, r]) => ({ name, ...r })).sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))
  return day
}

const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: STORE_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
/** Seconds to cache a day's summary, or null for a day that hasn't started in San Antonio yet. */
export function salesCacheTtl(date: string, now = Date.now()): number | null {
  const today = localDate.format(now)
  if (date > today) return null
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86400000).toISOString().slice(0, 10)
  return date >= yesterday ? RECENT_DAY_TTL : FINISHED_DAY_TTL
}

/** One store's business day, from the KV cache when possible. `date` is YYYY-MM-DD. */
export async function fetchToastSales(env: ToastEnv, store: ToastStore, date: string, fetcher: Fetcher = fetch, now = Date.now()): Promise<ToastSalesDay & { cached: boolean }> {
  const ttl = salesCacheTtl(date, now)
  if (ttl === null) throw new ToastError('toast_unavailable', 'That business day has not started yet.')
  const key = `toast:sales:${SALES_KEY_VERSION}:${store}:${date}`
  try {
    const cached = JSON.parse((await env.SCHEDULES.get(key)) ?? 'null') as ToastSalesDay | null
    if (cached && typeof cached.net === 'number') return { ...cached, cached: true }
  } catch {
    // A corrupt entry just means asking Toast again.
  }

  const { get, orders } = await toastClient(env, store, fetcher)
  const configKey = `toast:config:${SALES_KEY_VERSION}:${store}`
  let config: ToastSalesConfig | null = null
  try {
    config = JSON.parse((await env.SCHEDULES.get(configKey)) ?? 'null') as ToastSalesConfig | null
  } catch {
    config = null
  }
  if (!config || !Array.isArray(config.services) || !Array.isArray(config.voidReasons)) {
    const [services, voidReasons] = await Promise.all([get('/config/v2/restaurantServices'), get('/config/v2/voidReasons')])
    const names = (rows: unknown) => (Array.isArray(rows) ? (rows as Named[]).map(r => ({ guid: r.guid, name: r.name })) : [])
    config = { services: names(services), voidReasons: names(voidReasons) }
    await env.SCHEDULES.put(configKey, JSON.stringify(config), { expirationTtl: CONFIG_TTL })
  }

  const day = summarizeToastSales(await orders(date), config)
  await env.SCHEDULES.put(key, JSON.stringify(day), { expirationTtl: ttl })
  return { ...day, cached: false }
}
