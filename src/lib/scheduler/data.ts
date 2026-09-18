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

const am = { start: minutes(9, 30), end: minutes(16) }
const pm = { start: minutes(16), end: minutes(23) }
const fullDay = { start: minutes(9, 30), end: minutes(23) }
const weekdayPmServer = { start: minutes(17), end: minutes(23) }

function allDays(ranges: { start: number; end: number }[]) {
  return Object.fromEntries(DAYS.map((day) => [day, ranges])) as Employee['recurringAvailability']
}

function except(days: DayOfWeek[], ranges: { start: number; end: number }[]) {
  return Object.fromEntries(DAYS.filter((day) => !days.includes(day)).map((day) => [day, ranges])) as Employee['recurringAvailability']
}

function only(days: DayOfWeek[], ranges: { start: number; end: number }[]) {
  return Object.fromEntries(days.map((day) => [day, ranges])) as Employee['recurringAvailability']
}

function employee(employee: Employee): Employee {
  return employee
}

export const schedulerAssumptions = [
  'Demo treats "can only work 4 days" as at most four work days, not exactly four.',
  'Employees without an explicit no-doubles rule are marked as double-eligible for demo purposes.',
  'Cashier 1 and Cashier 2 are modeled as staffing labels that use the same cashier qualification.',
  'Normal PM shifts are modeled as one lead, one server, and two cashiers. Friday PM adds a manager slot starting at 3:00 PM.',
  'Weekday PM server slots start at 5:00 PM in the demo so Javier and Serenity can cover their stated 5:00 PM-11:00 PM weekday availability.',
  'The Sunday noon third-person and Thursday/Friday noon fourth-person notes are listed as unresolved ambiguities instead of encoded as separate slots.',
  'Desiree, Shorty, and Dolores have no confirmed weekly limits in the source text, so the demo config uses seven max days and makes that editable.',
  'Kitchen pages (CR02/CR03) use kitchen posts only — no dining-room posts. Managers can add custom posts from the UI.',
  'CR03 Kitchen fixed cover: Muk (Cook) Mon-Sat 9am-8pm + Sun 9-11am; Jeffrey (M/V Prep) Sun 8am-1:30pm, Mon & Wed-Sat 6am-1:30pm, Tue 9-11am; Carolina (M/V Prep) Mon-Sat 9am-5pm, Sun off.',
  'CR03 non-fixed posts (Line Cook, Fried Rice, Dishwasher, Shadow) ship as optional 9am-8pm spots — flip them to required once hired so the solver stays feasible meanwhile.',
  'CR02 Kitchen template hours are placeholders (9am-8pm daily) until confirmed; its roster starts empty.',
]

