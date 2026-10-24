'use client'

import {
  currentWeekStart,
  formatDayLabel,
  formatWeekRange,
  monthKeyForWeek,
  monthLabel,
  shiftMonth,
  type PublishState,
  type Employee,
  type ScheduleStats,
  type WeekStatus,
} from '@/lib/scheduler'
import { FixIssue, GenerationReport, WeekAssignments, emptyAssignments, periodLabels, statusForWeek } from './helpers'
import { Button, ChecklistItem, FlipSwitch, Icon, IconButton, publishStateMeta } from './ui'
export function OnboardingBanner({
  activeEmployeeCount,
  onDismiss,
}: {
  activeEmployeeCount: number
  onDismiss: () => void
}) {
  return (
    <section className="rounded-lg border border-sky-200 bg-sky-50 p-4 shadow-sm print:hidden" aria-label="Getting started">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-sky-950">Getting started</h2>
          <p className="mt-1 text-sm text-sky-900">Four steps to a published schedule:</p>
        </div>
        <IconButton icon="close" label="Dismiss getting-started tips" onClick={onDismiss} />
      </div>
      <div className="mt-3 space-y-2">
        <ChecklistItem complete={activeEmployeeCount > 0} label="Add everyone working this week in Employee settings" />
        <ChecklistItem complete={false} label={'Press "Make schedule" to build the week'} />
        <ChecklistItem complete={false} label="Review any issues shown above the schedule" />
        <ChecklistItem complete={false} label={'Press "Publish to staff" when it looks right'} />
      </div>
    </section>
  )
}

