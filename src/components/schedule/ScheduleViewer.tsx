'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  DAYS,
  PERIODS,
  dayOfMonth,
  expandTemplate,
  formatTimeRange,
  formatWeekRange,
  seedTemplate,
  type DayOfWeek,
  type ShiftPeriod,
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
  const personFor = (index: number) => (index >= 0 ? week.people[index] : undefined)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <button
        type="button"
        className="text-sm font-semibold text-red-800 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
        onClick={onBack}
      >
        &lsaquo; All weeks
      </button>
      <h1 className="mt-2 text-2xl font-bold text-zinc-900">{formatWeekRange(week.weekStart)}</h1>
      <p className="text-zinc-600">{week.name}</p>

      <label className="mt-5 block text-sm font-medium text-zinc-800">
        Show
        <select
          className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 sm:w-64"
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

      <div className="mt-6 space-y-5">
        {DAYS.map((day) => (
          <DayCard
            key={day}
            day={day}
            weekStart={week.weekStart}
            slots={slots}
            slotPeople={week.slotPeople}
            personFor={personFor}
            onlyPerson={onlyPerson}
          />
        ))}
      </div>
    </div>
  )
}

function DayCard({
  day,
  weekStart,
  slots,
  slotPeople,
  personFor,
  onlyPerson,
}: {
  day: DayOfWeek
  weekStart: string
  slots: ReturnType<typeof expandTemplate>
  slotPeople: number[]
  personFor: (index: number) => string | undefined
  onlyPerson: string
}) {
  const rows = PERIODS.map((period: ShiftPeriod) => {
    const entries = slots
      .map((slot, index) => ({ slot, person: personFor(slotPeople[index]) }))
      .filter(({ slot }) => slot.day === day && slot.period === period)
      .filter(({ person }) => person && (!onlyPerson || person === onlyPerson))
    return { period, entries }
  }).filter(({ entries }) => entries.length > 0)

  if (rows.length === 0) return null

  return (
    <section>
      <h2 className="text-base font-bold text-zinc-900">
        {day} <span className="text-sm font-normal text-zinc-500">{dayOfMonth(weekStart, day)}</span>
      </h2>
      <div className="mt-2 space-y-3">
        {rows.map(({ period, entries }) => (
          <div key={period}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {period === 'AM' ? 'Morning' : 'Dinner'}
            </h3>
            <ul className="mt-1 divide-y divide-zinc-100 border-t border-zinc-100">
              {entries.map(({ slot, person }) => (
                <li key={slot.id} className="flex items-baseline justify-between gap-3 py-2">
                  <span className="font-semibold text-zinc-900">{person}</span>
                  <span className="text-right text-sm text-zinc-600">
                    {slot.label}
                    <span className="ml-2 text-zinc-500">{formatTimeRange(slot)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
