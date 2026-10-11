'use client'

import { useEffect, useMemo, useState } from 'react'
import { buildPublishedWeek, publishedWeekFingerprint, templateHashForSlots } from '@/lib/schedule-share'
import {
  StoreConflictError,
  fetchGoldenWeek,
  saveErrorMessage,
  saveGoldenWeek,
  type GoldenWeekDoc,
} from '@/lib/schedule-store'
import type { Employee, ScheduleAssignment, StaffingSlot, WeekStatus } from '@/lib/scheduler'
import { formatUpdatedAt } from '@/lib/scheduler/time'
import { useManagerCode } from './DemoGate'

const scheduleChannelName = 'chinarose-schedule'

function broadcastSave(weekStart: string, restaurantId?: string) {
  try {
    const channel = new BroadcastChannel(scheduleChannelName)
    channel.postMessage({ type: 'golden-saved', weekStart, restaurantId })
    channel.close()
  } catch {
    return
  }
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
  restaurantId,
  restaurantName,
  unsavedSetup,
  onSaveSetup,
  onPublished,
}: {
  weekStart: string
  weekLabel: string
  slots: StaffingSlot[]
  employees: Employee[]
  assignments: ScheduleAssignment[]
  visible: boolean
  onVisibilityChange: (status: WeekStatus) => void
  onClose: () => void
  restaurantId?: string
  restaurantName?: string
  /** Unsaved parts of this week's setup, e.g. ['staff list', 'shift rules']. They save first. */
  unsavedSetup: string[]
  /** Saves the setup with the manager code; false when it failed (it shows its own error). */
  onSaveSetup: () => Promise<boolean>
  onPublished: (doc: GoldenWeekDoc) => void
}) {
  const managerCode = useManagerCode()
  const [name, setName] = useState(`Week of ${weekLabel}`)
  const [baseRev, setBaseRev] = useState<number | null>(null)
  const [serverFingerprint, setServerFingerprint] = useState<string | null>(null)
  const [serverVisible, setServerVisible] = useState<boolean | null>(null)
  const [serverUpdatedAt, setServerUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [scheduleUrl, setScheduleUrl] = useState('')
  const filled = assignments.filter((assignment) => assignment.employeeId).length

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
    setScheduleUrl(
      restaurantId ? `${window.location.origin}${base}/schedule/${restaurantId}` : `${window.location.origin}${base}/schedule`,
    )
  }, [restaurantId])

  const week = useMemo(
    () => buildPublishedWeek({ weekStart, name, slots, employees, assignments }),
    [weekStart, name, slots, employees, assignments],
  )
  const fingerprint = publishedWeekFingerprint(week)
  const dirty =
    unsavedSetup.length > 0 ||
    (serverFingerprint === null ? filled > 0 : serverFingerprint !== fingerprint || serverVisible !== visible)

  useEffect(() => {
    setName(`Week of ${weekLabel}`)
    setBaseRev(null)
    setServerFingerprint(null)
    setServerVisible(null)
    setServerUpdatedAt(null)
    setError('')
    setNotice('')
    let cancelled = false
    setLoading(true)
    fetchGoldenWeek(weekStart, restaurantId)
      .then((doc) => {
        if (cancelled || !doc) return
        setBaseRev(doc.rev)
        setServerFingerprint(publishedWeekFingerprint(doc.week))
        setServerVisible(doc.visible)
        setServerUpdatedAt(doc.updatedAt)
        setName(doc.week.name)
      })
      .catch(() => {
        if (!cancelled) {
          setError('Could not reach the server. You can still edit — publishing will try again.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [weekStart, weekLabel, restaurantId])

  async function publish() {
    if (filled === 0 || busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (!(await onSaveSetup())) return
      const templateHash = templateHashForSlots(slots)
      const result = await saveGoldenWeek(weekStart, { week, templateHash, visible, baseRev: baseRev ?? 0 }, managerCode, restaurantId)
      onPublished({ v: 3, weekStart, rev: result.rev, week, visible, templateHash, updatedAt: result.updatedAt ?? new Date().toISOString() })
      setBaseRev(result.rev)
      setServerFingerprint(fingerprint)
      setServerVisible(visible)
      setServerUpdatedAt(result.updatedAt)
      broadcastSave(weekStart, restaurantId)
      setNotice(visible ? 'Published. Staff now see this week.' : 'Saved. This week stays hidden from staff until you turn it on.')
    } catch (caught) {
      if (caught instanceof StoreConflictError) {
        setBaseRev(caught.rev)
        setError(
          caught.rev === 0
            ? 'This week is not on the server yet. Press Publish again to create it.'
            : 'Someone else published this week first. Press Publish again to replace it with your copy.',
        )
      } else {
        setError(saveErrorMessage(caught, 'week'))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-lg border border-zinc-300 bg-white p-4 shadow-sm print:hidden">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Publish {weekLabel}{restaurantName ? ` for ${restaurantName}` : ''} to staff</h2>
          <p className="mt-1 text-sm text-zinc-600">
            {filled} filled spot{filled === 1 ? '' : 's'} will be included. Staff see it on the staff schedule page — no links or codes.
            Last published: {baseRev === null ? 'never' : formatUpdatedAt(serverUpdatedAt)}.
            {unsavedSetup.length > 0 && <> Your unsaved {unsavedSetup.join(' and ')} will save first.</>}
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-zinc-800">
          What to call it
          <input
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
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
              className={`flex-1 rounded border px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 ${
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
              className={`flex-1 rounded border px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 ${
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

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
          onClick={publish}
          disabled={busy || loading || !dirty || filled === 0}
        >
          {busy ? 'Publishing…' : baseRev === null ? 'Publish' : 'Publish updates'}
        </button>
        {!dirty && baseRev !== null && <span className="text-sm text-green-800">Staff see the latest version.</span>}
        {dirty && baseRev !== null && (
          <span className="text-sm font-medium text-amber-800">You have changes staff cannot see yet.</span>
        )}
        {baseRev === null && !loading && (
          <span className="text-sm text-zinc-600">Not on the server yet — publishing creates it.</span>
        )}
      </div>
      {filled === 0 && <p className="mt-2 text-sm text-zinc-600">Make a schedule for this week first.</p>}
      {loading && <p className="mt-2 text-sm text-zinc-600">Checking what is on the server...</p>}
      {error && <p className="mt-2 text-sm font-medium text-red-800">{error}</p>}
      {notice && !error && (
        <div className="mt-2 space-y-2">
          <p className="text-sm font-medium text-green-800">{notice}</p>
          {visible && scheduleUrl && (
            <div>
              <a
                href={`sms:?&body=${encodeURIComponent(`Schedule for ${weekLabel} is up: ${scheduleUrl}`)}`}
                className="inline-flex items-center gap-2 rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
              >
                Text my contacts
              </a>
              <p className="mt-1 text-xs text-zinc-500">Opens your phone&apos;s messaging app with the schedule link ready to send.</p>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
