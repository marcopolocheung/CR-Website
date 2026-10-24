'use client'

import { useCallback, useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { useInternalLanguage } from './InternalLanguage'

/** Opt-in field navigation. Tab stays native; Enter never saves or wraps the entry. */
export default function EntryWorkspace({ children, summary, finishId }: {
  children: ReactNode
  summary: ReactNode
  finishId: string
}) {
  const { t } = useInternalLanguage()
  const workspace = useRef<HTMLDivElement>(null)
  const summaryRef = useRef<HTMLDivElement>(null)
  const frame = useRef<number | null>(null)
  const revealField = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      frame.current = null
      const element = workspace.current
      if (!element) return
      const viewport = window.visualViewport
      element.style.setProperty('--entry-viewport-height', `${viewport?.height ?? window.innerHeight}px`)
      const field = document.activeElement
      if (!(field instanceof HTMLInputElement) || !element.contains(field)) return
      const bannerHeight = parseFloat(getComputedStyle(element).getPropertyValue('--internal-banner-height')) || 0
      const top = (viewport?.offsetTop ?? 0) + bannerHeight + (summaryRef.current?.offsetHeight ?? 0) + 16
      const bottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) - 24
      const box = field.getBoundingClientRect()
      if (bottom - top >= box.height && (box.top < top || box.bottom > bottom)) {
        window.scrollBy({ top: box.top - (top + Math.max(0, bottom - top - box.height) / 2), behavior: 'instant' })
      }
    })
  }, [])

  useEffect(() => {
    const viewport = window.visualViewport
    viewport?.addEventListener('resize', revealField)
    viewport?.addEventListener('scroll', revealField)
    window.addEventListener('resize', revealField)
    return () => {
      viewport?.removeEventListener('resize', revealField)
      viewport?.removeEventListener('scroll', revealField)
      window.removeEventListener('resize', revealField)
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    }
  }, [revealField])

  const navigate = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' || event.altKey || event.ctrlKey || event.metaKey || event.nativeEvent.isComposing) return
    if (!(event.target instanceof HTMLInputElement) || !event.target.matches('[data-entry-field]')) return
    const fields = [...event.currentTarget.querySelectorAll<HTMLInputElement>('input[data-entry-field]:not([disabled])')]
      .filter(field => field.getClientRects().length > 0)
    const index = fields.indexOf(event.target)
    if (index < 0) return
    event.preventDefault()
    const next = fields[index + (event.shiftKey ? -1 : 1)]
    if (next) next.focus()
    else if (!event.shiftKey) document.getElementById(finishId)?.focus()
  }

  return <div ref={workspace} onKeyDown={navigate} onFocusCapture={revealField}
    className="[&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-offset-2 [&_button]:focus-visible:outline-red-700 [&_input]:scroll-my-24">
    <div ref={summaryRef} data-entry-summary className="sticky top-[var(--internal-banner-height,0px)] z-10 mb-4 max-h-[calc(var(--entry-viewport-height,100dvh)_-_var(--internal-banner-height,0px)_-_1rem)] overflow-y-auto border-y border-gray-200 bg-white px-3 py-2 print:hidden">
      {summary}
      <p className="mt-1 text-xs text-gray-600">{t('entry.help')}</p>
    </div>
    {children}
  </div>
}
