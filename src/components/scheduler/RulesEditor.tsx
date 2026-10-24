'use client'

import {
  DAYS,
  PERIODS,
  defaultRoleForRestaurant,
  formatTime,
  minutes,
  normalizeRoleSlug,
  type RuleProblem,
  type DayOfWeek,
  type ShiftPeriod,
  type StaffingTemplateSlot,
  type WeeklyStaffingTemplate,
  formatUpdatedAt,
} from '@/lib/scheduler'
import { periodLabels, roleLabel } from './helpers'
export function minutesToTimeValue(totalMinutes: number) {
  const hour = Math.floor(totalMinutes / 60)
  const minute = totalMinutes % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function timeValueToMinutes(value: string) {
  const [hour, minute] = value.split(':').map(Number)
  return (hour || 0) * 60 + (minute || 0)
}

export const TIME_MINUTE_STEPS = [0, 15, 30, 45]

/** 12-hour time picker (hour : minute AM/PM) so no screen ever shows a 24-hour clock. */
export function TimeField({
  value,
  onChange,
  disabled,
  ariaLabel,
}: {
  value: number
  onChange: (totalMinutes: number) => void
  disabled?: boolean
  ariaLabel: string
}) {
  const hour24 = Math.floor(value / 60)
  const minute = value % 60
  const period: 'AM' | 'PM' = hour24 >= 12 ? 'PM' : 'AM'
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
  const minuteOptions = TIME_MINUTE_STEPS.includes(minute)
    ? TIME_MINUTE_STEPS
    : [...TIME_MINUTE_STEPS, minute].sort((a, b) => a - b)

  function emit(nextHour12: number, nextMinute: number, nextPeriod: 'AM' | 'PM') {
    const base = nextHour12 % 12
    onChange((nextPeriod === 'PM' ? base + 12 : base) * 60 + nextMinute)
  }

  return (
    <span className="inline-flex items-center gap-0.5" role="group" aria-label={ariaLabel}>
      <select
        className="rounded border border-zinc-300 bg-white px-1 py-0.5 text-xs"
        aria-label={`${ariaLabel} hour`}
        value={hour12}
        disabled={disabled}
        onChange={(event) => emit(Number(event.target.value), minute, period)}
      >
        {Array.from({ length: 12 }, (_, index) => index + 1).map((hour) => (
          <option key={hour} value={hour}>
            {hour}
          </option>
        ))}
      </select>
      <span aria-hidden="true" className="text-xs text-zinc-500">
        :
      </span>
      <select
        className="rounded border border-zinc-300 bg-white px-1 py-0.5 text-xs"
        aria-label={`${ariaLabel} minute`}
        value={minute}
        disabled={disabled}
        onChange={(event) => emit(hour12, Number(event.target.value), period)}
      >
        {minuteOptions.map((option) => (
          <option key={option} value={option}>
            {String(option).padStart(2, '0')}
          </option>
        ))}
      </select>
      <select
        className="rounded border border-zinc-300 bg-white px-1 py-0.5 text-xs"
        aria-label={`${ariaLabel} AM or PM`}
        value={period}
        disabled={disabled}
        onChange={(event) => emit(hour12, minute, event.target.value as 'AM' | 'PM')}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </span>
  )
}

export function blankTemplateSlot(role = 'server', label = 'Server'): StaffingTemplateSlot {
  return { period: 'AM', role, label, start: minutes(9, 30), end: minutes(16), required: true }
}

export function TemplateEditor({
  template,
  roles,
  onChange,
  onUseDefault,
  isDefaultTemplate,
  dirty,
  loadError,
  restaurantId,
  updatedAt,
  readOnly = false,
  problems,
}: {
  template: WeeklyStaffingTemplate
  roles: string[]
  onChange: (template: WeeklyStaffingTemplate) => void
  onUseDefault: () => void
  isDefaultTemplate: boolean
  dirty: boolean
  loadError: string
  restaurantId?: string
  updatedAt: string | null
  readOnly?: boolean
  problems: RuleProblem[]
}) {
  if (readOnly) {
    return (
      <section className="border-t border-zinc-100 p-4 print:hidden">
        <h3 className="font-semibold">Shift rules (locked)</h3>
        <p className="mt-0.5 text-sm text-zinc-600">
          The spots below are locked for this station — enter the staff password in Employee settings above to change this week’s rules. You build
          the week by putting the crew into them and moving people around.
        </p>
        <div className="mt-3 space-y-3">
          {DAYS.map((day) => (
            <div key={day} className="rounded border border-zinc-200 p-2.5">
              <h4 className="text-sm font-semibold text-zinc-900">{day}</h4>
              <ul className="mt-1 space-y-1 text-xs text-zinc-700">
                {template[day].map((slot, index) => (
                  <li key={index} className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{slot.label}</span>
                    <span className="text-zinc-500">{roleLabel(slot.role)}</span>
                    <span>
                      {formatTime(slot.start)} – {formatTime(slot.end)}
                    </span>
                    {slot.required ? (
                      <span className="font-semibold text-zinc-900">required</span>
                    ) : (
                      <span className="text-zinc-400">optional</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    )
  }

  function updateDay(day: DayOfWeek, daySlots: StaffingTemplateSlot[]) {
    onChange({ ...template, [day]: daySlots })
  }

  function updateSlot(day: DayOfWeek, index: number, update: Partial<StaffingTemplateSlot>) {
    updateDay(day, template[day].map((slot, candidate) => (candidate === index ? { ...slot, ...update } : slot)))
  }

  function removeSlot(day: DayOfWeek, index: number) {
    updateDay(day, template[day].filter((_, candidate) => candidate !== index))
  }

  function addSlot(day: DayOfWeek) {
    const fallback = roles[0] ?? defaultRoleForRestaurant(restaurantId)
    updateDay(day, [...template[day], blankTemplateSlot(fallback, roleLabel(fallback))])
  }

  return (
    <section className="border-t border-zinc-100 p-4 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">Shift rules</h3>
          <p className="mt-0.5 text-sm text-zinc-600">Who the restaurant needs on each shift for this week. Add, remove, or change any spot.</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Extra 12-7 / 4-7 help goes here as an added spot with exact times (e.g. Mid 12:00 PM - 4:00 PM,
            Evening 4:00 PM - 7:00 PM) on top of the core AM/PM spots.
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Last saved: {formatUpdatedAt(updatedAt)}{dirty ? ' · unsaved changes — use Save changes above' : ''} · changes stay in this week only
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            className="rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
            onClick={onUseDefault}
            disabled={isDefaultTemplate}
            title={
              isDefaultTemplate
                ? 'Already using the starting rules.'
                : 'Replace this week’s rules with the starting rules. You can undo, then save to keep them.'
            }
          >
            Use starting rules
          </button>
        </div>
      </div>
      {loadError && <p className="mt-2 text-xs font-medium text-amber-800">{loadError}</p>}
      {problems.length > 0 && (
        <div className="mt-2 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-900" role="alert">
          <p className="font-semibold">Fix {problems.length === 1 ? 'this spot' : `these ${problems.length} spots`} before saving:</p>
          <ul className="mt-1 list-disc pl-4">
            {problems.map((problem) => (
              <li key={`${problem.day}-${problem.index}`}>{problem.message}</li>
            ))}
          </ul>
        </div>
      )}
      <datalist id="scheduler-role-options">
        {roles.map((role) => (
          <option key={role} value={role}>
            {roleLabel(role)}
          </option>
        ))}
      </datalist>
      <div className="mt-3 space-y-3">
        {DAYS.map((day) => (
          <div key={day} className="rounded border border-zinc-200 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-zinc-900">{day}</h4>
              <button
                type="button"
                className="shrink-0 rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                onClick={() => addSlot(day)}
              >
                + Add spot
              </button>
            </div>
            <div className="mt-2 space-y-2">
              {template[day].length === 0 && <p className="text-xs text-zinc-500">No spots this day.</p>}
              {template[day].map((slot, index) => (
                <div
                  key={index}
                  className={`flex flex-wrap items-center gap-1.5 rounded p-1.5 ${
                    problems.some((problem) => problem.day === day && problem.index === index)
                      ? 'bg-red-50 ring-1 ring-red-400'
                      : 'bg-zinc-50'
                  }`}
                >
                  <select
                    className="rounded border border-zinc-300 bg-white px-1.5 py-1 text-xs"
                    value={slot.period}
                    onChange={(event) => updateSlot(day, index, { period: event.target.value as ShiftPeriod })}
                  >
                    {PERIODS.map((period) => (
                      <option key={period} value={period}>
                        {periodLabels[period]}
                      </option>
                    ))}
                  </select>
                  <input
                    className="w-28 rounded border border-zinc-300 bg-white px-1.5 py-1 text-xs"
                    value={slot.role}
                    list="scheduler-role-options"
                    onChange={(event) => updateSlot(day, index, { role: event.target.value })}
                    onBlur={(event) => {
                      const slug = normalizeRoleSlug(event.target.value)
                      updateSlot(day, index, { role: slug || slot.role })
                    }}
                    placeholder="Post"
                    title="Pick a post or type any new one (e.g. Sushi Chef) — it is saved with the rules."
                    aria-label="Post for this spot"
                  />
                  <input
                    className="min-w-0 flex-1 rounded border border-zinc-300 bg-white px-2 py-1 text-xs"
                    value={slot.label}
                    onChange={(event) => updateSlot(day, index, { label: event.target.value })}
                    placeholder="Label"
                    aria-label="Label for this spot"
                  />
                  <TimeField
                    ariaLabel="Spot start time"
                    value={slot.start}
                    onChange={(totalMinutes) => updateSlot(day, index, { start: totalMinutes })}
                  />
                  <span aria-hidden="true" className="text-xs text-zinc-500">to</span>
                  <TimeField
                    ariaLabel="Spot end time"
                    value={slot.end}
                    onChange={(totalMinutes) => updateSlot(day, index, { end: totalMinutes })}
                  />
                  <label className="flex items-center gap-1 text-xs text-zinc-700">
                    <input
                      type="checkbox"
                      checked={slot.required}
                      onChange={(event) => updateSlot(day, index, { required: event.target.checked })}
                    />
                    Required
                  </label>
                  <button
                    type="button"
                    className="ml-auto rounded border border-red-300 bg-white px-2 py-1 text-xs font-semibold text-red-800 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                    onClick={() => removeSlot(day, index)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
