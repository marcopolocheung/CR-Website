import { DAYS, type DayOfWeek, type Employee, type StaffingSlot, type StaffingTemplateSlot, type WeeklyStaffingTemplate } from './types'
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