export const seedEmployees: Employee[] = [
  employee({
    id: 'mary',
    name: 'Mary',
    roles: ['server', 'cashier'],
    recurringAvailability: except(['Thursday'], [am, pm]),
    maxDaysPerWeek: 4,
    allowDoubles: true,
    incompatibleEmployeeIds: [],
    active: true,
  }),
  employee({
    id: 'chela',
    name: 'Chela',
    roles: ['server', 'cashier'],
    recurringAvailability: except(['Sunday'], [pm]),
    maxDaysPerWeek: 4,
    allowDoubles: false,
    incompatibleEmployeeIds: ['emerie'],
    active: true,
  }),
  employee({
    id: 'pam',
    name: 'Pam',
    roles: ['server', 'cashier'],
    recurringAvailability: allDays([am, pm]),
    maxDaysPerWeek: 4,
    allowDoubles: false,
    incompatibleEmployeeIds: [],
    active: true,
  }),
  employee({
    id: 'aurora',
    name: 'Aurora',
    roles: ['server', 'cashier'],
    recurringAvailability: except(['Wednesday', 'Thursday'], [am, pm]),
    maxDaysPerWeek: 4,
    allowDoubles: true,
    incompatibleEmployeeIds: [],
    active: true,
  }),
  employee({
    id: 'eileen',
    name: 'Eileen',
    roles: ['server'],
    recurringAvailability: only(['Tuesday', 'Wednesday', 'Thursday', 'Friday'], [am]),
    maxDaysPerWeek: 4,
    allowDoubles: false,
    incompatibleEmployeeIds: [],
    active: true,
  }),
  employee({
    id: 'stephanie',
    name: 'Stephanie',
    roles: ['server', 'cashier'],
    recurringAvailability: only(['Thursday', 'Friday', 'Saturday', 'Sunday'], [pm]),
    maxDaysPerWeek: 4,
    allowDoubles: false,
    incompatibleEmployeeIds: [],
    active: true,
  }),
  employee({
    id: 'emerie',
    name: 'Emerie',
    roles: ['server', 'cashier'],
    recurringAvailability: allDays([am, pm]),
    maxDaysPerWeek: 4,
    allowDoubles: false,
    incompatibleEmployeeIds: ['chela'],
    active: true,
  }),
  employee({
    id: 'javier',
    name: 'Javier',
    roles: ['server'],
    recurringAvailability: {
      Monday: [weekdayPmServer],
      Tuesday: [weekdayPmServer],
      Wednesday: [weekdayPmServer],
      Thursday: [weekdayPmServer],
      Friday: [weekdayPmServer],
      Saturday: [am, pm],
      Sunday: [am, pm],
    },
    maxDaysPerWeek: 4,
    allowDoubles: true,
    incompatibleEmployeeIds: [],
    active: true,
  }),
  employee({
    id: 'serenity',
    name: 'Serenity',
    roles: ['server'],
    recurringAvailability: {
      Monday: [weekdayPmServer],
      Tuesday: [weekdayPmServer],
      Wednesday: [weekdayPmServer],
      Thursday: [weekdayPmServer],
      Friday: [weekdayPmServer],
      Saturday: [am, pm],
      Sunday: [am, pm],
    },
    maxDaysPerWeek: 4,
    allowDoubles: true,
    incompatibleEmployeeIds: [],
    active: true,
  }),
  employee({
    id: 'desiree',
    name: 'Desiree',
    roles: ['lead'],
    recurringAvailability: allDays([am]),
    maxDaysPerWeek: 7,
    allowDoubles: false,
    incompatibleEmployeeIds: [],
    active: true,
  }),
  employee({
    id: 'shorty',
    name: 'Shorty',
    roles: ['lead', 'manager'],
    recurringAvailability: {
      Sunday: [am],
      Monday: [am],
      Tuesday: [am],
      Wednesday: [am],
      Thursday: [am],
      Friday: [fullDay],
      Saturday: [fullDay],
    },
    maxDaysPerWeek: 7,
    allowDoubles: true,
    incompatibleEmployeeIds: [],
    active: true,
  }),
  employee({
    id: 'dolores',
    name: 'Dolores',
    roles: ['lead', 'manager'],
    recurringAvailability: allDays([fullDay]),
    maxDaysPerWeek: 7,
    allowDoubles: true,
    incompatibleEmployeeIds: [],
    active: true,
  }),
]

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

export function expandTemplate(template: WeeklyStaffingTemplate): StaffingSlot[] {
  return DAYS.flatMap((day) =>
    template[day].map((slot, index) => ({
      ...slot,
      day,
      id: `${day.toLowerCase()}-${slot.period.toLowerCase()}-${index}-${slot.label.toLowerCase().replaceAll(' ', '-')}`,
    })),
  )
}

// --- Kitchen stations (CR02 / CR03) ---
// Kitchen pages use kitchen posts only. Long day-cover slots are single slots
// (period AM) so fixed staff like Muk (9am-8pm) need no doubles to cover them.

const KITCHEN_COVER_START = minutes(9)
const KITCHEN_COVER_END = minutes(20)

function kitchenSlot(
  role: string,
  label: string,
  start: number,
  end: number,
  required = true,
): StaffingTemplateSlot {
  return { period: 'AM', role, label, start, end, required }
}

