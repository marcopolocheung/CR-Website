import { cashierTotals, formatCents, toCents } from '../../src/lib/cashout'
import type { AssistantOp, AssistantProposal, ScheduleAssistantRequest } from '../../src/lib/scheduler/assistant'
import { formatTime } from '../../src/lib/scheduler/time'
import type { CashoutDay } from './index'

// shortcut: the "latest" alias follows Google's newest Flash release; pin a versioned id if answers start to drift.
export const ASSISTANT_MODEL = 'gemini-flash-latest'
// Gemini's OpenAI-compatible endpoint: a stable request shape with no SDK in the dashboard bundle.
export const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'

const nullable = (type: string) => ({ type: [type, 'null'] })
const objectSchema = (properties: Record<string, unknown>) =>
  ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties })

/** One structured-output call. Throws on an HTTP error, a cut-off or blocked reply, or bad JSON; the route turns that into a 502. */
async function ask<T>(apiKey: string, system: string, content: string, schema: Record<string, unknown>): Promise<T> {
  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: ASSISTANT_MODEL,
      messages: [{ role: 'system', content: system }, { role: 'user', content }],
      response_format: { type: 'json_schema', json_schema: { name: 'reply', strict: true, schema } },
    }),
    signal: AbortSignal.timeout(60_000),
  })
  if (!response.ok) throw new Error(`assistant_http_${response.status}`)
  const choice = (await response.json() as { choices?: { finish_reason?: string; message?: { content?: unknown } }[] }).choices?.[0]
  if (choice?.finish_reason !== 'stop' || typeof choice.message?.content !== 'string') throw new Error(`assistant_stop_${choice?.finish_reason}`)
  return JSON.parse(choice.message.content) as T
}

// --- Cash questions (read-only) ---

const money = (cents: number | null) => (cents === null ? null : formatCents(cents))
const typed = (text: string | undefined) => (text?.trim() ? toCents(text) : null)

type Tally = { days: number; difference: number; over: number; short: number; even: number }
const tally = (): Tally => ({ days: 0, difference: 0, over: 0, short: 0, even: 0 })
function count(t: Tally, cents: number | null) {
  t.days++
  if (cents === null) return
  t.difference += cents
  if (cents > 0) t.over++
  else if (cents < 0) t.short++
  else t.even++
}
const showTally = ({ difference, ...rest }: Tally) => ({ ...rest, totalDifference: formatCents(difference) })

/** Pre-computed figures so the model reads numbers instead of doing the notebook arithmetic. */
export function cashContext(days: CashoutDay[]) {
  const stores = new Map<string, Tally>()
  const cashiers = new Map<string, Tally>()
  const rows = days.map(day => {
    const shift = (list: CashoutDay['sheet']['am']) => list.map(c => {
      const { turnIn, overShort } = cashierTotals(c)
      const name = c.name.trim() || '(no name)'
      if (!cashiers.has(name)) cashiers.set(name, tally())
      count(cashiers.get(name)!, overShort)
      return { cashier: name, turnIn: money(turnIn), toastCash: money(typed(c.toast)), difference: money(overShort) }
    })
    if (!stores.has(day.store)) stores.set(day.store, tally())
    count(stores.get(day.store)!, day.totals.zOverShort)
    return {
      store: day.store, date: day.date, am: shift(day.sheet.am), pm: shift(day.sheet.pm),
      extraMoney: money(typed(day.sheet.extraMoney)), dayTurnIn: money(day.totals.deposit),
      zReportExpected: money(typed(day.sheet.zReport)), zDifference: money(day.totals.zOverShort),
    }
  })
  return {
    days: rows,
    totals: {
      // Store tallies count the Z difference per day; cashier tallies count each drawer against its Toast cash.
      byStore: Object.fromEntries([...stores].map(([store, t]) => [store, showTally(t)])),
      byCashier: Object.fromEntries([...cashiers].map(([name, t]) => [name, showTally(t)])),
    },
  }
}

const CASH_SYSTEM = `You answer a restaurant manager's questions about their saved cash-out sheets for stores CR2 and CR3.
The sheet is a bookkeeping notebook. Each cashier drawer always keeps $100; turn-in is the drawer count minus $100.
A cashier's difference is turn-in minus the Toast cash payments entered for them. A day's Z difference is the day turn-in (AM + PM + extra money) minus the Z report expected cash. Positive means over, negative means short.
A null figure means it was left blank, so that comparison is unavailable. It is not zero.
The data only covers the dates provided (about the last 30 days); older sheets are not kept. If the question needs dates you don't have, say so.
Use the pre-computed totals rather than adding numbers yourself where they answer the question.
Report figures and dates only. Do not judge whether an amount is acceptable, accuse anyone, or invent rules or thresholds.
Answer in the language of the question (English or Spanish), in a few short sentences or a short list, and say which dates your answer covers.`

