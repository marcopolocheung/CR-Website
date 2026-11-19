'use client'

import { useEffect, useRef, useState } from 'react'
import { DraftJob } from '@/lib/scheduler/draft-job'
import { assignmentChanges, describeRepair, RepairProblem, repairSchedule, type AssignmentChange, type RepairInput } from '@/lib/scheduler/repair'
import type { ScheduleAssignment } from '@/lib/scheduler/types'
import type { TranslationKey } from '@/lib/internal-tools/i18n'

type Prepared = ScheduleAssignment[] | { assignments: ScheduleAssignment[]; exclusions: readonly string[] }
export type AdjustmentReport = { scope: string; changes: AssignmentChange[]; automaticSlotIds: string[]; limited: boolean; notice: TranslationKey }
export default function useDraftAdjustment({ input, contextKey, scope, disabled, onCommit }: {
  input: RepairInput; contextKey: string; scope: string; disabled: boolean
  onCommit: (assignments: ScheduleAssignment[], exclusions: readonly string[]) => void
}) {
  const jobs = useRef(new DraftJob())
  const latest = useRef({ input, contextKey, scope, disabled, onCommit })
  latest.current = { input, contextKey, scope, disabled, onCommit }
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState<AdjustmentReport | null>(null)
  const [error, setError] = useState<TranslationKey | null>(null)
  useEffect(() => {
    jobs.current.cancel(); setBusy(false); setError(null)
    return () => jobs.current.cancel()
  }, [contextKey])

  function cancel() { jobs.current.cancel(); setBusy(false) }
  async function run(prepare: (input: RepairInput) => Prepared, auto: boolean, notice: TranslationKey = 'planning.done') {
    const current = latest.current
    if (current.disabled || busy) return
    const job = jobs.current.begin(current.contextKey)
    setBusy(true); setError(null)
    try {
      // Paint busy state and allow week/layout navigation to cancel before search.
      await new Promise(resolve => setTimeout(resolve, 0))
      if (!jobs.current.canCommit(job, latest.current.contextKey)) return
      const prepared = prepare(current.input)
      const proposed = Array.isArray(prepared) ? prepared : prepared.assignments
      const exclusions = Array.isArray(prepared) ? current.input.exclusions ?? [] : prepared.exclusions
      const input = { ...current.input, assignments: proposed, exclusions }
      const result = auto ? await repairSchedule(input, { signal: job.controller.signal }) : describeRepair(input, proposed)
      if (!jobs.current.canCommit(job, latest.current.contextKey) || latest.current.disabled) return
      const changes = assignmentChanges(current.input.assignments, result.assignments)
      const exclusionsChanged = !Array.isArray(prepared)
      if (changes.length || exclusionsChanged) current.onCommit(result.assignments, exclusions)
      setReport({ scope: current.scope, changes, automaticSlotIds: result.changes.map(c => c.slotId), limited: result.limited, notice })
    } catch (problem) {
      if (!jobs.current.canCommit(job, latest.current.contextKey)) return
      if (problem instanceof RepairProblem) {
        setError(problem.code === 'unavailable' ? 'planning.unavailablePlacement' : `planning.${problem.code}`)
      } else if (!(problem instanceof DOMException && problem.name === 'AbortError')) setError('planning.failed')
    } finally {
      if (jobs.current.owns(job)) { jobs.current.finish(job); setBusy(false) }
    }
  }
  return { busy, report: report?.scope === scope ? report : null, error, run, cancel,
    clearReport: () => { setReport(null); setError(null) } }
}
