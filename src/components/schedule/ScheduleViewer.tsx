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
  monthLabel,
  seedTemplate,
  shiftMonth,
  type StaffingSlot,
} from '@/lib/scheduler'
import {
  UnreadableShareError,
  WrongCodeError,
  decryptWeek,
  isShareId,
  serializePublishedWeek,
  templateHashForSlots,
  type PublishedWeek,
} from '@/lib/schedule-share'
import {
  StoreNotFoundError,
  StoreUnavailableError,
  fetchSharedWeek,
  listVisibleWeeks,
  type VisibleWeekStub,
} from '@/lib/schedule-store'

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
    return
  }
}

export default function ScheduleViewer() {
  const slots = useMemo(() => expandTemplate(seedTemplate), [])
  const templateHash = useMemo(() => templateHashForSlots(slots), [slots])
  const [rawToken, setRawToken] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [week, setWeek] = useState<PublishedWeek | null>(null)
  const [viewingShare, setViewingShare] = useState<{ id: string; rev: number } | null>(null)
  const [seenWeeks, setSeenWeeks] = useState<PublishedWeek[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [checking, setChecking] = useState(false)
  const [updateNote, setUpdateNote] = useState('')
  const [onlyPerson, setOnlyPerson] = useState('')
  const [ready, setReady] = useState(false)
  const [monthKey, setMonthKey] = useState('')
  const [stubs, setStubs] = useState<VisibleWeekStub[]>([])
  const [stubsLoading, setStubsLoading] = useState(false)
  const [monthCode, setMonthCode] = useState('')
  const [unlockingMonth, setUnlockingMonth] = useState(false)
  const [monthNote, setMonthNote] = useState('')
  const [monthUnlocked, setMonthUnlocked] = useState<PublishedWeek[]>([])
  const isIdLink = rawToken !== null && isShareId(rawToken)

  useEffect(() => {
    const readHash = () => window.location.hash.slice(1) || null
    setRawToken(readHash())
    setSeenWeeks(readSeenWeeks())
    setMonthKey(currentMonthKey())
    setReady(true)
    const onHashChange = () => {
      setRawToken(readHash())
      setWeek(null)
      setViewingShare(null)
      setCode('')
      setError('')
      setUpdateNote('')
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    if (!ready || !monthKey) return
    let cancelled = false
    setStubsLoading(true)
    listVisibleWeeks(monthKey)
      .then((visible) => {
        if (!cancelled) setStubs(visible)
      })
      .catch(() => {
        if (!cancelled) setStubs([])
      })
      .finally(() => {
        if (!cancelled) setStubsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [monthKey, ready])

  async function unlockMonth() {
    if (!monthCode || stubs.length === 0 || unlockingMonth) return
    setUnlockingMonth(true)
    setMonthNote('')
    let openedCount = 0
    let lockedCount = 0
    const opened: PublishedWeek[] = []
    for (const stub of stubs) {
      if (monthUnlocked.some((item) => item.weekStart === stub.weekStart)) continue
      try {
        const doc = await fetchSharedWeek(stub.id)
        if (!doc.visible) continue
        const unlocked = await decryptWeek(doc.ciphertext, monthCode)
        if (doc.templateHash !== templateHash) {
          lockedCount += 1
          continue
        }
        opened.push(unlocked)
        rememberWeek(unlocked)
        openedCount += 1
      } catch {
        lockedCount += 1
      }
    }
    if (opened.length > 0) {
      setMonthUnlocked((current) => {
        const merged = new Map(current.map((item) => [item.weekStart, item]))
        for (const item of opened) merged.set(item.weekStart, item)
        return [...merged.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart))
      })
      setSeenWeeks(readSeenWeeks())
    }
    setMonthNote(
      openedCount === 0
        ? 'That code did not open any week in this month. Check with your manager.'
        : lockedCount > 0
          ? `${openedCount} week${openedCount === 1 ? '' : 's'} opened. ${lockedCount} still need${lockedCount === 1 ? 's' : ''} a different code.`
          : `${openedCount} week${openedCount === 1 ? '' : 's'} opened.`,
    )
    setUnlockingMonth(false)
  }

  async function unlock() {
    if (!rawToken || !code) return
    setBusy(true)
    setError('')
    setUpdateNote('')
    try {
      if (isShareId(rawToken)) {
        const doc = await fetchSharedWeek(rawToken)
        const opened = await decryptWeek(doc.ciphertext, code)
        if (doc.templateHash !== templateHash) {
          setError('This link was made with a different shift layout and cannot be shown here.')
          return
        }
        setWeek(opened)
        setViewingShare({ id: rawToken, rev: doc.rev })
        rememberWeek(opened)
        setSeenWeeks(readSeenWeeks())
      } else {
        const opened = await decryptWeek(rawToken, code)
        if (opened.slotPeople.length !== slots.length) {
          setError('This link was made with a different shift layout and cannot be shown here.')
          return
        }
        setWeek(opened)
        setViewingShare(null)
        rememberWeek(opened)
        setSeenWeeks(readSeenWeeks())
      }
    } catch (caught) {
      if (caught instanceof WrongCodeError) setError('That code did not work. Check with your manager.')
      else if (caught instanceof UnreadableShareError) setError('This link is damaged. Ask for a new one.')
      else if (caught instanceof StoreNotFoundError)
        setError('This link does not match any saved schedule. Ask your manager for the current link.')
      else if (caught instanceof StoreUnavailableError)
        setError('Could not reach the schedule store. Check your connection and try again.')
      else setError('Something went wrong opening this schedule.')
    } finally {
      setBusy(false)
    }
  }

  async function checkForUpdates() {
    if (!viewingShare || !code) return
    setChecking(true)
    setUpdateNote('')
    try {
      const doc = await fetchSharedWeek(viewingShare.id)
      if (doc.rev === viewingShare.rev) {
        setUpdateNote('You are up to date.')
        return
      }
      const opened = await decryptWeek(doc.ciphertext, code)
      if (serializePublishedWeek(opened) !== (week ? serializePublishedWeek(week) : '')) {
        setWeek(opened)
        rememberWeek(opened)
        setSeenWeeks(readSeenWeeks())
      }
      setViewingShare({ id: viewingShare.id, rev: doc.rev })
      setUpdateNote('Updated to the latest schedule.')
    } catch (caught) {
      if (caught instanceof StoreNotFoundError)
        setUpdateNote('This link no longer has a saved schedule. Ask your manager for the current link.')
      else setUpdateNote('Could not check for updates. Try again in a moment.')
    } finally {
      setChecking(false)
    }
  }

  function goBack() {
    setWeek(null)
    setViewingShare(null)
    setCode('')
    setUpdateNote('')
  }

  if (week) {
    return (
      <div>
        {viewingShare && (
          <div className="border-b border-zinc-200 bg-white print:hidden">
            <div className="mx-auto flex w-full max-w-none flex-wrap items-center gap-2 px-4 py-2">
              <span className="text-sm text-zinc-600">This link can change when your manager edits the week.</span>
              <button
                type="button"
                className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                onClick={checkForUpdates}
                disabled={checking}
              >
                {checking ? 'Checking...' : 'Check for updates'}
              </button>
              {updateNote && (
                <span className="text-sm font-medium text-zinc-700" role="status">
                  {updateNote}
                </span>
              )}
            </div>
          </div>
        )}
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

        {!ready ? null : rawToken ? (
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
            {isIdLink && !error && (
              <p className="mt-3 text-sm text-zinc-600">This link stays up to date when your manager edits the week.</p>
            )}
          </div>
        ) : (
          <p className="mt-4 text-zinc-700">
            Open the link your manager sent you to see a week. Weeks you have already opened on this device are listed
            below.
          </p>
        )}
      </div>

      <MonthBrowser
        monthKey={monthKey}
        stubs={stubs}
        loading={stubsLoading}
        monthCode={monthCode}
        unlocking={unlockingMonth}
        note={monthNote}
        unlocked={monthUnlocked}
        seenWeeks={seenWeeks}
        onMonthChange={setMonthKey}
        onMonthCodeChange={setMonthCode}
        onUnlockMonth={unlockMonth}
        onOpenWeek={setWeek}
        onCloseWeek={(weekStart) => setMonthUnlocked((current) => current.filter((item) => item.weekStart !== weekStart))}
      />

      {ready && seenWeeks.length > 0 && monthUnlocked.length === 0 && (
        <div className="mx-auto mt-8 max-w-2xl">
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
                    <span className="block font-semibold text-zinc-900">Week of {formatWeekRange(seen.weekStart)}</span>
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

function MonthBrowser({
  monthKey,
  stubs,
  loading,
  monthCode,
  unlocking,
  note,
  unlocked,
  seenWeeks,
  onMonthChange,
  onMonthCodeChange,
  onUnlockMonth,
  onOpenWeek,
  onCloseWeek,
}: {
  monthKey: string
  stubs: VisibleWeekStub[]
  loading: boolean
  monthCode: string
  unlocking: boolean
  note: string
  unlocked: PublishedWeek[]
  seenWeeks: PublishedWeek[]
  onMonthChange: (monthKey: string) => void
  onMonthCodeChange: (code: string) => void
  onUnlockMonth: () => void
  onOpenWeek: (week: PublishedWeek) => void
  onCloseWeek: (weekStart: string) => void
}) {
  if (!monthKey) return null
  const seenByWeek = new Map(seenWeeks.map((seen) => [seen.weekStart, seen]))
  const unlockedByWeek = new Map(unlocked.map((item) => [item.weekStart, item]))
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
      </div>

      <div className="mx-auto mt-3 flex max-w-2xl flex-col gap-2 sm:flex-row">
        <label className="min-w-0 flex-1 text-sm font-medium text-zinc-800">
          <span className="sr-only">Code for this month&apos;s weeks</span>
          <input
            className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-base"
            value={monthCode}
            autoComplete="off"
            placeholder="Type the staff code once to open the month"
            onChange={(event) => onMonthCodeChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onUnlockMonth()
            }}
          />
        </label>
        <button
          type="button"
          className="rounded bg-red-800 px-4 py-2 text-sm font-semibold text-white hover:bg-red-900 disabled:cursor-not-allowed disabled:bg-zinc-300"
          onClick={onUnlockMonth}
          disabled={unlocking || !monthCode || stubs.length === 0}
        >
          {unlocking ? 'Opening...' : 'Open this month'}
        </button>
      </div>
      {note && (
        <p className="mx-auto mt-2 max-w-2xl text-sm font-medium text-zinc-700" role="status">
          {note}
        </p>
      )}

      <div className="mt-4">
        {loading ? (
          <p className="text-center text-sm text-zinc-500">Looking for this month&apos;s weeks...</p>
        ) : stubs.length === 0 ? (
          <p className="mx-auto max-w-2xl rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-center text-sm text-zinc-600">
            No weeks are turned on for {monthLabel(monthKey)} yet. Weeks your manager turns off stay hidden here.
          </p>
        ) : (
          <ul className="grid w-full min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {stubs.map((stub) => {
              const opened = unlockedByWeek.get(stub.weekStart) ?? seenByWeek.get(stub.weekStart) ?? null
              return (
                <li
                  key={stub.id}
                  className="flex min-w-0 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 shadow-sm"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-zinc-900">
                      Week of {formatWeekRange(stub.weekStart)}
                    </span>
                    <span className="block text-xs text-zinc-500">
                      {opened ? `On · ${opened.name || 'shared'}` : 'On · code needed'}
                    </span>
                  </span>
                  {opened ? (
                    <span className="flex shrink-0 gap-1.5">
                      <button
                        type="button"
                        className="rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-100"
                        onClick={() => onOpenWeek(opened)}
                      >
                        Open
                      </button>
                      {unlockedByWeek.has(stub.weekStart) && (
                        <button
                          type="button"
                          className="rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-500 hover:bg-zinc-50"
                          onClick={() => onCloseWeek(stub.weekStart)}
                          aria-label={`Hide week of ${formatWeekRange(stub.weekStart)}`}
                        >
                          Hide
                        </button>
                      )}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900">
                      Locked
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {unlocked.length > 0 && (
        <p className="mt-4 text-center text-sm text-zinc-500">Scroll to move through the open weeks below.</p>
      )}
    </section>
  )
}

function localToday() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
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
