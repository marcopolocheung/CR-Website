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
  'CR03 Kitchen is schedule-only: its 17-person crew, post qualifications, and hours are fixed in code from the CR03_K rules sheet. Users build the schedule and move people between spots; nobody edits the staff list or the rules from the app.',
  'CR03 runs the sheet’s two shifts: a lunch (AM) crew of Cook + M/V Prep (early/late) and a dinner (PM) crew of Cook + Line Cook + F.R. Cook + Dishwasher. Evening-only staff are scheduled into the Dinner column. Shadow, Meat Prep, and the extra lunch F.R. Cook / Dishwasher spots ship as optional cover.',
  'CR03 lunch spots use the sheet’s AM window (10:15am-4pm Sunday, 9am-4pm otherwise) so both 9am-start and 10:15am-start workers fit; dinner spots use 4-11pm, except Dishwasher which starts at 5pm so the 5pm-start staff (Jayden, Cris) can take it.',
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
// 17 fixed staff. Post qualifications come from the sheet's Y matrix; the
// availability windows, day limits, and double limits come from its per-person
// work-hour rules. Windows that "any shift" people can cover span the whole day.

const K_MUK = { start: minutes(9), end: minutes(20) }
const K_FULL = { start: minutes(9), end: minutes(23) }
const K_PM = { start: minutes(16), end: minutes(23) }
const K_EVENING = { start: minutes(17), end: minutes(23) }
const K_EARLY_SUN = { start: minutes(8), end: minutes(13, 30) }
const K_EARLY_MON_SAT = { start: minutes(6), end: minutes(13, 30) }
const K_ALFREDO = { start: minutes(10, 15), end: minutes(16) }
const K_STEF = { start: minutes(14), end: minutes(23) }
const K_DANIEL = { start: minutes(15), end: minutes(23) }
const K_MV_LATE = { start: minutes(9), end: minutes(17) }

