import { DEFAULT_PRIORITY, type Employee, type ScheduleAssignment, type StaffingSlot } from './types'
import { isEmployeeAvailableForSlot, isEmployeeQualified, validateSchedule } from './validator'

export type RepairInput = { employees: Employee[]; slots: StaffingSlot[]; assignments: ScheduleAssignment[] }
export type Placement = { slotId: string; employeeId: string; fromSlotId?: string }
export type AssignmentChange = { slotId: string; before?: string; after?: string; releasedKeep: boolean }
export type RepairResult = { assignments: ScheduleAssignment[]; changes: AssignmentChange[]; openRequiredSlotIds: string[]; limited: boolean; nodes: number }
export type RepairProblemCode = 'unknown' | 'keptDestination' | 'unqualified' | 'unavailable' | 'keptConflict'
export class RepairProblem extends Error {
  constructor(public code: RepairProblemCode, public detail = '') { super(detail || code) }
}

export function assignmentChanges(before: ScheduleAssignment[], after: ScheduleAssignment[]): AssignmentChange[] {
  const previous = new Map(before.map(a => [a.slotId, a]))
  const next = new Map(after.map(a => [a.slotId, a]))
  return [...new Set([...previous.keys(), ...next.keys()])].flatMap(slotId => {
    const a = previous.get(slotId), b = next.get(slotId)
    return a?.employeeId === b?.employeeId && !!a?.locked === !!b?.locked ? [] : [{
      slotId, before: a?.employeeId, after: b?.employeeId, releasedKeep: !!a?.locked && (!b?.locked || a.employeeId !== b.employeeId),
    }]
  })
}

function valid(input: RepairInput, assignments: ScheduleAssignment[]) {
  return new Set(assignments.map(a => a.slotId)).size === assignments.length &&
    validateSchedule({ ...input, assignments, requireCoverage: false }).length === 0
}

/** Never silently drop a Keep. Availability reconciliation explicitly releases affected Keeps first. */
export function retainValidAssignments(input: RepairInput): ScheduleAssignment[] {
  const kept = input.assignments.filter(a => a.locked)
  if (!valid(input, kept)) throw new RepairProblem('keptConflict')
  const retained = [...kept]
  for (const a of input.assignments.filter(a => !a.locked && a.employeeId)) {
    if (valid(input, [...retained, a])) retained.push({ ...a })
  }
  return retained
}

export function preparePlacement(input: RepairInput, placement: Placement): ScheduleAssignment[] {
  const { slotId, employeeId, fromSlotId } = placement
  const slot = input.slots.find(s => s.id === slotId)
  const employee = input.employees.find(e => e.id === employeeId)
  if (!slot || !employee || (fromSlotId && !input.assignments.some(a => a.slotId === fromSlotId && a.employeeId === employeeId))) throw new RepairProblem('unknown')
  if (input.assignments.some(a => a.slotId === slotId && a.employeeId === employeeId)) return input.assignments
  if (input.assignments.find(a => a.slotId === slotId)?.locked && fromSlotId !== slotId) throw new RepairProblem('keptDestination')
  if (!isEmployeeQualified(employee, slot)) throw new RepairProblem('unqualified')
  if (!employee.active || !isEmployeeAvailableForSlot(employee, slot)) throw new RepairProblem('unavailable')
  return retainValidAssignments({ ...input, assignments: [
    { slotId, employeeId, locked: true },
    ...input.assignments.filter(a => a.slotId !== slotId && a.slotId !== fromSlotId),
  ] })
}

/** Only the approved employee/date range may invalidate a Keep. Other conflicts remain actionable. */
export function reconcileAvailability(input: RepairInput, employeeId: string, startDate: string, endDate: string) {
  const employee = input.employees.find(e => e.id === employeeId)
  return input.assignments.filter(a => {
    const slot = input.slots.find(s => s.id === a.slotId)
    return a.employeeId !== employeeId || !slot?.date || slot.date < startDate || slot.date > endDate ||
      (!!employee && isEmployeeAvailableForSlot(employee, slot))
  })
}

export function describeRepair(input: RepairInput, assignments: ScheduleAssignment[], limited = false, nodes = 0): RepairResult {
  return { assignments, changes: assignmentChanges(input.assignments, assignments),
    openRequiredSlotIds: input.slots.filter(s => s.required && !assignments.some(a => a.slotId === s.id)).map(s => s.id), limited, nodes }
}

