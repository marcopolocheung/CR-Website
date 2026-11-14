import assert from 'node:assert/strict'
import test from 'node:test'
import { summarizeToastSales, fetchToastSales, salesCacheTtl } from './toast-sales'
import type { ToastEnv } from './toast'

// Toast sends UTC; the stores are on America/Chicago (CST = UTC-6 in November).
const at = (localHour: number, minute = 0) => new Date(Date.UTC(2026, 10, 13, localHour + 6, minute)).toISOString().replace('Z', '+0000')
const item = (price: number, extra: Record<string, unknown> = {}) => ({ preDiscountPrice: price, price, voided: false, appliedDiscounts: [], ...extra })
const check = (amount: number, selections: unknown[] = [], extra: Record<string, unknown> = {}) => ({ amount, voided: false, deleted: false, appliedDiscounts: [], selections, ...extra })
const order = (openedHour: number, service: string | null, checks: unknown[], extra: Record<string, unknown> = {}) =>
  ({ openedDate: at(openedHour), restaurantService: service ? { guid: service } : null, voided: false, deleted: false, checks, ...extra })
const config = { services: [{ guid: 'svc-l', name: 'Lunch' }, { guid: 'svc-d', name: 'Dinner' }], voidReasons: [{ guid: 'vr-walk', name: 'WALKOUT - DRIVE THRU' }] }

test('net sales are summed in cents and split by 4 PM order time and by Toast meal period', () => {
  const day = summarizeToastSales([
    order(11, 'svc-l', [check(10.1), check(5)]),
    order(15, 'svc-d', [check(20)]),
    order(18, 'svc-d', [check(30.25)]),
    order(19, null, [check(1)]),
  ], config)
  assert.equal(day.net, 6635)
  assert.equal(day.orders, 4)
  assert.deepEqual(day.shift, { am: { net: 3510, orders: 2 }, pm: { net: 3125, orders: 2 } })
  assert.deepEqual(day.service, { lunch: { net: 1510, orders: 1 }, dinner: { net: 5025, orders: 2 }, other: { net: 100, orders: 1 } })
})

test('discounts are totalled from check and item discounts, by name, and gross = net + discounts', () => {
  const day = summarizeToastSales([
    order(12, 'svc-l', [check(8, [item(10, { appliedDiscounts: [{ name: 'EMPLOYEE DISCOUNT', discountAmount: 1 }] })], { appliedDiscounts: [{ name: 'POLICE', discountAmount: 1 }] })]),
    order(13, 'svc-l', [check(9, [], { appliedDiscounts: [{ name: 'POLICE', discountAmount: 2.14 }] })]),
  ], config)
  assert.equal(day.discounts, 414)
  assert.equal(day.gross, day.net + day.discounts)
  assert.deepEqual(day.discountsByName, [{ name: 'POLICE', count: 2, amount: 314 }, { name: 'EMPLOYEE DISCOUNT', count: 1, amount: 100 }])
})

test('voids count voided items, voided checks and voided orders once each, with reasons; they never count as sales', () => {
  const day = summarizeToastSales([
    order(12, 'svc-l', [check(10, [item(10), item(4.5, { voided: true, voidReason: { guid: 'vr-walk' } })])]),
    order(13, 'svc-l', [check(7, [item(7)], { voided: true })]),
    order(14, 'svc-l', [check(6, [item(6, { voided: true })])], { voided: true }),
    order(14, 'svc-l', [check(99, [item(99)])], { deleted: true }),
  ], config)
  assert.equal(day.net, 1000)
  assert.equal(day.orders, 1)
  assert.deepEqual(day.voids, { items: 3, amount: 1750, orders: 1 })
  assert.deepEqual(day.voidsByReason, [{ name: 'No reason given', items: 2, amount: 1300 }, { name: 'WALKOUT - DRIVE THRU', items: 1, amount: 450 }])
})

test('finished days are cached for 40 days; yesterday and today only briefly; future days are rejected', () => {
  const now = Date.UTC(2026, 10, 14, 18) // Nov 14, noon in San Antonio
  assert.equal(salesCacheTtl('2026-11-11', now), 40 * 86400)
  assert.equal(salesCacheTtl('2026-11-12', now), 40 * 86400)
  assert.equal(salesCacheTtl('2026-11-13', now), 600)
  assert.equal(salesCacheTtl('2026-11-14', now), 600)
  assert.equal(salesCacheTtl('2026-11-15', now), null)
})

function mockKv() {
  const data = new Map<string, string>()
  return { data, async get(key: string) { return data.get(key) ?? null }, async put(key: string, value: string) { data.set(key, value) } }
}

test('fetchToastSales caches a finished day so the second view makes no Toast calls', async () => {
  const kv = mockKv()
  const env: ToastEnv = { SCHEDULES: kv, TOAST_CLIENT_ID: 'id', TOAST_CLIENT_SECRET: 's', TOAST_GUID_CR2: 'g2', TOAST_GUID_CR3: 'g3' }
  const calls: string[] = []
  const fetcher = async (url: string) => {
    calls.push(url)
    if (url.endsWith('/authentication/v1/authentication/login')) return Response.json({ token: { accessToken: 't', expiresIn: 86400 } })
    if (url.includes('ordersBulk')) return Response.json([order(12, 'svc-l', [check(12.5)])])
    if (url.includes('/config/v2/restaurantServices')) return Response.json(config.services)
    if (url.includes('/config/v2/voidReasons')) return Response.json(config.voidReasons)
    return Response.json([])
  }
  const now = Date.UTC(2026, 10, 14, 18)
  const first = await fetchToastSales(env, 'CR3', '2026-11-10', fetcher, now)
  assert.equal(first.cached, false)
  assert.equal(first.service.lunch.net, 1250)
  const toastCalls = calls.length
  const second = await fetchToastSales(env, 'CR3', '2026-11-10', fetcher, now)
  assert.equal(second.cached, true)
  assert.equal(second.net, 1250)
  assert.equal(calls.length, toastCalls)
  // Meal-period and void-reason names are cached too, so another day only fetches orders.
  await fetchToastSales(env, 'CR3', '2026-11-09', fetcher, now)
  assert.deepEqual(calls.slice(toastCalls).map(u => new URL(u).pathname), ['/orders/v2/ordersBulk'])
})