export function GuidedFixPanel({
  nextIssue,
  weekStart,
  issueCount,
  totalCount,
  ignoredCount,
  candidates,
  excluded,
  choosing,
  hasSchedule,
  onChooseEmployee,
  onPickEmployee,
  onAddEmployee,
  onIgnore,
  onShowIgnored,
  canAddEmployee = true,
}: {
  nextIssue?: FixIssue
  weekStart: string
  issueCount: number
  totalCount: number
  ignoredCount: number
  candidates: Employee[]
  excluded: { employee: Employee; reason: string }[]
  choosing: boolean
  hasSchedule: boolean
  onChooseEmployee: () => void
  onPickEmployee: (employeeId: string) => void
  onAddEmployee: () => void
  onIgnore: () => void
  onShowIgnored: () => void
  canAddEmployee?: boolean
}) {
  if (!nextIssue) {
    return (
      <section className="rounded-lg border border-green-300 bg-green-50 p-4 shadow-sm print:hidden">
        <div className="flex flex-wrap items-start gap-3">
          <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-700 text-white">
            <Icon name="check" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-green-950">
              {hasSchedule ? 'Nothing left to fix' : 'Ready when you are'}
            </h2>
            <p className="mt-1 text-sm text-green-900">
              {hasSchedule
                ? 'Every spot is filled and nobody is double-booked.'
                : 'Press Make schedule. Anything that needs a decision will show up here, one at a time.'}
            </p>
          </div>
          {ignoredCount > 0 && (
            <Button onClick={onShowIgnored} icon="undo">
              Show {ignoredCount} skipped
            </Button>
          )}
        </div>
      </section>
    )
  }

  const isBlocker = nextIssue.id.includes('missing_assignment') || nextIssue.id.startsWith('ready:')
  const position = totalCount > 0 ? totalCount - issueCount + 1 : 1
  return (
    <section
      className={`rounded-lg border p-4 shadow-sm print:hidden ${isBlocker ? 'border-red-400 bg-red-50' : 'border-amber-400 bg-amber-50'}`}
      aria-live="polite"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${isBlocker ? 'text-red-900' : 'text-amber-900'}`}>
            Fix {position} of {totalCount}
            {ignoredCount > 0 && ` · ${ignoredCount} skipped`}
          </p>
          <p className="mt-1">
            <span
              className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-bold ${
                isBlocker ? 'border-red-300 bg-white text-red-900' : 'border-amber-300 bg-white text-amber-950'
              }`}
            >
              <Icon name={isBlocker ? 'warning' : 'target'} />
              {isBlocker ? 'Must fix before printing' : 'You can skip this'}
            </span>
          </p>
          <h2 className={`mt-1 text-lg font-semibold ${isBlocker ? 'text-red-950' : 'text-amber-950'}`}>{nextIssue.title}</h2>
          <p className={`mt-1 text-sm ${isBlocker ? 'text-red-900' : 'text-amber-900'}`}>{nextIssue.detail}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button tone="primary" onClick={onChooseEmployee} icon="target" disabled={!nextIssue.slot}>
            Choose employee
          </Button>
          {canAddEmployee && (
            <Button onClick={onAddEmployee} icon="plus">
              Add employee
            </Button>
          )}
          <Button onClick={onIgnore} icon="close" disabled={isBlocker} title={isBlocker ? 'An empty spot must be filled — skipping would hide missing cover.' : 'Skip this for now.'}>
            Ignore for now
          </Button>
        </div>
      </div>
      {isBlocker && (
        <p className="mt-2 text-xs font-medium text-red-900">
          Empty spots block printing. Skipping is turned off so missing cover stays visible.
        </p>
      )}

      {choosing && nextIssue.slot && (
        <div className="mt-4 rounded border border-amber-300 bg-white p-3">
          {candidates.length > 0 ? (
            <>
              <p className="text-sm font-semibold text-zinc-900">
                Who should work {weekStart ? formatDayLabel(weekStart, nextIssue.slot.day) : nextIssue.slot.day} {periodLabels[nextIssue.slot.period]} as {nextIssue.slot.label}?
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {candidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    className="inline-flex items-center gap-2 rounded border border-green-500 bg-green-50 px-3 py-2 text-sm font-semibold text-green-950 hover:bg-green-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                    onClick={() => onPickEmployee(candidate.id)}
                  >
                    <Icon name="check" />
                    {candidate.name}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-zinc-500">Everyone here is free and trained for this position.</p>
              {excluded.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-semibold text-zinc-700 hover:text-zinc-900">
                    Why {excluded.length} other{excluded.length === 1 ? '' : 's'} can&apos;t cover this
                  </summary>
                  <ul className="mt-1 space-y-1 text-xs text-zinc-600">
                    {excluded.map(({ employee, reason }) => (
                      <li key={employee.id}>
                        <span className="font-medium text-zinc-800">{employee.name}</span> — {reason}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-zinc-700">
                {canAddEmployee
                  ? 'Nobody on the list is free and trained for this spot. Add someone, or open the shift below to override it.'
                  : 'Nobody on the crew is free and trained for this spot. Open the shift below to move someone else in.'}
              </p>
              {excluded.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-zinc-600">
                  {excluded.map(({ employee, reason }) => (
                    <li key={employee.id}>
                      <span className="font-medium text-zinc-800">{employee.name}</span> — {reason}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}

export function MonthStrip({
  monthKey,
  weekStart,
  monthWeeks,
  weeks,
  weekStatus,
  onSelectWeek,
  onSelectMonth,
  onToggleWeek,
  liveWeeks,
  currentState,
  editedWeeks,
}: {
  monthKey: string
  weekStart: string
  monthWeeks: string[]
  weeks: WeekAssignments
  weekStatus: Record<string, WeekStatus>
  onSelectWeek: (weekStart: string) => void
  onSelectMonth: (monthKey: string) => void
  onToggleWeek: (weekStart: string, status: WeekStatus) => void
  liveWeeks: Record<string, boolean>
  currentState: PublishState | null
  editedWeeks: string[]
}) {
  if (!monthKey) return null
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <IconButton icon="chevronLeft" label="Previous month" onClick={() => onSelectMonth(shiftMonth(monthKey, -1))} />
        <h3 className="min-w-36 text-center text-base font-bold">{monthLabel(monthKey)}</h3>
        <IconButton icon="chevronRight" label="Next month" onClick={() => onSelectMonth(shiftMonth(monthKey, 1))} />
        <button
          type="button"
          className="ml-1 rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
          onClick={() => onSelectMonth(monthKeyForWeek(currentWeekStart()))}
        >
          This month
        </button>
      </div>
      <div className="mt-2 grid w-full min-w-0 grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5" role="listbox" aria-label="Weeks in this month">
        {monthWeeks.map((week) => {
          const list = weeks[week] ?? emptyAssignments
          const status = statusForWeek(weekStatus, week, list)
          const selected = week === weekStart
          const filled = list.filter((assignment) => assignment.employeeId).length
          // What staff see right now — the switch only takes effect once the week is published.
          const state: PublishState =
            week === weekStart && currentState
              ? currentState
              : editedWeeks.includes(week)
                ? liveWeeks[week]
                  ? 'changed'
                  : 'draft'
                : liveWeeks[week]
                  ? 'live'
                  : 'draft'
          return (
            <div
              key={week}
              role="option"
              aria-selected={selected}
              className={`flex min-w-0 items-center gap-1.5 rounded border px-2 py-1.5 text-left ${
                selected ? 'border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900' : 'border-zinc-200 bg-white hover:bg-zinc-50'
              } ${status === 'off' ? 'opacity-70' : ''}`}
            >
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelectWeek(week)} title={formatWeekRange(week)}>
                <span className="block truncate text-xs font-semibold text-zinc-900">{formatWeekRange(week)}</span>
                <span className="mt-0.5 flex items-center gap-1 text-[11px] text-zinc-600">
                  <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${publishStateMeta[state].dot}`} />
                  {publishStateMeta[state].short} · {filled} filled
                </span>
              </button>
              <FlipSwitch
                on={status === 'on'}
                onFlip={() => onToggleWeek(week, status === 'on' ? 'off' : 'on')}
                label={`Show week of ${formatWeekRange(week)} to staff when published`}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function GenerationReportBanner({ report, onDismiss }: { report: GenerationReport; onDismiss: () => void }) {
  const failed = report.status === 'failed'
  return (
    <div
      key={report.id}
      role={failed ? 'alert' : 'status'}
      aria-live="polite"
      className={`mt-3 flex flex-col gap-2 rounded border p-3 sm:flex-row sm:items-center sm:justify-between print:hidden ${
        failed
          ? 'border-red-300 bg-red-50'
          : report.status === 'success'
            ? 'border-green-300 bg-green-50'
            : 'border-zinc-300 bg-zinc-50'
      }`}
    >
      <p
        className={`flex items-center gap-2 text-sm font-semibold ${
          failed ? 'text-red-950' : report.status === 'success' ? 'text-green-950' : 'text-zinc-800'
        }`}
      >
        <Icon name={failed ? 'warning' : report.status === 'success' ? 'check' : 'spark'} />
        {failed ? `Couldn’t make the schedule (${report.at}). ` : `Schedule ${report.status === 'success' ? 'updated' : 'checked'} at ${report.at}. `}
        <span className="font-normal">{report.detail}</span>
      </p>
      <button
        type="button"
        className="shrink-0 rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
        onClick={onDismiss}
      >
        Dismiss
      </button>
    </div>
  )
}

export function HoursSummary({ stats, employees }: { stats: ScheduleStats[]; employees: Employee[] }) {
  const working = stats.filter((stat) => stat.shifts > 0)
  if (working.length === 0) {
    return <p className="text-sm text-zinc-600">Make a schedule to see how the hours land.</p>
  }

  const mostHours = Math.max(...working.map((stat) => stat.hours))
  const idle = stats.filter((stat) => stat.shifts === 0)
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]))

  return (
    <div>
      <ul className="divide-y divide-zinc-100">
        {working.map((stat) => {
          const employee = employeeById.get(stat.employeeId)
          const maxDays = employee?.maxDaysPerWeek ?? 7
          const maxShifts = employee?.maxShiftsPerWeek
          const overloaded = stat.days > maxDays || (maxShifts !== undefined && stat.shifts > maxShifts)
          return (
            <li key={stat.employeeId} className="flex items-center gap-3 py-1.5 text-sm">
              <span className="w-24 shrink-0 truncate font-medium text-zinc-900">
                {stat.name}
                {overloaded && <span className="ml-1 font-bold text-red-700">· over</span>}
              </span>
              <span aria-hidden="true" className={`h-1.5 min-w-0 flex-1 rounded-full ${overloaded ? 'bg-red-100' : 'bg-zinc-100'}`}>
                <span
                  className={`block h-full rounded-full ${overloaded ? 'bg-red-600' : 'bg-zinc-400'}`}
                  style={{ width: `${Math.round((stat.hours / mostHours) * 100)}%` }}
                />
              </span>
              <span className={`w-14 shrink-0 text-right font-semibold ${overloaded ? 'text-red-800' : 'text-zinc-900'}`}>
                {stat.hours.toFixed(1)}h
              </span>
              <span className={`w-20 shrink-0 text-right text-xs ${overloaded ? 'font-semibold text-red-700' : 'text-zinc-500'}`}>
                {stat.days}d · {stat.shifts} shift{stat.shifts === 1 ? '' : 's'}
              </span>
            </li>
          )
        })}
      </ul>
      {idle.length > 0 && (
        <p className="mt-2 text-xs text-zinc-500">
          Not working this week: {idle.map((stat) => stat.name).join(', ')}
        </p>
      )}
    </div>
  )
}
