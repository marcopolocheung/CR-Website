import { z } from 'zod'
import { canonicalJson } from '../internal-tools/json'
import { businessDate, isStationId } from '../internal-tools/contracts'
import { validRequestData, type RequestData } from './requests'
import { DAYS, PERIODS } from './types'

const date = z.string().refine(value => businessDate(value) !== null, 'Choose a real date.')
const id = z.string().min(1).max(128)
const role = z.string().regex(/^[a-z0-9-]{1,40}$/)
const range = z.object({ start: z.number().int().min(0).max(1439), end: z.number().int().max(2880) })
  .strict().refine(value => value.end > value.start && value.end <= value.start + 1440)
const employee = z.object({
  id, name: z.string().min(1).max(120), roles: z.array(role).max(40),
  recurringAvailability: z.partialRecord(z.enum(DAYS), z.array(range).max(8)),
  availabilityOverrides: z.array(z.object({ date, ranges: z.array(range).max(8) }).strict()).max(366).optional(),
  maxDaysPerWeek: z.number().int().min(1).max(7).optional(),
  maxShiftsPerWeek: z.number().int().min(1).max(21).optional(),
  maxHoursPerWeek: z.number().min(1).max(168).optional(),
  allowDoubles: z.boolean(), maxDoublesPerWeek: z.number().int().min(0).max(7).optional(),
  preferredDaysPerWeek: z.number().int().min(0).max(7).optional(),
  preferredHoursPerWeek: z.number().min(0).max(168).optional(),
  preferences: z.array(z.object({ day: z.enum(DAYS), period: z.enum(PERIODS), weight: z.number().min(-100).max(100) }).strict()).max(14).optional(),
  shiftRoles: z.array(z.object({ day: z.enum(DAYS), period: z.enum(PERIODS), role }).strict()).max(14).optional(),
  incompatibleEmployeeIds: z.array(id).max(100).optional(), active: z.boolean(), newHire: z.boolean().optional(),
  suspendedFrom: date.optional(), suspendedUntil: date.optional(), priority: z.number().int().min(1).max(5).optional(),
}).strict()
const slot = z.object({ period: z.enum(PERIODS), role, label: z.string().min(1).max(60),
  start: z.number().int().min(0).max(1439), end: z.number().int().max(2880), required: z.boolean(),
}).strict().refine(value => value.end > value.start && value.end <= value.start + 1440)
export const assignmentSchema = z.object({ slotId: id, employeeId: id, locked: z.boolean().optional() }).strict()
export const goalSchema = z.enum(['balanced', 'fewestDoubles', 'similarWeek', 'fairHours'])

/** A snapshot of the manager's draft, not permission to publish or edit staffing rules. */
export const agentContextSchema = z.object({
  stationId: z.string().refine(isStationId),
  weekStart: date.refine(value => new Date(`${value}T00:00:00Z`).getUTCDay() === 0, 'Choose a Sunday.'),
  employees: z.array(employee).max(100), template: z.record(z.enum(DAYS), z.array(slot).max(20)),
  assignments: z.array(assignmentSchema).max(140),
  requests: z.object({ phase: z.enum(['ready', 'loading', 'unconfigured', 'failed', 'uncertain']),
    revision: z.number().int().min(0), data: z.unknown().nullable(),
  }).strict(),
}).strict().superRefine((value, ctx) => {
  if (new Set(value.employees.map(item => item.id)).size !== value.employees.length)
    ctx.addIssue({ code: 'custom', message: 'Employee IDs must be unique.' })
  if (new Set(value.assignments.map(item => item.slotId)).size !== value.assignments.length)
    ctx.addIssue({ code: 'custom', message: 'Each spot can have only one assignment.' })
  if (value.requests.data !== null && !validRequestData(value.requests.data, value.stationId as Parameters<typeof validRequestData>[1]))
    ctx.addIssue({ code: 'custom', message: 'Requests do not match this station.' })
})
export type AgentContext = z.infer<typeof agentContextSchema>
export function requestData(context: AgentContext): RequestData | null { return context.requests.data as RequestData | null }
// Optional fields in editor objects can be undefined; compare the exact JSON sent over HTTP.
export function contextFingerprint(context: AgentContext) { return canonicalJson(JSON.parse(JSON.stringify(context))) }

export type AgentMetrics = { filled: number; required: number; doubles: number; changed: number; hourSpread: number; totalHours: number }
export type AgentEvent = { step: string; message: string }
export type AgentRunView = {
  id: string
  status: 'running' | 'review' | 'accepted' | 'rejected' | 'blocked' | 'failed'
  stationId: string; weekStart: string; goal: z.infer<typeof goalSchema>
  summary: string; events: AgentEvent[]; problems: string[]
  proposal: { assignments: z.infer<typeof assignmentSchema>[]; metrics: AgentMetrics } | null
}
