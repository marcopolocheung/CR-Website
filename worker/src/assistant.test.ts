import assert from 'node:assert/strict'
import test from 'node:test'
import handler, { validateCashoutBody } from './index'
import { DENOMINATIONS } from '../../src/lib/cashout'

function mockEnv(apiKey: string | undefined = 'sk-test') {
  const data = new Map<string, string>()
  return {
    data,
    SCHEDULES: {
      async get(key: string) { return data.get(key) ?? null },
      async put(key: string, value: string) { data.set(key, value) },
      async delete(key: string) { data.delete(key) },
      async list() { return { keys: [], list_complete: true } },
    },
    SCHEDULE_WRITE_TOKEN: 'manager-token',
    GEMINI_API_KEY: apiKey,
  }
}
const post = (path: string, body: unknown, token = 'manager-token') => new Request(`https://api.test${path}`, {
  method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
})

/** Replaces the Gemini API with a canned reply and records what was sent. */
async function withGemini<T>(reply: unknown, run: (sent: Record<string, unknown>[]) => Promise<T>, finish = 'stop') {
  const sent: Record<string, unknown>[] = []
  const realFetch = globalThis.fetch
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(String(url), 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions')
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer sk-test')
    sent.push(JSON.parse(String(init?.body)))
    return new Response(JSON.stringify({ choices: [{ index: 0, finish_reason: finish, message: { role: 'assistant', content: JSON.stringify(reply) } }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch
  try { return await run(sent) } finally { globalThis.fetch = realFetch }
}

const counts = (dollars: number) => DENOMINATIONS.map(d => (d === 100 ? dollars : 0))
const draft = {
  text: 'Ana called out Friday', weekStart: '2026-11-22',
  employees: [{ id: 'e1', name: 'Ana', roles: ['server'], active: true }, { id: 'e2', name: 'Kevin', roles: ['server'], active: true }],
  slots: [{ id: 's1', day: 'Friday', period: 'AM', role: 'server', label: 'Server', start: 660, end: 960, required: true, date: '2026-11-27' }],
  assignments: [{ slotId: 's1', employeeId: 'e1' }],
}

test('assistant routes need the manager code, a configured key and a valid body', async () => {
  const env = mockEnv()
  assert.equal((await handler.fetch(post('/api/assistant/cash', { question: 'hi', to: '2026-11-27' }, 'wrong'), env)).status, 401)
  assert.equal((await handler.fetch(post('/api/assistant/cash', { question: 'hi', to: '2026-11-27' }), mockEnv(''))).status, 503)
  assert.equal((await handler.fetch(post('/api/assistant/cash', { question: '', to: '2026-11-27' }), env)).status, 400)
  assert.equal((await handler.fetch(post('/api/assistant/cash', { question: 'hi', to: 'today' }), env)).status, 400)
  assert.equal((await handler.fetch(post('/api/assistant/schedule', { ...draft, weekStart: 'x' }), env)).status, 400)
})

test('cash questions send computed figures, never raw counts, and report covered dates', async () => {
  const env = mockEnv()
  const save = (store: string, date: string, sheet: unknown) => {
    const valid = validateCashoutBody({ sheet })!
    env.data.set(`cashout:${store}:${date}`, JSON.stringify({ v: 1, store, date, ...valid, updatedAt: `${date}T23:00:00.000Z` }))
  }
  save('CR3', '2026-11-26', { am: [{ name: 'Lee', counts: counts(300), toast: '205' }], pm: [], zReport: '' })
  save('CR2', '2026-11-20', { am: [{ name: 'Sam', counts: counts(250), toast: '' }], pm: [], zReport: '150' })
  await withGemini({ answer: 'CR3 was short $5.00 on Nov 26.' }, async sent => {
    const response = await handler.fetch(post('/api/assistant/cash', { question: 'How was CR3?', to: '2026-11-27' }), env)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { answer: 'CR3 was short $5.00 on Nov 26.', coveredDates: { from: '2026-11-20', to: '2026-11-26' } })
    const body = sent[0] as { model: string; response_format: { type: string }; messages: { role: string; content: string }[] }
    assert.equal(body.model, 'gemini-flash-latest')
    assert.equal(body.response_format.type, 'json_schema')
    assert.deepEqual(body.messages.map(m => m.role), ['system', 'user'])
    const context = JSON.parse(body.messages[1].content)
    assert(!body.messages[1].content.includes('counts'))
    const lee = context.days.find((d: { store: string }) => d.store === 'CR3').am[0]
    assert.deepEqual(lee, { cashier: 'Lee', turnIn: '$200.00', toastCash: '$205.00', difference: '-$5.00' })
    const cr2 = context.days.find((d: { store: string }) => d.store === 'CR2')
    assert.equal(cr2.am[0].toastCash, null)
    assert.equal(cr2.am[0].difference, null)
    assert.equal(cr2.zDifference, '$0.00')
    assert.deepEqual(context.totals.byCashier.Lee, { days: 1, over: 0, short: 1, even: 0, totalDifference: '-$5.00' })
  })
})

test('schedule proposals drop steps with unknown ids and blocked replies become 502', async () => {
  const env = mockEnv()
  const reply = { reply: 'Took Ana off Friday.', operations: [
    { type: 'callout', employeeId: 'e1', date: '2026-11-27', slotId: null, fromSlotId: null },
    { type: 'place', employeeId: 'ghost', slotId: 's1', fromSlotId: null, date: null },
  ] }
  await withGemini(reply, async () => {
    const response = await handler.fetch(post('/api/assistant/schedule', draft), env)
    assert.equal(response.status, 200)
    const body = await response.json() as { reply: string; operations: unknown[] }
    assert.deepEqual(body.operations, [{ type: 'callout', employeeId: 'e1', date: '2026-11-27' }])
    assert.match(body.reply, /1 step\(s\)/)
  })
  await withGemini({}, async () => {
    assert.equal((await handler.fetch(post('/api/assistant/schedule', draft), env)).status, 502)
  }, 'content_filter')
})

test('assistant calls have their own hourly budget', async () => {
  const env = mockEnv()
  await withGemini({ answer: 'ok' }, async () => {
    for (let i = 0; i < 30; i++) assert.equal((await handler.fetch(post('/api/assistant/cash', { question: 'q', to: '2026-11-27' }), env)).status, 200)
    assert.equal((await handler.fetch(post('/api/assistant/cash', { question: 'q', to: '2026-11-27' }), env)).status, 429)
  })
})
