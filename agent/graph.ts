import { Annotation, END, START, StateGraph, interrupt, type BaseCheckpointSaver } from '@langchain/langgraph'
import { expandTemplate } from '../src/lib/scheduler/data'
import { generateSchedule, SCHEDULE_STRATEGIES, type ScheduleStrategy } from '../src/lib/scheduler/solver'
import { calculateScheduleStats, validateSchedule } from '../src/lib/scheduler/validator'
import { withApprovedRequests } from '../src/lib/scheduler/requests'
import { requestData, type AgentContext, type AgentEvent, type AgentMetrics, type AgentRunView } from '../src/lib/scheduler/agent-contracts'
import type { GenerateScheduleResult, ScheduleAssignment } from '../src/lib/scheduler/types'

type Candidate = { assignments: ScheduleAssignment[]; metrics: AgentMetrics; strategy: ScheduleStrategy }
export type Plan = { strategies: ScheduleStrategy[]; explanation: string }
export type Planner = (goal: ScheduleStrategy, instructions: string, signal?: AbortSignal) => Promise<Plan>
const State = Annotation.Root({
  context: Annotation<AgentContext>(), goal: Annotation<ScheduleStrategy>(), instructions: Annotation<string>(),
  status: Annotation<AgentRunView['status']>(), summary: Annotation<string>(), problems: Annotation<string[]>(),
  events: Annotation<AgentEvent[]>({ reducer: (before, next) => before.concat(next), default: () => [] }),
  strategies: Annotation<ScheduleStrategy[]>(), attempt: Annotation<number>(),
  candidate: Annotation<GenerateScheduleResult | null>(), best: Annotation<Candidate | null>(),
})
export type AgentState = typeof State.State

function inputs(context: AgentContext) {
  return { employees: withApprovedRequests(context.employees, requestData(context), context.weekStart),
    slots: expandTemplate(context.template, context.weekStart),
    lockedAssignments: Object.fromEntries(context.assignments.filter(item => item.locked).map(item => [item.slotId, item.employeeId])) }
}
export function proposalProblems(context: AgentContext, assignments: ScheduleAssignment[]) {
  const duplicate = new Set(assignments.map(item => item.slotId)).size !== assignments.length
  return [...(duplicate ? ['A spot was assigned more than once.'] : []),
    ...validateSchedule({ ...inputs(context), assignments }).map(item => item.message)]
}
function metrics(context: AgentContext, assignments: ScheduleAssignment[]): AgentMetrics {
  const { employees, slots } = inputs(context)
  const stats = calculateScheduleStats(employees, slots, assignments).filter(item => employees.find(e => e.id === item.employeeId)?.active)
  const hours = stats.map(item => item.hours)
  const occupied = new Set(assignments.map(item => item.slotId))
  const previous = new Map(context.assignments.map(item => [item.slotId, item.employeeId]))
  let doubles = 0
  for (const person of employees) {
    const personSlots = slots.filter(slot => assignments.some(a => a.employeeId === person.id && a.slotId === slot.id))
    for (const day of new Set(personSlots.map(slot => slot.day)))
      if (new Set(personSlots.filter(slot => slot.day === day).map(slot => slot.period)).size === 2) doubles++
  }
  return { filled: slots.filter(slot => slot.required && occupied.has(slot.id)).length,
    required: slots.filter(slot => slot.required).length, doubles,
    changed: slots.filter(slot => previous.get(slot.id) !== assignments.find(a => a.slotId === slot.id)?.employeeId).length,
    hourSpread: hours.length ? Math.max(...hours) - Math.min(...hours) : 0, totalHours: hours.reduce((a, b) => a + b, 0) }
}
function rank(goal: ScheduleStrategy, value: AgentMetrics) {
  if (goal === 'fewestDoubles') return [value.doubles, value.hourSpread, value.changed]
  if (goal === 'similarWeek') return [value.changed, value.doubles, value.hourSpread]
  if (goal === 'fairHours') return [value.hourSpread, value.doubles, value.changed]
  return [value.doubles * 20 + value.hourSpread + value.changed / 4, value.changed]
}
function better(goal: ScheduleStrategy, a: AgentMetrics, b: AgentMetrics) {
  const left = rank(goal, a), right = rank(goal, b)
  for (let i = 0; i < left.length; i++) if (left[i] !== right[i]) return left[i] < right[i]
  return false
}

