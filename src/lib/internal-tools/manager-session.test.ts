import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ManagerSession, SessionChangedError, managerSession } from './manager-session'
import { requestJson } from '../cashout-store'

test('session lifetime rejects old successful requests and old expiry with the same code', () => {
  const session = new ManagerSession()
  session.active = true
  session.unlock('synthetic')
  const first = session.getSnapshot().generation
  const oldResponse = session.capture('synthetic')
  session.expire(first)
  session.unlock('synthetic')
  session.expire(first)
  assert.equal(session.getSnapshot().token, 'synthetic')
  assert.throws(() => oldResponse(200), SessionChangedError)
  assert.throws(() => oldResponse(401), SessionChangedError)
  assert.equal(session.getSnapshot().token, 'synthetic')
  assert.equal(session.unlock('late-verification', first), false)
})

test('unauthorized response clears current access while unowned APIs remain independent', () => {
  const session = new ManagerSession()
  session.capture('scheduler-only')(401)
  assert.equal(session.getSnapshot().generation, 0)
  session.active = true
  session.unlock('synthetic')
  session.capture('synthetic')(401)
  assert.equal(session.getSnapshot().token, '')
  assert.throws(() => session.capture('synthetic'), SessionChangedError)
})

test('internal request rejects a delayed body after reauthentication and does not expire newer access', async () => {
  const original = globalThis.fetch
  let release!: (response: Response) => void
  globalThis.fetch = () => new Promise(resolve => { release = resolve })
  managerSession.active = true
  managerSession.unlock('synthetic')
  try {
    const response = requestJson('/api/cashout/CR3/2026-11-12', 'synthetic')
    managerSession.expire()
    managerSession.unlock('synthetic')
    release(new Response('{}', { status: 401 }))
    await assert.rejects(response, SessionChangedError)
    assert.equal(managerSession.getSnapshot().token, 'synthetic')
  } finally {
    globalThis.fetch = original
    managerSession.active = false
    managerSession.expire()
  }
})


test('a verification completing after the layout exits cannot revive access', () => {
  const session = new ManagerSession()
  session.active = true
  const verificationGeneration = session.getSnapshot().generation
  session.active = false
  session.expire()
  assert.equal(session.unlock('late-code', verificationGeneration), false)
  assert.equal(session.unlock('late-code'), false)
  session.active = true
  assert.equal(session.getSnapshot().token, '')
})
