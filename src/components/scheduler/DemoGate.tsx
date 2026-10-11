'use client'

import { createContext, useContext, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { saveErrorMessage, verifyWriteToken } from '@/lib/schedule-store'

const ManagerCodeContext = createContext('')

/** The manager code this visit unlocked with. Every scheduler save sends it, so nobody types it twice. */
export function useManagerCode() {
  return useContext(ManagerCodeContext)
}

/**
 * Code gate in front of the scheduler. The code is the manager write token, checked live against
 * the Worker (`GET /api/auth/verify`). It is held in memory for this visit only — never written to
 * storage — so a reload or a new tab asks again. Mounted in the scheduler layout so moving between
 * stations keeps it.
 */
export default function DemoGate({ children }: { children: ReactNode }) {
  const [unlockedCode, setUnlockedCode] = useState('')
  const [code, setCode] = useState('')
  const [showCode, setShowCode] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!code || busy) return
    setBusy(true)
    setError('')
    try {
      await verifyWriteToken(code)
      setUnlockedCode(code)
      setCode('')
    } catch (caught) {
      setError(saveErrorMessage(caught, 'code'))
    } finally {
      setBusy(false)
    }
  }

  if (unlockedCode) return <ManagerCodeContext.Provider value={unlockedCode}>{children}</ManagerCodeContext.Provider>

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Scheduler</p>
      <h1 className="mt-1 text-2xl font-bold">Enter the manager code</h1>
      <p className="mt-2 text-sm text-zinc-600">
        For managers only. You type the code once — every save on this visit uses it. It is never stored.
      </p>
      <form onSubmit={submit} className="mt-6 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <label className="text-sm font-medium text-zinc-800" htmlFor="demo-gate-code">
          Manager code
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id="demo-gate-code"
            className="min-w-0 flex-1 rounded border border-zinc-300 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
            value={code}
            type={showCode ? 'text' : 'password'}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Type the code to continue"
          />
          <button
            type="button"
            className="shrink-0 rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
            onClick={() => setShowCode((show) => !show)}
            aria-pressed={showCode}
          >
            {showCode ? 'Hide' : 'Show'}
          </button>
        </div>
        <button
          type="submit"
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
          disabled={busy || !code}
        >
          {busy ? 'Checking…' : 'Open the scheduler'}
        </button>
        {error && <p className="mt-2 text-sm font-medium text-red-800">{error}</p>}
      </form>
    </div>
  )
}
