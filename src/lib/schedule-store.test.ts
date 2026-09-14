import assert from 'node:assert/strict'
import test from 'node:test'
import {
  StoreAuthError,
  StoreConflictError,
  StoreNotFoundError,
  StoreUnavailableError,
  createSharedWeek,
  fetchGoldenMonth,
  fetchGoldenWeek,
  fetchSharedWeek,
  listVisibleWeeks,
  saveGoldenWeek,
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

const goldenWeek = {
  version: 1,
  weekStart: '2026-09-13',
  name: 'Week of Sep 13',
  people: ['Mary'],
  slotPeople: [0],
}

test('fetchGoldenWeek returns null on 404 and the doc on 200', async () => {
  let restore = mockFetchOnce((url) => {
    assert.ok(url.endsWith('/api/schedule/2026-09-13'))
    return { status: 404, payload: { error: 'not_found' } }
  })
  try {
    assert.equal(await fetchGoldenWeek('2026-09-13'), null)
  } finally {
    restore()
  }

  restore = mockFetchOnce(() => ({
    status: 200,
    payload: { v: 3, weekStart: '2026-09-13', rev: 2, week: goldenWeek, visible: true, templateHash: 'a1b2c3d4', updatedAt: 'x' },
  }))
  try {
    const doc = await fetchGoldenWeek('2026-09-13')
    assert.equal(doc?.rev, 2)
    assert.deepEqual(doc?.week.people, ['Mary'])
  } finally {
    restore()
  }
})

test('fetchGoldenMonth returns an empty list for a bad month', async () => {
  const restore = mockFetchOnce(() => ({ status: 400, payload: { error: 'invalid_month' } }))
  try {
    assert.deepEqual(await fetchGoldenMonth('september'), [])
  } finally {
    restore()
  }
})

test('saveGoldenWeek sends the write token and maps 401 to auth', async () => {
  let restore = mockFetchOnce((url, init) => {
    assert.ok(url.endsWith('/api/schedule/2026-09-13'))
    assert.equal(init?.method, 'PUT')
    assert.equal((init?.headers as Record<string, string>)?.Authorization, 'Bearer manager-token')
    return { status: 201, payload: { rev: 1 } }
  })
  try {
    assert.deepEqual(
      await saveGoldenWeek(
        '2026-09-13',
        { week: goldenWeek, templateHash: 'a1b2c3d4', visible: true, baseRev: 0 },
        'manager-token',
      ),
      { rev: 1 },
    )
  } finally {
    restore()
  }

  restore = mockFetchOnce(() => ({ status: 401, payload: { error: 'unauthorized' } }))
  try {
    await assert.rejects(
      () =>
        saveGoldenWeek(
          '2026-09-13',
          { week: goldenWeek, templateHash: 'a1b2c3d4', visible: true, baseRev: 1 },
          'wrong',
        ),
      StoreAuthError,
    )
  } finally {
    restore()
  }
})

test('month listing returns visible stubs and tolerates a bad month', async () => {
  const restore = mockFetchOnce((url) => {
    if (url.includes('month=bad')) return { status: 400, payload: { error: 'invalid_month' } }
    assert.ok(url.includes('/api/weeks?month=2026-09'))
    return {
      status: 200,
      payload: { weeks: [{ id: 'Ab3x9QzY2k', weekStart: '2026-09-13', rev: 1, updatedAt: 'x', templateHash: 'a1b2' }] },
    }
  })
  try {
    assert.equal((await listVisibleWeeks('2026-09')).length, 1)
  } finally {
    restore()
  }
  const restoreBad = mockFetchOnce(() => ({ status: 400, payload: { error: 'invalid_month' } }))
  try {
    assert.deepEqual(await listVisibleWeeks('bad'), [])
  } finally {
    restoreBad()
  }
})
