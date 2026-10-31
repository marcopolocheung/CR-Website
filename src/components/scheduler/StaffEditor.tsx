'use client'

import { Fragment, useId, useState } from 'react'
import {
  DAYS,
  PERIODS,
  formatTimeRange,
  DEFAULT_PRIORITY,
  isValidRoleSlug,
  minutes,
  normalizeRoleSlug,
  formatDayLabel,
  type DayOfWeek,
  type Employee,
  type ScheduleStats,
  type ShiftPeriod,
  type StaffingSlot,
  type TimeRange,
} from '@/lib/scheduler'
import { EmployeeDraft, amShift, availabilityPresets, availabilitySummary, clampAvailabilityRange, clampMaxDays, dayAvailabilityFromRanges, parseMaxHours, fullDay, gapAvailability, isCustomDayRanges, periodLabels, pmShift, rangesForDayToggle, roleChipClass, roleLabel, suspensionText } from './helpers'
import { Disclosure, Icon } from './ui'
import { TimeField, minutesToTimeValue, timeValueToMinutes } from './RulesEditor'
export function AvailabilityPresetBar({
  onApply,
  gapSlot,
  weekStart,
}: {
  onApply: (availability: Employee['recurringAvailability']) => void
  gapSlot?: StaffingSlot
  weekStart?: string
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {availabilityPresets.map((preset) => (
        <button
          key={preset.label}
          type="button"
          className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
          onClick={() => onApply(preset.build())}
        >
          {preset.label}
        </button>
      ))}
      {gapSlot && (
        <button
          type="button"
          className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
          onClick={() => onApply(gapAvailability(gapSlot))}
        >
          {weekStart ? formatDayLabel(weekStart, gapSlot.day) : gapSlot.day} {periodLabels[gapSlot.period]} only
        </button>
      )}
    </div>
  )
}