/** Fixed CR03 Kitchen crew: qualifications and hours mirror the CR03_K sheet. */
export const seedKitchenEmployeesCR03: Employee[] = [
  employee({
    id: 'muk',
    name: 'Muk',
    roles: ['cook'],
    // Sheet: Sun off, Mon-Sat 9am-8pm.
    recurringAvailability: only(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], [K_MUK]),
    maxDaysPerWeek: 6,
    allowDoubles: false,
    incompatibleEmployeeIds: [],
    active: true,
  }),
  employee({
    id: 'jeffery',
    name: 'Jeffery',
    roles: ['mv-prep'],
    // Sheet: Tue off; Sun 8am-1:30pm; Mon & Wed-Sat 6am-1:30pm.
    recurringAvailability: {
      Sunday: [K_EARLY_SUN],
      Monday: [K_EARLY_MON_SAT],
      Wednesday: [K_EARLY_MON_SAT],
      Thursday: [K_EARLY_MON_SAT],
      Friday: [K_EARLY_MON_SAT],
      Saturday: [K_EARLY_MON_SAT],
    },
    maxDaysPerWeek: 6,
    allowDoubles: false,
    incompatibleEmployeeIds: [],
    active: true,
  }),
  employee({
    id: 'alfredo',
    name: 'Alfredo',
    roles: ['fried-rice'],
    // Sheet: Mon-Fri 10:15am-4pm.
    recurringAvailability: only(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], [K_ALFREDO]),
    maxDaysPerWeek: 5,
    allowDoubles: false,
    incompatibleEmployeeIds: [],
    active: true,
  }),
  employee({
    id: 'stef',
    name: 'Stef',
    roles: ['line-cook', 'shadow'],
    // Sheet: one day off, any 6 days, 2pm-11pm; main post shadow; one double only.
    recurringAvailability: allDays([K_STEF]),
    maxDaysPerWeek: 6,
    allowDoubles: true,
    maxDoublesPerWeek: 1,
    incompatibleEmployeeIds: [],
    active: true,
  }),
  employee({
    id: 'jay',
    name: 'Jay',
    roles: ['cook', 'line-cook', 'fried-rice'],
    // Sheet: Tue off, 6 days max, any shift, max 2 doubles.
    recurringAvailability: except(['Tuesday'], [K_FULL]),
    maxDaysPerWeek: 6,
    allowDoubles: true,
    maxDoublesPerWeek: 2,
    incompatibleEmployeeIds: [],
    active: true,
  }),
  employee({
    id: 'jeremy',
    name: 'Jeremy',
    roles: ['cook', 'line-cook', 'fried-rice', 'shadow'],
    // Sheet: Mon off, 6 days max, any shift, max 2 doubles; shadow when Stef is off.
    recurringAvailability: except(['Monday'], [K_FULL]),
    maxDaysPerWeek: 6,
    allowDoubles: true,
    maxDoublesPerWeek: 2,
    incompatibleEmployeeIds: [],
    active: true,
  }),
  employee({
    id: 'robert',
    name: 'Robert',
    roles: ['cook', 'line-cook', 'fried-rice'],
    // Sheet: Thu off, 6 days max, max 2 doubles.
    recurringAvailability: except(['Thursday'], [K_FULL]),
    maxDaysPerWeek: 6,
    allowDoubles: true,
    maxDoublesPerWeek: 2,
    incompatibleEmployeeIds: [],
    active: true,
  }),
  employee({
    id: 'daniel',
    name: 'Daniel',
    roles: ['cook', 'line-cook', 'fried-rice'],
    // Sheet: Tue, Wed, Sat off; 3pm-11pm the other days.
    recurringAvailability: only(['Sunday', 'Monday', 'Thursday', 'Friday'], [K_DANIEL]),
    maxDaysPerWeek: 4,
    allowDoubles: false,
    incompatibleEmployeeIds: [],
    active: true,
  }),
  employee({
    id: 'jorge',
    name: 'Jorge',
    roles: ['fried-rice'],
    // Sheet: Sun, Thu, Sat only; any shift; max 1 double.
    recurringAvailability: only(['Sunday', 'Thursday', 'Saturday'], [K_FULL]),
    maxDaysPerWeek: 3,
    allowDoubles: true,
    maxDoublesPerWeek: 1,
    incompatibleEmployeeIds: [],
    active: true,
  }),
  employee({
    id: 'isaiah',
    name: 'Isaiah',
    roles: ['line-cook'],
    // Sheet: PM only, max 4 days.
    recurringAvailability: allDays([K_PM]),
    maxDaysPerWeek: 4,
    allowDoubles: false,
    incompatibleEmployeeIds: [],
    active: true,
  }),
  employee({
    id: 'jayden',
    name: 'Jayden',
    roles: ['fried-rice', 'dishwasher'],
    // Sheet: Sun off; Mon-Fri 5pm-11pm; Sat any shift; no doubles.
    recurringAvailability: {
      Monday: [K_EVENING],
      Tuesday: [K_EVENING],
      Wednesday: [K_EVENING],
      Thursday: [K_EVENING],
      Friday: [K_EVENING],
      Saturday: [K_FULL],
    },
    maxDaysPerWeek: 6,
    allowDoubles: false,
    incompatibleEmployeeIds: [],
    active: true,
  }),
  employee({
    id: 'eddie',
    name: 'Eddie',
    roles: ['dishwasher', 'mv-prep'],
    // Sheet: 6 days max, AM only.
    recurringAvailability: allDays([K_MV_LATE]),
    maxDaysPerWeek: 6,
    allowDoubles: false,
    incompatibleEmployeeIds: [],
    active: true,
  }),
  employee({
    id: 'carolina',
    name: 'Carolina',
    roles: ['mv-prep'],
    // Sheet: Sun off, Mon-Sat 9am-5pm.
    recurringAvailability: except(['Sunday'], [K_MV_LATE]),
    maxDaysPerWeek: 6,
    allowDoubles: false,
    incompatibleEmployeeIds: [],
    active: true,
  }),
  employee({
    id: 'issac',
    name: 'Issac',
    roles: ['dishwasher'],
    // Sheet: any day, PM only, max 4 days.
    recurringAvailability: allDays([K_PM]),
    maxDaysPerWeek: 4,
    allowDoubles: false,
    incompatibleEmployeeIds: [],
    active: true,
  }),
  employee({
    id: 'jeremiah',
    name: 'Jeremiah',
    roles: ['fried-rice', 'dishwasher'],
    // Sheet: any shift, max 4 days.
    recurringAvailability: allDays([K_FULL]),
    maxDaysPerWeek: 4,
    allowDoubles: true,
    incompatibleEmployeeIds: [],
    active: true,
  }),
  employee({
    id: 'cris',
    name: 'Cris',
    roles: ['dishwasher', 'meat-prep'],
    // Sheet: Mon, Tue, Wed, Fri, Sat 5pm-11pm; Sun & Thu off.
    recurringAvailability: only(['Monday', 'Tuesday', 'Wednesday', 'Friday', 'Saturday'], [K_EVENING]),
    maxDaysPerWeek: 5,
    allowDoubles: false,
    incompatibleEmployeeIds: [],
    active: true,
  }),
  employee({
    id: 'alex',
    name: 'Alex',
    roles: ['fried-rice'],
    // Sheet: PM only, max 4 days.
    recurringAvailability: allDays([K_PM]),
    maxDaysPerWeek: 4,
    allowDoubles: false,
    incompatibleEmployeeIds: [],
    active: true,
  }),
]

const CR03_EARLY_MV: Record<DayOfWeek, { start: number; end: number }> = {
  Sunday: K_EARLY_SUN,
  Monday: K_EARLY_MON_SAT,
  // Jeffery is off Tuesday; Eddie or Carolina covers the early prep slot at 9.
  Tuesday: { start: minutes(9), end: minutes(13, 30) },
  Wednesday: K_EARLY_MON_SAT,
  Thursday: K_EARLY_MON_SAT,
  Friday: K_EARLY_MON_SAT,
  Saturday: K_EARLY_MON_SAT,
}

/**
 * CR03 Kitchen rules. The sheet runs a lunch (AM) and a dinner (PM) shift, so
 * the board does too: the lunch crew is Cook + M/V Prep (early/late) and the
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
