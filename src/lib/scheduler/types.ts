export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
export const PERIODS = ['AM', 'PM'] as const
/** Dining-room posts (front of house). Kept for the dining scheduler pages. */
export const DINING_ROLES = ['server', 'cashier', 'lead', 'manager'] as const
/** Every known kitchen post slug. CR02 uses meat/veggie prep + manager; CR03 uses the combined m/v prep. */
export const KITCHEN_ROLES = [
  'cook',
  'line-cook',
  'fried-rice',
  'dishwasher',
  'meat-prep',
  'veggie-prep',
  'mv-prep',
  'shadow',
  'manager',
] as const
/** Kitchen posts for CR02 Kitchen (meat + veggie prep are separate, has a manager post). */
export const KITCHEN_ROLES_CR02 = [
  'cook',
  'line-cook',
  'fried-rice',
  'dishwasher',
  'meat-prep',
  'veggie-prep',
  'shadow',
  'manager',
] as const
/** Kitchen posts for CR03 Kitchen (combined m/v prep, no manager post). */
export const KITCHEN_ROLES_CR03 = ['cook', 'line-cook', 'fried-rice', 'dishwasher', 'mv-prep', 'shadow'] as const
/**
 * All built-in posts. Roles are extensible: managers can add custom posts
 * (slugified, e.g. "sushi-chef") from the scheduler UI, so `Role` is a string
 * and this list is the set of known defaults, not a closed enum.
 */
export const ROLES: readonly string[] = Array.from(new Set([...DINING_ROLES, ...KITCHEN_ROLES]))

export type DayOfWeek = (typeof DAYS)[number]
export type ShiftPeriod = (typeof PERIODS)[number]
export type Role = string

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  server: 'Server',
  cashier: 'Cashier',
  lead: 'Shift lead',
  manager: 'Manager',
  cook: 'Cook',
  'line-cook': 'Line Cook',
  'fried-rice': 'Fried Rice',
  dishwasher: 'Dishwasher',
  'meat-prep': 'Meat Prep',
  'veggie-prep': 'Veggie Prep',
  'mv-prep': 'M/V Prep',
  shadow: 'Shadow',
}

/** Human label for any role slug, including manager-defined custom posts. */
export function formatRoleLabel(role: string): string {
  const known = ROLE_DISPLAY_NAMES[role]
  if (known) return known
  return role
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

/** Turn free-typed post names ("M/V Prep", "Line Cook") into storage slugs ("mv-prep", "line-cook"). */
export function normalizeRoleSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[/&'’]+/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export const ROLE_SLUG_RE = /^[a-z0-9-]{1,40}$/

/** Storage-level check shared by the web app and the Worker: known or well-formed custom slugs pass. */
export function isValidRoleSlug(value: unknown): value is string {
  return typeof value === 'string' && ROLE_SLUG_RE.test(value)
}

export function isKitchenRestaurant(restaurantId?: string): boolean {
  return typeof restaurantId === 'string' && restaurantId.endsWith('-kitchen')
}

/** Default post list per scheduler page: kitchens show kitchen posts only (no dining posts). */
export function rolesForRestaurant(restaurantId?: string): string[] {
  if (restaurantId === 'CR2-kitchen') return [...KITCHEN_ROLES_CR02]
  if (restaurantId === 'CR3-kitchen') return [...KITCHEN_ROLES_CR03]
  if (isKitchenRestaurant(restaurantId)) return Array.from(new Set([...KITCHEN_ROLES]))
  return [...DINING_ROLES]
}

/** Default post for "add employee / add spot" forms on a given page. */
export function defaultRoleForRestaurant(restaurantId?: string): string {
  return isKitchenRestaurant(restaurantId) ? 'cook' : 'server'
}

export type TimeRange = {
  start: number
  end: number
}

export type AvailabilityOverride = {
  date: string
  ranges: TimeRange[]
}

export type ShiftPreference = {
  day: DayOfWeek
  period: ShiftPeriod
  weight: number
}

export type Employee = {
  id: string
  name: string
  roles: Role[]
  recurringAvailability: Partial<Record<DayOfWeek, TimeRange[]>>
  availabilityOverrides?: AvailabilityOverride[]
  maxDaysPerWeek?: number
  maxShiftsPerWeek?: number
  allowDoubles: boolean
  preferredDaysPerWeek?: number
  preferredHoursPerWeek?: number
  preferences?: ShiftPreference[]
  incompatibleEmployeeIds?: string[]
  active: boolean
  newHire?: boolean
}

export type StaffingSlot = {
  id: string
  day: DayOfWeek
  period: ShiftPeriod
  role: Role
  label: string
  start: number
  end: number
  required: boolean
}

export type StaffingTemplateSlot = Omit<StaffingSlot, 'id' | 'day'>

export type WeeklyStaffingTemplate = Record<DayOfWeek, StaffingTemplateSlot[]>

export type ScheduleAssignment = {
  slotId: string
  employeeId: string
  locked?: boolean
}

export type SchedulerInput = {
  employees: Employee[]
  template: WeeklyStaffingTemplate
}

export type ValidationCode =
  | 'missing_assignment'
  | 'unknown_slot'
  | 'unknown_employee'
  | 'inactive_employee'
  | 'unqualified_employee'
  | 'unavailable_employee'
  | 'overlapping_assignment'
  | 'max_days_exceeded'
  | 'max_shifts_exceeded'
  | 'prohibited_double'
  | 'incompatible_pair'
  | 'locked_assignment_changed'

export type ValidationViolation = {
  code: ValidationCode
  message: string
  slotId?: string
  relatedSlotId?: string
  employeeId?: string
}

export type Diagnostic = {
  code: string
  message: string
  day?: DayOfWeek
  period?: ShiftPeriod
  role?: Role
  slotId?: string
}

export type GenerateScheduleResult =
  | {
      status: 'OPTIMAL' | 'FEASIBLE'
      assignments: ScheduleAssignment[]
      diagnostics: Diagnostic[]
      objectiveScore: number
    }
  | {
      status: 'INFEASIBLE'
      assignments: ScheduleAssignment[]
      diagnostics: Diagnostic[]
      objectiveScore: null
    }

export type ScheduleStats = {
  employeeId: string
  name: string
  days: number
  shifts: number
  hours: number
}
