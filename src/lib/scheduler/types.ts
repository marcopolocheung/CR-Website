export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
export const PERIODS = ['AM', 'PM'] as const
export const ROLES = ['server', 'cashier', 'lead', 'manager'] as const

export type DayOfWeek = (typeof DAYS)[number]
export type ShiftPeriod = (typeof PERIODS)[number]
export type Role = (typeof ROLES)[number]

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
