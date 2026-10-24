'use client'

import { useEffect, useRef } from 'react'
import { useInternalLanguage } from './InternalLanguage'
import { parseCountInput } from '@/lib/internal-tools/cashout-draft'

/** An inline, optional keypad: the active denomination/value remain visible while tapping. */
export default function CountKeypad({ label, value, onChange, onPrevious, onNext, onClose }: {
  label: string
  value: string
  onChange: (value: string) => void
  onPrevious: (() => void) | null
  onNext: (() => void) | null
  onClose: () => void
}) {
  const { t } = useInternalLanguage()
  const first = useRef<HTMLButtonElement>(null)
  useEffect(() => { first.current?.focus() }, [])
  const buttonClass = 'min-h-11 rounded-lg border border-gray-300 bg-white px-3 py-2 text-base font-medium hover:bg-gray-100 disabled:opacity-40'
  return <div role="group" aria-label={t('cash.keypad')} onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); onClose() }
  }} className="mt-2 border-t border-gray-200 pt-2 print:hidden">
    <p className="break-words text-sm font-medium">{label}</p>
    <p className="my-1 break-all font-mono text-lg" aria-live="polite" aria-atomic="true">{value === '' ? t('cash.notEntered') : value}</p>
    {parseCountInput(value) === null && <p role="alert" className="mb-2 text-sm text-red-700">{t('cash.invalidCount')}</p>}
    <div className="grid grid-cols-3 gap-1">
      {['1','2','3','4','5','6','7','8','9'].map((digit, index) => <button key={digit} ref={index === 0 ? first : undefined}
        type="button" className={buttonClass} onClick={() => onChange(value + digit)}>{digit}</button>)}
      <button type="button" className={buttonClass} onClick={() => onChange('')}>{t('cash.clearCount')}</button>
      <button type="button" className={buttonClass} onClick={() => onChange(value + '0')}>0</button>
      <button type="button" className={buttonClass} onClick={() => onChange(value.slice(0,-1))}>{t('cash.backspace')}</button>
    </div>
    <div className="mt-2 flex flex-wrap gap-2">
      <button type="button" className={buttonClass} disabled={!onPrevious} onClick={() => onPrevious?.()}>{t('cash.previousCount')}</button>
      <button type="button" className={buttonClass} disabled={!onNext} onClick={() => onNext?.()}>{t('cash.nextCount')}</button>
      <button type="button" className={buttonClass} onClick={onClose}>{t('cash.closeKeypad')}</button>
    </div>
  </div>
}