/** Fixed CR03 Kitchen crew: availability mirrors the template slots below exactly. */
export const seedKitchenEmployeesCR03: Employee[] = [
  employee({
    id: 'muk',
    name: 'Muk',
    roles: ['cook'],
    recurringAvailability: {
      Sunday: [{ start: minutes(9), end: minutes(11) }],
      Monday: [{ start: minutes(9), end: minutes(20) }],
      Tuesday: [{ start: minutes(9), end: minutes(20) }],
      Wednesday: [{ start: minutes(9), end: minutes(20) }],
      Thursday: [{ start: minutes(9), end: minutes(20) }],
      Friday: [{ start: minutes(9), end: minutes(20) }],
      Saturday: [{ start: minutes(9), end: minutes(20) }],
    },
    maxDaysPerWeek: 7,
    allowDoubles: false,
    incompatibleEmployeeIds: [],
    active: true,
  }),
  employee({
    id: 'jeffrey',
    name: 'Jeffrey',
    roles: ['mv-prep'],
    recurringAvailability: {
      Sunday: [{ start: minutes(8), end: minutes(13, 30) }],
      Monday: [{ start: minutes(6), end: minutes(13, 30) }],
      Tuesday: [{ start: minutes(9), end: minutes(11) }],
      Wednesday: [{ start: minutes(6), end: minutes(13, 30) }],
      Thursday: [{ start: minutes(6), end: minutes(13, 30) }],
      Friday: [{ start: minutes(6), end: minutes(13, 30) }],
      Saturday: [{ start: minutes(6), end: minutes(13, 30) }],
    },
    maxDaysPerWeek: 7,
    allowDoubles: false,
    incompatibleEmployeeIds: [],
    active: true,
  }),
  employee({
    id: 'carolina',
    name: 'Carolina',
    roles: ['mv-prep'],
    recurringAvailability: {
      Monday: [{ start: minutes(9), end: minutes(17) }],
      Tuesday: [{ start: minutes(9), end: minutes(17) }],
      Wednesday: [{ start: minutes(9), end: minutes(17) }],
      Thursday: [{ start: minutes(9), end: minutes(17) }],
      Friday: [{ start: minutes(9), end: minutes(17) }],
      Saturday: [{ start: minutes(9), end: minutes(17) }],
    },
    maxDaysPerWeek: 6,
    allowDoubles: false,
    incompatibleEmployeeIds: [],
    active: true,
  }),
]

const CR03_EARLY_MV: Record<DayOfWeek, { start: number; end: number }> = {
  Sunday: { start: minutes(8), end: minutes(13, 30) },
  Monday: { start: minutes(6), end: minutes(13, 30) },
  Tuesday: { start: minutes(9), end: minutes(11) },
  Wednesday: { start: minutes(6), end: minutes(13, 30) },
  Thursday: { start: minutes(6), end: minutes(13, 30) },
  Friday: { start: minutes(6), end: minutes(13, 30) },
  Saturday: { start: minutes(6), end: minutes(13, 30) },
}

/** CR03 Kitchen rules: Cook + two M/V Prep slots/day (early/late) are required; other posts are optional until hired. */
export const seedKitchenTemplateCR03: WeeklyStaffingTemplate = Object.fromEntries(
  DAYS.map((day) => {
    const slots: StaffingTemplateSlot[] = [
      day === 'Sunday'
        ? kitchenSlot('cook', 'Cook', minutes(9), minutes(11))
        : kitchenSlot('cook', 'Cook', minutes(9), minutes(20)),
      kitchenSlot('mv-prep', 'M/V Prep (early)', CR03_EARLY_MV[day].start, CR03_EARLY_MV[day].end),
    ]
    if (day !== 'Sunday') {
      slots.push(kitchenSlot('mv-prep', 'M/V Prep (late)', minutes(9), minutes(17)))
    }
    // Optional cover: flip to required once these posts are hired.
    for (const [role, label] of [
      ['line-cook', 'Line Cook'],
      ['fried-rice', 'Fried Rice'],
      ['dishwasher', 'Dishwasher'],
      ['shadow', 'Shadow'],
    ] as const) {
      slots.push(kitchenSlot(role, label, KITCHEN_COVER_START, KITCHEN_COVER_END, false))
    }
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

/** Built-in staff list per scheduler page. Kitchens never inherit the dining-room crew. */
export function defaultEmployeesForRestaurant(restaurantId?: string): Employee[] {
  if (restaurantId === 'CR3-kitchen') return cloneEmployeeList(seedKitchenEmployeesCR03)
  if (restaurantId === 'CR2-kitchen') return []
  return cloneEmployeeList(seedEmployees)
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

function cloneEmployeeList(employees: Employee[]): Employee[] {
  return employees.map((candidate) => ({
    ...candidate,
    roles: [...candidate.roles],
    recurringAvailability: Object.fromEntries(
      Object.entries(candidate.recurringAvailability).map(([day, ranges]) => [
        day,
        ranges?.map((range) => ({ ...range })) ?? [],
      ]),
    ) as Employee['recurringAvailability'],
    incompatibleEmployeeIds: [...(candidate.incompatibleEmployeeIds ?? [])],
  }))
}

function cloneTemplate(source: WeeklyStaffingTemplate): WeeklyStaffingTemplate {
  return Object.fromEntries(DAYS.map((day) => [day, source[day].map((slot) => ({ ...slot }))])) as WeeklyStaffingTemplate
}
