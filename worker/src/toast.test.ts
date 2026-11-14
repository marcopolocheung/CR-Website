import assert from 'node:assert/strict'
import test from 'node:test'
import { summarizeToastCash, getToastToken, fetchToastCash, type ToastEnv } from './toast'

// Toast sends times in UTC; the stores are in America/Chicago (CST = UTC-6 in November).
const at = (localHour: number, minute = 0) => new Date(Date.UTC(2026, 10, 13, localHour + 6, minute)).toISOString().replace('Z', '+0000')
const cash = (server: string, amount: number, paidDate: string, extra: Record<string, unknown> = {}) =>
  ({ type: 'CASH', paymentStatus: 'CAPTURED', refundStatus: 'NONE', amount, tipAmount: 0, paidDate, server: { guid: server }, ...extra })
const order = (payments: unknown[], extra: Record<string, unknown> = {}) => ({ voided: false, deleted: false, checks: [{ voided: false, deleted: false, payments }], ...extra })
const employees = [
  { guid: 'ana', firstName: 'Ana', lastName: 'Lopez', chosenName: null },
  { guid: 'luis', firstName: 'Luis', lastName: 'Diaz', chosenName: 'Lu' },
  { guid: 'ana2', firstName: 'Ana', lastName: 'Garcia', chosenName: '' },
]

test('cash payments are summed per employee in cents and split into AM/PM at 4 PM local', () => {
  const summary = summarizeToastCash({
    orders: [
      order([cash('ana', 10.1, at(11)), cash('ana', 0.2, at(12)), { ...cash('ana', 50, at(12)), type: 'CREDIT' }]),
      order([cash('luis', 20, at(17))]),
    ],
    entries: [],
    employees,
  })
  assert.deepEqual(summary.am.map(c => [c.name, c.cents, c.payments]), [['Ana', 1030, 2]])
  assert.deepEqual(summary.pm.map(c => [c.name, c.cents, c.payments]), [['Lu', 2000, 1]])
  assert.equal(summary.am[0].first, '11:00')
  assert.equal(summary.am[0].last, '12:00')
  assert.equal(summary.z.cashPayments, 3030)
  assert.equal(summary.z.expected, 3030)
})

test('a cashier goes to the shift where most of their cash came in', () => {
  const summary = summarizeToastCash({
    orders: [order([cash('ana', 100, at(11)), cash('ana', 80, at(15, 30)), cash('ana', 5, at(16, 5))]), order([cash('luis', 10, at(15)), cash('luis', 90, at(19))])],
    entries: [],
    employees,
  })
  assert.deepEqual(summary.am.map(c => [c.name, c.cents]), [['Ana', 18500]])
  assert.deepEqual(summary.pm.map(c => [c.name, c.cents]), [['Lu', 10000]])
})

test('voided payments, voided or deleted orders and checks are left out', () => {
  const summary = summarizeToastCash({
    orders: [
      order([cash('ana', 10, at(11)), cash('ana', 99, at(11), { paymentStatus: 'VOIDED', voidInfo: {} })]),
      order([cash('ana', 99, at(11))], { voided: true }),
      order([cash('ana', 99, at(11))], { deleted: true }),
      { voided: false, deleted: false, checks: [{ voided: true, deleted: false, payments: [cash('ana', 99, at(11))] }] },
    ],
    entries: [],
    employees,
  })
  assert.deepEqual(summary.am.map(c => c.cents), [1000])
})

test('refunds come off the cashier and the day; same first names get a last initial; unknown staff stay visible', () => {
  const summary = summarizeToastCash({
    orders: [order([
      cash('ana', 30, at(11), { refundStatus: 'PARTIAL', refund: { refundAmount: 5.5 } }),
      cash('ana2', 7, at(12)),
      cash('ghost-1234', 4, at(13)),
    ])],
    entries: [],
    employees,
  })
  assert.deepEqual(summary.am.map(c => [c.name, c.cents]), [['Ana L.', 2450], ['Ana G.', 700], ['Unknown employee', 400]])
  assert.equal(summary.z.refunds, 550)
  assert.equal(summary.z.cashPayments, 4100)
  assert.equal(summary.z.expected, 4100 - 550)
})

