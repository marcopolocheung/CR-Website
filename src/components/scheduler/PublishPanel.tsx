'use client'

import { useSchedulerText } from './useSchedulerText'
import { useInternalLanguage } from '@/components/internal/InternalLanguage'

import { useEffect, useMemo, useRef, useState } from 'react'
import { buildPublishedWeek, publishedWeekFingerprint, templateHashForSlots } from '@/lib/schedule-share'
import { buildScheduleSnapshot } from '@/lib/schedule-snapshot'
import type { ScheduleSnapshot } from '@/lib/schedule-snapshot'
import {
  StoreConflictError,
  fetchGoldenWeek,
  saveErrorMessage,
  saveGoldenWeek,
  requireScheduleSnapshots,
  type GoldenWeekDoc,
} from '@/lib/schedule-store'
import type { Employee, ScheduleAssignment, StaffingSlot, WeekStatus } from '@/lib/scheduler'
import { formatUpdatedAt } from '@/lib/scheduler/time'
import { validateSchedule } from '@/lib/scheduler/validator'
import { useManagerSession } from '@/components/internal/ManagerSession'
import { managerSession, SessionChangedError } from '@/lib/internal-tools/manager-session'

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
  snapshot:providedSnapshot,
  canPublishEmpty=false,
  onBusyChange,
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
  snapshot?:ScheduleSnapshot
  canPublishEmpty?:boolean
  onBusyChange?:(busy:boolean)=>void
}) {
  const text = useSchedulerText()
  const { locale } = useInternalLanguage()
  const session = useManagerSession()
  const managerCode = session.token
  const flight=useRef(false)
  const alive=useRef(true)
  useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[])
  const [name, setName] = useState(`Week of ${weekLabel}`)
  const [baseRev, setBaseRev] = useState<number | null>(null)
  const [serverFingerprint, setServerFingerprint] = useState<string | null>(null)
  const [serverVisible, setServerVisible] = useState<boolean | null>(null)
  const [serverUpdatedAt, setServerUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(()=>{onBusyChange?.(busy);return()=>onBusyChange?.(false)},[busy,onBusyChange])
  const [scheduleUrl, setScheduleUrl] = useState('')
  const filled = assignments.filter((assignment) => assignment.employeeId).length
  const qualificationViolations = useMemo(
    () => validateSchedule({ employees, slots, assignments, requireCoverage: false })
      .filter((violation) => violation.code === 'unqualified_employee'),
    [employees, slots, assignments],
  )
  // Hiding an existing week must remain possible even when its assignments need fixing.
  const qualificationBlocked = visible && qualificationViolations.length > 0

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
  const snapshot = useMemo(() => providedSnapshot??buildScheduleSnapshot(slots), [slots,providedSnapshot])
  const fingerprint = publishedWeekFingerprint(week, snapshot)
  const dirty =
    unsavedSetup.length > 0 ||
    (serverFingerprint === null ? filled > 0 || canPublishEmpty : serverFingerprint !== fingerprint || serverVisible !== visible)

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
        setServerFingerprint(publishedWeekFingerprint(doc.week, doc.snapshot))
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
    if (!managerCode || flight.current || filled === 0 && !canPublishEmpty || busy || qualificationBlocked) return
    const current=managerSession.capture(managerCode)
    flight.current=true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await requireScheduleSnapshots()
      current()
      if (!(await onSaveSetup())) return
      current();if(!alive.current)return
      const templateHash = templateHashForSlots(slots)
      const result = await saveGoldenWeek(weekStart, { week, templateHash, snapshot, visible, baseRev: baseRev ?? 0 }, managerCode, restaurantId)
      current();if(!alive.current)return
      onPublished({ v: 3, weekStart, rev: result.rev, week, visible, templateHash, snapshot, updatedAt: result.updatedAt ?? new Date().toISOString() })
      setBaseRev(result.rev)
      setServerFingerprint(fingerprint)
      setServerVisible(visible)
      setServerUpdatedAt(result.updatedAt)
      broadcastSave(weekStart, restaurantId)
      setNotice(visible ? 'Published. Staff now see this week.' : 'Saved. This week stays hidden from staff until you turn it on.')
    } catch (caught) {
      if(!alive.current||caught instanceof SessionChangedError)return
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
      flight.current=false
      if(alive.current)setBusy(false)
    }
  }

  return (
    <section className="rounded-lg border border-zinc-300 bg-white p-4 shadow-sm print:hidden">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{text('Publish {week}{station} to staff',{week:weekLabel,station:restaurantName?text(' for {station}',{station:restaurantName}):''})}</h2>
          <p className="mt-1 text-sm text-zinc-600">
            {text('{count} filled spots will be included. Staff see it on the staff schedule page — no links or codes.',{count:filled})}{' '}
            {text('Last published: {saved}.',{saved:baseRev===null?text('never'):formatUpdatedAt(serverUpdatedAt)})}
            {unsavedSetup.length > 0 && <>{' '}{text('Your unsaved {parts} will save first.',{parts:unsavedSetup.map(part=>text(part)).join(` ${text('and')} `)})}</>}
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
          onClick={onClose}
        >{text("Close")}</button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-zinc-800">{text("What to call it")}<input
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <div>
          <span className="text-sm font-medium text-zinc-800" id="publish-visibility-label">{text("Staff can see this week")}</span>
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
            >{text("On")}</button>
            <button
              type="button"
              className={`flex-1 rounded border px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 ${
                visible
                  ? 'border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-100'
                  : 'border-zinc-700 bg-zinc-700 text-white'
              }`}
              aria-pressed={!visible}
              onClick={() => onVisibilityChange('off')}
            >{text("Off")}</button>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
          onClick={publish}
          disabled={busy || loading || !dirty || filled === 0 && !canPublishEmpty || qualificationBlocked}
        >
          {busy ? text("Publishing…") : baseRev === null ? text("Publish") : text("Publish updates")}
        </button>
        {!dirty && baseRev !== null && <span className="text-sm text-green-800">{text("Staff see the latest version.")}</span>}
        {dirty && baseRev !== null && (
          <span className="text-sm font-medium text-amber-800">{text("You have changes staff cannot see yet.")}</span>
        )}
        {baseRev === null && !loading && (
          <span className="text-sm text-zinc-600">{text("Not on the server yet — publishing creates it.")}</span>
        )}
      </div>
      {qualificationBlocked && (
        <div role="alert" className="mt-2 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          <p className="font-semibold">{text("Fix these position assignments before publishing:")}</p>
          <ul className="mt-1 list-disc pl-5">
            {/* English keeps the validator's day-specific sentence; Spanish adds day and period so rows stay distinguishable. */}
            {qualificationViolations.map((violation) => { const slot = slots.find(item=>item.id===violation.slotId)
              return <li key={violation.slotId}>{locale === 'en' ? violation.message : `${employees.find(employee=>employee.id===violation.employeeId)?.name} · ${slot?.day} ${slot?.period} ${slot?.label}: ${text('This employee is not qualified for this position.')}`}</li> })}
          </ul>
        </div>
      )}
      {filled === 0 && !canPublishEmpty && <p className="mt-2 text-sm text-zinc-600">{text("Make a schedule for this week first.")}</p>}
      {loading && <p className="mt-2 text-sm text-zinc-600">{text("Checking what is on the server...")}</p>}
      {error && <p className="mt-2 text-sm font-medium text-red-800">{text(error)}</p>}
      {notice && !error && (
        <div className="mt-2 space-y-2">
          <p className="text-sm font-medium text-green-800">{text(notice)}</p>
          {visible && scheduleUrl && (
            <div>
              <a
                href={`sms:?&body=${encodeURIComponent(`Schedule for ${weekLabel} is up: ${scheduleUrl}`)}`}
                className="inline-flex items-center gap-2 rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
              >{text("Text my contacts")}</a>
              <p className="mt-1 text-xs text-zinc-500">{text("Opens your phone's messaging app with the schedule link ready to send.")}</p>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
