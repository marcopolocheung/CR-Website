import { DAYS, PERIODS, isValidRoleSlug, type StaffingSlot } from './scheduler/types'
import { validHoursData, type PublishedDayHours } from './scheduler/special-hours'

export type PublishedSlot = Omit<StaffingSlot, 'date'>
export type ScheduleSnapshot = {
  version: 1
  /** Capturing legacy rules cannot establish what the original published times were. */
  basis: 'published' | 'legacy-captured'
  slots: PublishedSlot[]
  specialHours?: PublishedDayHours[]
}

export function buildScheduleSnapshot(slots: readonly StaffingSlot[], basis: ScheduleSnapshot['basis'] = 'published', specialHours: readonly PublishedDayHours[] = []): ScheduleSnapshot {
  return { version: 1, basis, slots: slots.map(({ id, day, period, role, label, start, end, required }) =>
    ({ id, day, period, role, label, start, end, required })),
    ...(specialHours.length ? {specialHours:specialHours.map(day=>({...day}))} : {}) }
}

/** Index order is significant; validate without sorting, repairing, or falling back. */
export function validScheduleSnapshot(value: unknown, slotCount: number, weekStart?: string): value is ScheduleSnapshot {
  if (!value || typeof value !== 'object') return false
  const snapshot = value as ScheduleSnapshot
  if (snapshot.version !== 1 || !['published', 'legacy-captured'].includes(snapshot.basis)
    || !Array.isArray(snapshot.slots) || snapshot.slots.length !== slotCount || slotCount > 200) return false
  if (snapshot.specialHours !== undefined && (!Array.isArray(snapshot.specialHours) || snapshot.specialHours.length > 7
    || new Set(snapshot.specialHours.map(day=>day?.date)).size !== snapshot.specialHours.length
    || !snapshot.specialHours.every(day=> {
      if (!day || typeof day !== 'object') return false
      const {eventRevision,reviewRevision,...event}=day
      return validHoursData(event) && Number.isSafeInteger(eventRevision) && eventRevision>0
        && Number.isSafeInteger(reviewRevision) && reviewRevision>0 && (!weekStart || day.date>=weekStart
          && Date.parse(day.date+'T00:00:00Z')<=Date.parse(weekStart+'T00:00:00Z')+6*86400000)
    }))) return false
  const ids = new Set<string>()
  return snapshot.slots.every(slot => {
    if (!slot || typeof slot !== 'object' || typeof slot.id !== 'string' || !slot.id || slot.id.length > 200 || ids.has(slot.id)
      || !DAYS.includes(slot.day) || !PERIODS.includes(slot.period) || !isValidRoleSlug(slot.role)
      || typeof slot.label !== 'string' || !slot.label.trim() || slot.label.length > 60
      || typeof slot.required !== 'boolean' || !Number.isInteger(slot.start) || !Number.isInteger(slot.end)
      || slot.start < 0 || slot.start >= 1440 || slot.end <= slot.start || slot.end > 2880 || slot.end > slot.start + 1440
      || Object.keys(slot).some(key => !['id', 'day', 'period', 'role', 'label', 'start', 'end', 'required'].includes(key))) return false
    ids.add(slot.id)
    return true
  }) && Object.keys(snapshot).every(key => ['version', 'basis', 'slots', 'specialHours'].includes(key))
}
