import { DAYS, type Employee, type ScheduleAssignment, type StaffingSlot } from '../../lib/scheduler/types'
import { isEmployeeAvailableForSlot, isEmployeeQualified, validateSchedule } from '../../lib/scheduler/validator'

export type BoardState = { employees: Employee[]; assignments: ScheduleAssignment[] }
export const weekDays = [...DAYS.slice(1), DAYS[0]]
export const dates = weekDays.map((_, i) => `2026-11-${16 + i}`)
export const slots: StaffingSlot[] = weekDays.flatMap((day, i) => (['AM', 'PM'] as const).flatMap(period => ['server', 'cashier'].map(role => ({
  id: `${i}-${period}-${role}`, day, date: dates[i], period, role, label: role === 'server' ? 'Server' : 'Cashier', required: true,
  start: period === 'AM' ? 570 : 960, end: period === 'AM' ? 960 : 1380,
}))))
export function sample(): BoardState {
  const names = ['Jesus', 'Ana', 'Ben', 'Diana', 'Eli', 'Farah', 'Gabe', 'Hana', 'Ivan', 'Jules']
  const employees: Employee[] = names.map((name, i) => ({ id: `sample-${i}`, name, roles: i < 6 ? ['server', 'cashier'] : [i % 2 ? 'cashier' : 'server'],
    recurringAvailability: Object.fromEntries(weekDays.map(day => [day, [{ start: i === 8 ? 960 : 570, end: i === 9 ? 960 : 1380 }]])),
    active: true, allowDoubles: false, maxHoursPerWeek: 32, maxDaysPerWeek: 4,
  }))
  const assignments = slots.map((slot, i) => ({ slotId: slot.id, employeeId: employees[(Math.floor(i / 4) * 2 + i % 4) % 8].id }))
  return { employees, assignments }
}
export function violations(state: BoardState) { return validateSchedule({ ...state, slots }) }
export function validAddition(state: BoardState, assignments: ScheduleAssignment[], assignment: ScheduleAssignment) {
  return validateSchedule({ employees: state.employees, slots, assignments: [...assignments, assignment], requireCoverage: false }).length === 0
}
// Kept decisions take precedence. Retain every other valid existing assignment before repair.
export function clean(state: BoardState): BoardState {
  const assignments: ScheduleAssignment[] = []
  for (const assignment of [...state.assignments].sort((a, b) => Number(!!b.locked) - Number(!!a.locked))) {
    if (validAddition(state, assignments, assignment)) assignments.push(assignment)
  }
  return { ...state, assignments }
}
export function place(state: BoardState, slotId: string, employeeId: string, fromSlotId?: string): BoardState {
  const slot = slots.find(s => s.id === slotId)!
  const employee = state.employees.find(e => e.id === employeeId)!
  if (state.assignments.find(a => a.slotId === slotId)?.locked && fromSlotId !== slotId) throw new Error('Release Keep on the destination before replacing it.')
  if (!isEmployeeQualified(employee, slot)) throw new Error(`${employee.name} is not trained for ${slot.label}.`)
  if (!isEmployeeAvailableForSlot(employee, slot)) throw new Error(`${employee.name} is unavailable for this shift.`)
  const remaining = state.assignments.filter(a => a.slotId !== slotId && a.slotId !== fromSlotId)
  const assignment = { slotId, employeeId, locked: true }
  if (!validAddition(state, remaining.filter(a => a.locked), assignment)) throw new Error('This placement conflicts with another Keep or the employee’s weekly limits. Release that Keep first.')
  return clean({ ...state, assignments: [...remaining, assignment] })
}
export type RepairResult = { state: BoardState; limited: boolean; nodes: number }
export async function repair(state: BoardState, maxNodes = 6000): Promise<RepairResult> {
  const base = clean(state)
  const reference = new Map(state.assignments.map(a => [a.slotId, a.employeeId]))
  const fixed = base.assignments.filter(a => a.locked)
  const candidates = new Map(slots.map(slot => [slot.id, state.employees.filter(e => e.active && isEmployeeQualified(e, slot) && isEmployeeAvailableForSlot(e, slot))]))
  const remaining = slots.filter(s => !fixed.some(a => a.slotId === s.id)).sort((a, b) => candidates.get(a.id)!.length - candidates.get(b.id)!.length || a.id.localeCompare(b.id))
  let best = base.assignments, bestCost = cost(best), nodes = 0, limited = false
  function cost(list: ScheduleAssignment[]) {
    const bySlot = new Map(list.map(a => [a.slotId, a.employeeId]))
    const changed = slots.filter(s => bySlot.get(s.id) !== reference.get(s.id)).length
    const hours = state.employees.map(e => list.filter(a => a.employeeId === e.id).reduce((n, a) => { const s = slots.find(s => s.id === a.slotId)!; return n + (s.end - s.start) / 60 }, 0))
    return [slots.length - list.length, changed, hours.reduce((n, h) => n + h * h, 0)]
  }
  function better(a: number[], b: number[]) { for (let i = 0; i < a.length; i++) { if (a[i] !== b[i]) return a[i] < b[i] } return false }
  async function search(index: number, list: ScheduleAssignment[], changed: number) {
    if (nodes >= maxNodes) { limited = true; return }
    nodes++
    if (nodes % 200 === 0) await new Promise(resolve => setTimeout(resolve, 0))
    const missingAlready = index + fixed.length - list.length
    if (missingAlready > bestCost[0] || (bestCost[0] === 0 && changed > bestCost[1])) return
    const currentCost = cost(list)
    if (better(currentCost, bestCost)) { best = [...list]; bestCost = currentCost }
    if (index === remaining.length) return
    const slot = remaining[index]
    const choices = [...candidates.get(slot.id)!].sort((a, b) => Number(b.id === reference.get(slot.id)) - Number(a.id === reference.get(slot.id)) || list.filter(x => x.employeeId === a.id).length - list.filter(x => x.employeeId === b.id).length || a.id.localeCompare(b.id))
    for (const employee of choices) {
      const assignment = { slotId: slot.id, employeeId: employee.id }
      if (validAddition(state, list, assignment)) await search(index + 1, [...list, assignment], changed + Number(employee.id !== reference.get(slot.id)))
      if (limited) return
    }
    await search(index + 1, list, changed + Number(reference.has(slot.id)))
  }
  await search(0, fixed, 0)
  return { state: { ...state, assignments: best }, limited, nodes }
}
export function editAvailability(state: BoardState, id: string, date: string, ranges: { start: number; end: number }[], recurring: boolean): BoardState {
  const day = weekDays[dates.indexOf(date)]
  const employees = state.employees.map(e => e.id !== id ? e : recurring
    ? { ...e, recurringAvailability: { ...e.recurringAvailability, [day]: ranges }, availabilityOverrides: e.availabilityOverrides?.filter(o => o.date !== date) }
    : { ...e, availabilityOverrides: [...(e.availabilityOverrides ?? []).filter(o => o.date !== date), { date, ranges }] })
  return clean({ employees, assignments: state.assignments })
}
