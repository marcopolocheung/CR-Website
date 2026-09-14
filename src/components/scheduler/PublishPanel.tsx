'use client'

import { useEffect, useMemo, useState } from 'react'
import { buildPublishedWeek, templateHashForSlots } from '@/lib/schedule-share'
import {
  StoreAuthError,
  StoreConflictError,
  StoreUnavailableError,
  fetchGoldenWeek,
  saveGoldenWeek,
} from '@/lib/schedule-store'
import type { Employee, ScheduleAssignment, StaffingSlot, WeekStatus } from '@/lib/scheduler'

const tokenSessionKey = 'chinarose.schedule.writeToken'

function readToken(): string {
  try {
    return window.sessionStorage.getItem(tokenSessionKey) ?? ''
  } catch {
    return ''
  }
}

function canonicalWeek(week: { weekStart: string; people: string[]; slotPeople: number[] }) {
  return JSON.stringify({ w: week.weekStart, p: week.people, s: week.slotPeople })
}

export default function PublishPanel({
  weekStart,
  weekLabel,
  slots,
  employees,
  assignments,
  visible,
  onVisibilityChange,
  onClose,
}: {
  weekStart: string
  weekLabel: string
  slots: StaffingSlot[]
  employees: Employee[]
  assignments: ScheduleAssignment[]
  visible: boolean
  onVisibilityChange: (status: WeekStatus) => void
  onClose: () => void
}) {
  const [name, setName] = useState(`Week of ${weekLabel}`)
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [baseRev, setBaseRev] = useState<number | null>(null)
  const [serverFingerprint, setServerFingerprint] = useState<string | null>(null)
  const [serverVisible, setServerVisible] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const filled = assignments.filter((assignment) => assignment.employeeId).length

  const week = useMemo(
    () => buildPublishedWeek({ weekStart, name, slots, employees, assignments }),
    [weekStart, name, slots, employees, assignments],
  )
  const fingerprint = canonicalWeek({ weekStart, people: week.people, slotPeople: week.slotPeople })
  const dirty =
    serverFingerprint === null ? filled > 0 : serverFingerprint !== fingerprint || serverVisible !== visible

  useEffect(() => {
    setName(`Week of ${weekLabel}`)
    setBaseRev(null)
    setServerFingerprint(null)
    setServerVisible(null)
    setError('')
    setNotice('')
    setToken(readToken())
    let cancelled = false
    setLoading(true)
    fetchGoldenWeek(weekStart)
      .then((doc) => {
        if (cancelled || !doc) return
        setBaseRev(doc.rev)
        setServerFingerprint(canonicalWeek(doc.week))
        setServerVisible(doc.visible)
        setName(doc.week.name)
      })
      .catch(() => {
        if (!cancelled) {
          setError('Could not reach the schedule store. You can still edit — saving will retry the connection.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [weekStart, weekLabel])

  async function save() {
    if (filled === 0 || !token || busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      try {
        window.sessionStorage.setItem(tokenSessionKey, token)
      } catch {
        return
      }
      const result = await saveGoldenWeek(
        weekStart,
        { week, templateHash: templateHashForSlots(slots), visible, baseRev: baseRev ?? 0 },
        token,
      )
      setBaseRev(result.rev)
      setServerFingerprint(fingerprint)
      setServerVisible(visible)
      setNotice(
        visible
          ? 'Saved. Staff now see this week on /schedule.'
          : 'Saved. This week stays hidden from staff until you turn it on.',
      )
    } catch (caught) {
      if (caught instanceof StoreAuthError) {
        setError('That write token did not work. Ask for the current one and try again.')
      } else if (caught instanceof StoreConflictError) {
        setBaseRev(caught.rev)
        setError(
          caught.rev === 0
            ? 'This week is not on the server yet. Press Save again to create it.'
            : 'Someone else saved this week first. Press Save again to overwrite with your copy.',
        )
      } else if (caught instanceof StoreUnavailableError) {
        setError('Could not reach the schedule store. Your edits are safe on this screen — try again in a moment.')
      } else {
        setError('Something went wrong saving.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-lg border border-zinc-300 bg-white p-4 shadow-sm print:hidden">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Publish {weekLabel} to /schedule</h2>
          <p className="mt-1 text-sm text-zinc-600">
            {filled} filled spot{filled === 1 ? '' : 's'} will be included. One schedule, no links or codes.
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-zinc-800">
          What to call it
          <input
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <div>
          <span className="text-sm font-medium text-zinc-800" id="publish-visibility-label">
            Staff can see this week
          </span>
          <div
            className="mt-1 flex gap-2"
            role="group"
            aria-labelledby="publish-visibility-label"
          >
            <button
              type="button"
              className={`flex-1 rounded border px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 ${
                visible
                  ? 'border-green-700 bg-green-700 text-white'
                  : 'border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-100'
              }`}
              aria-pressed={visible}
              onClick={() => onVisibilityChange('on')}
            >
              On
            </button>
            <button
              type="button"
              className={`flex-1 rounded border px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 ${
                visible
                  ? 'border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-100'
                  : 'border-zinc-700 bg-zinc-700 text-white'
              }`}
              aria-pressed={!visible}
              onClick={() => onVisibilityChange('off')}
            >
              Off
            </button>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <label className="text-sm font-medium text-zinc-800" htmlFor="publish-token">
          Manager write token
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id="publish-token"
            className="min-w-0 flex-1 rounded border border-zinc-300 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
            value={token}
            type={showToken ? 'text' : 'password'}
            autoComplete="off"
            onChange={(event) => setToken(event.target.value)}
            placeholder="Type the token once per tab"
          />
          <button
            type="button"
            className="shrink-0 rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
            onClick={() => setShowToken((show) => !show)}
            aria-pressed={showToken}
          >
            {showToken ? 'Hide' : 'Show'}
          </button>
        </div>
        <p className="mt-1 text-xs text-zinc-500">Kept in this tab only. Ask whoever runs the Worker for it.</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded bg-red-800 px-4 py-2 text-sm font-semibold text-white hover:bg-red-900 disabled:cursor-not-allowed disabled:bg-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
          onClick={save}
          disabled={busy || loading || !token || !dirty || filled === 0}
        >
          {busy ? 'Saving...' : baseRev === null ? 'Save to /schedule' : 'Save updates to /schedule'}
        </button>
        {!dirty && baseRev !== null && <span className="text-sm text-green-800">/schedule is up to date.</span>}
        {dirty && baseRev !== null && (
          <span className="text-sm font-medium text-amber-800">You have changes staff cannot see yet.</span>
        )}
        {baseRev === null && !loading && (
          <span className="text-sm text-zinc-600">Not on the server yet — saving creates it.</span>
        )}
      </div>
      {filled === 0 && <p className="mt-2 text-sm text-zinc-600">Make a schedule for this week first.</p>}
      {loading && <p className="mt-2 text-sm text-zinc-600">Checking what is on the server...</p>}
      {error && <p className="mt-2 text-sm font-medium text-red-800">{error}</p>}
      {notice && !error && <p className="mt-2 text-sm font-medium text-green-800">{notice}</p>}
    </section>
  )
}
