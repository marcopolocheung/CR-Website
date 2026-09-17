'use client'

import { useState } from 'react'
import { saveRoster } from '@/lib/employee-store'
import { StoreAuthError, StoreConflictError, StoreUnavailableError } from '@/lib/schedule-store'
import type { Employee } from '@/lib/scheduler'

export default function RosterPanel({
  employees,
  rev,
  dirty,
  loadPending = false,
  onSaved,
  onClose,
  restaurantId,
}: {
  employees: Employee[]
  rev: number
  dirty: boolean
  loadPending?: boolean
  onSaved: (rev: number, updatedAt: string | null) => void
  onClose: () => void
  restaurantId?: string
}) {
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function save() {
    if (!token || busy || loadPending) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await saveRoster(employees, rev, token, restaurantId)
      setToken('')
      setNotice('Saved. This staff list is now what everyone editing the scheduler starts from.')
      onSaved(result.rev, result.updatedAt)
    } catch (caught) {
      if (caught instanceof StoreAuthError) {
        setError('That token was not accepted. Check for typos and try again.')
      } else if (caught instanceof StoreConflictError) {
        setError('Someone else saved the staff list first. Reload the page, then try again.')
      } else if (caught instanceof StoreUnavailableError) {
        setError(`${caught.message} Your edits are safe on this screen — try again in a moment.`)
      } else {
        setError('Something went wrong saving.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3 rounded border border-zinc-200 bg-zinc-50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">Save staff list</h3>
          <p className="mt-0.5 text-xs text-zinc-600">
            {dirty ? 'You have changes that are not saved yet — they will reset on refresh until saved.' : 'Nothing new to save.'}
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
          onClick={onClose}
        >
          Close
        </button>
      </div>
      <div className="mt-2 flex gap-2">
        <input
          className="min-w-0 flex-1 rounded border border-zinc-300 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
          value={token}
          type={showToken ? 'text' : 'password'}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setToken(event.target.value)}
          placeholder="Manager write token"
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
      <button
        type="button"
        className="mt-2 inline-flex items-center justify-center gap-2 rounded bg-red-800 px-4 py-2 text-sm font-semibold text-white hover:bg-red-900 disabled:cursor-not-allowed disabled:bg-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
        onClick={save}
        disabled={busy || !token || !dirty || loadPending}
        title={loadPending ? 'Waiting for the schedule store.' : undefined}
      >
        {busy ? 'Saving...' : 'Save staff list'}
      </button>
      {error && <p className="mt-2 text-xs font-medium text-red-800">{error}</p>}
      {notice && !error && <p className="mt-2 text-xs font-medium text-green-800">{notice}</p>}
    </div>
  )
}
