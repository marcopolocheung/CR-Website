'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { translate } from '@/lib/internal-tools/i18n'
import { canonicalJson } from '@/lib/internal-tools/json'
import { STATION_STORES, type Locale, type StationId } from '@/lib/internal-tools/contracts'
import { DAYS, dateForDay, formatTimeRange, type Employee, type ScheduleAssignment, type StaffingSlot } from '@/lib/scheduler'
import { suggestedHoursDecisions, type HoursDecision, type HoursReviewRecord, type SpecialHoursData, type SpecialHoursPage } from '@/lib/scheduler/special-hours'
import { createHoursBatch, planHoursDay, previewHoursPlan, saveHoursBatch, verifyHoursBatch, type HoursBatch, type HoursResult } from '@/lib/scheduler/hours-batch'
import { SpecialHoursError } from '@/lib/scheduler/special-hours-store'
import { useManagerCode } from './DemoGate'
import { TimeField } from './RulesEditor'
import { hoursCaption } from './SpecialHours'
import type { SpecialHoursSource } from './useSpecialHours'
import { planningDate } from './planning-format'
import css from './special-hours.module.css'

export default function HoursEditor({ active=true,date, week, anchor, station, locale, source, base, assignments, employees,
  locked, activeReviews, onClose, onApplied, onDirty, onBusy, onUnlock }: {
  active?:boolean; date: string | null; week: string; anchor: HTMLElement | null; station: StationId; locale: Locale
  source: SpecialHoursSource; base: StaffingSlot[]; assignments: ScheduleAssignment[]; employees: Employee[]
  locked: boolean; activeReviews: readonly HoursReviewRecord[]; onClose: () => void
  onApplied: (results: readonly HoursResult[], page: SpecialHoursPage) => void
  onDirty: (dirty: boolean) => void; onBusy: (busy: boolean) => void
  onUnlock: (password: string) => Promise<string|null>
}) {
  const t = (key: string, params?: Record<string, string | number>) => translate(locale, key, params)
  const token = useManagerCode()
  useEffect(()=>{if(!token)setUnlockPassword('')},[token])
  const [snapshot, setSnapshot] = useState(source.page!)
  const initial = useRef(snapshot.events.find(e => e.data.date === date)?.data)
  const [selected, setSelected] = useState<string[]>(date ? [date] : [])
  const [multiple, setMultiple] = useState(!date)
  const [mode, setMode] = useState<SpecialHoursData['mode'] | null>(date ? initial.current?.mode ?? 'normal' : null)
  const [closeMinute, setCloseMinute] = useState(initial.current?.closeMinute ?? 1140)
  const [label, setLabel] = useState(initial.current?.label ?? '')
  const [changeLabel, setChangeLabel] = useState(false)
  const [overrides, setOverrides] = useState<Record<string, HoursDecision[]>>({})
  const [saving, setSaving] = useState(false), [uncertain, setUncertain] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unlockPassword,setUnlockPassword] = useState(''), [unlockError,setUnlockError] = useState<string|null>(null)
  const [unlocking,setUnlocking] = useState(false)
  const [, setProgress] = useState(0)
  const attempt = useRef<HoursBatch | null>(null), panel = useRef<HTMLElement>(null)
  const mounted = useRef(true), running = useRef(false), latestBase = useRef(base)
  const restoreFocus = useRef(true)
  const applyCurrent = useRef(onApplied)
  applyCurrent.current = onApplied
  latestBase.current = base
  const form = canonicalJson({ selected: [...selected].sort(), mode, closeMinute, label, changeLabel, overrides })
  const initialForm = useRef(form)
  const dirty = form !== initialForm.current || !!attempt.current || unlockPassword !== ''
  const disabled = saving || uncertain || unlocking
  const plans = mode ? [...selected].sort().map(d => planHoursDay(snapshot, station, base, d,
    { mode, closeMinute, label: changeLabel ? label : undefined }, activeReviews, overrides[d])) : []
  const previews = plans.map(p => previewHoursPlan(p, station))
  const invalid = previews.some(p => p === null)
  const removed = new Set(plans.flatMap((p, i) => p.base.filter(s => !previews[i]?.some(next => next.id === s.id)).map(s => s.id)))
  const removedAssignments = assignments.filter(a => removed.has(a.slotId))
  const single = plans.length === 1 ? plans[0] : null
  const customFinishes = !!single && mode === 'early' && canonicalJson(single.decisions) !== canonicalJson(suggestedHoursDecisions(single.base, single.data))
  const resetCleanup = plans.filter(p => p.data.mode === 'early' && p.before?.data.mode === 'early'
    && p.data.closeMinute !== p.before.data.closeMinute && p.reviewBefore
    && canonicalJson(p.reviewBefore.data.decisions) !== canonicalJson(suggestedHoursDecisions(p.base, p.before.data))).length
  const flags = useRef({ dirty, disabled, onClose })
  flags.current = { dirty, disabled, onClose }
  const [position, setPosition] = useState({ top: 8, left: 8, maxHeight: 'calc(100dvh - 16px)', width: 'min(380px,calc(100vw - 16px))' })

  useEffect(() => { onDirty(dirty || disabled); onBusy(disabled) }, [dirty, disabled, onDirty, onBusy])
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; onDirty(false); onBusy(false) }
  }, [onDirty, onBusy])
  useLayoutEffect(() => {
    if(!active)return
    const trigger = anchor?.isConnected ? anchor : document.getElementById('set-week-hours')
    trigger?.setAttribute('aria-expanded', 'true'); trigger?.setAttribute('aria-controls', 'restaurant-hours-editor')
    panel.current?.querySelector<HTMLElement>('input:not(:disabled),button:not(:disabled)')?.focus({ preventScroll: true })
    function place() {
      const element = panel.current
      if (!element) return
      const viewport = window.visualViewport
      const width = viewport?.width ?? innerWidth, height = viewport?.height ?? innerHeight
      const x = viewport?.offsetLeft ?? 0, y = viewport?.offsetTop ?? 0
      const rect = trigger?.getBoundingClientRect()
      const panelHeight = Math.min(element.scrollHeight, height - 16)
      const left = Math.max(x + 8, Math.min(rect?.left ?? x + 8, x + width - element.offsetWidth - 8))
      const below = rect ? rect.bottom + 6 : y + 8
      const top = below + panelHeight <= y + height - 8 ? Math.max(y + 8, below)
        : Math.max(y + 8, Math.min((rect?.top ?? y + 8) - panelHeight - 6, y + height - panelHeight - 8))
      const panelWidth = `${Math.max(0, Math.min(380, width - 16))}px`
      setPosition(old => old.top === top && old.left === left && old.maxHeight === `${height - 16}px` && old.width === panelWidth
        ? old : { top, left, maxHeight: `${height - 16}px`, width: panelWidth })
    }
    let frame = 0
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(place) }
    const observer = new ResizeObserver(schedule)
    if (panel.current) observer.observe(panel.current)
    const dismiss = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node) && !trigger?.contains(event.target as Node)
        && !flags.current.dirty && !flags.current.disabled) { restoreFocus.current = false; flags.current.onClose() }
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !flags.current.disabled) { event.preventDefault(); flags.current.onClose() }
    }
    place(); window.addEventListener('resize', schedule); window.addEventListener('scroll', schedule, true)
    window.visualViewport?.addEventListener('resize', schedule); window.visualViewport?.addEventListener('scroll', schedule)
    document.addEventListener('pointerdown', dismiss); document.addEventListener('keydown', escape)
    return () => {
      observer.disconnect(); cancelAnimationFrame(frame)
      window.removeEventListener('resize', schedule); window.removeEventListener('scroll', schedule, true)
      window.visualViewport?.removeEventListener('resize', schedule); window.visualViewport?.removeEventListener('scroll', schedule)
      document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape)
      trigger?.setAttribute('aria-expanded', 'false'); trigger?.removeAttribute('aria-controls')
      if (restoreFocus.current) requestAnimationFrame(() => { if (trigger?.isConnected) trigger.focus({ preventScroll: true }) })
    }
  }, [anchor,active])

  async function apply() {
    if (running.current || locked || invalid || !plans.length || (!uncertain && (source.phase !== 'ready' || !plans.some(p => p.needsApply)))) return
    running.current = true; setSaving(true); onBusy(true); setError(null)
    attempt.current ??= createHoursBatch(plans)
    const batch = attempt.current
    try {
      await saveHoursBatch(batch, station, token, () => mounted.current, () => setProgress(p => p + 1))
      if (!mounted.current) return
      const fresh = await source.reload()
      if (!mounted.current) return
      if (!fresh) throw new SpecialHoursError('unavailable')
      const results = verifyHoursBatch(batch, fresh, station, latestBase.current)
      source.acceptMany(results); onBusy(false); applyCurrent.current(results, fresh); onClose()
    } catch (problem) {
      if (!mounted.current) return
      const code = problem instanceof SpecialHoursError ? problem.code : 'unavailable'
      setError(code === 'conflict' ? 'hours.conflict' : code === 'invalid' ? 'hours.invalid'
        : code === 'unauthorized' ? 'hours.unauthorized' : code === 'unconfigured' ? 'hours.unconfigured' : 'hours.uncertain')
      setUncertain(true); source.uncertain()
    } finally { running.current = false; if (mounted.current) setSaving(false) }
  }
  async function reload() {
    if (running.current) return
    running.current = true; setSaving(true); onBusy(true)
    try {
      const fresh = await source.reload()
      if (fresh && mounted.current) {
        setSnapshot(fresh); attempt.current = null; setUncertain(false); setError('hours.reloaded')
      }
    } finally { running.current = false; if (mounted.current) setSaving(false) }
  }
  function chooseMode(next: SpecialHoursData['mode']) {
    setMode(next); setOverrides({}); setError(null)
  }
  async function unlock() {
    if(running.current||!unlockPassword)return
    running.current=true;setUnlocking(true);setUnlockError(null)
    try {
      const message=await onUnlock(unlockPassword)
      if(!mounted.current)return
      if(message)setUnlockError(message)
      else {
        setUnlockPassword('')
        requestAnimationFrame(()=>panel.current?.querySelector<HTMLInputElement>('input[type="radio"]:not(:disabled)')?.focus())
      }
    } catch {if(mounted.current)setUnlockError(t('hours.unlockFailed'))}
    finally {running.current=false;if(mounted.current)setUnlocking(false)}
  }
  const batch = attempt.current
  return createPortal(<section hidden={!active} inert={!active} ref={panel} id="restaurant-hours-editor" role="region" aria-labelledby="restaurant-hours-title"
    data-hours-editor lang={locale} className={css.editor} style={active?position:{...position,display:'none'}} aria-busy={saving||unlocking}>
    <h2 id="restaurant-hours-title" className={css.heading}>{t('hours.title')}</h2>
    <p className={css.date}>{multiple ? t('hours.selectedDates', { count: selected.length }) : planningDate(date!, locale)}</p>
    <p className={css.scope}>{t('hours.scope', { store: STATION_STORES[station] })}</p>
    {locked&&<form className={css.unlock} onSubmit={event=>{event.preventDefault();void unlock()}}>
      <p id="hours-unlock-help" className={css.muted}>{t('hours.locked')}</p>
      <label className={css.field}>{t('hours.password')}<input type="password" autoComplete="current-password"
        aria-describedby="hours-unlock-help" value={unlockPassword} disabled={unlocking}
        onChange={event=>{setUnlockPassword(event.target.value);setUnlockError(null)}}/></label>
      {unlockError&&<p role="alert" className={css.error}>{unlockError}</p>}
      <button type="submit" disabled={!unlockPassword||unlocking}>{t(unlocking?'hours.checkingPassword':'hours.unlock')}</button>
    </form>}
    <fieldset disabled={disabled || locked} className={css.form}>
      {multiple ? <div className={css.dates}>
        <div className={css.shortcuts}><button type="button" onClick={() => setSelected(DAYS.map(d => dateForDay(week, d)))}>{t('hours.allWeek')}</button>
          <button type="button" onClick={() => setSelected([])}>{t('hours.clearDates')}</button></div>
        {DAYS.map(day => {
          const d = dateForDay(week, day), event = snapshot.events.find(e => e.data.date === d)
          return <label key={d}><input type="checkbox" checked={selected.includes(d)} aria-label={t('hours.selectDate', { date: d })}
            onChange={e => setSelected(old => e.target.checked ? [...old, d] : old.filter(value => value !== d))}/>
            <span>{new Date(d+'T12:00:00Z').toLocaleDateString(locale==='es'?'es-US':'en-US',{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'})}<small>{event ? hoursCaption(event.data, locale) : t('hours.normal')}</small></span></label>
        })}
      </div> : <button type="button" className={css.moreDays} onClick={() => setMultiple(true)}>{t('hours.moreDays')}</button>}
      <div className={css.modes} role="radiogroup" aria-label={t('hours.title')}>{(['normal', 'closed', 'early'] as const).map(value =>
        <label key={value}><input type="radio" name="restaurant-hours-mode" value={value} checked={mode === value} onChange={() => chooseMode(value)}/>{t(`hours.${value}`)}</label>)}</div>
      {mode === 'early' && <label className={css.field}>{t('hours.closeTime')}<TimeField value={closeMinute} ariaLabel={t('hours.closeTime')}
        onChange={value => { setCloseMinute(value); setOverrides({}); setError(null) }}/></label>}
      {mode && <p className={css.effect}>{t(customFinishes ? 'hours.customFinishes' : `hours.effect.${mode}`)}
        {removedAssignments.length > 0 && <> {t('hours.removeSummary', { count: removedAssignments.length, kept: removedAssignments.filter(a => a.locked).length })}</>}</p>}
      {resetCleanup > 0 && <p className={css.effect}>{t('hours.resetCleanup', { count: resetCleanup })}</p>}
      <details className={css.options}><summary>{t('hours.options')}</summary>
        {multiple && <label className={css.check}><input type="checkbox" checked={changeLabel} onChange={e => setChangeLabel(e.target.checked)}/>{t('hours.changeLabels')}</label>}
        <label className={css.field}>{t('hours.label')}<input value={label} disabled={multiple && !changeLabel} maxLength={80}
          onChange={e => { setLabel(e.target.value); setChangeLabel(true) }}/></label>
        {multiple && <p className={css.muted}>{t('hours.bulkCleanup')}</p>}
        {single && mode === 'early' && <div className={css.preview}><h3>{t('hours.finishOptions')}</h3><p className={css.muted}>{t('hours.finishHelp')}</p>
          {single.base.filter(slot => slot.end > closeMinute).map(slot => {
            const choice = single.decisions.find(d => d.slotId === slot.id)!, assignment = assignments.find(a => a.slotId === slot.id)
            const changeEnd = (end: number | null) => setOverrides(old => ({ ...old, [single.date]: single.decisions.map(d => d.slotId === slot.id ? { ...d, end } : d) }))
            return <div className={css.row} key={slot.id}><div><strong>{slot.label}</strong><p>{employees.find(e => e.id === assignment?.employeeId)?.name ?? t('hours.unassigned')}{assignment?.locked ? ` · ${t('hours.keep')}` : ''}</p><p className={css.muted}>{t('hours.original', { time: formatTimeRange(slot) })}</p></div>
              <div>{slot.start >= closeMinute && <label><input type="checkbox" checked={choice.end !== null} onChange={e => changeEnd(e.target.checked ? slot.end : null)}/>{t('hours.cleanup')}</label>}
                {choice.end !== null ? <label>{t('hours.finish')}<TimeField value={choice.end} ariaLabel={`${t('hours.finish')} · ${slot.label}`} onChange={changeEnd}/></label> : <span>{t('hours.remove')}</span>}</div></div>
          })}</div>}
      </details>
    </fieldset>
    {batch && error && <div role="status"><p>{t('hours.batchPartial', { count: batch.filter(r => r.done).length, total: batch.length })}</p>
      <ul className={css.progress}>{batch.map(row => <li key={row.date}>{planningDate(row.date, locale)}: {t(row.done ? 'hours.confirmed' : 'hours.notConfirmed')}</li>)}</ul>
      {batch.some(row => row.event && !row.review) && <p>{t('hours.partial')}</p>}</div>}
    {error && <p role="alert" className={css.error}>{t(error)}</p>}
    {!error && source.phase === 'failed' && <p role="alert" className={css.error}>{t('hours.unavailable')}</p>}
    {invalid && <p role="alert" className={css.error}>{t('hours.invalid')}</p>}
    <p className={css.muted}>{t('hours.publishHelp')}</p>
    <div className={css.actions}>
      {(!uncertain || error !== 'hours.conflict') && <button type="button" className={css.primary}
        disabled={saving || locked || invalid || !plans.length || (!uncertain && (source.phase !== 'ready' || !plans.some(p => p.needsApply)))} onClick={() => void apply()}>
        {t(saving ? 'hours.applying' : uncertain ? 'hours.retryRemaining' : selected.length > 1 ? 'hours.applyDays' : 'hours.apply', { count: selected.length })}</button>}
      {(uncertain || error === 'hours.reloaded' || source.phase === 'failed') && <button type="button" disabled={saving} onClick={() => void reload()}>{t('hours.reload')}</button>}
      <button type="button" disabled={disabled} onClick={onClose}>{t('hours.cancel')}</button>
    </div>
  </section>, document.body)
}
