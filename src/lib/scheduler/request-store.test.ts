import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchRequests, putRequests, RequestApiError } from './request-store'
import { canonicalJson } from '../internal-tools/json'
import type { RequestData } from './requests'
const station = 'CR3-diningroom'
const data: RequestData = { version: 1, stationId: station, requests: [] }
const record = { schemaVersion: 1, family: 'schedule-request', id: `requests-${station}`, storeId: 'CR3', stationId: station,
  context: { kind: 'undated' }, revision: 1, createdAt: '2026-10-24T12:00:00.000Z', updatedAt: '2026-10-24T12:00:00.000Z', data }
test('request store validates authoritative context and keeps the retry operation identity', async () => {
  const previousFetch = globalThis.fetch
  const calls: { url: string; init?: RequestInit }[] = []
  let status = 200, payload: unknown = { record: null }
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init }); return { status, json: async () => payload }
  }) as typeof fetch
  try {
    assert.equal(await fetchRequests(station, 'synthetic-token'), null)
    assert.equal(calls[0].init?.cache, 'no-store')
    for (status of [401, 403, 404, 409, 503]) {
      await assert.rejects(fetchRequests(station, 'synthetic-token'), RequestApiError)
    }
    status = 200
    payload = { record: { ...record, stationId: 'CR2-kitchen' } }
    await assert.rejects(fetchRequests(station, 'synthetic-token'), RequestApiError)
    payload = { record: JSON.parse(canonicalJson(record)) }
    assert.deepEqual(await putRequests(station, 'synthetic-token', null, data, 'Sample Manager', 'same-operation'), record)
    await putRequests(station, 'synthetic-token', null, data, 'Sample Manager', 'same-operation')
    assert.equal(calls.at(-1)?.init?.body, calls.at(-2)?.init?.body)
    assert.ok(!String(calls.at(-1)?.init?.body).includes('synthetic-token'))
    payload = { record: { ...record, revision: 2 } }
    await assert.rejects(putRequests(station, 'synthetic-token', null, data, 'Sample Manager', 'same-operation'), RequestApiError)
  } finally { globalThis.fetch = previousFetch }
})
