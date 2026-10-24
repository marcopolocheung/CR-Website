import { DAYS, type DayOfWeek, type Employee } from './types'
import { minutes } from './time'

/**
 * Test fixtures only — never import this from app code. These are the starting
 * crews the scheduler used to ship in the page bundle (names, availability, and
 * who is kept apart). The real crews live on the Worker behind the manager code;
 * the tests keep this copy so the solver and validator run against realistic staff.
 */

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

const K_MUK = { start: minutes(9), end: minutes(20) }
const K_FULL = { start: minutes(9), end: minutes(23) }
const K_PM = { start: minutes(16), end: minutes(23) }
const K_EVENING = { start: minutes(17), end: minutes(23) }
const K_EARLY_SUN = { start: minutes(8), end: minutes(13, 30) }
const K_EARLY_MON_SAT = { start: minutes(6), end: minutes(13, 30) }
const K_ALFREDO = { start: minutes(10, 15), end: minutes(16) }
const K_STEF = { start: minutes(14), end: minutes(23) }
const K_DANIEL = { start: minutes(15), end: minutes(23) }
const K_AM = { start: minutes(9), end: minutes(16) }
const K_MV_LATE = { start: minutes(9), end: minutes(17) }

/** Built-in CR03 Kitchen crew: qualifications and hours mirror the CR03_K sheet. Saved edits replace it. */
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
    // Sheet: 6 days max, AM only (9am-4pm lunch shift).
    recurringAvailability: allDays([K_AM]),
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
    id: 'levelle',
    name: 'Levelle',
    roles: ['fried-rice'],
    // Morning and night availability, no doubles, max 5 days.
    recurringAvailability: allDays([K_FULL]),
    maxDaysPerWeek: 5,
    allowDoubles: false,
    incompatibleEmployeeIds: [],
    active: true,
  }),
  employee({
    id: 'michaela',
    name: 'Michaela',
    roles: ['line-cook'],
    // Morning and night availability, no doubles, max 5 days.
    recurringAvailability: allDays([K_FULL]),
    maxDaysPerWeek: 5,
    allowDoubles: false,
    incompatibleEmployeeIds: [],
    active: true,
  }),
  employee({
    id: 'jerry',
    name: 'Jerry',
    roles: ['line-cook'],
    // Morning and night availability, no doubles, max 5 days.
    recurringAvailability: allDays([K_FULL]),
    maxDaysPerWeek: 5,
    allowDoubles: false,
    incompatibleEmployeeIds: [],
    active: true,
  }),
]

/** Demo assumptions behind the starting crews above (they name staff, so they live here too). */
export const schedulerAssumptions = [
  'Demo treats "can only work 4 days" as at most four work days, not exactly four.',
  'Employees without an explicit no-doubles rule are marked as double-eligible for demo purposes.',
  'Cashier 1 and Cashier 2 are modeled as staffing labels that use the same cashier qualification.',
  'Normal PM shifts are modeled as one lead, one server, and two cashiers. Friday PM adds a manager slot starting at 3:00 PM.',
  'Weekday PM server slots start at 5:00 PM in the demo so Javier and Serenity can cover their stated 5:00 PM-11:00 PM weekday availability.',
  'The Sunday noon third-person and Thursday/Friday noon fourth-person notes are listed as unresolved ambiguities instead of encoded as separate slots.',
  'Desiree, Shorty, and Dolores have no confirmed weekly limits in the source text, so the demo config uses seven max days and makes that editable.',
  'Kitchen pages (CR02/CR03) use kitchen posts only — no dining-room posts. Managers can add custom posts from the UI.',
  'CR03 Kitchen rules start from the CR03_K rules sheet; each week’s rules can be changed after unlocking with the staff password. Its crew starts from the sheet (with later hires) and can be edited — roles, availability, add and remove — only after unlocking with the staff password. Saved crew changes apply to every week and the last save can be undone.',
  'CR03 runs the sheet’s two shifts: a lunch (AM) crew of Cook + Line Cook + M/V Prep (early/late) and a dinner (PM) crew of Cook + Line Cook + F.R. Cook + Dishwasher. Evening-only staff are scheduled into the Dinner column. Shadow, Meat Prep, and the extra lunch F.R. Cook / Dishwasher spots ship as optional cover.',
  'CR03 lunch spots use the sheet’s AM window (10:15am-4pm Sunday, 9am-4pm otherwise) so both 9am-start and 10:15am-start workers fit; dinner spots use 4-11pm, except Dishwasher which starts at 5pm so the 5pm-start staff (Jayden, Cris) can take it.',
  'CR03 optional spots are filled automatically when a valid candidate exists (e.g. Stef on Shadow, Cris on Meat Prep when he is not on Dishwasher). Unfilled optional spots show as open and never block the week.',
  'A Meat / Veggie Prep qualification also covers Meat Prep, but not the other way around — a meat-prep-only worker (Cris) cannot cover M/V Prep.',
  'CR02 Kitchen template hours are placeholders (9am-8pm daily) until confirmed; its roster starts empty.',
]
