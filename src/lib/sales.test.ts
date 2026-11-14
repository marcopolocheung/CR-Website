import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchSalesDay, fetchSalesRange, SalesUnavailableError } from './sales-store'
import { RequestTimeoutError, requestJson } from './cashout-store'
import { StoreAuthError } from './schedule-store'
import { emptySalesDay, sumSalesDays, salesRows, splitParts, storeTotals, runLimited, type SalesDay } from './sales'

test('runLimited keeps at most the limit in flight and stops after a failure', async () => {
  let running = 0
  let peak = 0
  const done: number[] = []
  await runLimited([1, 2, 3, 4, 5, 6, 7], 3, async n => {
    running += 1; peak = Math.max(peak, running)
    await new Promise(resolve => setTimeout(resolve, 5))
    running -= 1; done.push(n)
  })
  assert.equal(peak, 3)
  assert.deepEqual(done.sort(), [1, 2, 3, 4, 5, 6, 7])
  const started: number[] = []
  await assert.rejects(runLimited([1, 2, 3, 4, 5], 1, async n => { started.push(n); if (n === 2) throw new Error('toast down') }), /toast down/)
  assert.deepEqual(started, [1, 2])
})

const day = (net: number, extra: Partial<SalesDay> = {}): SalesDay => ({
  ...emptySalesDay(),
  net, gross: net, orders: 1,
  shift: { am: { net, orders: 1 }, pm: { net: 0, orders: 0 } },
  service: { lunch: { net, orders: 1 }, dinner: { net: 0, orders: 0 }, other: { net: 0, orders: 0 } },
  ...extra,
})

test('summing days adds every figure and merges discount and void names', () => {
  const a = day(1000, { discounts: 100, gross: 1100, voids: { items: 1, amount: 50, orders: 0 }, discountsByName: [{ name: 'POLICE', count: 1, amount: 100 }], voidsByReason: [{ name: 'WALKOUT', items: 1, amount: 50 }] })
  const b = day(2000, { discounts: 300, gross: 2300, voids: { items: 2, amount: 70, orders: 1 }, discountsByName: [{ name: 'EMPLOYEE', count: 2, amount: 200 }, { name: 'POLICE', count: 1, amount: 100 }], voidsByReason: [{ name: 'WALKOUT', items: 2, amount: 70 }] })
  const total = sumSalesDays([a, b])
  assert.equal(total.net, 3000)
  assert.equal(total.gross, 3400)
  assert.equal(total.orders, 2)
  assert.deepEqual(total.shift.am, { net: 3000, orders: 2 })
  assert.deepEqual(total.voids, { items: 3, amount: 120, orders: 1 })
  assert.deepEqual(total.discountsByName, [{ name: 'EMPLOYEE', count: 2, amount: 200 }, { name: 'POLICE', count: 2, amount: 200 }])
  assert.deepEqual(total.voidsByReason, [{ name: 'WALKOUT', items: 3, amount: 120 }])
  assert.deepEqual(sumSalesDays([]), emptySalesDay())
})

test('rows combine the chosen stores per date and mark dates still missing a store', () => {
  const loaded = { 'CR3:2026-11-12': day(1000), 'CR2:2026-11-12': day(500), 'CR3:2026-11-13': day(700) }
  const rows = salesRows(['2026-11-12', '2026-11-13'], ['CR3', 'CR2'], loaded)
  assert.deepEqual(rows.map(r => [r.date, r.day?.net ?? null, r.stores]), [['2026-11-12', 1500, 2], ['2026-11-13', 700, 1]])
  const none = salesRows(['2026-11-14'], ['CR3'], loaded)
  assert.equal(none[0].day, null)
})

test('rows keep each store apart, and store totals add up to the combined total', () => {
  const loaded = { 'CR3:2026-11-12': day(1000), 'CR2:2026-11-12': day(500), 'CR3:2026-11-13': day(700) }
  const rows = salesRows(['2026-11-12', '2026-11-13'], ['CR3', 'CR2'], loaded)
  assert.deepEqual(rows.map(r => Object.fromEntries(Object.entries(r.byStore).map(([s, d]) => [s, d.net]))), [{ CR3: 1000, CR2: 500 }, { CR3: 700 }])
  const totals = storeTotals(rows, ['CR3', 'CR2'])
  assert.equal(totals.CR3.net, 1700)
  assert.equal(totals.CR2.net, 500)
  assert.equal(totals.CR3.net + totals.CR2.net, sumSalesDays(rows.flatMap(r => (r.day ? [r.day] : []))).net)
  assert.deepEqual(storeTotals(salesRows(['2026-11-14'], ['CR2'], loaded), ['CR2']).CR2, emptySalesDay())
})

