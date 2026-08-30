'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  DAYS,
  PERIODS,
  dateForDay,
  dayOfMonth,
  expandTemplate,
  formatTimeRange,
  formatWeekRange,
  hoursFor,
  seedTemplate,
  type DayOfWeek,
  type ShiftPeriod,
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
    .map((slot, index) => ({ slot, person: week.slotPeople[index] >= 0 ? week.people[week.slotPeople[index]] : undefined }))
    .filter((entry): entry is { slot: StaffingSlot; person: string } => Boolean(entry.person))
  const shown = onlyPerson ? entries.filter((entry) => entry.person === onlyPerson) : entries
  const hours = shown.reduce((total, entry) => total + hoursFor(entry.slot), 0)

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

      {onlyPerson && (
        <p className="mt-3 rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800">
          <span className="font-semibold">{onlyPerson}</span> works {shown.length} shift{shown.length === 1 ? '' : 's'}
          {shown.length > 0 && ` this week, ${hours.toFixed(1)} hours in total`}.
        </p>
      )}

      {/* One column per day on a wide screen, stacking into a readable list on a phone. */}
      <div className="mt-5 grid gap-2 lg:grid-cols-7">
        {DAYS.map((day) => (
          <DayCell
            key={day}
            day={day}
            weekStart={week.weekStart}
            today={today}
            entries={shown.filter((entry) => entry.slot.day === day)}
            showOff={Boolean(onlyPerson)}
          />
        ))}
      </div>
    </div>
  )
}

function DayCell({
  day,
  weekStart,
  today,
  entries,
  showOff,
}: {
  day: DayOfWeek
  weekStart: string
  today: string
  entries: { slot: StaffingSlot; person: string }[]
  showOff: boolean
}) {
  const date = dateForDay(weekStart, day)
  const isToday = date === today
  const isPast = date < today

  return (
    <section
      className={`rounded-lg border p-2 ${
        isToday ? 'border-red-300 bg-red-50' : isPast ? 'border-zinc-200 bg-zinc-50/60' : 'border-zinc-200 bg-white'
      }`}
    >
      <h2 className={`flex items-baseline gap-1.5 px-1 ${isPast ? 'text-zinc-400' : 'text-zinc-900'}`}>
        <span className="text-sm font-bold">{day.slice(0, 3)}</span>
        <span className="text-sm font-normal text-zinc-500">{dayOfMonth(weekStart, day)}</span>
        {isToday && <span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-red-800">Today</span>}
      </h2>

      {entries.length === 0 ? (
        <p className={`px-1 py-2 text-sm ${showOff ? 'font-medium text-zinc-500' : 'text-zinc-400'}`}>
          {showOff ? 'Off' : 'Nobody yet'}
        </p>
      ) : (
        <div className="mt-1 space-y-2">
          {PERIODS.map((period: ShiftPeriod) => {
            const periodEntries = entries.filter((entry) => entry.slot.period === period)
            if (periodEntries.length === 0) return null
            return (
              <div key={period}>
                <h3 className="px-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  {period === 'AM' ? 'Morning' : 'Dinner'}
                </h3>
                <ul className="mt-0.5">
                  {periodEntries.map(({ slot, person }) => (
                    <li key={slot.id} className="rounded px-1 py-1 odd:bg-zinc-50/70">
                      <span className="block text-sm font-semibold text-zinc-900">{person}</span>
                      <span className="block text-xs text-zinc-500">
                        {slot.label} &middot; {formatTimeRange(slot)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
