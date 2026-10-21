import {
  DAYS,
  defaultRoleForRestaurant,
  rolesForRestaurant,
  type DayOfWeek,
  type Employee,
  type StaffingSlot,
  type StaffingTemplateSlot,
  type WeeklyStaffingTemplate,
} from './types'
import { minutes } from './time'
import { dateForDay } from './week'

export const seedTemplate: WeeklyStaffingTemplate = Object.fromEntries(
  DAYS.map((day) => {
    const amSlots: StaffingTemplateSlot[] = [
      { period: 'AM' as const, role: 'lead' as const, label: 'Shift lead', start: minutes(9, 30), end: minutes(16), required: true },
      { period: 'AM' as const, role: 'server' as const, label: 'Server', start: minutes(10), end: minutes(16), required: true },
      { period: 'AM' as const, role: 'cashier' as const, label: 'Cashier 1', start: minutes(10, 30), end: minutes(16), required: true },
    ]

    if (day === 'Thursday' || day === 'Friday') {
      amSlots.push({
        period: 'AM' as const,
        role: 'cashier' as const,
        label: 'Cashier 2',
        start: minutes(12),
        end: minutes(16),
        required: true,
      })
    }

    const pmServerStart = day === 'Saturday' || day === 'Sunday' ? minutes(16) : minutes(17)
    const pmSlots: StaffingTemplateSlot[] = [
      { period: 'PM' as const, role: 'lead' as const, label: 'Shift lead', start: minutes(16), end: minutes(23), required: true },
      { period: 'PM' as const, role: 'server' as const, label: 'Server', start: pmServerStart, end: minutes(23), required: true },
      { period: 'PM' as const, role: 'cashier' as const, label: 'Cashier 1', start: minutes(16), end: minutes(23), required: true },
      { period: 'PM' as const, role: 'cashier' as const, label: 'Cashier 2', start: minutes(16, 30), end: minutes(23), required: true },
    ]

    if (day === 'Friday') {
      pmSlots.push({
        period: 'PM' as const,
        role: 'manager' as const,
        label: 'Friday manager',
        start: minutes(15),
        end: minutes(23),
        required: true,
      })
    }

    return [day, [...amSlots, ...pmSlots]]
  }),
) as WeeklyStaffingTemplate

export function expandTemplate(template: WeeklyStaffingTemplate, weekStart?: string): StaffingSlot[] {
  return DAYS.flatMap((day) =>
    template[day].map((slot, index) => ({
      ...slot,
      day,
      ...(weekStart ? { date: dateForDay(weekStart, day) } : {}),
      id: `${day.toLowerCase()}-${slot.period.toLowerCase()}-${index}-${slot.label.toLowerCase().replaceAll(' ', '-')}`,
    })),
  )
}

// --- Kitchen stations (CR02 / CR03) ---
// Kitchen pages use kitchen posts only. The required Cook/prep slots are single
// long (period AM) slots so a worker like Muk (9am-8pm) covers one slot with no
// double; the optional AM/PM spots are where the rest of the crew gets placed.

const KITCHEN_COVER_START = minutes(9)
const KITCHEN_COVER_END = minutes(20)

function kitchenSlot(
  role: string,
  label: string,
  start: number,
  end: number,
  required = true,
): StaffingTemplateSlot {
  // Lunch (AM) spots start before 4pm, dinner (PM) spots at/after 4pm — this is
  // what puts evening-only staff in the Dinner column instead of Morning.
  return { period: start >= minutes(16) ? 'PM' : 'AM', role, label, start, end, required }
}

// --- CR03 Kitchen crew (from 26-00919 CR SCHEDULER RULES, sheet CR03_K) ---
// 19 staff. Post qualifications come from the sheet's Y matrix; the
// availability windows, day limits, and double limits come from its per-person
// work-hour rules. Windows that "any shift" people can cover span the whole day.

// Early M/V Prep window: 6am (8am Sunday) to 1:30pm, except Tuesday, which starts at 9.
const CR03_EARLY_MV_START = { Sunday: minutes(8), Tuesday: minutes(9) } as Partial<Record<DayOfWeek, number>>
const CR03_EARLY_MV: Record<DayOfWeek, { start: number; end: number }> = Object.fromEntries(
  DAYS.map((day) => [day, { start: CR03_EARLY_MV_START[day] ?? minutes(6), end: minutes(13, 30) }]),
) as Record<DayOfWeek, { start: number; end: number }>

