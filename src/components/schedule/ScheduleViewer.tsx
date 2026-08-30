'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  DAYS,
  dateForDay,
  dayOfMonth,
  expandTemplate,
  formatWeekRange,
  hoursFor,
  seedTemplate,
  type StaffingSlot,
} from '@/lib/scheduler'
import { UnreadableShareError, WrongCodeError, decryptWeek, type PublishedWeek } from '@/lib/schedule-share'

const seenKey = 'chinarose.schedule.seen.v1'

function readSeenWeeks(): PublishedWeek[] {
  try {
    const raw = window.localStorage.getItem(seenKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as PublishedWeek[]) : []
  } catch {
    return []
  }
}

function rememberWeek(week: PublishedWeek) {
  try {
    const others = readSeenWeeks().filter((seen) => seen.weekStart !== week.weekStart)
    const next = [...others, week].sort((a, b) => b.weekStart.localeCompare(a.weekStart)).slice(0, 12)
    window.localStorage.setItem(seenKey, JSON.stringify(next))
  } catch {
    // Viewing still works; this device just will not remember the week.
  }
}

export default function ScheduleViewer() {
  const slots = useMemo(() => expandTemplate(seedTemplate), [])
  const [token, setToken] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [week, setWeek] = useState<PublishedWeek | null>(null)
  const [seenWeeks, setSeenWeeks] = useState<PublishedWeek[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [onlyPerson, setOnlyPerson] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setToken(window.location.hash.slice(1) || null)
    setSeenWeeks(readSeenWeeks())
    setReady(true)
  }, [])

  async function unlock() {
    if (!token || !code) return
    setBusy(true)
    setError('')
    try {
      const opened = await decryptWeek(token, code)
      if (opened.slotPeople.length !== slots.length) {
        setError('This link was made with a different shift layout and cannot be shown here.')
        return
      }
      setWeek(opened)
      rememberWeek(opened)
      setSeenWeeks(readSeenWeeks())
    } catch (caught) {
      if (caught instanceof WrongCodeError) setError('That code did not work. Check with your manager.')
      else if (caught instanceof UnreadableShareError) setError('This link is damaged. Ask for a new one.')
      else setError('Something went wrong opening this schedule.')
    } finally {
      setBusy(false)
    }
  }

  if (week) {
    return (
      <WeekView
        week={week}
        slots={slots}
        onlyPerson={onlyPerson}
        onOnlyPersonChange={setOnlyPerson}
        onBack={() => {
          setWeek(null)
          setCode('')
        }}
      />
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold text-zinc-900">Staff schedule</h1>

      {/* The hash and this device's saved weeks are only readable after mount, and the page is
          prerendered, so hold the body back rather than flash the wrong state. */}
      {!ready ? null : token ? (
        <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <label className="block text-sm font-medium text-zinc-800">
            Type the code your manager gave you
            <input
              className="mt-2 w-full rounded border border-zinc-300 px-3 py-2 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
              value={code}
              autoComplete="off"
              onChange={(event) => setCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') unlock()
              }}
            />
          </label>
          <button
            type="button"
            className="mt-4 w-full rounded bg-red-800 px-4 py-3 text-base font-semibold text-white hover:bg-red-900 disabled:cursor-not-allowed disabled:bg-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
            onClick={unlock}
            disabled={busy || !code}
          >
            {busy ? 'Opening...' : 'Open the schedule'}
          </button>
          {error && <p className="mt-3 text-sm font-medium text-red-800">{error}</p>}
        </div>
      ) : (
        <p className="mt-4 text-zinc-700">
          Open the link your manager sent you to see a week. Weeks you have already opened on this device are listed
          below.
        </p>
      )}

      {ready && seenWeeks.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Weeks on this device</h2>
          <ul className="mt-3 space-y-2">
            {seenWeeks.map((seen) => (
              <li key={seen.weekStart}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-left hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                  onClick={() => setWeek(seen)}
                >
                  <span>
                    <span className="block font-semibold text-zinc-900">{formatWeekRange(seen.weekStart)}</span>
                    <span className="block text-sm text-zinc-600">{seen.name}</span>
                  </span>
                  <span aria-hidden="true" className="text-zinc-400">
                    &rsaquo;
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function localToday() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/** "Cashier 1" and "Cashier 2" differ only by start time, which the cell already shows. */
function positionName(label: string) {
  return label.replace(/\s*\d+$/, '')
}

function shortTime(totalMinutes: number) {
  const hour24 = Math.floor(totalMinutes / 60)
  const minute = totalMinutes % 60
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
  return minute === 0 ? `${hour12}` : `${hour12}:${String(minute).padStart(2, '0')}`
}

function WeekView({
  week,
  slots,
  onlyPerson,
  onOnlyPersonChange,
  onBack,
}: {
  week: PublishedWeek
  slots: ReturnType<typeof expandTemplate>
  onlyPerson: string
  onOnlyPersonChange: (person: string) => void
  onBack: () => void
}) {
  const today = localToday()
  const entries = slots
    .map((slot, index) => ({ slot, personIndex: week.slotPeople[index] }))
    .filter((entry) => entry.personIndex >= 0)
  const rows = week.people
    .map((person, personIndex) => ({
      person,
      shifts: entries.filter((entry) => entry.personIndex === personIndex).map((entry) => entry.slot),
    }))
    .filter((row) => !onlyPerson || row.person === onlyPerson)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <button
        type="button"
        className="text-sm font-semibold text-red-800 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
        onClick={onBack}
      >
        &lsaquo; All weeks
      </button>

      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">{formatWeekRange(week.weekStart)}</h1>
          <p className="text-zinc-600">{week.name}</p>
        </div>
        <label className="text-sm font-medium text-zinc-800">
          <span className="sr-only">Whose shifts to show</span>
          <select
            className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 sm:w-56"
            value={onlyPerson}
            onChange={(event) => onOnlyPersonChange(event.target.value)}
          >
            <option value="">Everyone</option>
            {week.people.map((person) => (
              <option key={person} value={person}>
                Only {person}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-white px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Who
              </th>
              {DAYS.map((day) => {
                const date = dateForDay(week.weekStart, day)
                const isToday = date === today
                return (
                  <th
                    key={day}
                    scope="col"
                    className={`px-2 pb-2 text-xs font-semibold uppercase tracking-wide ${
                      isToday ? 'text-red-800' : date < today ? 'text-zinc-400' : 'text-zinc-500'
                    }`}
                  >
                    {day.slice(0, 3)} {dayOfMonth(week.weekStart, day)}
                    {isToday && <span className="ml-1 normal-case">(today)</span>}
                  </th>
                )
              })}
              <th scope="col" className="px-2 pb-2 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Hours
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map(({ person, shifts }) => (
              <tr key={person} className="align-top">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-white px-2 py-2 text-sm font-semibold text-zinc-900"
                >
                  {person}
                </th>
                {DAYS.map((day) => (
                  <DayCell
                    key={day}
                    shifts={shifts.filter((slot) => slot.day === day)}
                    isToday={dateForDay(week.weekStart, day) === today}
                    isPast={dateForDay(week.weekStart, day) < today}
                  />
                ))}
                <td className="px-2 py-2 text-right text-sm font-semibold text-zinc-900">
                  {shifts.length === 0 ? '\u2014' : `${shifts.reduce((total, slot) => total + hoursFor(slot), 0).toFixed(1)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DayCell({ shifts, isToday, isPast }: { shifts: StaffingSlot[]; isToday: boolean; isPast: boolean }) {
  if (shifts.length === 0) {
    return (
      <td className={`px-2 py-2 ${isToday ? 'bg-red-50/60' : 'bg-zinc-50'}`}>
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Off</span>
      </td>
    )
  }

  return (
    <td className={`px-2 py-2 ${isToday ? 'bg-red-50/60' : ''} ${isPast ? 'opacity-60' : ''}`}>
      <ul className="space-y-1">
        {shifts.map((slot) => (
          <li key={slot.id}>
            <span className="block text-sm font-semibold text-zinc-900">
              {shortTime(slot.start)}-{shortTime(slot.end)}
            </span>
            <span className="block text-xs text-zinc-500">{positionName(slot.label)}</span>
          </li>
        ))}
      </ul>
    </td>
  )
}