export function AvailabilityGridEditor({
  recurringAvailability,
  onToggle,
  onChange,
  showCustomControls = false,
  onToggleCustomControls,
  presets,
}: {
  recurringAvailability: Employee['recurringAvailability']
  onToggle: (day: DayOfWeek, period: 'am' | 'pm', checked: boolean) => void
  onChange?: (day: DayOfWeek, ranges: TimeRange[]) => void
  showCustomControls?: boolean
  onToggleCustomControls?: () => void
  presets?: React.ReactNode
}) {
  const [pendingReset, setPendingReset] = useState<{ day: DayOfWeek; period: 'am' | 'pm'; checked: boolean } | null>(null)
  const customControlsId = useId()
  const canCustomize = Boolean(onChange && onToggleCustomControls)
  const expanded = canCustomize ? showCustomControls : true

  // Ticking AM/PM on a day with custom hours would wipe them, so ask first.
  function requestToggle(day: DayOfWeek, period: 'am' | 'pm', checked: boolean) {
    if (isCustomDayRanges(recurringAvailability[day] ?? [])) {
      setPendingReset({ day, period, checked })
      return
    }
    setPendingReset(null)
    onToggle(day, period, checked)
  }

  function updateRangeTime(day: DayOfWeek, index: number, field: 'start' | 'end', value: string) {
    if (!onChange) return
    const current = [...(recurringAvailability[day] ?? [])]
    const base = current[index]
    if (!base) return
    const nextMinutes = timeValueToMinutes(value)
    const next =
      field === 'start'
        ? clampAvailabilityRange(nextMinutes, base.end)
        : clampAvailabilityRange(base.start, nextMinutes === 0 ? minutes(23, 59) : nextMinutes)
    if (!next) return
    current[index] = next
    onChange(day, current)
  }

  function removeRange(day: DayOfWeek, index: number) {
    if (!onChange) return
    onChange(
      day,
      (recurringAvailability[day] ?? []).filter((_, candidate) => candidate !== index),
    )
  }

  function addRange(day: DayOfWeek) {
    if (!onChange) return
    const current = recurringAvailability[day] ?? []
    if (current.length >= 3) return
    onChange(day, [...current, { ...fullDay }])
  }

  function isSingleCustomRange(range: TimeRange) {
    return !(
      (range.start === amShift.start && range.end === amShift.end) ||
      (range.start === pmShift.start && range.end === pmShift.end) ||
      (range.start === fullDay.start && range.end === fullDay.end)
    )
  }

  return (
    <div className="mt-2 space-y-1.5">
      {expanded && presets ? presets : null}
      <div className="grid grid-cols-[2.5rem_2rem_2rem_1fr] items-center gap-x-3">
        <span />
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">AM</span>
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">PM</span>
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Hours</span>
      </div>
      {DAYS.map((day) => {
        const { am, pm } = dayAvailabilityFromRanges(recurringAvailability[day])
        const ranges = recurringAvailability[day] ?? []
        const single = ranges.length === 1 ? ranges[0] : null
        const custom = isCustomDayRanges(ranges)
        const confirming = pendingReset?.day === day
        const customLabel = ranges.length === 0 ? '' : ranges.map((range) => formatTimeRange(range)).join(' + ')
        return (
          <Fragment key={day}>
            <div className="grid grid-cols-[2.5rem_2rem_2rem_1fr] items-center gap-x-3">
              <span className="text-xs text-zinc-700">{day.slice(0, 3)}</span>
              <label className="flex items-center justify-start">
                <input type="checkbox" checked={am} onChange={(event) => requestToggle(day, 'am', event.target.checked)} />
              </label>
              <label className="flex items-center justify-start">
                <input type="checkbox" checked={pm} onChange={(event) => requestToggle(day, 'pm', event.target.checked)} />
              </label>
              <div className="min-w-0 space-y-1">
                {ranges.length === 0 && <span className="text-xs text-zinc-400">Off</span>}
                {ranges.map((range, index) => (
                  <div key={index} className="flex min-w-0 flex-wrap items-center gap-1">
                    <TimeField
                      ariaLabel={`${day} availability ${index + 1} start`}
                      value={range.start}
                      disabled={!onChange}
                      onChange={(totalMinutes) => updateRangeTime(day, index, 'start', minutesToTimeValue(totalMinutes))}
                    />
                    <span aria-hidden="true" className="text-xs text-zinc-500">
                      to
                    </span>
                    <TimeField
                      ariaLabel={`${day} availability ${index + 1} end`}
                      value={range.end}
                      disabled={!onChange}
                      onChange={(totalMinutes) => updateRangeTime(day, index, 'end', minutesToTimeValue(totalMinutes))}
                    />
                    {isSingleCustomRange(range) && (
                      <span className="rounded border border-sky-200 bg-sky-50 px-1 py-px text-[10px] font-semibold text-sky-900">
                        Custom
                      </span>
                    )}
                    {onChange && ranges.length > 1 && (
                      <button
                        type="button"
                        aria-label={`Remove ${day} hours ${index + 1}`}
                        className="rounded border border-zinc-300 bg-white px-1 py-px text-[11px] font-semibold text-zinc-600 hover:bg-zinc-100"
                        onClick={() => removeRange(day, index)}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                {onChange && ranges.length >= 1 && ranges.length < 3 && (
                  <button
                    type="button"
                    className="text-[11px] font-semibold text-sky-800 hover:text-sky-900"
                    onClick={() => addRange(day)}
                  >
                    + Add hours
                  </button>
                )}
                {onChange && ranges.length === 0 && (
                  <button
                    type="button"
                    className="text-[11px] font-semibold text-sky-800 hover:text-sky-900"
                    onClick={() => addRange(day)}
                  >
                    + Add hours
                  </button>
                )}
              </div>
              {confirming && (
                <div className="ml-10 mt-1 flex flex-wrap items-center gap-2 rounded border border-amber-300 bg-amber-50 px-2 py-1.5">
                  <span className="text-[11px] font-medium text-amber-900">
                    Replace {customLabel || 'custom hours'} with standard halves?
                  </span>
                  <button
                    type="button"
                    className="rounded border border-zinc-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-100"
                    onClick={() => setPendingReset(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="rounded bg-zinc-900 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-zinc-700"
                    onClick={() => {
                      const pending = pendingReset
                      setPendingReset(null)
                      if (pending) onToggle(pending.day, pending.period, pending.checked)
                    }}
                  >
                    Use standard
                  </button>
                </div>
              )}
              {expanded && custom && single && !confirming && (
                <p className="ml-10 text-[11px] text-zinc-500">
                  Custom {formatTimeRange(single)} — AM/PM boxes only show overlap; changing them resets to standard halves.
                </p>
              )}
            </div>
          </Fragment>
          )
        })}
      {canCustomize && onToggleCustomControls && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={customControlsId}
          className="text-[11px] font-semibold text-sky-800 hover:text-sky-900"
          onClick={onToggleCustomControls}
        >
          {expanded ? 'Hide custom hours' : 'Customize hours / Apply presets'}
        </button>
      )}
    </div>
  )
}

export function EmployeeForm({
  draft,
  gapSlot,
  weekStart,
  canAddEmployee,
  roles,
  onDraftChange,
  onAdd,
  onAddCustomRole,
}: {
  draft: EmployeeDraft
  gapSlot?: StaffingSlot
  weekStart: string
  canAddEmployee: boolean
  roles: string[]
  onDraftChange: (draft: EmployeeDraft) => void
  onAdd: () => void
  onAddCustomRole: (raw: string) => void
}) {
  const saveHint = !draft.name.trim()
    ? 'Add a name to save.'
    : roles.every((role) => !draft.roles[role]) && !draft.newHire
      ? 'Pick at least one position, or mark them a new hire, to save.'
      : null
  const [customizing, setCustomizing] = useState(false)
  const [customRole, setCustomRole] = useState('')

  function toggleAvailabilityDay(day: DayOfWeek, period: 'am' | 'pm', checked: boolean) {
    const current = dayAvailabilityFromRanges(draft.recurringAvailability[day])
    const next = { ...current, [period]: checked }
    onDraftChange({
      ...draft,
      recurringAvailability: { ...draft.recurringAvailability, [day]: rangesForDayToggle(next.am, next.pm) },
    })
  }

  function changeAvailabilityDay(day: DayOfWeek, ranges: TimeRange[]) {
    onDraftChange({
      ...draft,
      recurringAvailability: { ...draft.recurringAvailability, [day]: ranges },
    })
  }
  return (
    <div className="mt-4 rounded border border-zinc-200 bg-zinc-50 p-3">
      <label className="block text-sm font-medium text-zinc-800">
        Employee name
        <input
          className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
          value={draft.name}
          onChange={(event) => onDraftChange({ ...draft, name: event.target.value })}
          placeholder="Name"
        />
      </label>

      <fieldset className="mt-3">
        <legend className="text-sm font-medium text-zinc-800">Positions</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {roles.map((role) => (
            <label key={role} className="flex items-center gap-2 rounded border border-zinc-200 bg-white px-2 py-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={Boolean(draft.roles[role])}
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    roles: { ...draft.roles, [role]: event.target.checked },
                  })
                }
              />
              {roleLabel(role)}
            </label>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            className="min-w-0 flex-1 rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
            value={customRole}
            onChange={(event) => setCustomRole(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                onAddCustomRole(customRole)
                setCustomRole('')
              }
            }}
            placeholder="New position (e.g. Sushi Chef)"
            aria-label="Add a custom position"
          />
          <button
            type="button"
            className="shrink-0 rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
            disabled={!normalizeRoleSlug(customRole)}
            onClick={() => {
              onAddCustomRole(customRole)
              setCustomRole('')
            }}
            title="Add any position you need — it becomes available everywhere on this page."
          >
            Add position
          </button>
        </div>
      </fieldset>

      <fieldset className="mt-3">
        <legend className="text-sm font-medium text-zinc-800">Availability</legend>
        <p className="mt-1 text-xs text-zinc-500">
          Pick AM/PM per day. For 12-7 or 4-7 workers, customize hours then fine-tune per-day. 12-7 spans both halves:
          keep doubles on if they can take one morning plus one dinner spot the same day.
        </p>
        <AvailabilityGridEditor
          recurringAvailability={draft.recurringAvailability}
          onToggle={toggleAvailabilityDay}
          onChange={changeAvailabilityDay}
          showCustomControls={customizing}
          onToggleCustomControls={() => setCustomizing((value) => !value)}
          presets={
            <AvailabilityPresetBar
              onApply={(availability) => onDraftChange({ ...draft, recurringAvailability: availability })}
              gapSlot={gapSlot}
              weekStart={weekStart}
            />
          }
        />
      </fieldset>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="text-sm font-medium text-zinc-800">
          Max days (1–7)
          <input
            className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
            min={1}
            max={7}
            type="number"
            value={draft.maxDaysPerWeek}
            onChange={(event) => onDraftChange({ ...draft, maxDaysPerWeek: clampMaxDays(Number(event.target.value)) })}
          />
        </label>
        <label className="text-sm font-medium text-zinc-800">
          Max hours (optional)
          <input
            className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
            min={1}
            max={80}
            type="number"
            inputMode="numeric"
            placeholder="No limit"
            value={draft.maxHoursPerWeek ?? ''}
            onChange={(event) => onDraftChange({ ...draft, maxHoursPerWeek: parseMaxHours(event.target.value) })}
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

      <label className="mt-3 flex items-center gap-2 text-sm font-medium text-zinc-800">
        <input
          type="checkbox"
          checked={draft.newHire}
          onChange={(event) => onDraftChange({ ...draft, newHire: event.target.checked })}
        />
        New hire (can be placed in any position, still limited by max days)
      </label>

      <button
        type="button"
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
        disabled={!canAddEmployee}
        onClick={onAdd}
        title={saveHint ?? 'Save this person to the staff list.'}
        aria-disabled={!canAddEmployee}
      >
        <Icon name="plus" />
        Save employee
      </button>
      {saveHint && (
        <p className="mt-2 text-xs text-zinc-600" role="note">
          {saveHint}
        </p>
      )}
    </div>
  )
}

export function EmployeeCard({
  employee,
  stat,
  roles,
  onUpdate,
  onRemove,
  readOnly = false,
}: {
  employee: Employee
  stat?: ScheduleStats
  roles: string[]
  onUpdate: (employeeId: string, update: Partial<Employee>) => void
  onRemove: (employeeId: string) => void
  readOnly?: boolean
}) {
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const [customizing, setCustomizing] = useState(false)
  // Union so custom posts already on this person never disappear from their card.
  const visibleRoles = [...roles]
  for (const role of employee.roles) {
    if (isValidRoleSlug(role) && !visibleRoles.includes(role)) visibleRoles.push(role)
  }

  function toggleRole(role: string, enabled: boolean) {
    const next = enabled ? [...employee.roles, role] : employee.roles.filter((candidate) => candidate !== role)
    onUpdate(employee.id, { roles: [...new Set(next)] })
  }

  if (readOnly) {
    return (
      <div className="rounded border border-zinc-200 bg-white p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate font-semibold text-zinc-950">{employee.name}</div>
            <p className="mt-0.5 text-xs text-zinc-600">
              {availabilitySummary(employee)} · {stat && stat.shifts > 0 ? `${stat.hours.toFixed(1)}h · ${stat.days}d this week` : 'off this week'}
            </p>
          </div>
          {!employee.active && <span className="shrink-0 text-xs font-semibold text-zinc-500">Off the list</span>}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {visibleRoles
            .filter((role) => employee.roles.includes(role))
            .map((role) => (
              <span key={role} className={`inline-flex items-center rounded border px-2 py-1 text-xs font-medium ${roleChipClass(role)}`}>
                {roleLabel(role)}
              </span>
            ))}
          {employee.newHire && (
            <span className="inline-flex items-center rounded border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-medium text-sky-900">New hire</span>
          )}
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Max {employee.maxDaysPerWeek ?? 7} days{employee.maxHoursPerWeek !== undefined && `, ${employee.maxHoursPerWeek} h`} · {employee.allowDoubles ? `doubles${employee.maxDoublesPerWeek !== undefined ? ` (max ${employee.maxDoublesPerWeek})` : ''}` : 'no doubles'} · Priority {employee.priority ?? DEFAULT_PRIORITY}
          {employee.suspendedFrom && ` · Suspended ${suspensionText(employee)}`}
        </p>
        {(employee.shiftRoles?.length ?? 0) > 0 && (
          <p className="mt-1 text-xs text-zinc-600">Only as: {shiftRolesText(employee)}</p>
        )}
      </div>
    )
  }

  return (
    <div className="rounded border border-zinc-200 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold text-zinc-950">{employee.name}</div>
          <p className="mt-0.5 text-xs text-zinc-600">
            {availabilitySummary(employee)} · {stat && stat.shifts > 0 ? `${stat.hours.toFixed(1)}h · ${stat.days}d this week` : 'off this week'}
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={employee.active}
            onChange={(event) => onUpdate(employee.id, { active: event.target.checked })}
          />
          Working
        </label>
      </div>

      {confirmingRemove ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded border border-red-300 bg-red-50 px-2 py-1.5">
          <span className="text-xs font-semibold text-red-900">Remove {employee.name} from the staff list?</span>
          <button
            type="button"
            className="rounded bg-red-800 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
            onClick={() => onRemove(employee.id)}
          >
            Yes, remove
          </button>
          <button
            type="button"
            className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
            onClick={() => setConfirmingRemove(false)}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="mt-2 text-xs font-semibold text-red-800 hover:text-red-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
          onClick={() => setConfirmingRemove(true)}
        >
          Remove from staff list
        </button>
      )}

      <fieldset className="mt-2">
        <legend className="sr-only">Positions {employee.name} can work</legend>
        <div className="flex flex-wrap gap-1.5">
          {visibleRoles.map((role) => {
            const checked = employee.roles.includes(role)
            return (
              <label
                key={role}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded border px-2 py-1 text-xs font-medium ${
                  checked ? roleChipClass(role) : 'border-zinc-200 bg-white text-zinc-400'
                }`}
              >
                <input
                  type="checkbox"
                  className="h-3 w-3"
                  checked={checked}
                  onChange={(event) => toggleRole(role, event.target.checked)}
                />
                {roleLabel(role)}
              </label>
            )
          })}
        </div>
      </fieldset>

      {employee.roles.length === 0 && !employee.newHire && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-800">
          <Icon name="warning" />
          No positions picked, so {employee.name} cannot be scheduled.
        </p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="text-sm text-zinc-700">
          Max days (1–7)
          <input
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
            min={1}
            max={7}
            type="number"
            value={employee.maxDaysPerWeek ?? 7}
            onChange={(event) => onUpdate(employee.id, { maxDaysPerWeek: clampMaxDays(Number(event.target.value)) })}
          />
        </label>
        <label className="text-sm text-zinc-700">
          Max hours
          <input
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
            min={1}
            max={80}
            type="number"
            inputMode="numeric"
            placeholder="No limit"
            value={employee.maxHoursPerWeek ?? ''}
            onChange={(event) => onUpdate(employee.id, { maxHoursPerWeek: parseMaxHours(event.target.value) })}
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

      <label className="mt-2 flex items-center gap-2 text-sm text-zinc-700">
        <input
          type="checkbox"
          checked={Boolean(employee.newHire)}
          onChange={(event) => onUpdate(employee.id, { newHire: event.target.checked })}
        />
        New hire (any position, still limited by max days)
      </label>

      <label className="mt-3 block text-sm text-zinc-700">
        Priority
        <select
          className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
          value={employee.priority ?? DEFAULT_PRIORITY}
          onChange={(event) => onUpdate(employee.id, { priority: Number(event.target.value) })}
        >
          {[1, 2, 3, 4, 5].map((rank) => (
            <option key={rank} value={rank}>
              {rank === 1 ? '1 (scheduled first)' : rank === 5 ? '5 (scheduled last)' : rank === DEFAULT_PRIORITY ? `${rank} (normal)` : rank}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="mt-3">
        <legend className="text-sm text-zinc-700">Suspended (not scheduled on these dates)</legend>
        <div className="mt-1 grid grid-cols-2 gap-3">
          <label className="text-xs text-zinc-600">
            From
            <input
              type="date"
              className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
              value={employee.suspendedFrom ?? ''}
              onChange={(event) => {
                const from = event.target.value || undefined
                const until = from && employee.suspendedUntil && employee.suspendedUntil >= from ? employee.suspendedUntil : from
                onUpdate(employee.id, { suspendedFrom: from, suspendedUntil: until })
              }}
            />
          </label>
          <label className="text-xs text-zinc-600">
            Through
            <input
              type="date"
              className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
              value={employee.suspendedUntil ?? ''}
              min={employee.suspendedFrom}
              disabled={!employee.suspendedFrom}
              onChange={(event) => onUpdate(employee.id, { suspendedUntil: event.target.value || employee.suspendedFrom })}
            />
          </label>
        </div>
        {employee.suspendedFrom && (
          <button
            type="button"
            className="mt-1 text-xs font-semibold text-red-800 hover:text-red-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
            onClick={() => onUpdate(employee.id, { suspendedFrom: undefined, suspendedUntil: undefined })}
          >
            Clear suspension
          </button>
        )}
      </fieldset>

      <ShiftRolesEditor employee={employee} roles={visibleRoles} onUpdate={onUpdate} />

      <Disclosure summary="Edit availability" tone="quiet">
        <AvailabilityGridEditor
          recurringAvailability={employee.recurringAvailability}
          onToggle={(day, period, checked) => {
            const current = dayAvailabilityFromRanges(employee.recurringAvailability[day])
            const next = { ...current, [period]: checked }
            onUpdate(employee.id, {
              recurringAvailability: { ...employee.recurringAvailability, [day]: rangesForDayToggle(next.am, next.pm) },
            })
          }}
          onChange={(day, ranges) => {
            onUpdate(employee.id, {
              recurringAvailability: { ...employee.recurringAvailability, [day]: ranges },
            })
          }}
          showCustomControls={customizing}
          onToggleCustomControls={() => setCustomizing((value) => !value)}
          presets={
            <AvailabilityPresetBar
              onApply={(availability) => onUpdate(employee.id, { recurringAvailability: availability })}
            />
          }
        />
      </Disclosure>
    </div>
  )
}

export function shiftRolesText(employee: Employee) {
  return (employee.shiftRoles ?? [])
    .map((shiftRole) => `${shiftRole.day.slice(0, 3)} ${periodLabels[shiftRole.period]} → ${roleLabel(shiftRole.role)}`)
    .join(', ')
}

export function ShiftRolesEditor({
  employee,
  roles,
  onUpdate,
}: {
  employee: Employee
  roles: string[]
  onUpdate: (employeeId: string, update: Partial<Employee>) => void
}) {
  const shiftRoles = employee.shiftRoles ?? []
  const [day, setDay] = useState<DayOfWeek>(DAYS[0])
  const [period, setPeriod] = useState<ShiftPeriod>('AM')
  const [role, setRole] = useState(employee.roles[0] ?? roles[0] ?? '')
  const selectClass =
    'rounded border border-zinc-300 bg-white px-1.5 py-1 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900'

  function save(next: Employee['shiftRoles']) {
    onUpdate(employee.id, { shiftRoles: next && next.length > 0 ? next : undefined })
  }

  return (
    <Disclosure summary={`Only one position on a shift${shiftRoles.length > 0 ? ` (${shiftRoles.length})` : ''}`} tone="quiet">
      <p className="text-xs text-zinc-600">
        On these shifts {employee.name} is only scheduled in the position picked here. Other shifts use every position above.
      </p>
      {shiftRoles.length > 0 && (
        <ul className="mt-2 space-y-1">
          {shiftRoles.map((shiftRole) => (
            <li key={`${shiftRole.day}-${shiftRole.period}`} className="flex items-center justify-between gap-2 rounded bg-zinc-50 px-2 py-1 text-xs">
              <span>
                {shiftRole.day} {periodLabels[shiftRole.period]} → <span className="font-semibold">{roleLabel(shiftRole.role)}</span>
              </span>
              <button
                type="button"
                className="font-semibold text-red-800 hover:text-red-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                onClick={() => save(shiftRoles.filter((candidate) => candidate !== shiftRole))}
                aria-label={`Remove ${shiftRole.day} ${periodLabels[shiftRole.period]} rule`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <select className={selectClass} aria-label="Day" value={day} onChange={(event) => setDay(event.target.value as DayOfWeek)}>
          {DAYS.map((candidate) => (
            <option key={candidate} value={candidate}>
              {candidate}
            </option>
          ))}
        </select>
        <select className={selectClass} aria-label="Shift" value={period} onChange={(event) => setPeriod(event.target.value as ShiftPeriod)}>
          {PERIODS.map((candidate) => (
            <option key={candidate} value={candidate}>
              {periodLabels[candidate]}
            </option>
          ))}
        </select>
        <select className={selectClass} aria-label="Position" value={role} onChange={(event) => setRole(event.target.value)}>
          {roles.map((candidate) => (
            <option key={candidate} value={candidate}>
              {roleLabel(candidate)}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-900 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
          disabled={!role}
          onClick={() =>
            save([...shiftRoles.filter((candidate) => candidate.day !== day || candidate.period !== period), { day, period, role }])
          }
        >
          {shiftRoles.some((candidate) => candidate.day === day && candidate.period === period) ? 'Replace' : 'Add'}
        </button>
      </div>
    </Disclosure>
  )
}
