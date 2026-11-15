import assert from 'node:assert/strict'
import test from 'node:test'
import { SalesCache, preloadSales, type SalesDeps } from './sales-cache'
import { emptySalesDay, type SalesDay } from './sales'
import { SalesUnavailableError } from './sales-store'

const day = (net: number): SalesDay => ({ ...emptySalesDay(), net })

function harness(options: { cached?: Record<string, number>; range?: 'missing' | 'ok'; failures?: Record<string, SalesUnavailableError[]> } = {}) {
  const dayCalls: string[] = []
  const rangeCalls: string[] = []
  const sleeps: number[] = []
  let clock = 1_000_000
  const failures = options.failures ?? {}
  const deps: SalesDeps = {
    async fetchRange(store, from, to) {
      rangeCalls.push(`${store} ${from}..${to}`)
      if (options.range === 'missing') return null
      const days: Record<string, SalesDay> = {}
      const missing: string[] = []
      for (let d = from; d <= to; d = new Date(Date.parse(`${d}T00:00:00Z`) + 86400000).toISOString().slice(0, 10)) {
        const net = options.cached?.[`${store}:${d}`]
        if (net === undefined) missing.push(d)
        else days[d] = day(net)
      }
      return { days, missing }
    },
    async fetchDay(store, date) {
      dayCalls.push(`${store}:${date}`)
      const queued = failures[`${store}:${date}`]
      if (queued?.length) throw queued.shift()
      await Promise.resolve()
      return day(100)
    },
    async sleep(ms) { sleeps.push(ms) },
    now: () => clock,
    today: () => '2026-11-14',
  }
  return { cache: new SalesCache(deps), dayCalls, rangeCalls, sleeps, advance(ms: number) { clock += ms } }
}

test('one range read per store fills cached days; only the rest are fetched day by day', async () => {
  const h = harness({ cached: { 'CR3:2026-11-12': 700, 'CR2:2026-11-12': 300 } })
  let notified = 0
  h.cache.subscribe(() => { notified += 1 })
  await h.cache.ensure(['CR3', 'CR2'], ['2026-11-12', '2026-11-13'], 'code')
  assert.deepEqual(h.rangeCalls, ['CR3 2026-11-12..2026-11-13', 'CR2 2026-11-12..2026-11-13'])
  assert.deepEqual(h.dayCalls.sort(), ['CR2:2026-11-13', 'CR3:2026-11-13'])
  const snapshot = h.cache.getSnapshot()
  assert.equal(snapshot['CR3:2026-11-12'].net, 700)
  assert.equal(snapshot['CR2:2026-11-13'].net, 100)
  assert.ok(notified > 0)
  // Everything is loaded and fresh: asking again does nothing.
  await h.cache.ensure(['CR3', 'CR2'], ['2026-11-12', '2026-11-13'], 'code')
  assert.equal(h.rangeCalls.length, 2)
  assert.equal(h.dayCalls.length, 2)
})

test('an older Worker without the range route falls back to day requests', async () => {
  const h = harness({ range: 'missing' })
  await h.cache.ensure(['CR3'], ['2026-11-10', '2026-11-11'], 'code')
  assert.deepEqual(h.dayCalls, ['CR3:2026-11-10', 'CR3:2026-11-11'])
})

test('two callers asking for the same day share one request (preload + Reports)', async () => {
  const h = harness({ range: 'missing' })
  await Promise.all([
    h.cache.ensure(['CR3', 'CR2'], ['2026-11-10', '2026-11-11', '2026-11-12'], 'code'),
    h.cache.ensure(['CR3'], ['2026-11-11', '2026-11-12'], 'code'),
  ])
  assert.equal(h.dayCalls.length, new Set(h.dayCalls).size)
  assert.equal(h.dayCalls.length, 6)
})

