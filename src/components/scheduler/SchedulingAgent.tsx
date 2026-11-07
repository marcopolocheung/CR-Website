'use client'

import { useEffect, useRef, useState } from 'react'
import { AGENT_API, AgentApiError, agentRequest, createAgentRun } from '@/lib/scheduler/agent-client'
import { contextFingerprint, type AgentContext, type AgentRunView } from '@/lib/scheduler/agent-contracts'
import { expandTemplate } from '@/lib/scheduler/data'
import { validateSchedule } from '@/lib/scheduler/validator'
import { withApprovedRequests } from '@/lib/scheduler/requests'
import type { RequestData } from '@/lib/scheduler/requests'
import type { ScheduleAssignment } from '@/lib/scheduler/types'

const goals = { balanced: 'Balance the week', fewestDoubles: 'Reduce double shifts', similarWeek: 'Keep this draft familiar', fairHours: 'Even out hours' } as const
const button = 'min-h-11 rounded-lg border border-zinc-300 bg-white px-4 text-base font-semibold text-zinc-900 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900'

export default function SchedulingAgent({ context, token, disabled, onApply }: {
  context: AgentContext; token: string; disabled: boolean; onApply: (assignments: ScheduleAssignment[]) => void
}) {
  const key = `cr-scheduling-agent:${context.stationId}:${context.weekStart}`
  const [goal, setGoal] = useState<AgentRunView['goal']>('balanced')
  const [run, setRun] = useState<AgentRunView | null>(null)
  const [runId, setRunId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [applied, setApplied] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const current = useRef({ context, disabled, onApply })
  current.current = { context, disabled, onApply }
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    try { setRunId(localStorage.getItem(key) ?? '') } catch { /* Saving the pointer is optional. */ }
    return () => { alive.current = false }
  }, [key])
  useEffect(() => {
    if (!runId || !AGENT_API) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    async function poll() {
      try {
        const next = await agentRequest(`/${runId}`, token)
        if (cancelled) return
        setRun(next); setError('')
        if (next.status === 'running') timer = setTimeout(() => void poll(), 1500)
      } catch (problem) {
        if (!cancelled) { setError((problem as Error).message); timer = setTimeout(() => void poll(), 10000) }
      }
    }
    void poll()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [runId, token])

  if (!AGENT_API) return null
  const waiting = run?.status === 'running'
  const proposal = run?.proposal
  const slots = expandTemplate(context.template, context.weekStart)
  const changes = proposal ? slots.flatMap(slot => {
    const previous = context.assignments.find(item => item.slotId === slot.id)?.employeeId
    const proposed = proposal.assignments.find(item => item.slotId === slot.id)?.employeeId
    return previous !== proposed ? [{ slotId: slot.id, previous, proposed }] : []
  }) : []
  function rememberRun(id: string) {
    try { localStorage.setItem(key, id) } catch { /* In-memory operation still works. */ }
  }
  async function make() {
    if (busy || disabled || waiting) return
    setBusy(true); setError(''); setNotice(''); setApplied(false); setRun(null); setRunId('')
    const id = crypto.randomUUID()
    // Persist the operation ID before sending; a lost response can be recovered by polling.
    rememberRun(id)
    try {
      const next = await createAgentRun(id, context, goal, token)
      if (alive.current) { setRun(next); setRunId(id) }
    } catch (problem) {
      if (alive.current) {
        setError((problem as Error).message)
        if (problem instanceof AgentApiError) {
          try { localStorage.removeItem(key) } catch { /* Optional pointer cleanup. */ }
        } else setRunId(id)
      }
    }
    finally { if (alive.current) setBusy(false) }
  }
  async function decide(accept: boolean) {
    if (!run || busy) return
    const before = contextFingerprint(current.current.context)
    setBusy(true); setError('')
    try {
      const next = await agentRequest(`/${run.id}/decision`, token, { accept, ...(accept ? { context: current.current.context } : {}) })
      if (!alive.current) return
      setRun(next)
      if (!accept) { setNotice('Proposal dismissed. Your schedule is unchanged.'); return }
      if (next.status !== 'accepted' || !next.proposal) throw new Error('The agent could not accept this proposal. Try again.')
      if (current.current.disabled || contextFingerprint(current.current.context) !== before)
        throw new Error('Your week changed while the proposal was being checked. Make a new proposal to keep those changes.')
      const draft = current.current.context
      const assignments = next.proposal.assignments
      const problems = validateSchedule({ employees: withApprovedRequests(draft.employees, draft.requests.data as RequestData | null, draft.weekStart),
        slots: expandTemplate(draft.template, draft.weekStart), assignments,
        lockedAssignments: Object.fromEntries(draft.assignments.filter(item => item.locked).map(item => [item.slotId, item.employeeId])) })
      if (problems.length || new Set(assignments.map(item => item.slotId)).size !== assignments.length)
        throw new Error('The proposal no longer passes the schedule checks. Make a new proposal.')
      current.current.onApply(assignments)
      setApplied(true)
      setNotice('✓ Proposal added to your draft. Use Undo to restore the previous schedule. Publish when you are ready for staff to see it.')
    } catch (problem) { if (alive.current) setError((problem as Error).message) }
    finally { if (alive.current) setBusy(false) }
  }
  return (
    <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 print:hidden" aria-labelledby="scheduling-agent-title">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h2 id="scheduling-agent-title" className="text-lg font-semibold text-zinc-900">Scheduling assistant</h2>
          <p className="text-sm text-zinc-600">Build, check, and compare proposals while keeping your locked spots.</p></div>
        <button type="button" className={button} onClick={() => setExpanded(value => !value)} aria-expanded={expanded}>{expanded ? 'Hide assistant' : 'Open assistant'}</button>
      </div>
      {expanded && <>
        <div className="flex flex-wrap items-end gap-4">
          <label className="grid flex-1 gap-2 text-base font-medium text-zinc-900">Goal for this week
            <select value={goal} onChange={event => setGoal(event.target.value as AgentRunView['goal'])} disabled={busy || waiting}
              className="min-h-11 rounded-lg border border-zinc-300 bg-white px-3 text-base">
              {Object.entries(goals).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <button type="button" className={button} onClick={() => void make()} disabled={disabled || busy || waiting} aria-busy={busy || waiting}>
            {waiting ? 'Comparing proposals…' : 'Make proposal'}
          </button>
        </div>
        {disabled && <p className="text-sm text-amber-950">! Load the saved crew, fix shift rules, and reload requests before making or using a proposal.</p>}
        {error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-900">✕ {error}</p>}
        {notice && <p role="status" className="rounded-lg border border-green-300 bg-green-50 p-4 text-green-900">{notice}</p>}
        {run && <div className="space-y-4" aria-live="polite">
          <p className="font-medium text-zinc-900">{run.status === 'review' ? '✓ Ready for review · ' : run.status === 'blocked' || run.status === 'failed' ? '! Needs attention · ' : ''}{run.summary}</p>
          {!!run.problems.length && <ul className="list-disc space-y-2 pl-5 text-red-900">{run.problems.map((problem, index) => <li key={index}>{problem}</li>)}</ul>}
          {proposal && <>
            <p className="text-sm tabular-nums text-zinc-700">{proposal.metrics.totalHours} scheduled hours · {proposal.metrics.hourSpread} hour spread · Goal: {goals[run.goal]}</p>
            <details><summary className="min-h-11 cursor-pointer py-3 font-medium text-zinc-900">Review {changes.length} changed spots</summary>
              <div className="overflow-x-auto"><table className="w-full text-left text-sm text-zinc-900"><thead><tr><th className="p-2">Spot</th><th className="p-2">Current</th><th className="p-2">Proposed</th></tr></thead>
                <tbody>{changes.map(item => {
                  const slot = slots.find(s => s.id === item.slotId)
                  return <tr key={item.slotId} className="border-t border-zinc-200"><td className="p-2">{slot ? `${slot.day} ${slot.period} · ${slot.label}` : item.slotId}</td>
                    <td className="p-2">{context.employees.find(e => e.id === item.previous)?.name ?? 'Open'}</td><td className="p-2">{context.employees.find(e => e.id === item.proposed)?.name ?? 'Open'}</td></tr>
                })}</tbody></table></div>
            </details>
          </>}
          {!applied && (run.status === 'review' || run.status === 'accepted') && <div className="flex flex-wrap gap-4">
            <button type="button" className={button} onClick={() => void decide(true)} disabled={disabled || busy}>Use proposal</button>
            {run.status === 'review' && <button type="button" className={button} onClick={() => void decide(false)} disabled={busy}>Dismiss proposal</button>}
          </div>}
          <details><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-zinc-900">See work log</summary>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-zinc-700">{run.events.map((event, index) => <li key={index}>{event.message}</li>)}</ol>
          </details>
        </div>}
      </>}
    </section>
  )
}
