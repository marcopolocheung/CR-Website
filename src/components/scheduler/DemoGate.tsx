'use client'

import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { StoreAuthError, StoreUnavailableError, verifyWriteToken } from '@/lib/schedule-store'

/** sessionStorage marker that the demo gate was unlocked. The code itself is never stored. */
export const DEMO_GATE_KEY = 'cr-scheduler-unlocked'

/**
 * Code gate in front of the scheduler demo. The code is the same manager
 * write token used to publish schedules — checked live against the Worker
 * (`GET /api/auth/verify`), never stored anywhere. Unlocking only reveals
 * the demo UI in this tab; publishing still asks for the token again.
 */
export default function DemoGate({ children }: { children: ReactNode }) {
  // Default locked so the first render matches the statically prerendered
  // HTML (no sessionStorage on the server); the effect below unlocks when
  // this tab already passed the gate.
  const [unlocked, setUnlocked] = useState(false)
  const [code, setCode] = useState('')
  const [showCode, setShowCode] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    try {
      setUnlocked(window.sessionStorage.getItem(DEMO_GATE_KEY) === '1')
    } catch {
      setUnlocked(false)
    }
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!code || busy) return
    setBusy(true)
    setError('')
    try {
      await verifyWriteToken(code)
      try {
        window.sessionStorage.setItem(DEMO_GATE_KEY, '1')
      } catch {
        // Private mode etc. — the gate still unlocks for this page view.
      }
      setCode('')
      setUnlocked(true)
    } catch (caught) {
      if (caught instanceof StoreAuthError) {
        setError('That code was not accepted. Check for typos and try again, or ask whoever runs the Worker for the current one.')
      } else if (caught instanceof StoreUnavailableError) {
        setError(`${caught.message} Your code was not checked — try again in a moment.`)
      } else {
        setError('Something went wrong checking the code.')
      }
    } finally {
      setBusy(false)
    }
  }

  if (unlocked) return <>{children}</>

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Scheduler demo</p>
      <h1 className="mt-1 text-2xl font-bold">Enter the manager code</h1>
      <p className="mt-2 text-sm text-zinc-600">
        This demo is for managers only. Use the same code you type when publishing schedules — it is checked, never saved.
      </p>
      <form onSubmit={submit} className="mt-6 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <label className="text-sm font-medium text-zinc-800" htmlFor="demo-gate-code">
          Manager code
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id="demo-gate-code"
            className="min-w-0 flex-1 rounded border border-zinc-300 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
            value={code}
            type={showCode ? 'text' : 'password'}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Type the code to continue"
          />
          <button
            type="button"
            className="shrink-0 rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
            onClick={() => setShowCode((show) => !show)}
            aria-pressed={showCode}
          >
            {showCode ? 'Hide' : 'Show'}
          </button>
        </div>
        <button
          type="submit"
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded bg-red-800 px-4 py-2 text-sm font-semibold text-white hover:bg-red-900 disabled:cursor-not-allowed disabled:bg-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
          disabled={busy || !code}
        >
          {busy ? 'Checking…' : 'Unlock the demo'}
        </button>
        {error && <p className="mt-2 text-sm font-medium text-red-800">{error}</p>}
      </form>
    </div>
  )
}
