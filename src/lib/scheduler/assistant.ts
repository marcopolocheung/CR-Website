import { z } from 'zod'
import { businessDate } from '../internal-tools/contracts'
import { exclusionKey, preparePlacement, prepareRemoval, RepairProblem, type RepairInput } from './repair'
import { DAYS, PERIODS, type ScheduleAssignment } from './types'

/** What the assistant may propose. Each step goes through the same repair checks as a manual edit. */
export type AssistantOp =
  | { type: 'callout'; employeeId: string; date: string }
  | { type: 'remove'; slotId: string }
  | { type: 'place'; slotId: string; employeeId: string; fromSlotId?: string }
export type AssistantProposal = { reply: string; operations: AssistantOp[] }

const id = z.string().min(1).max(128)
const date = z.string().refine(value => businessDate(value) !== null)
/** The draft on screen, as sent to the Worker. Caps match agent-contracts. */
export const scheduleAssistantRequestSchema = z.object({
  text: z.string().trim().min(1).max(500),
  weekStart: date,
  employees: z.array(z.object({ id, name: z.string().min(1).max(120), roles: z.array(z.string().max(40)).max(40), active: z.boolean() })).max(100),
  slots: z.array(z.object({ id, day: z.enum(DAYS), period: z.enum(PERIODS), role: z.string().max(40), label: z.string().max(60),
    start: z.number().int().min(0).max(1439), end: z.number().int().max(2880), required: z.boolean(), date })).max(200),
  assignments: z.array(z.object({ slotId: id, employeeId: id, locked: z.boolean().optional() })).max(200),
})
export type ScheduleAssistantRequest = z.infer<typeof scheduleAssistantRequestSchema>

/** A failed step, numbered from 1 so the UI can say which one. */
export class AssistantStepProblem extends RepairProblem {
  constructor(public step: number, public problem: RepairProblem) { super(problem.code, problem.detail) }
}

/** Folds the proposal into one draft edit for useDraftAdjustment; any failing step rejects the whole proposal. */
export function prepareAssistantOps(input: RepairInput, ops: readonly AssistantOp[]): { assignments: ScheduleAssignment[]; exclusions: string[] } {
  let assignments = input.assignments
  let exclusions = [...(input.exclusions ?? [])]
  ops.forEach((op, index) => {
    const current = { ...input, assignments, exclusions }
    try {
      if (op.type === 'place') assignments = preparePlacement(current, op)
      else if (op.type === 'remove') ({ assignments, exclusions } = prepareRemoval(current, op.slotId))
      else {
        const day = input.slots.filter(slot => slot.date === op.date)
        if (!day.length || !input.employees.some(e => e.id === op.employeeId)) throw new RepairProblem('unknown')
        // Every spot that date, so the refill can't move them into the other shift.
        const keys = day.map(slot => exclusionKey(slot, op.employeeId))
        exclusions = [...exclusions.filter(key => !keys.includes(key)), ...keys]
        const ids = new Set(day.map(slot => slot.id))
        assignments = assignments.filter(a => !(a.employeeId === op.employeeId && ids.has(a.slotId)))
      }
    } catch (error) {
      throw error instanceof RepairProblem ? new AssistantStepProblem(index + 1, error) : error
    }
  })
  return { assignments, exclusions }
}
