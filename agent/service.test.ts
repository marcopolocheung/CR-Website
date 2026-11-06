import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createAgentService } from './service'
import { fixtureContext } from './fixtures'
import type { AgentRunView } from '../src/lib/scheduler/agent-contracts'

const token = 'synthetic-manager-code-for-local-tests'
const origin = 'http://localhost:3000'
function request(method: string, path: string, body?: unknown, auth = token, from = origin) {
  return new Request(`http://localhost/api/agent/${path}`, { method,
    headers: { Authorization: `Bearer ${auth}`, Origin: from, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
}
function makeService(checkRequests: () => Promise<boolean> = async () => true) {
  return createAgentService({ databasePath: ':memory:', managerToken: token, allowedOrigin: origin, checkRequests })
}
async function createRun(service: ReturnType<typeof makeService>) {
  const id = randomUUID(), context = fixtureContext()
  const body = { id, context, goal: 'balanced' }
  const response = await service.handle(request('POST', 'runs', body))
  assert.equal(response.status, 202)
  await service.idle()
  return { id, context, body }
}
test('service authenticates every request, restricts origins, and never exposes context in its view', async () => {
  const service = makeService()
  try {
    assert.equal((await service.handle(request('GET', 'health', undefined, 'wrong'))).status, 401)
    assert.equal((await service.handle(request('GET', 'health', undefined, token, 'https://other.test'))).status, 403)
    const { id } = await createRun(service)
    const response = await service.handle(request('GET', `runs/${id}`))
    assert.equal(response.status, 200)
    const view = await response.json() as AgentRunView
    assert.equal(view.status, 'review')
    assert.ok(view.proposal)
    assert.equal(JSON.stringify(view).includes('recurringAvailability'), false)
    assert.equal(JSON.stringify(view).includes(token), false)
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
  } finally { await service.close() }
})
test('duplicate creates are idempotent and changed payloads cannot reuse an operation ID', async () => {
  const service = makeService()
  try {
    const { id, body } = await createRun(service)
    assert.equal((await service.handle(request('POST', 'runs', body))).status, 200)
    assert.equal((await service.handle(request('POST', 'runs', { ...body, goal: 'fairHours' }))).status, 409)
    assert.equal((await service.handle(request('GET', `runs/${id}`))).status, 200)
  } finally { await service.close() }
})
test('approval rejects stale drafts and changed requests, then accepts retryable draft-only decisions', async () => {
  let requestsMatch = true
  const service = makeService(async () => requestsMatch)
  try {
    const { id, context } = await createRun(service)
    const changed = structuredClone(context); changed.employees[0].active = false
    const stale = await service.handle(request('POST', `runs/${id}/decision`, { accept: true, context: changed }))
    assert.equal(stale.status, 409); assert.equal((await stale.json()).error, 'draft_changed')
    requestsMatch = false
    const outdated = await service.handle(request('POST', `runs/${id}/decision`, { accept: true, context }))
    assert.equal(outdated.status, 409); assert.equal((await outdated.json()).error, 'requests_changed')
    requestsMatch = true
    for (let i = 0; i < 2; i++) {
      const response = await service.handle(request('POST', `runs/${id}/decision`, { accept: true, context }))
      assert.equal(response.status, 200); assert.equal((await response.json()).status, 'accepted')
    }
    assert.equal((await service.handle(request('POST', `runs/${id}/decision`, { accept: false }))).status, 409)
  } finally { await service.close() }
})
test('unavailable requests, malformed payloads, oversized bodies, and budget exhaustion fail closed', async () => {
  let available = false
  const service = makeService(async () => available)
  try {
    const body = { id: randomUUID(), context: fixtureContext(), goal: 'balanced' }
    assert.equal((await service.handle(request('POST', 'runs', body))).status, 409)
    assert.equal((await service.handle(request('POST', 'runs', { ...body, token }))).status, 400)
    assert.equal((await service.handle(request('POST', 'runs', { text: 'x'.repeat(256001) }))).status, 413)
    available = true
    for (let i = 0; i < 12; i++) await createRun(service)
    assert.equal((await service.handle(request('POST', 'runs', body))).status, 429)
  } finally { await service.close() }
})
