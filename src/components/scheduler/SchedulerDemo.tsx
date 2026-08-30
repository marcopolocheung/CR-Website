'use client'

import { useMemo, useState } from 'react'
import {
  DAYS,
  PERIODS,
  ROLES,
  calculateScheduleStats,
  expandTemplate,
  formatTimeRange,
  generateSchedule,
  isEmployeeAvailableForSlot,
  isEmployeeQualified,
  minutes,
  preflightDiagnostics,
  schedulerAssumptions,
  seedEmployees,
  seedTemplate,
  validateSchedule,
  type DayOfWeek,
  type Diagnostic,
  type Employee,
  type Role,
  type ScheduleAssignment,
  type ShiftPeriod,
  type StaffingSlot,
  type TimeRange,
  type ValidationViolation,
} from '@/lib/scheduler'

type AvailabilityMode = 'all' | 'am' | 'pm' | 'weekdayPm' | 'weekend' | 'gap'

type EmployeeDraft = {
  name: string
  roles: Record<Role, boolean>
  availabilityMode: AvailabilityMode
  maxDaysPerWeek: number
  allowDoubles: boolean
}

const roleLabels: Record<Role, string> = {
  server: 'Server',
  cashier: 'Cashier',
  lead: 'Shift lead',
  manager: 'Manager',
}

const periodLabels: Record<ShiftPeriod, string> = {
  AM: 'Morning',
  PM: 'Dinner',
}

const fullDay = { start: minutes(9, 30), end: minutes(23) }
const amShift = { start: minutes(9, 30), end: minutes(16) }
const pmShift = { start: minutes(16), end: minutes(23) }

function cloneEmployees() {
  return seedEmployees.map((employee) => ({
    ...employee,
    roles: [...employee.roles],
    recurringAvailability: Object.fromEntries(
      Object.entries(employee.recurringAvailability).map(([day, ranges]) => [
        day,
        ranges?.map((range) => ({ ...range })) ?? [],
      ]),
    ) as Employee['recurringAvailability'],
    incompatibleEmployeeIds: [...(employee.incompatibleEmployeeIds ?? [])],
  }))
}

function blankDraft(role: Role = 'server', availabilityMode: AvailabilityMode = 'all'): EmployeeDraft {
  return {
    name: '',
    roles: Object.fromEntries(ROLES.map((candidate) => [candidate, candidate === role])) as Record<Role, boolean>,
    availabilityMode,
    maxDaysPerWeek: 5,
    allowDoubles: false,
  }
}

function allDays(ranges: TimeRange[]) {
  return Object.fromEntries(DAYS.map((day) => [day, ranges])) as Employee['recurringAvailability']
}

function onlyDays(days: DayOfWeek[], ranges: TimeRange[]) {
  return Object.fromEntries(days.map((day) => [day, ranges])) as Employee['recurringAvailability']
}

function availabilityFromDraft(draft: EmployeeDraft, gapSlot?: StaffingSlot): Employee['recurringAvailability'] {
  if (draft.availabilityMode === 'gap' && gapSlot) {
    return onlyDays([gapSlot.day], [{ start: gapSlot.start, end: gapSlot.end }])
  }

  if (draft.availabilityMode === 'am') return allDays([amShift])
  if (draft.availabilityMode === 'pm') return allDays([pmShift])
  if (draft.availabilityMode === 'weekdayPm') {
    return onlyDays(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], [pmShift])
  }
  if (draft.availabilityMode === 'weekend') return onlyDays(['Saturday', 'Sunday'], [fullDay])
  return allDays([fullDay])
}

function createEmployeeId(name: string, employees: Employee[]) {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'new-employee'
  const existingIds = new Set(employees.map((employee) => employee.id))
  let id = base
  let suffix = 2

  while (existingIds.has(id)) {
    id = `${base}-${suffix}`
    suffix += 1
  }

  return id
}

function diagnosticLabel(diagnostic: Diagnostic) {
  if (diagnostic.day && diagnostic.period && diagnostic.role) {
    return `${diagnostic.day} ${periodLabels[diagnostic.period]} needs ${roleLabels[diagnostic.role]} coverage.`
  }

  return diagnostic.message
}