test('yesterday and today refresh after 10 minutes; finished days stay', async () => {
  const h = harness({ range: 'missing' })
  const dates = ['2026-11-12', '2026-11-13', '2026-11-14']
  await h.cache.ensure(['CR3'], dates, 'code')
  h.advance(9 * 60 * 1000)
  await h.cache.ensure(['CR3'], dates, 'code')
  assert.equal(h.dayCalls.length, 3)
  h.advance(2 * 60 * 1000)
  await h.cache.ensure(['CR3'], dates, 'code')
  assert.deepEqual(h.dayCalls.slice(3).sort(), ['CR3:2026-11-13', 'CR3:2026-11-14'])
})

test('a timeout or busy day is retried after 1 s then 3 s; a third failure is reported, loaded days are kept', async () => {
  const timeout = () => new SalesUnavailableError('timeout')
  const h = harness({ range: 'missing', failures: { 'CR3:2026-11-10': [timeout(), new SalesUnavailableError('busy')], 'CR3:2026-11-11': [timeout(), timeout(), timeout()] } })
  await assert.rejects(h.cache.ensure(['CR3'], ['2026-11-10', '2026-11-11'], 'code'), (caught: unknown) => caught instanceof SalesUnavailableError && caught.reason === 'timeout')
  assert.deepEqual(h.sleeps, [1000, 1000, 3000, 3000])
  assert.equal(h.cache.getSnapshot()['CR3:2026-11-10'].net, 100)
  assert.equal(h.cache.getSnapshot()['CR3:2026-11-11'], undefined)
})

test('other failures are not retried', async () => {
  const h = harness({ range: 'missing', failures: { 'CR3:2026-11-10': [new SalesUnavailableError('failed')] } })
  await assert.rejects(h.cache.ensure(['CR3'], ['2026-11-10'], 'code'), SalesUnavailableError)
  assert.deepEqual(h.sleeps, [])
  assert.equal(h.dayCalls.length, 1)
})

test('clearing (lock) or a different manager code drops loaded days and late answers', async () => {
  const h = harness({ range: 'missing' })
  await h.cache.ensure(['CR3'], ['2026-11-10'], 'code')
  assert.ok(h.cache.getSnapshot()['CR3:2026-11-10'])
  h.cache.clear()
  assert.deepEqual(h.cache.getSnapshot(), {})
  await h.cache.ensure(['CR3'], ['2026-11-10'], 'code')
  const pending = h.cache.ensure(['CR3'], ['2026-11-11'], 'code')
  h.cache.clear()
  await pending
  assert.deepEqual(h.cache.getSnapshot(), {})
  await h.cache.ensure(['CR3'], ['2026-11-10'], 'code')
  await h.cache.ensure(['CR3'], ['2026-11-10'], 'other-code')
  assert.equal(h.dayCalls.filter(k => k === 'CR3:2026-11-10').length, 4)
})

test('preloadSales asks for both stores over the 30-day Reports range and swallows failures', async () => {
  const h = harness({ range: 'missing', failures: { 'CR3:2026-11-14': [new SalesUnavailableError('failed')] } })
  preloadSales('code', ['CR3', 'CR2'], h.cache, '2026-11-14')
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.deepEqual(h.rangeCalls, ['CR3 2026-10-16..2026-11-14', 'CR2 2026-10-16..2026-11-14'])
  assert.ok(h.dayCalls.includes('CR3:2026-11-14'))
  assert.ok(h.dayCalls.every(k => k.slice(4) >= '2026-10-16' && k.slice(4) <= '2026-11-14'))
})

test('preloadSales only asks for the stores the sales code opens', async () => {
  const h = harness({ range: 'missing' })
  preloadSales('cr2-code', ['CR2'], h.cache, '2026-11-14')
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.deepEqual(h.rangeCalls, ['CR2 2026-10-16..2026-11-14'])
  assert.ok(h.dayCalls.length > 0 && h.dayCalls.every(k => k.startsWith('CR2:')))
  preloadSales('none', [], h.cache, '2026-11-14')
})
