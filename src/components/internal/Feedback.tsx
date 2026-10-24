'use client'

import { useCallback, useEffect, useId, useRef, useState, type InputHTMLAttributes } from 'react'
import { useInternalLanguage } from './InternalLanguage'
import type { Message } from '@/lib/internal-tools/i18n'

export type FieldIssue = { fieldId: string; message: Message }
export function focusField(fieldId: string) {
  document.getElementById(fieldId)?.focus()
}
export function LabeledInput({ id, label, error, ...props }: InputHTMLAttributes<HTMLInputElement> & { id: string; label: Message; error?: Message | null }) {
  const { t } = useInternalLanguage()
  return <div>
    <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700">{t(label.key, label.params)}</label>
    <input {...props} id={id} aria-invalid={error ? true : undefined} aria-describedby={[props['aria-describedby'], error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined} />
    {error && <p id={`${id}-error`} role="alert" className="mt-2 text-sm text-red-700">{t(error.key, error.params)}</p>}
  </div>
}
export function ErrorSummary({ issues }: { issues: FieldIssue[] }) {
  const { t } = useInternalLanguage()
  if (!issues.length) return null
  return <div role="alert" className="my-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
    <p className="font-semibold">{t('feedback.fixFields')}</p>
    <ul className="mt-1 list-inside list-disc">{issues.map(issue => <li key={issue.fieldId} id={`${issue.fieldId}-summary-error`}>
      <a href={`#${issue.fieldId}`} onClick={event => { event.preventDefault(); focusField(issue.fieldId) }} className="underline focus-visible:outline-2">
        {t(issue.message.key, issue.message.params)}
      </a>
    </li>)}</ul>
  </div>
}
export function EmptyState({ message }: { message: Message }) {
  const { t } = useInternalLanguage()
  return <p className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">{t(message.key, message.params)}</p>
}
export type SaveState = 'unsaved' | 'device' | 'sending' | 'server' | 'waiting' | 'failed' | 'conflict'
const STATE_KEYS = {
  unsaved: 'common.unsaved', device: 'common.savedDevice', sending: 'common.sending', server: 'common.savedServer',
  waiting: 'common.waiting', failed: 'feedback.failed', conflict: 'errors.conflict',
} as const
export function SaveFeedback({ state, message }: { state: SaveState; message?: Message | null }) {
  const { t } = useInternalLanguage()
  return <div role="status" aria-live="polite" aria-atomic="true" data-save-state={state} className="text-sm text-gray-700 print:hidden">
    <p className="font-medium">{t(STATE_KEYS[state])}</p>
    {message && <p>{t(message.key, message.params)}</p>}
  </div>
}

type Question = { message: Message; destructive?: boolean }
export function useConfirmation() {
  const [question, setQuestion] = useState<Question | null>(null)
  const resolve = useRef<((answer: boolean) => void) | null>(null)
  const mounted = useRef(true)
  const ask = useCallback((message: Message, destructive = false): Promise<boolean> => {
    if (!mounted.current || resolve.current) return Promise.resolve(false)
    return new Promise(answer => { resolve.current = answer; setQuestion({ message, destructive }) })
  }, [])
  const decide = useCallback((answer: boolean) => {
    const pending = resolve.current
    resolve.current = null
    setQuestion(null)
    pending?.(answer)
  }, [])
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; resolve.current?.(false); resolve.current = null }
  }, [])
  return { ask, dialog: <ConfirmDialog question={question} onDecision={decide} /> }
}
function ConfirmDialog({ question, onDecision }: { question: Question | null; onDecision: (answer: boolean) => void }) {
  const { t } = useInternalLanguage()
  const titleId = useId()
  const descriptionId = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const element = dialog.current
    if (!question || !element) return
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    element.showModal()
    cancel.current?.focus()
    return () => { element.close(); if (trigger?.isConnected) trigger.focus() }
  }, [question])
  return <dialog ref={dialog} aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={event => { event.preventDefault(); onDecision(false) }}
    onKeyDown={event => {
      if (event.key !== 'Tab') return
      const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])')
      const first = buttons[0]
      const last = buttons[buttons.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }}
    className="m-auto max-h-[85vh] w-[min(28rem,calc(100%_-_2rem))] overflow-auto rounded-xl border border-gray-200 bg-white p-6 shadow-xl backdrop:bg-black/40 print:hidden">
    {question && <>
      <h2 id={titleId} className="text-lg font-semibold text-gray-900">{t('feedback.confirmTitle')}</h2>
      <p id={descriptionId} className="mt-3 text-sm text-gray-700">{t(question.message.key, question.message.params)}</p>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button ref={cancel} type="button" onClick={() => onDecision(false)} className="min-h-11 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700">{t('feedback.cancel')}</button>
        <button type="button" onClick={() => onDecision(true)} className={`min-h-11 rounded-lg px-4 py-2 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 ${question.destructive ? 'bg-red-700 hover:bg-red-800' : 'bg-red-600 hover:bg-red-700'}`}>{t('feedback.confirm')}</button>
      </div>
    </>}
  </dialog>
}
