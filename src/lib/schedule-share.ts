/**
 * Payload for one published week of the golden schedule.
 *
 * Reads are public: /schedule fetches the plaintext week from the Worker,
 * so there is no encryption and no staff code. Writes stay guarded by the
 * manager token, which the Worker checks — see schedule-store.ts.
 */

import type { Employee, ScheduleAssignment, StaffingSlot } from './scheduler'

export const SHARE_VERSION = 1

export function templateHashForSlots(slots: Pick<StaffingSlot, 'id'>[]): string {
  let hash = 0x811c9dc5
  const input = slots.map((slot) => slot.id).join('\n')
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export type PublishedWeek = {
  version: number
  weekStart: string
  name: string
  /** Unique people referenced by index, so a name is stored once however many shifts it works. */
  people: string[]
  /** One entry per staffing slot in canonical order; -1 means nobody is assigned. */
  slotPeople: number[]
}

/**
 * Packs one week into the share payload. Slot order comes straight from the staffing template,
 * and the reader rebuilds the same order, so only the person in each slot has to travel.
 */
export function buildPublishedWeek({
  weekStart,
  name,
  slots,
  employees,
  assignments,
}: {
  weekStart: string
  name: string
  slots: StaffingSlot[]
  employees: Employee[]
  assignments: ScheduleAssignment[]
}): PublishedWeek {
  const assignmentBySlot = new Map(assignments.map((assignment) => [assignment.slotId, assignment.employeeId]))

  // Everyone rostered is listed, including anyone with no shifts, so the reader can show them
  // an explicit OFF row rather than leaving them to wonder whether they were forgotten.
  const roster = employees.filter((employee) => employee.active)
  const people = roster.map((employee) => employee.name)
  const indexById = new Map(roster.map((employee, index) => [employee.id, index]))

  const slotPeople = slots.map((slot) => indexById.get(assignmentBySlot.get(slot.id) ?? '') ?? -1)

  return { version: SHARE_VERSION, weekStart, name, people, slotPeople }
}