/** Deterministic bounded repair: required coverage, minimal movement, then balanced hours. */
export async function repairSchedule(input: RepairInput, options: { signal?: AbortSignal; maxNodes?: number; maxMs?: number } = {}): Promise<RepairResult> {
  const { signal, maxNodes = 6000, maxMs = 1000 } = options
  const started = Date.now()
  const abort = () => { if (signal?.aborted) throw new DOMException('Adjustment cancelled', 'AbortError') }
  abort()
  const base = retainValidAssignments(input)
  const slotsById = new Map(input.slots.map(s => [s.id, s]))
  const reference = new Map(input.assignments.map(a => [a.slotId, a.employeeId]))
  const fixed = base.filter(a => a.locked)
  const fixedIds = new Set(fixed.map(a => a.slotId))
  const candidates = new Map(input.slots.map(s => [s.id, input.employees.filter(e => e.active && isEmployeeQualified(e, s) && isEmployeeAvailableForSlot(e, s))]))
  const remaining = input.slots.filter(s => s.required && !fixedIds.has(s.id)).sort((a, b) => candidates.get(a.id)!.length - candidates.get(b.id)!.length || a.id.localeCompare(b.id))
  const optional = base.filter(a => !a.locked && !slotsById.get(a.slotId)?.required)
  function withOptional(list: ScheduleAssignment[]) {
    const result = [...list]
    for (const a of optional) if (valid(input, [...result, a])) result.push(a)
    return result
  }
  function cost(list: ScheduleAssignment[]) {
    const bySlot = new Map(list.map(a => [a.slotId, a.employeeId]))
    const hours = new Map<string, number>()
    for (const a of list) { const s = slotsById.get(a.slotId)!; hours.set(a.employeeId, (hours.get(a.employeeId) ?? 0) + (s.end - s.start) / 60) }
    return [input.slots.filter(s => s.required && !bySlot.has(s.id)).length,
      input.slots.filter(s => bySlot.get(s.id) !== reference.get(s.id)).length,
      [...hours.values()].reduce((n, h) => n + h * h, 0)]
  }
  function better(a: number[], b: number[]) { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i]; return false }
  let best = base, bestCost = cost(base), nodes = 0, limited = false
  // A covered week is already the closest possible repair; do not rebalance it.
  if (bestCost[0] === 0 && bestCost[1] === 0) return describeRepair(input, base)
  async function search(index: number, list: ScheduleAssignment[], changed: number, skipped: number) {
    abort()
    if (nodes >= maxNodes || Date.now() - started >= maxMs) { limited = true; return }
    if (++nodes % 64 === 0) { await new Promise(resolve => setTimeout(resolve, 0)); abort() }
    if (skipped > bestCost[0] || (bestCost[0] === 0 && changed > bestCost[1])) return
    const complete = withOptional(list), score = cost(complete)
    if (better(score, bestCost)) { best = complete; bestCost = score }
    if (index === remaining.length) return
    const slot = remaining[index]
    const preference = (e: Employee) => e.preferences?.filter(p => p.day === slot.day && p.period === slot.period).reduce((n, p) => n + p.weight, 0) ?? 0
    const choices = [...candidates.get(slot.id)!].sort((a, b) =>
      Number(b.id === reference.get(slot.id)) - Number(a.id === reference.get(slot.id)) ||
      (a.priority ?? DEFAULT_PRIORITY) - (b.priority ?? DEFAULT_PRIORITY) || preference(b) - preference(a) ||
      list.filter(x => x.employeeId === a.id).length - list.filter(x => x.employeeId === b.id).length || a.id.localeCompare(b.id))
    for (const employee of choices) {
      const a = { slotId: slot.id, employeeId: employee.id }
      if (valid(input, [...list, a])) await search(index + 1, [...list, a], changed + Number(employee.id !== reference.get(slot.id)), skipped)
      if (limited) return
    }
    await search(index + 1, list, changed + Number(reference.has(slot.id)), skipped + 1)
  }
  await search(0, fixed, 0, 0)
  abort()
  const locks = Object.fromEntries(fixed.map(a => [a.slotId, a.employeeId]))
  if (!valid(input, best) || validateSchedule({ ...input, assignments: best, lockedAssignments: locks, requireCoverage: false }).length) throw new RepairProblem('keptConflict')
  return describeRepair(input, best, limited, nodes)
}
