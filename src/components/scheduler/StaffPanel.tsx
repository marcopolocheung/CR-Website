'use client'

import { useState } from 'react'
import { saveStaff, undoStaff, verifyStaffPassword, type StaffWriteResult } from '@/lib/staff-store'
import { StoreAuthError, StoreConflictError, StoreUnavailableError } from '@/lib/schedule-store'
import type { Employee } from '@/lib/scheduler'

/**
 * Crew editor for schedule-only stations. The whole panel is hidden behind the
 * staff password: until it is accepted, the panel only shows the unlock form and
 * the crew stays read-only. The password is kept in memory for this page view —
 * it is never written to storage — and is sent as the bearer on each save/undo.
 */
export default function StaffPanel({
  employees,
  rev,
  canUndo,
  updatedAt,
  dirty,
  loadPending,
  unlocked,
  restaurantId,
  onUnlock,
  onLock,
  onSaved,
  onUndone,
}: {
  employees: Employee[]
  rev: number
  canUndo: boolean
  updatedAt: string | null
  dirty: boolean
  loadPending: boolean
  unlocked: boolean
  restaurantId?: string
  onUnlock: () => void
  onLock: () => void
  onSaved: (result: StaffWriteResult) => void
  onUndone: (result: StaffWriteResult) => void
}) {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  function describe(caught: unknown, action: string): string {
    if (caught instanceof StoreAuthError) {
      return 'That password was not accepted. Check for typos and try again.'
    }
    if (caught instanceof StoreConflictError) {
      return 'Someone else saved the crew first. Reload the page, then try again.'
    }
    if (caught instanceof StoreUnavailableError) {
      return `${caught.message} Your edits are safe on this screen — try again in a moment.`
    }
    return `Something went wrong ${action}.`
  }

  async function unlock() {
    if (!password || busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await verifyStaffPassword(password, restaurantId)
      setNotice('Crew editing unlocked. Changes save for every week.')
      onUnlock()
    } catch (caught) {
      setError(describe(caught, 'checking the password'))
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (busy || loadPending) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await saveStaff(employees, rev, password, restaurantId)
      setNotice('Saved. This crew now applies to every week.')
      onSaved(result)
    } catch (caught) {
      setError(describe(caught, 'saving'))
    } finally {
      setBusy(false)
    }
  }

  async function undo() {
    if (busy || loadPending || !canUndo) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await undoStaff(rev, password, restaurantId)
      setNotice('Undid the last saved crew change.')
      onUndone(result)
    } catch (caught) {
      setError(describe(caught, 'undoing'))
    } finally {
      setBusy(false)
    }
  }

  if (!unlocked) {
    return (
      <div className="mt-3 rounded border border-zinc-200 bg-zinc-50 p-3">
        <h3 className="text-sm font-semibold text-zinc-900">Edit this crew</h3>
        <p className="mt-0.5 text-xs text-zinc-600">
          The crew, roles, and availability are locked. Enter the staff password to edit them. Saved changes apply to
          every week and can be undone.
        </p>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            void unlock()
          }}
        >
          <input
            className="min-w-0 flex-1 rounded border border-zinc-300 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
            value={password}
            type={showPassword ? 'text' : 'password'}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Staff password"
            aria-label="Staff password"
          />
          <button
            type="button"
            className="shrink-0 rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
            onClick={() => setShowPassword((show) => !show)}
            aria-pressed={showPassword}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </form>
        <button
          type="button"
          className="mt-2 inline-flex w-full items-center justify-center rounded bg-red-800 px-4 py-2 text-sm font-semibold text-white hover:bg-red-900 disabled:cursor-not-allowed disabled:bg-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
          onClick={() => void unlock()}
          disabled={busy || !password || loadPending}
        >
          {busy ? 'Checking…' : 'Unlock crew editing'}
        </button>
        {error && <p className="mt-2 text-xs font-medium text-red-800">{error}</p>}
        {notice && !error && <p className="mt-2 text-xs font-medium text-green-800">{notice}</p>}
      </div>
    )
  }

  return (
    <div className="mt-3 rounded border border-zinc-200 bg-zinc-50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">Crew editing unlocked</h3>
          <p className="mt-0.5 text-xs text-zinc-600">
            {dirty ? 'You have unsaved changes — they reset on refresh until saved.' : 'Everything here is saved.'}
            {updatedAt ? ` Last saved ${formatWhen(updatedAt)}.` : ''}
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
          onClick={() => {
            setPassword('')
            setError('')
            setNotice('')
            onLock()
          }}
        >
          Lock
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className="inline-flex items-center justify-center rounded bg-red-800 px-4 py-2 text-sm font-semibold text-white hover:bg-red-900 disabled:cursor-not-allowed disabled:bg-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
          onClick={() => void save()}
          disabled={busy || loadPending || !dirty}
          title={loadPending ? 'Waiting for the crew store.' : 'Save this crew for every week.'}
        >
          {busy ? 'Saving…' : 'Save crew'}
        </button>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
          onClick={() => void undo()}
          disabled={busy || loadPending || !canUndo}
          title={canUndo ? 'Undo the last saved crew change.' : 'No saved change to undo yet.'}
        >
          Undo last saved
        </button>
      </div>
      {error && <p className="mt-2 text-xs font-medium text-red-800">{error}</p>}
      {notice && !error && <p className="mt-2 text-xs font-medium text-green-800">{notice}</p>}
    </div>
  )
}

function formatWhen(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