test('split parts follow the chosen split; meal periods include orders Toast left without one only when there are any', () => {
  const d = day(1000, { shift: { am: { net: 400, orders: 1 }, pm: { net: 600, orders: 2 } }, service: { lunch: { net: 300, orders: 1 }, dinner: { net: 700, orders: 2 }, other: { net: 0, orders: 0 } } })
  assert.deepEqual(splitParts(d, 'shift').map(p => [p.key, p.net]), [['am', 400], ['pm', 600]])
  assert.deepEqual(splitParts(d, 'service').map(p => [p.key, p.net]), [['lunch', 300], ['dinner', 700]])
  const withOther = { ...d, service: { ...d.service, other: { net: 5, orders: 1 } } }
  assert.deepEqual(splitParts(withOther, 'service').map(p => p.key), ['lunch', 'dinner', 'other'])
})

test('fetchSalesDay names why a day could not load', async () => {
  const original = globalThis.fetch
  const answer = async (status: number, payload: unknown) => {
    globalThis.fetch = (async () => ({ status, async json() { return payload } })) as unknown as typeof fetch
    try { await fetchSalesDay('CR3', '2026-11-13', 'code'); return 'ok' } catch (caught) {
      if (caught instanceof SalesUnavailableError) return caught.reason
      return caught instanceof StoreAuthError ? 'auth' : 'other'
    }
  }
  try {
    assert.equal(await answer(200, { ...emptySalesDay(), net: 0 }), 'ok')
    assert.equal(await answer(401, { error: 'unauthorized' }), 'auth')
    assert.equal(await answer(503, { error: 'toast_unconfigured' }), 'unconfigured')
    // A Worker deployed before the sales route existed answers 404 for the whole path.
    assert.equal(await answer(404, { error: 'not_found' }), 'outdated')
    assert.equal(await answer(503, { error: 'toast_busy' }), 'busy')
    assert.equal(await answer(502, { error: 'toast_unavailable' }), 'failed')
  } finally {
    globalThis.fetch = original
  }
})

test('requestJson reports a timeout separately from other network trouble', async () => {
  const original = globalThis.fetch
  try {
    globalThis.fetch = ((_url: unknown, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    })) as typeof fetch
    await assert.rejects(requestJson('/slow', 'code', undefined, 'Could not reach Toast.', 5), RequestTimeoutError)
    globalThis.fetch = (async () => { throw new TypeError('offline') }) as typeof fetch
    await assert.rejects(requestJson('/down', 'code'), (caught: unknown) => caught instanceof Error && !(caught instanceof RequestTimeoutError))
  } finally {
    globalThis.fetch = original
  }
})

test('fetchSalesRange returns cached days, or null so an older or troubled Worker falls back to day requests', async () => {
  const original = globalThis.fetch
  const answer = (status: number, payload: unknown) => {
    globalThis.fetch = (async () => ({ status, async json() { return payload } })) as unknown as typeof fetch
    return fetchSalesRange('CR3', '2026-11-01', '2026-11-03', 'code')
  }
  try {
    const day = { ...emptySalesDay(), net: 500 }
    assert.deepEqual(await answer(200, { store: 'CR3', days: { '2026-11-02': day }, missing: ['2026-11-01', '2026-11-03'] }), { days: { '2026-11-02': day }, missing: ['2026-11-01', '2026-11-03'] })
    assert.equal(await answer(404, { error: 'not_found' }), null)
    assert.equal(await answer(500, null), null)
    await assert.rejects(answer(401, { error: 'unauthorized' }), StoreAuthError)
    await assert.rejects(answer(503, { error: 'toast_unconfigured' }), (caught: unknown) => caught instanceof SalesUnavailableError && caught.reason === 'unconfigured')
  } finally {
    globalThis.fetch = original
  }
})
