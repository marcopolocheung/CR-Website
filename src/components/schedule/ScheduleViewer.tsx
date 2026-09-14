'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  DAYS,
  currentMonthKey,
  dateForDay,
  expandTemplate,
  formatDayLabel,
  formatTimeRange,
  formatWeekRange,
  hoursFor,
  monthGridForMonth,
  monthLabel,
  seedTemplate,
  shiftMonth,
  todayIsoDate,
  type StaffingSlot,
} from '@/lib/scheduler'
import { templateHashForSlots, type PublishedWeek } from '@/lib/schedule-share'
import { fetchGoldenMonth, type GoldenWeekDoc } from '@/lib/schedule-store'

export default function ScheduleViewer() {
  const slots = useMemo(() => expandTemplate(seedTemplate), [])
  const templateHash = useMemo(() => templateHashForSlots(slots), [slots])
  const [monthKey, setMonthKey] = useState('')
  const [docs, setDocs] = useState<GoldenWeekDoc[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [openWeekStart, setOpenWeekStart] = useState<string | null>(null)
  const [onlyPerson, setOnlyPerson] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setMonthKey(currentMonthKey())
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready || !monthKey) return
    let cancelled = false
    setLoading(true)
    setLoadError('')
    fetchGoldenMonth(monthKey)
      .then((weeks) => {
        if (!cancelled) setDocs(weeks)
      })
      .catch(() => {
        if (!cancelled) {
          setDocs([])
          setLoadError('Could not reach the schedule store. Check your connection and try again.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [monthKey, ready])

  function goToMonth(next: string) {
    if (!next || next === monthKey) return
    setMonthKey(next)
    setOpenWeekStart(null)
    setOnlyPerson('')
  }

  async function refresh() {
    if (!monthKey || refreshing) return
    setRefreshing(true)
    try {
      const weeks = await fetchGoldenMonth(monthKey)
      setDocs(weeks)
      if (openWeekStart && !weeks.some((doc) => doc.weekStart === openWeekStart)) {
        setOpenWeekStart(null)
      }
    } catch {
      setLoadError('Could not check for updates. Try again in a moment.')
    } finally {
      setRefreshing(false)
    }
  }

  function goBack() {
    setOpenWeekStart(null)
    setOnlyPerson('')
  }

  const openDoc = docs.find((doc) => doc.weekStart === openWeekStart) ?? null
  const layoutMismatch = openDoc !== null && openDoc.templateHash !== templateHash

  if (openDoc && !layoutMismatch) {
    const week: PublishedWeek = openDoc.week
    return (
      <div>
        <div className="border-b border-zinc-200 bg-white print:hidden">
          <div className="mx-auto flex w-full max-w-none flex-wrap items-center gap-2 px-4 py-2">
            <span className="text-sm text-zinc-600">This schedule can change when your manager publishes updates.</span>
            <button
              type="button"
              className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
              onClick={refresh}
              disabled={refreshing}
            >
              {refreshing ? 'Checking...' : 'Check for updates'}
            </button>
          </div>
        </div>
        <WeekView
          week={week}
          slots={slots}
          onlyPerson={onlyPerson}
          onOnlyPersonChange={setOnlyPerson}
          onBack={goBack}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-none px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold text-zinc-900">Staff schedule</h1>
        <p className="mt-2 text-zinc-700">
          The current schedule, straight from your manager. No links or codes — pick a week below.
        </p>
        {openDoc && layoutMismatch && (
          <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-5 shadow-sm">
            <p className="font-semibold text-amber-950">This week was made with a different shift layout.</p>
            <p className="mt-1 text-sm text-amber-900">
              Ask your manager to republish it, then press Check for updates.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                onClick={refresh}
                disabled={refreshing}
              >
                {refreshing ? 'Checking...' : 'Check for updates'}
              </button>
              <button
                type="button"
                className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                onClick={goBack}
              >
                All weeks
              </button>
            </div>
          </div>
        )}
      </div>

      <MonthBrowser
        monthKey={monthKey}
        docs={docs}
        loading={loading}
        refreshing={refreshing}
        loadError={loadError}
        templateHash={templateHash}
        selectedWeekStart={openWeekStart}
        onMonthChange={goToMonth}
        onRefresh={refresh}
        onOpenWeek={setOpenWeekStart}
      />
    </div>
  )
}

function MonthBrowser({
  monthKey,
  docs,
  loading,
  refreshing,
  loadError,
  templateHash,
  selectedWeekStart,
  onMonthChange,
  onRefresh,
  onOpenWeek,
}: {
  monthKey: string
  docs: GoldenWeekDoc[]
  loading: boolean
  refreshing: boolean
  loadError: string
  templateHash: string
  selectedWeekStart: string | null
  onMonthChange: (monthKey: string) => void
  onRefresh: () => void
  onOpenWeek: (weekStart: string) => void
}) {
  if (!monthKey) return null
  const grid = monthGridForMonth(monthKey)
  const docByWeek = new Map(docs.map((doc) => [doc.weekStart, doc]))
  const todayWeekStart = grid.find((row) => row.days.some((day) => day.isToday))?.weekStart
  return (
    <section className="mx-auto mt-8 w-full max-w-none" aria-label="Browse weeks by month">
      <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
          onClick={() => onMonthChange(shiftMonth(monthKey, -1))}
          aria-label="Previous month"
        >
          &lsaquo;
        </button>
        <h2 className="min-w-44 text-center text-lg font-bold text-zinc-900">{monthLabel(monthKey)}</h2>
        <button
          type="button"
          className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
          onClick={() => onMonthChange(shiftMonth(monthKey, 1))}
          aria-label="Next month"
        >
          &rsaquo;
        </button>
        <button
          type="button"
          className="ml-1 rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
          onClick={() => onMonthChange(currentMonthKey())}
        >
          This month
        </button>
        <button
          type="button"
          className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-400"
          onClick={onRefresh}
          disabled={refreshing || loading}
        >
          {refreshing ? 'Checking...' : 'Check for updates'}
        </button>
      </div>

      {loadError && (
        <p className="mx-auto mt-3 max-w-2xl text-sm font-medium text-red-800" role="status">
          {loadError}
        </p>
      )}

      <div className="mt-4">
        {loading ? (
          <p className="text-center text-sm text-zinc-500">Looking for this month&apos;s weeks...</p>
        ) : (
          <div className="mx-auto w-full max-w-2xl">
            {docs.length === 0 && (
              <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-center text-sm text-zinc-600">
                No weeks are turned on for {monthLabel(monthKey)} yet. Weeks your manager turns off stay hidden here.
              </p>
            )}
            <div className="mt-3 grid grid-cols-7 text-center text-[11px] font-semibold uppercase tracking-wide text-zinc-400" aria-hidden="true">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <span key={day} className="py-1">{day}</span>
              ))}
            </div>
            <ul className="mt-1 space-y-2">
              {grid.map((row) => {
                const doc = docByWeek.get(row.weekStart)
                const mismatched = doc !== undefined && doc.templateHash !== templateHash
                const published = doc !== undefined && !mismatched
                const selected = selectedWeekStart === row.weekStart
                const isTodayWeek = todayWeekStart === row.weekStart
                return (
                  <li
                    key={row.weekStart}
                    className={`overflow-hidden rounded-lg border bg-white shadow-sm ${
                      selected
                        ? 'border-red-800 ring-2 ring-red-800'
                        : isTodayWeek
                          ? 'border-red-300 bg-red-50/50'
                          : 'border-zinc-200'
                    }`}
                  >
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-default"
                      disabled={!published}
                      aria-pressed={published ? selected : undefined}
                      aria-label={
                        published
                          ? `Open week of ${formatWeekRange(row.weekStart)}`
                          : `Week of ${formatWeekRange(row.weekStart)}, not published yet`
                      }
                      onClick={() => onOpenWeek(row.weekStart)}
                    >
                      <span
                        aria-hidden="true"
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          published ? 'bg-green-600' : mismatched ? 'bg-amber-500' : 'border border-zinc-300 bg-white'
                        }`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-zinc-900">
                          Week of {formatWeekRange(row.weekStart)}
                        </span>
                        <span className="block truncate text-xs text-zinc-500">
                          {published ? doc.week.name || 'Shared week' : mismatched ? 'Made with an old shift layout' : 'Not published yet'}
                        </span>
                      </span>
                      {isTodayWeek && (
                        <span className="shrink-0 rounded-full bg-red-800 px-2 py-0.5 text-[11px] font-bold text-white">
                          This week
                        </span>
                      )}
                      {mismatched && (
                        <span
                          className="shrink-0 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900"
                          title="This week was made with a different shift layout. Ask your manager to republish it."
                        >
                          Needs republish
                        </span>
                      )}
                      {published && (
                        <span aria-hidden="true" className="shrink-0 text-lg leading-none text-zinc-400">
                          &rsaquo;
                        </span>
                      )}
                    </button>
                    <div className="grid grid-cols-7 border-t border-zinc-100" aria-hidden="true">
                      {row.days.map((day) => (
                        <span
                          key={day.date}
                          className={`py-1.5 text-center text-xs tabular-nums ${
                            day.isToday
                              ? 'font-bold text-red-800'
                              : day.inMonth
                                ? 'text-zinc-700'
                                : 'text-zinc-300'
                          } ${day.isToday ? 'rounded-full bg-red-100' : ''}`}
                        >
                          {day.dayOfMonth}
                        </span>
                      ))}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}

function positionName(label: string) {
  return label.replace(/\s*\d+$/, '')
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
  const today = todayIsoDate()
  const entries = slots
    .map((slot, index) => ({ slot, personIndex: week.slotPeople[index] }))
    .filter((entry) => entry.personIndex >= 0)
  const rows = week.people
    .map((person, personIndex) => ({
      person,
      shifts: entries.filter((entry) => entry.personIndex === personIndex).map((entry) => entry.slot),
    }))
    .filter((row) => !onlyPerson || row.person === onlyPerson)
  const todayDay = DAYS.find((day) => dateForDay(week.weekStart, day) === today) ?? null
  const daySections = DAYS.map((day) => ({
    day,
    date: dateForDay(week.weekStart, day),
    shifts: entries
      .filter((entry) => entry.slot.day === day && (!onlyPerson || week.people[entry.personIndex] === onlyPerson))
      .sort((a, b) => a.slot.start - b.slot.start),
  }))
  const printRows = entries
    .filter((entry) => !onlyPerson || week.people[entry.personIndex] === onlyPerson)
    .sort((a, b) => a.slot.day.localeCompare(b.slot.day) || a.slot.start - b.slot.start)

  function jumpToToday() {
    if (!todayDay) return
    document.getElementById(`staff-day-${todayDay}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="mx-auto w-full max-w-none min-w-0 px-4 py-8">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <button
          type="button"
          className="text-sm font-semibold text-red-800 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
          onClick={onBack}
        >
          &lsaquo; All weeks
        </button>
        {todayDay && (
          <button
            type="button"
            className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
            onClick={jumpToToday}
          >
            Today
          </button>
        )}
        <button
          type="button"
          className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
          onClick={() => window.print()}
        >
          Print
        </button>
      </div>

      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Week of {formatWeekRange(week.weekStart)}</h1>
          <p className="text-zinc-600">{week.name}</p>
        </div>
        <label className="text-sm font-medium text-zinc-800 print:hidden">
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

      <div className="mt-5 space-y-3 md:hidden print:hidden">
        {daySections.map(({ day, date, shifts }) => {
          const isToday = date === today
          return (
            <section
              key={day}
              id={`staff-day-${day}`}
              aria-label={`${day}${isToday ? ', today' : ''}`}
              className={`scroll-mt-4 rounded-lg border bg-white p-3 shadow-sm ${isToday ? 'border-red-300' : 'border-zinc-200'}`}
            >
              <h2 className="flex items-center gap-2 font-semibold text-zinc-900">
                {formatDayLabel(week.weekStart, day)}
                {isToday && (
                  <span className="rounded-full bg-red-800 px-2 py-0.5 text-xs font-bold text-white">Today</span>
                )}
                <span className="ml-auto text-xs font-normal text-zinc-500">
                  {shifts.length} shift{shifts.length === 1 ? '' : 's'}
                </span>
              </h2>
              {shifts.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-500">Nobody scheduled{onlyPerson ? ` for ${onlyPerson}` : ''}.</p>
              ) : (
                <ul className="mt-2 divide-y divide-zinc-100">
                  {shifts.map(({ slot, personIndex }) => (
                    <li key={slot.id} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-zinc-900">{week.people[personIndex]}</span>
                        <span className="block text-xs text-zinc-500">{positionName(slot.label)}</span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums text-zinc-900">{formatTimeRange(slot)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )
        })}
      </div>

      <div className="mt-5 hidden min-w-0 md:block print:hidden">
        <table className="w-full min-w-0 table-fixed border-collapse text-left">
          <thead>
            <tr>
              <th scope="col" className="w-28 border border-zinc-300 bg-zinc-100 px-2 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                Who
              </th>
              {DAYS.map((day) => {
                const date = dateForDay(week.weekStart, day)
                const isToday = date === today
                return (
                  <th
                    key={day}
                    scope="col"
                    className={`min-w-0 border border-zinc-300 px-1.5 py-2 text-xs font-semibold uppercase tracking-wide ${
                      isToday ? 'bg-red-100 text-red-900' : date < today ? 'bg-zinc-100 text-zinc-400' : 'bg-zinc-100 text-zinc-600'
                    }`}
                  >
                    <span className="block truncate">{formatDayLabel(week.weekStart, day)}</span>
                    {isToday && <span className="ml-1 normal-case">(today)</span>}
                  </th>
                )
              })}
              <th scope="col" className="w-16 border border-zinc-300 bg-zinc-100 px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-zinc-600">
                Hrs
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ person, shifts }) => (
              <tr key={person} className="align-top">
                <th
                  scope="row"
                  className="w-28 min-w-0 border border-zinc-300 bg-white px-2 py-2 text-sm font-semibold text-zinc-900"
                >
                  <span className="block truncate">{person}</span>
                </th>
                {DAYS.map((day) => (
                  <DayCell
                    key={day}
                    shifts={shifts.filter((slot) => slot.day === day)}
                    isToday={dateForDay(week.weekStart, day) === today}
                    isPast={dateForDay(week.weekStart, day) < today}
                  />
                ))}
                <td className="w-16 border border-zinc-300 px-2 py-2 text-right text-sm font-semibold tabular-nums text-zinc-900">
                  {shifts.length === 0 ? '—' : `${shifts.reduce((total, slot) => total + hoursFor(slot), 0).toFixed(1)}`}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot aria-hidden="true">
            <tr>
              <td className="border border-zinc-300 bg-zinc-100 px-2 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                Who
              </td>
              {DAYS.map((day) => {
                const date = dateForDay(week.weekStart, day)
                const isToday = date === today
                return (
                  <td
                    key={day}
                    className={`min-w-0 border border-zinc-300 px-1.5 py-2 text-xs font-semibold uppercase tracking-wide ${
                      isToday ? 'bg-red-100 text-red-900' : date < today ? 'bg-zinc-100 text-zinc-400' : 'bg-zinc-100 text-zinc-600'
                    }`}
                  >
                    <span className="block truncate">{formatDayLabel(week.weekStart, day)}</span>
                  </td>
                )
              })}
              <td className="border border-zinc-300 bg-zinc-100 px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-zinc-600">
                Hrs
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="hidden print:block">
        <h2 className="text-lg font-bold text-black">Week of {formatWeekRange(week.weekStart)}{onlyPerson ? ` — ${onlyPerson}` : ''}</h2>
        <p className="text-sm text-black">{week.name}</p>
        <table className="mt-3 w-full border-collapse text-left text-sm">
          <thead>
            <tr>
              <th scope="col" className="border border-black px-2 py-1">Day</th>
              <th scope="col" className="border border-black px-2 py-1">Time</th>
              <th scope="col" className="border border-black px-2 py-1">Who</th>
              <th scope="col" className="border border-black px-2 py-1">Position</th>
            </tr>
          </thead>
          <tbody>
            {printRows.map(({ slot, personIndex }) => (
              <tr key={slot.id}>
                <td className="border border-black px-2 py-1">{formatDayLabel(week.weekStart, slot.day)}</td>
                <td className="border border-black px-2 py-1">{formatTimeRange(slot)}</td>
                <td className="border border-black px-2 py-1">{week.people[personIndex]}</td>
                <td className="border border-black px-2 py-1">{positionName(slot.label)}</td>
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
      <td className={`border border-zinc-300 px-2 py-2 ${isToday ? 'bg-red-50' : 'bg-zinc-100'}`}>
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Off</span>
      </td>
    )
  }

  return (
    <td className={`min-w-0 border border-zinc-300 px-1.5 py-2 ${isToday ? 'bg-red-50' : 'bg-white'} ${isPast ? 'opacity-60' : ''}`}>
      <ul className="min-w-0 space-y-1">
        {shifts.map((slot) => (
          <li key={slot.id} className="min-w-0">
            <span className="block truncate text-xs font-semibold tabular-nums text-zinc-900">
              {formatTimeRange(slot)}
            </span>
            <span className="block truncate text-[11px] text-zinc-500">{positionName(slot.label)}</span>
          </li>
        ))}
      </ul>
    </td>
  )
}