/**
 * CR03 Kitchen rules. The sheet runs a lunch (AM) and a dinner (PM) shift, so
 * the board does too: the lunch crew is Cook + Line Cook + M/V Prep (early/late) and the
 * dinner crew is Cook + Line Cook + F.R. Cook + Dishwasher. Evening-only staff
 * therefore land in the Dinner column instead of Morning. Shadow, Meat Prep,
 * and the extra lunch spots ship as optional cover for the rest of the crew.
 */
export const seedKitchenTemplateCR03: WeeklyStaffingTemplate = Object.fromEntries(
  DAYS.map((day) => {
    const sunday = day === 'Sunday'
    const slots: StaffingTemplateSlot[] = [
      // Lunch (AM) crew.
      sunday
        ? kitchenSlot('cook', 'Cook (AM)', minutes(10, 15), minutes(16))
        : kitchenSlot('cook', 'Cook (AM)', minutes(9), minutes(16)),
      kitchenSlot('line-cook', 'Line Cook (AM)', sunday ? minutes(10, 15) : minutes(9), minutes(16)),
      kitchenSlot('mv-prep', 'M/V Prep (early)', CR03_EARLY_MV[day].start, CR03_EARLY_MV[day].end),
    ]
    if (!sunday) {
      slots.push(kitchenSlot('mv-prep', 'M/V Prep (late)', minutes(9), minutes(16)))
    }
    // Dinner (PM) crew.
    slots.push(kitchenSlot('cook', 'Cook (PM)', minutes(16), minutes(23)))
    slots.push(kitchenSlot('line-cook', 'Line Cook (PM)', minutes(16), minutes(23)))
    slots.push(kitchenSlot('fried-rice', 'F.R. Cook (PM)', minutes(16), minutes(23)))
    // Dishwashers who start at 5pm (Jayden, Cris) can take a 5-11 dinner spot.
    slots.push(kitchenSlot('dishwasher', 'Dishwasher (PM)', minutes(17), minutes(23)))
    // Optional cover: lunch F.R. Cook / Dishwasher, dinner Shadow / Meat Prep.
    slots.push(kitchenSlot('fried-rice', 'F.R. Cook (AM)', minutes(10, 15), minutes(16), false))
    slots.push(kitchenSlot('dishwasher', 'Dishwasher (AM)', sunday ? minutes(10, 15) : minutes(9), minutes(16), false))
    slots.push(kitchenSlot('shadow', 'Shadow (PM)', minutes(16), minutes(23), false))
    slots.push(kitchenSlot('meat-prep', 'Meat Prep (PM)', minutes(17), minutes(23), false))
    return [day, slots]
  }),
) as WeeklyStaffingTemplate

/** CR02 Kitchen rules: placeholder 9am-8pm daily cover per post (roster starts empty). */
export const seedKitchenTemplateCR02: WeeklyStaffingTemplate = Object.fromEntries(
  DAYS.map((day) => {
    const slots: StaffingTemplateSlot[] = [
      ['cook', 'Cook'],
      ['line-cook', 'Line Cook'],
      ['fried-rice', 'Fried Rice'],
      ['dishwasher', 'Dishwasher'],
      ['meat-prep', 'Meat Prep'],
      ['veggie-prep', 'Veggie Prep'],
      ['shadow', 'Shadow'],
      ['manager', 'Manager'],
    ].map(([role, label]) => kitchenSlot(role, label, KITCHEN_COVER_START, KITCHEN_COVER_END))
    return [day, slots]
  }),
) as WeeklyStaffingTemplate

/**
 * Starting staff list for a station with nothing saved yet: empty. Real crews live
 * on the Worker behind the manager code, so no names or availability ship in the page.
 */
export function defaultEmployeesForRestaurant(_restaurantId?: string): Employee[] {
  return []
}

/** Built-in schedule rules per scheduler page. */
export function defaultTemplateForRestaurant(restaurantId?: string): WeeklyStaffingTemplate {
  if (restaurantId === 'CR3-kitchen') return cloneTemplate(seedKitchenTemplateCR03)
  if (restaurantId === 'CR2-kitchen') return cloneTemplate(seedKitchenTemplateCR02)
  return cloneTemplate(seedTemplate)
}

/** Post options for "add employee / add spot" forms on a given page. */
export function defaultPostsForRestaurant(restaurantId?: string): string[] {
  return rolesForRestaurant(restaurantId)
}

export function defaultPostForRestaurant(restaurantId?: string): string {
  return defaultRoleForRestaurant(restaurantId)
}

function cloneTemplate(source: WeeklyStaffingTemplate): WeeklyStaffingTemplate {
  return Object.fromEntries(DAYS.map((day) => [day, source[day].map((slot) => ({ ...slot }))])) as WeeklyStaffingTemplate
}