/** Only generation and validation tools: no publish, roster-write, shell, or arbitrary HTTP tool. */
export function buildSchedulingGraph(checkpointer: BaseCheckpointSaver, options: {
  planner?: Planner; solve?: typeof generateSchedule; maxNodes?: number
} = {}) {
  return new StateGraph(State)
    .addNode('inspect', (state) => {
      const problems: string[] = []
      if (state.context.requests.phase !== 'ready') problems.push('Reload time-off and availability requests before making a proposal.')
      const data = requestData(state.context)
      const end = new Date(`${state.context.weekStart}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + 6)
      if (data?.requests.some(item => item.status === 'approved' && item.startDate <= end.toISOString().slice(0, 10)
        && item.endDate >= state.context.weekStart && !state.context.employees.some(e => e.id === item.employee.sourceEmployeeId)))
        problems.push('An approved request refers to someone missing from this crew. Review the request before continuing.')
      const locked = state.context.assignments.filter(item => item.locked)
      problems.push(...validateSchedule({ ...inputs(state.context), assignments: locked, requireCoverage: false }).map(item => item.message))
      if (!inputs(state.context).slots.some(slot => slot.required)) problems.push('Add required staffing spots before making a proposal.')
      return { problems, status: problems.length ? 'blocked' as const : 'running' as const,
        summary: problems.length ? 'The schedule needs your attention before I can continue.' : '',
        attempt: 0, best: null, candidate: null,
        events: [{ step: 'inspect', message: problems.length ? 'Stopped for unresolved inputs or locked assignments.' : 'Checked staffing rules, approved requests, and locked assignments.' }] }
    })
    .addNode('plan', async (state) => {
      let plan: Plan = { strategies: [state.goal, ...SCHEDULE_STRATEGIES.filter(item => item !== state.goal)],
        explanation: 'Compare four scheduling strategies against your selected goal.' }
      if (options.planner) {
        try {
          const suggested = await options.planner(state.goal, state.instructions, AbortSignal.timeout(15000))
          // The planner can order known tools; it cannot invent tools, relax rules, or increase the budget.
          plan = { strategies: [...new Set(suggested.strategies.filter(item => SCHEDULE_STRATEGIES.includes(item)))], explanation: suggested.explanation }
          plan.strategies = [...new Set([...plan.strategies, state.goal, ...SCHEDULE_STRATEGIES])].slice(0, 4)
        } catch {
          plan.explanation = 'The planning model was unavailable. Continuing with the selected goal and built-in strategies.'
        }
      } else if (state.instructions.trim()) plan.explanation += ' Free-text instructions require a configured planning model; this run uses the selected goal.'
      return { strategies: plan.strategies, events: [{ step: 'plan', message: plan.explanation }] }
    })
    .addNode('solve', state => {
      const strategy = state.strategies[state.attempt]
      const candidate = (options.solve ?? generateSchedule)({ employees: inputs(state.context).employees,
        template: state.context.template, weekStart: state.context.weekStart }, {
        strategy, existingAssignments: state.context.assignments.filter(item => item.locked),
        referenceAssignments: state.context.assignments, maxNodes: options.maxNodes ?? 15000,
      })
      return { candidate, attempt: state.attempt + 1,
        events: [{ step: 'solve', message: `Attempt ${state.attempt + 1} of ${state.strategies.length}: ${strategy}.` }] }
    })
    .addNode('verify', state => {
      const result = state.candidate!
      const problems = proposalProblems(state.context, result.assignments)
      const valid = result.status !== 'INFEASIBLE' && problems.length === 0
      const candidate = valid ? { assignments: result.assignments, metrics: metrics(state.context, result.assignments), strategy: state.strategies[state.attempt - 1] } : null
      const best = candidate && (!state.best || better(state.goal, candidate.metrics, state.best.metrics)) ? candidate : state.best
      const diagnostics = [...new Set([...result.diagnostics.map(item => item.message), ...problems])].slice(0, 20)
      return { best, problems: best ? [] : diagnostics,
        events: [{ step: 'verify', message: valid ? 'Independent validation passed. Compared coverage, doubles, hours, and changed assignments.' : `Candidate rejected. ${diagnostics[0] ?? 'No valid schedule found within the search budget.'}` }] }
    })
    .addNode('prepare_review', state => ({
      status: state.best ? 'review' as const : 'blocked' as const,
      summary: state.best
        ? `${state.best.metrics.filled}/${state.best.metrics.required} required spots covered; ${state.best.metrics.doubles} doubles; ${state.best.metrics.changed} changed spots. Best valid proposal among ${state.attempt} attempts. Review it before using it.`
        : 'No valid proposal found within the search budget. Review the listed conflicts; the crew and rules were preserved.',
      events: [{ step: 'review', message: state.best ? 'Saved proposal for manager review. Publishing is a separate step.' : 'Stopped after the attempt limit. Manager input is needed.' }],
    }))
    .addNode('review', state => {
      const decision = interrupt({ kind: 'schedule-proposal', summary: state.summary }) as { accept: boolean }
      return { status: decision.accept === true ? 'accepted' as const : 'rejected' as const,
        events: [{ step: 'decision', message: decision.accept === true ? 'Manager accepted the proposal as a draft.' : 'Manager dismissed the proposal.' }] }
    })
    .addEdge(START, 'inspect')
    .addConditionalEdges('inspect', state => state.status === 'blocked' ? END : 'plan', ['plan', END])
    .addEdge('plan', 'solve').addEdge('solve', 'verify')
    .addConditionalEdges('verify', state => state.attempt < state.strategies.length ? 'solve' : 'prepare_review', ['solve', 'prepare_review'])
    .addConditionalEdges('prepare_review', state => state.best ? 'review' : END, ['review', END])
    .addEdge('review', END).compile({ checkpointer })
}

export function runView(id: string, state: AgentState): AgentRunView {
  return { id, status: state.status, stationId: state.context.stationId, weekStart: state.context.weekStart,
    goal: state.goal, summary: state.summary, events: state.events, problems: state.problems,
    proposal: state.best ? { assignments: state.best.assignments, metrics: state.best.metrics } : null }
}