export async function answerCashQuestion(apiKey: string, question: string, days: CashoutDay[], today: string) {
  const dates = days.map(day => day.date).sort()
  const { answer } = await ask<{ answer: string }>(apiKey, CASH_SYSTEM,
    JSON.stringify({ today, question, ...cashContext(days) }), objectSchema({ answer: { type: 'string' } }))
  return { answer, coveredDates: dates.length ? { from: dates[0], to: dates.at(-1)! } : null }
}

// --- Schedule quick changes (proposal only) ---

const SCHEDULE_SYSTEM = `You turn a restaurant manager's plain-language request into proposed edits to this week's schedule draft. The draft is JSON in the user message.
Operations:
- callout: the employee can't work that date at all (sick, called out, day off). Needs employeeId and date. The app takes them off every spot that date and refills the spots.
- remove: take whoever is in slotId out of that one spot. The app refills it with someone else.
- place: put employeeId into slotId. To move someone, set fromSlotId to the spot they leave. To swap two people, use two place operations, each with fromSlotId.
Use only ids that appear in the data. Set fields an operation doesn't use to null.
The app checks qualifications, availability and staffing rules and fills gaps itself, so only use place when the manager says who should work.
If the request is ambiguous (two people match a name, unclear day or shift) or needs something these operations can't do (staff rules, hours, roles, time-off records, publishing), return no operations and say briefly what you need or can't do.
reply: one or two short sentences, in the manager's language (English or Spanish), saying what you proposed or asking your question.`

const operationSchema = objectSchema({
  type: { type: 'string', enum: ['callout', 'remove', 'place'] },
  employeeId: nullable('string'), slotId: nullable('string'), fromSlotId: nullable('string'), date: nullable('string'),
})
type RawOp = { type: AssistantOp['type']; employeeId: string | null; slotId: string | null; fromSlotId: string | null; date: string | null }

/** Keeps only steps whose ids exist in the submitted draft; the browser re-checks every rule before applying. */
export function keepKnownOps(raw: RawOp[], draft: ScheduleAssistantRequest): AssistantOp[] {
  const people = new Set(draft.employees.map(e => e.id))
  const spots = new Set(draft.slots.map(s => s.id))
  const dates = new Set(draft.slots.map(s => s.date))
  const filled = new Set(draft.assignments.map(a => a.slotId))
  return raw.flatMap((op): AssistantOp[] => {
    if (op.type === 'callout' && op.employeeId && people.has(op.employeeId) && op.date && dates.has(op.date))
      return [{ type: 'callout', employeeId: op.employeeId, date: op.date }]
    if (op.type === 'remove' && op.slotId && filled.has(op.slotId)) return [{ type: 'remove', slotId: op.slotId }]
    if (op.type === 'place' && op.slotId && spots.has(op.slotId) && op.employeeId && people.has(op.employeeId) && (!op.fromSlotId || spots.has(op.fromSlotId)))
      return [{ type: 'place', slotId: op.slotId, employeeId: op.employeeId, ...(op.fromSlotId ? { fromSlotId: op.fromSlotId } : {}) }]
    return []
  })
}

export async function proposeScheduleChanges(apiKey: string, draft: ScheduleAssistantRequest): Promise<AssistantProposal> {
  const assigned = new Map(draft.assignments.map(a => [a.slotId, a]))
  const content = JSON.stringify({
    request: draft.text,
    weekStartsSunday: draft.weekStart,
    employees: draft.employees,
    spots: draft.slots.map(s => ({ id: s.id, date: s.date, day: s.day, shift: s.period, role: s.role, label: s.label,
      time: `${formatTime(s.start)}–${formatTime(s.end)}`, required: s.required,
      employeeId: assigned.get(s.id)?.employeeId ?? null, kept: !!assigned.get(s.id)?.locked })),
  })
  const raw = await ask<{ reply: string; operations: RawOp[] }>(apiKey, SCHEDULE_SYSTEM, content,
    objectSchema({ reply: { type: 'string' }, operations: { type: 'array', items: operationSchema } }))
  const operations = keepKnownOps(raw.operations, draft)
  const dropped = raw.operations.length - operations.length
  return { reply: dropped ? `${raw.reply} (${dropped} step(s) referred to unknown people or spots and were left out.)` : raw.reply, operations }
}