test('Z expected cash adds paid-ins and subtracts paid-outs; counts, no-sales and undone entries are ignored', () => {
  const summary = summarizeToastCash({
    orders: [order([cash('ana', 100, at(11))])],
    entries: [
      { guid: 'e1', type: 'CASH_IN', amount: 20 },
      { guid: 'e2', type: 'PAY_OUT', amount: -12.5 },
      { guid: 'e3', type: 'TIP_OUT', amount: 3 },
      { guid: 'e4', type: 'CASH_OUT', amount: 1 },
      { guid: 'e5', type: 'NO_SALE', amount: 0 },
      { guid: 'e6', type: 'CLOSE_OUT_SHORTAGE', amount: -456.67 },
      { guid: 'e7', type: 'CASH_COLLECTED', amount: 30 },
      { guid: 'e8', type: 'PAY_OUT', amount: 40 },
      { guid: 'e9', type: 'PAY_OUT', amount: -40, undoes: { guid: 'e8' } },
    ],
    employees,
  })
  assert.deepEqual(summary.z, { cashPayments: 10000, refunds: 0, cashIn: 2000, cashOut: 100, payOuts: 1250, tipOuts: 300, expected: 10000 + 2000 - 100 - 1250 - 300 })
})

function mockKv() {
  const data = new Map<string, string>()
  return { data, async get(key: string) { return data.get(key) ?? null }, async put(key: string, value: string) { data.set(key, value) } }
}
function toastEnv(kv = mockKv()): ToastEnv & { SCHEDULES: ReturnType<typeof mockKv> } {
  return { SCHEDULES: kv, TOAST_CLIENT_ID: 'id', TOAST_CLIENT_SECRET: 'secret', TOAST_GUID_CR2: 'guid-cr2', TOAST_GUID_CR3: 'guid-cr3' }
}
type Call = { url: string; init?: RequestInit }
function mockFetch(pages: unknown[][], calls: Call[]) {
  return async (url: string | URL | Request, init?: RequestInit) => {
    const href = String(url)
    calls.push({ url: href, init })
    if (href.endsWith('/authentication/v1/authentication/login')) return Response.json({ status: 'SUCCESS', token: { accessToken: 'tok-1', expiresIn: 86400 } })
    if (href.includes('/orders/v2/ordersBulk')) return Response.json(pages[Number(new URL(href).searchParams.get('page')) - 1] ?? [])
    if (href.includes('/cashmgmt/v1/entries')) return Response.json([])
    if (href.includes('/labor/v1/employees')) return Response.json(employees)
    return new Response('nope', { status: 404 })
  }
}

test('the Toast token is reused from KV until shortly before it expires', async () => {
  const env = toastEnv()
  const calls: Call[] = []
  const fetcher = mockFetch([], calls)
  assert.equal(await getToastToken(env, fetcher, 1_000_000), 'tok-1')
  assert.equal(await getToastToken(env, fetcher, 1_000_000 + 3600_000), 'tok-1')
  assert.equal(calls.length, 1)
  const login = JSON.parse(String(calls[0].init?.body))
  assert.deepEqual(login, { clientId: 'id', clientSecret: 'secret', userAccessType: 'TOAST_MACHINE_CLIENT' })
  // Past expiry minus the safety margin, it logs in again.
  await getToastToken(env, fetcher, 1_000_000 + 86400_000)
  assert.equal(calls.length, 2)
})

test('fetchToastCash pages through orders for the store location and business date', async () => {
  const env = toastEnv()
  const calls: Call[] = []
  const fullPage = Array.from({ length: 100 }, () => order([cash('ana', 1, at(11))]))
  const summary = await fetchToastCash(env, 'CR2', '2026-11-13', mockFetch([fullPage, [order([cash('luis', 2, at(18))])]], calls))
  assert.equal(summary.am[0].cents, 10000)
  assert.equal(summary.pm[0].cents, 200)
  const orderCalls = calls.filter(c => c.url.includes('ordersBulk'))
  assert.equal(orderCalls.length, 2)
  assert.match(orderCalls[0].url, /businessDate=20261113/)
  const headers = new Headers(orderCalls[0].init?.headers)
  assert.equal(headers.get('Toast-Restaurant-External-ID'), 'guid-cr2')
  assert.equal(headers.get('Authorization'), 'Bearer tok-1')
})
