'use client'

import { useState } from 'react'
import { translate } from '@/lib/internal-tools/i18n'
import type { Locale } from '@/lib/internal-tools/contracts'
import { AssistantError, suggestScheduleChanges, type AssistantFailure } from '@/lib/assistant-client'
import { AssistantStepProblem, prepareAssistantOps, type AssistantOp } from '@/lib/scheduler/assistant'
import type { RepairInput } from '@/lib/scheduler/repair'
import { planningDate } from './planning-format'
import css from './planning.module.css'

type Suggestion = { reply: string; operations: AssistantOp[]; draftKey: string }

/** Plain-language draft edits. The AI only proposes; the manager applies through the normal adjustment (with Undo). */
export default function ScheduleAssistant({ input, weekStart, draftKey, token, locale, disabled, onApply, onRecord, onDenied }: {
  input: RepairInput; weekStart: string; draftKey: string; token: string; locale: Locale; disabled: boolean
  onApply: (ops: AssistantOp[]) => void; onRecord: (employeeId: string, date: string) => void; onDenied: (caught: unknown) => void
}) {
  const t = (key: string, params?: Record<string, string | number>) => translate(locale, key, params)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)
  const [failure, setFailure] = useState<AssistantFailure | null>(null)
  const [problem, setProblem] = useState('')
  const [applied, setApplied] = useState(false)
  const name = (id?: string) => input.employees.find(e => e.id === id)?.name ?? '?'
  const spot = (id?: string) => {
    const slot = input.slots.find(s => s.id === id)
    return slot?.date ? `${planningDate(slot.date, locale)} · ${slot.period} · ${slot.label}` : '?'
  }
  const describe = (op: AssistantOp) => op.type === 'callout' ? t('planning.ai.callout', { name: name(op.employeeId), date: planningDate(op.date, locale) })
    : op.type === 'remove' ? t('planning.ai.remove', { name: name(input.assignments.find(a => a.slotId === op.slotId)?.employeeId), spot: spot(op.slotId) })
    : op.fromSlotId ? t('planning.ai.move', { name: name(op.employeeId), from: spot(op.fromSlotId), to: spot(op.slotId) })
    : t('planning.ai.place', { name: name(op.employeeId), spot: spot(op.slotId) })

  async function suggest() {
    if (busy || disabled || !text.trim()) return
    setBusy(true); setFailure(null); setProblem(''); setApplied(false); setSuggestion(null)
    const sentKey = draftKey
    try {
      const proposal = await suggestScheduleChanges({
        text: text.trim(), weekStart,
        employees: input.employees.map(({ id, name, roles, active }) => ({ id, name, roles, active })),
        slots: input.slots.flatMap(({ id, day, period, role, label, start, end, required, date }) => date ? [{ id, day, period, role, label, start, end, required, date }] : []),
        assignments: input.assignments.filter(a => a.employeeId).map(({ slotId, employeeId, locked }) => ({ slotId, employeeId, ...(locked ? { locked } : {}) })),
      }, token)
      setSuggestion({ ...proposal, draftKey: sentKey })
    } catch (caught) {
      onDenied(caught)
      setFailure(caught instanceof AssistantError ? caught.reason : 'failed')
    } finally { setBusy(false) }
  }
  function apply() {
    if (!suggestion || disabled) return
    if (suggestion.draftKey !== draftKey) { setProblem(t('planning.ai.stale')); return }
    try { prepareAssistantOps(input, suggestion.operations) }
    catch (caught) {
      if (!(caught instanceof AssistantStepProblem)) throw caught
      const code = caught.problem.code
      setProblem(t('planning.ai.step', { step: caught.step, reason: t(code === 'unavailable' ? 'planning.unavailablePlacement' : `planning.${code}`) }))
      return
    }
    setProblem(''); setApplied(true)
    onApply(suggestion.operations)
  }

  const stale = !!suggestion && suggestion.draftKey !== draftKey
  return <div className={`${css.planning} ${css.panel}`} data-schedule-assistant>
    <label>{t('planning.ai.label')}
      <textarea value={text} maxLength={500} rows={2} disabled={busy} onChange={e => setText(e.target.value)} placeholder={t('planning.ai.placeholder')}
        className="w-full border border-[var(--cr-control)] p-3 text-base" />
    </label>
    <p>{t('planning.ai.hint')}</p>
    <div className={css.actions}>
      <button disabled={busy || disabled || !text.trim()} onClick={() => void suggest()}>{t(busy ? 'planning.ai.busy' : 'planning.ai.suggest')}</button>
    </div>
    {failure && <p role="alert" className={css.error}>{t(`assistant.${failure}`)}</p>}
    {suggestion && <div aria-live="polite">
      <p>{suggestion.reply}</p>
      {suggestion.operations.length > 0 && <>
        <ol className="list-decimal pl-6">{suggestion.operations.map((op, index) => <li key={index} className="py-1">
          {describe(op)}
          {op.type === 'callout' && <> <button onClick={() => onRecord(op.employeeId, op.date)}>{t('planning.ai.record')}</button></>}
        </li>)}</ol>
        <div className={css.actions}>
          <button className={css.primary} disabled={disabled || stale || applied} onClick={apply}>{t('planning.ai.apply')}</button>
        </div>
      </>}
    </div>}
    {problem && <p role="alert" className={css.error}>{problem}</p>}
  </div>
}
