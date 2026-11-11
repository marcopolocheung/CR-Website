'use client'

import { useCallback, useLayoutEffect, useRef } from 'react'
import { Icon, type IconName } from './Icon'
import styles from './ui.module.css'

export type NavigationItem = { id: string; label: string; icon: IconName }

/** A controlled task selector. Hover/focus preview geometry; only activation selects. */
export function MovingNavigation({ items, selectedId, onSelect, label }: {
  items: readonly NavigationItem[]; selectedId: string; onSelect: (id: string) => void; label: string
}) {
  const track = useRef<HTMLElement>(null)
  const surface = useRef<HTMLSpanElement>(null)
  const hovered = useRef<HTMLButtonElement | null>(null)
  const focused = useRef<HTMLButtonElement | null>(null)
  const move = useCallback((target: HTMLButtonElement | null, instant = false) => {
    const element = surface.current
    if (!target || !element || !track.current?.contains(target)) return
    if (instant) element.style.transition = 'none'
    element.style.width = `${target.offsetWidth}px`
    element.style.height = `${target.offsetHeight}px`
    element.style.transform = `translate(${target.offsetLeft}px, ${target.offsetTop}px)`
    element.style.opacity = '1'
    if (instant) { element.getBoundingClientRect(); element.style.removeProperty('transition') }
  }, [])
  const restore = useCallback((instant = false) => {
    const current = track.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]') ?? null
    move(focused.current?.matches(':focus-visible') ? focused.current : hovered.current ?? current, instant)
  }, [move])

  useLayoutEffect(() => {
    restore(true)
    const element = track.current
    if (!element) return
    const observer = new ResizeObserver(() => restore(true))
    observer.observe(element)
    element.querySelectorAll('button').forEach(button => observer.observe(button))
    let active = true
    void document.fonts.ready.then(() => { if (active) restore(true) })
    return () => { active = false; observer.disconnect() }
  }, [items, restore])
  useLayoutEffect(() => { restore() }, [selectedId, restore])

  return <nav ref={track} aria-label={label} className={styles.navigation}
    onPointerLeave={event => { if (event.pointerType !== 'touch') { hovered.current = null; restore() } }}
    onBlur={() => queueMicrotask(() => { if (track.current) restore() })}>
    <span ref={surface} aria-hidden="true" data-nav-surface className={styles.navSurface} />
    {items.map(item => <button key={item.id} type="button" data-nav-item={item.id} aria-pressed={selectedId === item.id}
      className={styles.navItem}
      onPointerEnter={event => { if (event.pointerType !== 'touch') { hovered.current = event.currentTarget; move(event.currentTarget) } }}
      onPointerDown={event => { if (event.pointerType === 'touch') { hovered.current = null; focused.current = null; restore() } }}
      onFocus={event => { focused.current = event.currentTarget; if (event.currentTarget.matches(':focus-visible')) move(event.currentTarget) }}
      onClick={() => onSelect(item.id)}>
      <Icon name={item.icon} /><span>{item.label}</span>
    </button>)}
  </nav>
}
