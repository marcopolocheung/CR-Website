import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MemorySaver, Command } from '@langchain/langgraph'
import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite'
import { agentContextSchema, contextFingerprint } from '../src/lib/scheduler/agent-contracts'
import { expandTemplate } from '../src/lib/scheduler/data'
import { generateSchedule } from '../src/lib/scheduler/solver'
import { buildSchedulingGraph, proposalProblems, type AgentState } from './graph'
import { fixtureContext, approvedTimeOff } from './fixtures'

const config = { configurable: { thread_id: 'test-run' }, recursionLimit: 24 }
test('context rejects impossible dates, duplicate assignments, and unrecognized authority fields', () => {
  const context = fixtureContext()
  assert.equal(agentContextSchema.safeParse({ ...context, weekStart: '2026-02-30' }).success, false)
  assert.equal(agentContextSchema.safeParse({ ...context, weekStart: '2026-11-09' }).success, false)
  assert.equal(agentContextSchema.safeParse({ ...context, managerToken: 'never-store' }).success, false)
  const assignment = { slotId: 'same', employeeId: 'alex' }
  assert.equal(agentContextSchema.safeParse({ ...context, assignments: [assignment, assignment] }).success, false)
  context.employees[0].maxHoursPerWeek = undefined
  assert.equal(contextFingerprint(context), contextFingerprint(JSON.parse(JSON.stringify(context))))
})
test('loop covers required spots, honors approved leave and locks, and pauses for review', async () => {
  const context = fixtureContext()
  const slots = expandTemplate(context.template, context.weekStart)
  context.assignments = [{ slotId: slots[2].id, employeeId: 'alex', locked: true }]
  context.requests = { phase: 'ready', revision: 1, data: { version: 1, stationId: context.stationId, requests: [approvedTimeOff()] } }
  const before = JSON.stringify(context)
  const graph = buildSchedulingGraph(new MemorySaver())
  await graph.invoke({ context, goal: 'balanced', instructions: '' }, config)
  const { values, tasks } = await graph.getState(config)
  assert.equal(values.status, 'review')
  assert.equal(values.attempt, 4)
  assert.ok(tasks.some(item => item.interrupts?.length))
  assert.deepEqual(proposalProblems(context, values.best.assignments), [])
  const best = (values as AgentState).best!
  assert.ok(best.assignments.some(a => a.slotId === slots[2].id && a.employeeId === 'alex'))
  assert.ok(!best.assignments.some(a => a.slotId.startsWith('sunday') && a.employeeId === 'alex'))
  assert.equal(JSON.stringify(context), before)
  await graph.invoke(new Command({ resume: { accept: true } }), config)
  assert.equal((await graph.getState(config)).values.status, 'accepted')
})
test('unconfirmed requests and conflicting locks stop before generation', async () => {
  for (const condition of ['requests', 'lock']) {
    const context = fixtureContext()
    if (condition === 'requests') context.requests.phase = 'failed'
    else context.assignments = [{ slotId: 'unknown-spot', employeeId: 'alex', locked: true }]
    let called = false
    const graph = buildSchedulingGraph(new MemorySaver(), { solve: () => { called = true; throw new Error('must not run') } })
    await graph.invoke({ context, goal: 'balanced', instructions: '' }, config)
    assert.equal((await graph.getState(config)).values.status, 'blocked')
    assert.equal(called, false)
  }
})
test('an unmatched approved request blocks instead of silently losing time off', async () => {
  const context = fixtureContext()
  context.requests.data = { version: 1, stationId: context.stationId, requests: [approvedTimeOff('missing-person')] }
  const graph = buildSchedulingGraph(new MemorySaver())
  await graph.invoke({ context, goal: 'balanced', instructions: '' }, config)
  assert.equal((await graph.getState(config)).values.status, 'blocked')
})
test('impossible coverage exhausts its budget and preserves rules and crew', async () => {
  const context = fixtureContext(); context.employees = []
  const before = JSON.stringify(context)
  const graph = buildSchedulingGraph(new MemorySaver())
  await graph.invoke({ context, goal: 'balanced', instructions: '' }, config)
  const { values } = await graph.getState(config)
  assert.equal(values.status, 'blocked'); assert.equal(values.attempt, 4); assert.equal(values.best, null)
  assert.ok(values.problems.length); assert.equal(JSON.stringify(context), before)
})
test('independent verification rejects a solver result that claims success with invalid assignments', async () => {
  const context = fixtureContext()
  let calls = 0
  const graph = buildSchedulingGraph(new MemorySaver(), { solve: (input, options) => ++calls === 1
    ? { status: 'FEASIBLE', assignments: [{ slotId: 'made-up', employeeId: 'made-up' }], objectiveScore: 0, diagnostics: [] }
    : generateSchedule(input, options) })
  await graph.invoke({ context, goal: 'balanced', instructions: '' }, config)
  const { values } = await graph.getState(config)
  assert.equal(values.status, 'review')
  assert.match((values as AgentState).events.find(e => e.step === 'verify')!.message, /rejected/)
  assert.deepEqual(proposalProblems(context, values.best!.assignments), [])
})
test('the loop compares observed results and selects fewer doubles', async () => {
  const context = fixtureContext()
  let calls = 0
  const slots = expandTemplate(context.template, context.weekStart)
  const graph = buildSchedulingGraph(new MemorySaver(), { solve: () => {
    const firstAttempt = calls++ === 0
    return { status: 'FEASIBLE', objectiveScore: 0, diagnostics: [],
      assignments: slots.map(slot => ({ slotId: slot.id, employeeId: firstAttempt || slot.period === 'AM' ? 'alex' : 'blair' })),
    }
  } })
  await graph.invoke({ context, goal: 'fewestDoubles', instructions: '' }, config)
  assert.equal((await graph.getState(config)).values.best?.metrics.doubles, 0)
})
test('planner outages fall back to bounded tools and duplicate output cannot increase the budget', async () => {
  for (const planner of [async () => { throw new Error('provider unavailable') },
    async () => ({ strategies: Array(100).fill('balanced'), explanation: 'Try balance.' })]) {
    const graph = buildSchedulingGraph(new MemorySaver(), { planner })
    await graph.invoke({ context: fixtureContext(), goal: 'balanced', instructions: '' }, config)
    const { values } = await graph.getState(config)
    assert.equal(values.status, 'review'); assert.equal(values.attempt, 4)
  }
})
test('SQLite checkpoints survive process reconstruction and resume review without regenerating', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'cr-agent-'))
  const path = join(directory, 'state.sqlite')
  let saver = SqliteSaver.fromConnString(path)
  try {
    let graph = buildSchedulingGraph(saver)
    await graph.invoke({ context: fixtureContext(), goal: 'balanced', instructions: '' }, config)
    const original = (await graph.getState(config)).values.best
    saver.db.close(); saver = SqliteSaver.fromConnString(path)
    graph = buildSchedulingGraph(saver, { solve: () => { throw new Error('must not regenerate') } })
    assert.equal((await graph.getState(config)).values.status, 'review')
    await graph.invoke(new Command({ resume: { accept: false } }), config)
    const { values } = await graph.getState(config)
    assert.equal(values.status, 'rejected'); assert.deepEqual(values.best, original)
  } finally { saver.db.close(); rmSync(directory, { recursive: true, force: true }) }
})