export default function SchedulerDemo() {
  const [employees, setEmployees] = useState<Employee[]>(cloneEmployees)
  const [assignments, setAssignments] = useState<ScheduleAssignment[]>([])
  const [diagnostics, setDiagnostics] = useState<string[]>([])
  const [draft, setDraft] = useState<EmployeeDraft>(() => blankDraft())
  const [employeePanelOpen, setEmployeePanelOpen] = useState(false)
  const slots = useMemo(() => expandTemplate(seedTemplate), [])
  const readinessProblems = useMemo(() => preflightDiagnostics(employees, slots), [employees, slots])
  const firstGap = readinessProblems.find((problem) => problem.day && problem.period && problem.role)
  const gapSlot = useMemo(
    () =>
      firstGap
        ? slots.find((slot) => slot.day === firstGap.day && slot.period === firstGap.period && slot.role === firstGap.role)
        : undefined,
    [firstGap, slots],
  )
  const violations = useMemo(
    () =>
      validateSchedule({
        employees,
        slots,
        assignments: assignments.filter((assignment) => assignment.employeeId),
        requireCoverage: assignments.length > 0,
      }),
    [assignments, employees, slots],
  )
  const stats = useMemo(() => calculateScheduleStats(employees, slots, assignments), [assignments, employees, slots])
  const assignmentMap = useMemo(
    () => new Map(assignments.map((assignment) => [assignment.slotId, assignment])),
    [assignments],
  )
  const activeEmployeeCount = employees.filter((employee) => employee.active).length
  const lockedCount = assignments.filter((assignment) => assignment.locked).length
  const assignedCount = assignments.filter((assignment) => assignment.employeeId).length
  const schedulePassing = assignments.length > 0 && violations.length === 0
  const selectedRoles = ROLES.filter((role) => draft.roles[role])
  const canAddEmployee = draft.name.trim().length > 0 && selectedRoles.length > 0

  function generate() {
    const result = generateSchedule(
      { employees, template: seedTemplate },
      { existingAssignments: assignments.filter((assignment) => assignment.locked) },
    )
    setDiagnostics(result.diagnostics.map((diagnostic) => diagnostic.message))
    if (result.status !== 'INFEASIBLE') {
      setAssignments(result.assignments)
    }
  }

  function reset() {
    setEmployees(cloneEmployees())
    setAssignments([])
    setDiagnostics([])
    setDraft(blankDraft())
    setEmployeePanelOpen(false)
  }

  function setEmployeeAssignment(slotId: string, employeeId: string) {
    setAssignments((current) => {
      const existing = current.find((assignment) => assignment.slotId === slotId)
      if (!employeeId) return current.filter((assignment) => assignment.slotId !== slotId)
      if (existing) {
        return current.map((assignment) =>
          assignment.slotId === slotId ? { ...assignment, employeeId } : assignment,
        )
      }
      return [...current, { slotId, employeeId }]
    })
  }

  function setLocked(slotId: string, locked: boolean) {
    setAssignments((current) =>
      current.map((assignment) => (assignment.slotId === slotId ? { ...assignment, locked } : assignment)),
    )
  }

  function updateEmployee(employeeId: string, update: Partial<Employee>) {
    setEmployees((current) =>
      current.map((employee) => (employee.id === employeeId ? { ...employee, ...update } : employee)),
    )
  }

  function openEmployeePanelForGap() {
    if (firstGap?.role) {
      setDraft(blankDraft(firstGap.role, 'gap'))
    } else {
      setDraft(blankDraft())
    }
    setEmployeePanelOpen(true)
  }

  function addEmployee() {
    if (!canAddEmployee) return
    const employee: Employee = {
      id: createEmployeeId(draft.name, employees),
      name: draft.name.trim(),
      roles: selectedRoles,
      recurringAvailability: availabilityFromDraft(draft, gapSlot),
      maxDaysPerWeek: draft.maxDaysPerWeek,
      allowDoubles: draft.allowDoubles,
      incompatibleEmployeeIds: [],
      active: true,
    }

    setEmployees((current) => [...current, employee])
    setDraft(blankDraft(firstGap?.role ?? selectedRoles[0], firstGap ? 'gap' : 'all'))
    setEmployeePanelOpen(false)
    setDiagnostics([`${employee.name} was added. Make the schedule again when the staff list looks right.`])
  }

  function makeInfeasible() {
    setEmployees((current) =>
      current.map((employee) =>
        employee.roles.includes('lead') || employee.roles.includes('manager')
          ? { ...employee, active: false }
          : employee,
      ),
    )
    setDiagnostics(['Lead and manager employees were deactivated. Make the schedule again to see where coverage is missing.'])
  }

  return (
    <div className="bg-zinc-50 text-zinc-950">
      <section className="border-b border-red-100 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-wide text-red-700">Scheduler demo</p>
              <h1 className="mt-2 text-3xl font-bold md:text-4xl">Weekly staff schedule</h1>
              <p className="mt-3 text-base text-zinc-700">
                Build the staff list, make the schedule, then review anything marked in yellow.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button tone="primary" onClick={generate} icon="spark">
                Make schedule
              </Button>
              <Button onClick={openEmployeePanelForGap} icon="plus">
                Add employee
              </Button>
              <Button onClick={() => window.print()} icon="print">
                Print
              </Button>
              <Button onClick={reset} icon="reset">
                Reset
              </Button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <StatusPanel label="Active employees" value={String(activeEmployeeCount)} />
            <StatusPanel label="Filled shifts" value={`${assignedCount}/${slots.length}`} />
            <StatusPanel label="Kept in place" value={String(lockedCount)} />
            <StatusPanel
              label="Schedule check"
              value={schedulePassing ? 'Ready' : assignments.length > 0 ? `${violations.length} to fix` : 'Not made'}
              tone={schedulePassing ? 'good' : assignments.length > 0 ? 'warn' : 'plain'}
            />
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="space-y-6">
          <section className="rounded border border-zinc-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Staff list</h2>
                <p className="mt-1 text-sm text-zinc-600">{employees.length} people saved for this demo</p>
              </div>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded border border-red-200 bg-red-50 text-red-800 hover:bg-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                onClick={() => setEmployeePanelOpen((open) => !open)}
                aria-label={employeePanelOpen ? 'Close employee form' : 'Add employee'}
                title={employeePanelOpen ? 'Close employee form' : 'Add employee'}
              >
                <Icon name={employeePanelOpen ? 'close' : 'plus'} />
              </button>
            </div>

            {employeePanelOpen && (
              <EmployeeForm
                draft={draft}
                gapSlot={gapSlot}
                canAddEmployee={canAddEmployee}
                onDraftChange={setDraft}
                onAdd={addEmployee}
              />
            )}

            <div className="mt-4 space-y-3">
              {employees.map((employee) => (
                <EmployeeCard key={employee.id} employee={employee} onUpdate={updateEmployee} />
              ))}
            </div>
          </section>

          <section className="rounded border border-zinc-200 bg-white p-4">
            <h2 className="text-lg font-semibold">Readiness</h2>
            <div className="mt-3 space-y-2">
              <ChecklistItem complete={activeEmployeeCount > 0} label={`${activeEmployeeCount} active employees`} />
              <ChecklistItem
                complete={readinessProblems.length === 0}
                label={readinessProblems.length === 0 ? 'Coverage looks ready' : `${readinessProblems.length} coverage gap${readinessProblems.length === 1 ? '' : 's'}`}
              />
              <ChecklistItem complete={schedulePassing} label={schedulePassing ? 'Schedule passes review' : 'Schedule needs review'} />
            </div>
            {firstGap && (
              <div className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                <div className="font-semibold">{diagnosticLabel(firstGap)}</div>
                <button
                  type="button"
                  className="mt-3 inline-flex items-center gap-2 rounded bg-amber-900 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-800"
                  onClick={openEmployeePanelForGap}
                >
                  <Icon name="plus" />
                  Add someone for this
                </button>
              </div>
            )}
          </section>
        </aside>

        <main className="space-y-6">
          {(diagnostics.length > 0 || violations.length > 0) && (
            <section className="rounded border border-amber-300 bg-amber-50 p-4">
              <h2 className="text-lg font-semibold text-amber-950">Needs attention</h2>
              <div className="mt-3 grid gap-4 lg:grid-cols-2">
                <MessageList title="Schedule maker" messages={diagnostics} empty="No messages." />
                <MessageList title="Review" messages={violations.map((violation) => violation.message)} empty="No review items." />
              </div>
            </section>
          )}

          <section className="rounded border border-zinc-200 bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold">Weekly schedule</h2>
              <Button onClick={makeInfeasible} icon="warning">
                Show gap example
              </Button>
            </div>
            <div className="mt-4 overflow-x-auto">
              <div className="grid min-w-[1040px] grid-cols-7 gap-3">
                {DAYS.map((day) => (
                  <DayColumn
                    key={day}
                    day={day}
                    slots={slots.filter((slot) => slot.day === day)}
                    employees={employees}
                    assignmentMap={assignmentMap}
                    violations={violations}
                    onAssign={setEmployeeAssignment}
                    onLock={setLocked}
                  />
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded border border-zinc-200 bg-white p-4">
              <h2 className="text-lg font-semibold">Staffing plan</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[700px] text-left text-sm">
                  <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="py-2 pr-3">Day</th>
                      <th className="py-2 pr-3">Shift</th>
                      <th className="py-2 pr-3">Position</th>
                      <th className="py-2 pr-3">Hours</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {slots.map((slot) => (
                      <tr key={slot.id}>
                        <td className="py-2 pr-3 font-medium text-zinc-900">{slot.day}</td>
                        <td className="py-2 pr-3 text-zinc-700">{periodLabels[slot.period]}</td>
                        <td className="py-2 pr-3 text-zinc-700">{slot.label}</td>
                        <td className="py-2 pr-3 text-zinc-700">{formatTimeRange(slot)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded border border-zinc-200 bg-white p-4">
              <h2 className="text-lg font-semibold">Employee totals</h2>
              <div className="mt-4 space-y-2">
                {stats.map((stat) => (
                  <div key={stat.employeeId} className="grid grid-cols-[1fr_auto] gap-3 border-b border-zinc-100 pb-2 text-sm last:border-0">
                    <div>
                      <div className="font-medium text-zinc-900">{stat.name}</div>
                      <div className="text-zinc-500">{stat.shifts} shift{stat.shifts === 1 ? '' : 's'}</div>
                    </div>
                    <div className="text-right text-zinc-700">
                      <div>{stat.days} day{stat.days === 1 ? '' : 's'}</div>
                      <div>{stat.hours.toFixed(1)} hrs</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded border border-zinc-200 bg-white p-4">
            <h2 className="text-lg font-semibold">Demo assumptions</h2>
            <ul className="mt-3 space-y-2 text-sm text-zinc-700">
              {schedulerAssumptions.map((assumption) => (
                <li key={assumption}>{assumption}</li>
              ))}
            </ul>
          </section>
        </main>
      </div>
    </div>
  )
}

function EmployeeForm({
  draft,
  gapSlot,
  canAddEmployee,
  onDraftChange,
  onAdd,
}: {
  draft: EmployeeDraft
  gapSlot?: StaffingSlot
  canAddEmployee: boolean
  onDraftChange: (draft: EmployeeDraft) => void
  onAdd: () => void
}) {
  return (
    <div className="mt-4 rounded border border-red-100 bg-red-50 p-3">
      <label className="block text-sm font-medium text-zinc-800">
        Employee name
        <input
          className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
          value={draft.name}
          onChange={(event) => onDraftChange({ ...draft, name: event.target.value })}
          placeholder="Name"
        />
      </label>

      <fieldset className="mt-3">
        <legend className="text-sm font-medium text-zinc-800">Positions</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {ROLES.map((role) => (
            <label key={role} className="flex items-center gap-2 rounded border border-zinc-200 bg-white px-2 py-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={draft.roles[role]}
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    roles: { ...draft.roles, [role]: event.target.checked },
                  })
                }
              />
              {roleLabels[role]}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mt-3 block text-sm font-medium text-zinc-800">
        Availability
        <select
          className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
          value={draft.availabilityMode === 'gap' && !gapSlot ? 'all' : draft.availabilityMode}
          onChange={(event) => onDraftChange({ ...draft, availabilityMode: event.target.value as AvailabilityMode })}
        >
          <option value="all">Any day, any shift</option>
          <option value="am">Morning shifts</option>
          <option value="pm">Dinner shifts</option>
          <option value="weekdayPm">Weekday dinner shifts</option>
          <option value="weekend">Saturday and Sunday</option>
          {(gapSlot || draft.availabilityMode === 'gap') && (
            <option value="gap">
              {gapSlot ? `${gapSlot.day} ${periodLabels[gapSlot.period]} only` : 'Coverage gap only'}
            </option>
          )}
        </select>
      </label>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="text-sm font-medium text-zinc-800">
          Max days
          <input
            className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
            min={1}
            max={7}
            type="number"
            value={draft.maxDaysPerWeek}
            onChange={(event) => onDraftChange({ ...draft, maxDaysPerWeek: Number(event.target.value) })}
          />
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm font-medium text-zinc-800">
          <input
            type="checkbox"
            checked={draft.allowDoubles}
            onChange={(event) => onDraftChange({ ...draft, allowDoubles: event.target.checked })}
          />
          Can work doubles
        </label>
      </div>

      <button
        type="button"
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded bg-red-800 px-4 py-2 text-sm font-semibold text-white hover:bg-red-900 disabled:cursor-not-allowed disabled:bg-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
        disabled={!canAddEmployee}
        onClick={onAdd}
      >
        <Icon name="plus" />
        Save employee
      </button>
    </div>
  )
}

function EmployeeCard({ employee, onUpdate }: { employee: Employee; onUpdate: (employeeId: string, update: Partial<Employee>) => void }) {
  return (
    <div className="rounded border border-zinc-200 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-950">{employee.name}</div>
          <div className="mt-1 text-xs uppercase tracking-wide text-zinc-500">
            {employee.roles.map((role) => roleLabels[role]).join(', ')}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={employee.active}
            onChange={(event) => onUpdate(employee.id, { active: event.target.checked })}
          />
          Active
        </label>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="text-sm text-zinc-700">
          Max days
          <input
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
            min={1}
            max={7}
            type="number"
            value={employee.maxDaysPerWeek ?? 7}
            onChange={(event) => onUpdate(employee.id, { maxDaysPerWeek: Number(event.target.value) })}
          />
        </label>
        <label className="flex items-end gap-2 pb-1 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={employee.allowDoubles}
            onChange={(event) => onUpdate(employee.id, { allowDoubles: event.target.checked })}
          />
          Doubles
        </label>
      </div>
    </div>
  )
}

function Button({
  children,
  icon,
  tone = 'plain',
  onClick,
}: {
  children: React.ReactNode
  icon: IconName
  tone?: 'plain' | 'primary'
  onClick: () => void
}) {
  const className =
    tone === 'primary'
      ? 'inline-flex items-center justify-center gap-2 rounded bg-red-800 px-4 py-2 text-sm font-semibold text-white hover:bg-red-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700'
      : 'inline-flex items-center justify-center gap-2 rounded border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700'

  return (
    <button type="button" className={className} onClick={onClick}>
      <Icon name={icon} />
      {children}
    </button>
  )
}

function StatusPanel({ label, value, tone = 'plain' }: { label: string; value: string; tone?: 'plain' | 'good' | 'warn' }) {
  const toneClass = tone === 'good' ? 'text-green-700' : tone === 'warn' ? 'text-amber-700' : 'text-zinc-950'
  return (
    <div className="rounded border border-zinc-200 bg-zinc-50 p-4">
      <div className="text-sm text-zinc-600">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</div>
    </div>
  )
}

function ChecklistItem({ complete, label }: { complete: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-zinc-700">
      <span
        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
          complete ? 'border-green-700 bg-green-700 text-white' : 'border-amber-400 bg-amber-50 text-amber-900'
        }`}
      >
        {complete ? <Icon name="check" /> : '!'}
      </span>
      {label}
    </div>
  )
}

function MessageList({ title, messages, empty }: { title: string; messages: string[]; empty: string }) {
  return (
    <div>
      <h3 className="font-semibold text-amber-950">{title}</h3>
      {messages.length > 0 ? (
        <ul className="mt-2 space-y-1 text-sm text-amber-900">
          {messages.map((message, index) => (
            <li key={`${message}-${index}`}>{message}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-amber-800">{empty}</p>
      )}
    </div>
  )
}

function DayColumn({
  day,
  slots,
  employees,
  assignmentMap,
  violations,
  onAssign,
  onLock,
}: {
  day: DayOfWeek
  slots: StaffingSlot[]
  employees: Employee[]
  assignmentMap: Map<string, ScheduleAssignment>
  violations: ValidationViolation[]
  onAssign: (slotId: string, employeeId: string) => void
  onLock: (slotId: string, locked: boolean) => void
}) {
  return (
    <div className="rounded border border-zinc-200 bg-zinc-50 p-3">
      <h3 className="text-center font-semibold text-zinc-950">{day.slice(0, 3)}</h3>
      {PERIODS.map((period) => (
        <div key={period} className="mt-3">
          <div className="mb-2 border-b border-zinc-200 pb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {periodLabels[period]}
          </div>
          <div className="space-y-2">
            {slots
              .filter((slot) => slot.period === period)
              .map((slot) => {
                const assignment = assignmentMap.get(slot.id)
                const slotViolations = violations.filter((violation) => violation.slotId === slot.id)
                const eligibleEmployees = employees.filter((employee) => employee.active && isEmployeeQualified(employee, slot) && isEmployeeAvailableForSlot(employee, slot))
                const otherEmployees = employees.filter((employee) => !eligibleEmployees.includes(employee))
                const hasIssue = slotViolations.length > 0
                return (
                  <div key={slot.id} className={`rounded border p-2 ${hasIssue ? 'border-amber-300 bg-amber-50' : 'border-zinc-200 bg-white'}`}>
                    <div className="min-h-9">
                      <div className="text-xs font-semibold text-zinc-900">{slot.label}</div>
                      <div className="text-[11px] text-zinc-500">{formatTimeRange(slot)}</div>
                    </div>
                    <select
                      className="mt-2 w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                      value={assignment?.employeeId ?? ''}
                      onChange={(event) => onAssign(slot.id, event.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {eligibleEmployees.length > 0 && (
                        <optgroup label="Best choices">
                          {eligibleEmployees.map((employee) => (
                            <option key={employee.id} value={employee.id}>
                              {employee.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {otherEmployees.length > 0 && (
                        <optgroup label="Other employees">
                          {otherEmployees.map((employee) => (
                            <option key={employee.id} value={employee.id}>
                              {employee.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    <label className="mt-2 flex items-center gap-2 text-xs text-zinc-600">
                      <input
                        type="checkbox"
                        disabled={!assignment}
                        checked={assignment?.locked ?? false}
                        onChange={(event) => onLock(slot.id, event.target.checked)}
                      />
                      Keep
                    </label>
                    {slotViolations.length > 0 && (
                      <ul className="mt-2 space-y-1 text-[11px] leading-4 text-amber-900">
                        {slotViolations.map((violation) => (
                          <li key={`${slot.id}-${violation.code}-${violation.employeeId ?? ''}`}>{violation.message}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })}
          </div>
        </div>
      ))}
    </div>
  )
}

type IconName = 'check' | 'close' | 'plus' | 'print' | 'reset' | 'spark' | 'warning'

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    check: <path d="M5 12l4 4L19 6" />,
    close: <path d="M6 6l12 12M18 6L6 18" />,
    plus: <path d="M12 5v14M5 12h14" />,
    print: <path d="M7 8V4h10v4M7 17H5V9h14v8h-2M7 14h10v6H7z" />,
    reset: <path d="M4 12a8 8 0 1 0 2.3-5.7M4 5v5h5" />,
    spark: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18 16l.8 2.2L21 19l-2.2.8L18 22l-.8-2.2L15 19l2.2-.8z" />,
    warning: <path d="M12 9v4M12 17h.01M10.3 4.9L2.8 18a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.9a2 2 0 0 0-3.4 0z" />,
  }

  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}
