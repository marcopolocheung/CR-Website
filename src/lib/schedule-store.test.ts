import assert from 'node:assert/strict'
import test from 'node:test'
import {
  StoreConflictError,
  StoreNotFoundError,
  StoreUnavailableError,
  createSharedWeek,
  fetchSharedWeek,
  updateSharedWeek,
} from './schedule-store'

function mockFetchOnce(handler: (url: string, init?: RequestInit) => { status: number; payload: unknown }) {
  const original = globalThis.fetch
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    const { status, payload } = handler(String(url), init)
    return { status, async json() { return payload } }
  }) as typeof fetch
  return () => {
    globalThis.fetch = original
  }
}

test('create returns the new same-link id and revision', async () => {
  const restore = mockFetchOnce((url, init) => {
    assert.ok(url.endsWith('/api/weeks'))
    assert.equal(init?.method, 'POST')
    return { status: 201, payload: { id: 'Ab3x9QzY2k', rev: 1 } }
  })
  try {
    assert.deepEqual(
      await createSharedWeek({ ciphertext: 'tok', templateHash: 'a1b2c3d4', weekStart: '2026-09-13' }),
      { id: 'Ab3x9QzY2k', rev: 1 },
    )
  } finally {
    restore()
  }
})

test('fetch maps 404 to not-found and network failure to unavailable', async () => {
  let restore = mockFetchOnce(() => ({ status: 404, payload: { error: 'not_found' } }))
  try {
    await assert.rejects(() => fetchSharedWeek('Ab3x9QzY2k'), StoreNotFoundError)
  } finally {
    restore()
  }

  const original = globalThis.fetch
  globalThis.fetch = (async () => {
    throw new Error('down')
  }) as typeof fetch
  try {
    await assert.rejects(() => fetchSharedWeek('Ab3x9QzY2k'), StoreUnavailableError)
  } finally {
    globalThis.fetch = original
  }
  restore = mockFetchOnce(() => ({ status: 200, payload: { error: 'x' } }))
  restore()
})

test('update maps 409 to a conflict carrying the server revision', async () => {
  const restore = mockFetchOnce(() => ({ status: 409, payload: { error: 'conflict', rev: 4 } }))
  try {
    const caught = await updateSharedWeek('Ab3x9QzY2k', { ciphertext: 'tok', baseRev: 2 }).then(
      () => null,
      (error: unknown) => error,
    )
    assert.ok(caught instanceof StoreConflictError)
    assert.equal((caught as StoreConflictError).rev, 4)
  } finally {
    restore()
  }
})

test('update returns the bumped revision on success', async () => {
  const restore = mockFetchOnce(() => ({ status: 200, payload: { rev: 3 } }))
  try {
    assert.deepEqual(await updateSharedWeek('Ab3x9QzY2k', { ciphertext: 'tok', baseRev: 2 }), { rev: 3 })
  } finally {
    restore()
  }
})
