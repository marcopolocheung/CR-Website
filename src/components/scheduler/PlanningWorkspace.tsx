'use client'

import { useEffect, useRef, useState, type CSSProperties, type DragEvent } from 'react'
import { DAYS, PERIODS, dateForDay, formatRoleLabel, formatTimeRange, getEmployeeAvailability } from '@/lib/scheduler'
import { translate } from '@/lib/internal-tools/i18n'
import type { Locale } from '@/lib/internal-tools/contracts'
import { exclusionKey, type Placement } from '@/lib/scheduler/repair'
import type { ScheduleWorkspaceProps } from './ScheduleWorkspace'
import type { AdjustmentReport } from './useDraftAdjustment'
import { MonthStrip } from './SchedulePanels'
import { Icon } from '@/components/internal/ui/Icon'
import { scheduleVariants, type ScheduleVariant } from './helpers'
import { planningDate } from './planning-format'
import { employeeColorsFor } from './employee-colors'
import RoleBadge from './RoleBadge'
import { DayHoursControl } from './SpecialHours'
import css from './planning.module.css'

function LockIcon({ locked }: { locked: boolean }) {
  return <svg data-lock-state={locked ? 'locked' : 'unlocked'} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <rect x="6" y="11" width="12" height="10" rx="1" /><path d={locked ? 'M7 11V8a5 5 0 0 1 10 0v3' : 'M7 11V8a5 5 0 0 1 9.6-2'} />
  </svg>
}
function PeriodIcon({ period }: { period: 'AM' | 'PM' }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {period === 'AM' ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5" /></> : <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" />}
  </svg>
}

export default function PlanningWorkspace({ data: p, locale, auto, onAuto, busy, disabled, report, error, onPlace, exclusions, onRemove, onAllow, onRequest, onEmployee, onAdjust }: {
  data: ScheduleWorkspaceProps; locale: Locale; auto: boolean; onAuto: (value: boolean) => void; busy: boolean; disabled: boolean
  report: AdjustmentReport | null; error: string | null; onPlace: (placement: Placement) => void
  exclusions: readonly string[]; onRemove: (slotId: string) => void; onAllow: (key: string) => void
  onRequest: (employeeId: string, date: string) => void; onEmployee: (employeeId: string) => void; onAdjust: () => void
}) {
  const t = (key: string, params?: Record<string, string | number>) => translate(locale, key, params)
  const colorRegistry = useRef(new Map<string, string>())
  colorRegistry.current = employeeColorsFor(p.allEmployees.map(employee => employee.id), colorRegistry.current)
  const personStyle = (id: string): CSSProperties => ({ '--employee-color': colorRegistry.current.get(id) ?? '#525252' } as CSSProperties)
  const [selected, setSelected] = useState<string | null>(null)
  const [personId, setPersonId] = useState<string | null>(null)
  const [menu, setMenu] = useState<string | null>(null)
  const [moving, setMoving] = useState<{ employeeId: string; fromSlotId?: string } | null>(null)
  const [query, setQuery] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const drag = useRef<typeof moving>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const reportRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  useEffect(() => { setSelected(null); setPersonId(null); setMenu(null); setMoving(null); setSelectedDate(''); drag.current = null }, [p.weekStart])
  useEffect(() => { if (busy) { setMenu(null); setMoving(null); drag.current = null } }, [busy])
  useEffect(() => {
    if (!menu) return
    function dismiss(event: PointerEvent) { if (!menuRef.current?.contains(event.target as Node)) setMenu(null) }
    function escape(event: KeyboardEvent) { if (event.key === 'Escape') { setMenu(null); document.getElementById(`planning-person-${menu}`)?.focus() } }
    document.addEventListener('pointerdown', dismiss); document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape) }
  }, [menu])
  if (!p.weekStart) return <p aria-live="polite">{t('planning.loading')}</p>
  const slotsById = new Map(p.slots.map(s => [s.id, s]))
  const name = (id?: string) => p.allEmployees.find(e => e.id === id)?.name ?? t('planning.open')
  const slotLabel = (id: string) => { const s = slotsById.get(id); return s ? `${planningDate(dateForDay(p.weekStart, s.day), locale)} ${s.period} ${s.label}` : t('planning.previousPosition') }
  const slot = slotsById.get(selected ?? '')
  const assignment = p.assignments.find(a => a.slotId === selected)
  const person = p.employees.find(e => e.id === personId)
  const date = selectedDate || p.weekStart
  const day = DAYS.find(d => dateForDay(p.weekStart, d) === date) ?? DAYS[0]
  const required = p.slots.filter(s => s.required)
  const gaps = required.filter(s => !p.assignmentMap.get(s.id)?.employeeId)
  const adjusted = new Set(report?.automaticSlotIds ?? [])
  const blocked = disabled || busy || p.isGenerating
  const generating = p.isGenerating && !busy
  const generationReport = p.lastReport?.weekStart === p.weekStart ? p.lastReport : null
  const totalHours = p.stats.reduce((n, s) => n + s.hours, 0)
  const problems = p.violations.filter(v => v.code !== 'missing_assignment')
  const excludedHere = slot ? p.allEmployees.map(e => ({ id: e.id, key: exclusionKey(slot, e.id) })).filter(x => exclusions.includes(x.key)) : []
  function editPerson(id: string, date: string, triggerId?: string) {
    returnFocus.current = triggerId ? document.getElementById(triggerId) : document.activeElement as HTMLElement | null
    setMenu(null); setPersonId(id); setSelectedDate(date)
    requestAnimationFrame(() => {
      if (!panelRef.current || panelRef.current.offsetParent === null) return
      panelRef.current.focus({ preventScroll: true })
      if (window.matchMedia('(max-width: 1250px)').matches) panelRef.current.scrollIntoView({ block: 'start' })
    })
  }
  function beginMove(pick: NonNullable<typeof moving>) {
    setMoving(pick); setMenu(null)
    requestAnimationFrame(() => { boardRef.current?.focus({ preventScroll: true }); boardRef.current?.scrollIntoView({ block: 'center' }) })
  }
  function closePanel() {
    setPersonId(null); setSelected(null); setMenu(null)
    if (returnFocus.current?.isConnected) returnFocus.current.focus()
    else boardRef.current?.focus()
  }
  function place(slotId: string, pick = moving) {
    if (!pick || blocked) return
    if (pick.fromSlotId !== slotId) onPlace({ ...pick, slotId })
    setSelected(slotId); setPersonId(null); setMoving(null); setMenu(null)
  }
  function startDrag(event: DragEvent, pick: NonNullable<typeof moving>) {
    setMenu(null); drag.current = pick; event.dataTransfer.setData('text/plain', pick.employeeId); event.dataTransfer.effectAllowed = 'move'
  }
  function updateAssignment(value: string) { if (!slot) return; if (value) onPlace({ slotId: slot.id, employeeId: value }); else p.onAssign(slot.id, '') }
  function dateText(value: string) {
    const day = new Date(`${value}T12:00:00Z`).toLocaleDateString(locale === 'es' ? 'es-US' : 'en-US', { weekday: 'short', timeZone: 'UTC' }).replace('.', '').toUpperCase()
    return `${day} ${Number(value.slice(-2))}`
  }
  return <div className={css.planning} lang={locale} data-planning-workspace>
    <div className={css.toolbar}>
      <label className={css.toggle}><input type="checkbox" checked={auto} disabled={busy} onChange={e => onAuto(e.target.checked)} />{t('planning.auto')}</label>
      <span>{t('planning.autoHelp')}</span>
      <div className={css.actions}>
        <button disabled={blocked || p.ruleProblemCount > 0 || !p.activeEmployeeCount} onClick={p.onMake} className={!p.assignments.length ? css.primary : undefined}>{t(generating ? 'planning.generating' : 'planning.make')}</button>
        <button disabled={blocked || p.ruleProblemCount > 0} onClick={onAdjust}>{t('planning.adjust')}</button>
        <button disabled={busy || !p.historyLength} onClick={p.onUndo}>{t('planning.undo')}</button>
        <button disabled={busy || p.isGenerating || p.storeLoading || p.hoursBlocked || p.ruleProblemCount > 0 || (!p.assignments.length&&!p.canPublishEmpty)} onClick={p.onPublish} className={p.assignments.length||p.canPublishEmpty ? css.primary : undefined}>{t('planning.publish')}</button>
      </div>
    </div>
    <div id="planning-review" ref={reportRef} tabIndex={-1} className={css.feedback} aria-live="polite" aria-busy={busy || generating}>
      <strong>{t(generating ? 'planning.generating' : busy ? 'planning.busy' : report?.notice ?? (generationReport && generationReport.status !== 'failed' ? generationReport.status === 'unchanged' ? 'planning.unchanged' : 'planning.made' : 'planning.ready'))}</strong>
      <span>{t('planning.covered', { filled: required.length - gaps.length, required: required.length, kept: p.keptCount })}</span>
    </div>
    {error && <p role="alert" className={css.error}>{t(error)}</p>}
    {generationReport?.status === 'failed' && <p role="alert" className={css.error}>{t('planning.generationFailed')}</p>}
    {p.layoutMismatch && <div role="alert" className={css.warning}><p>{t('planning.layoutMismatch')}</p><button onClick={p.onReviewRules}>{t('planning.reviewRules')}</button></div>}
    {!!problems.length && <ul role="alert" className={css.error}>{problems.map((problem, i) => <li key={i}>
      <button onClick={() => { if (problem.slotId) { setSelected(problem.slotId); setPersonId(null) } else if (problem.employeeId) editPerson(problem.employeeId, date) }}>
        {problem.employeeId ? `${name(problem.employeeId)} · ` : ''}{problem.slotId ? `${slotLabel(problem.slotId)}: ` : ''}{t(`planning.problem.${problem.code}`)}
      </button>
    </li>)}</ul>}
    {report?.limited && <p className={css.warning}>{t('planning.limit')}</p>}
    {!!report?.changes.length && <details className={css.changes}><summary>{t('planning.reviewChanges', { count: report.changes.length })}</summary>{report.changes.map(c => <p key={c.slotId}>{slotLabel(c.slotId)}: {name(c.before)} → {name(c.after)}{c.releasedKeep ? ` · ${t('planning.released')}` : c.before === c.after ? ` · ${t('planning.changesKept')}` : ''}</p>)}</details>}
    {moving && <div role="status" className={css.moving}>{t('planning.moving', { name: name(moving.employeeId) })}<button onClick={() => setMoving(null)}>{t('planning.cancel')}</button></div>}
    <div className={css.workspace}>
      <section className={css.paper} aria-label={t('planning.week')}>
        <div className={css.paperHead}><h2>{t('planning.week')}</h2><span>{t('planning.hoursTotal', { hours: Math.round(totalHours * 10) / 10 })}</span></div>
        <div ref={boardRef} className={css.boardScroll} tabIndex={0} aria-label={t('planning.scroll')}><div className={css.board}>
          {DAYS.map(day => <section key={day} className={css.day}><h3>{dateText(dateForDay(p.weekStart, day))}</h3>
            <DayHoursControl date={dateForDay(p.weekStart,day)} locale={locale} event={p.hoursDays.find(e=>e.date===dateForDay(p.weekStart,day))}
              pending={p.hoursPending.includes(dateForDay(p.weekStart,day))} disabled={p.hoursDisabled} onEdit={anchor=>p.onEditHours(dateForDay(p.weekStart,day),anchor)}/>
            {PERIODS.map(period => <div key={period} className={css.period}>
              {p.slots.filter(s => s.day === day && s.period === period).map(s => {
                const a = p.assignmentMap.get(s.id)
                return <div key={s.id} data-planning-slot={s.id} data-employee-id={a?.employeeId ?? ''} data-kept={!!a?.locked} className={`${css.slot} ${selected === s.id ? css.selected : ''} ${adjusted.has(s.id) ? css.changed : ''} ${!a?.employeeId ? css.open : ''} ${!s.required ? css.optional : ''}`}
                  onDragOver={e => { if (!blocked) { e.preventDefault(); e.dataTransfer.dropEffect = 'move' } }} onDrop={e => { e.preventDefault(); place(s.id, drag.current); drag.current = null }}>
                  <div className={css.slotLabel}><span className={css.shiftTag}><PeriodIcon period={period} />{period}</span><RoleBadge role={s.role} label={s.label} /></div>
                  <p className={css.hint}>{formatTimeRange(s)}</p>
                  <div className={css.personControl} ref={menu === s.id ? menuRef : undefined}>
                    <button id={`planning-person-${s.id}`} className={css.person} style={a?.employeeId ? personStyle(a.employeeId) : undefined} disabled={blocked} draggable={!!a?.employeeId && !blocked}
                      onDragStart={e => { if (a?.employeeId) startDrag(e, { employeeId: a.employeeId, fromSlotId: s.id }) }} onDragEnd={() => { drag.current = null }}
                      aria-label={`${slotLabel(s.id)}: ${name(a?.employeeId)}${a?.locked ? `, ${t('planning.keep')}` : ''}`} aria-expanded={a?.employeeId ? menu === s.id : undefined} aria-controls={menu === s.id ? `planning-menu-${s.id}` : undefined}
                      onClick={() => { if (moving) place(s.id); else { setSelected(s.id); setPersonId(null); setMenu(current => a?.employeeId && current !== s.id ? s.id : null) } }}>{name(a?.employeeId)}</button>
                    {a?.employeeId && menu === s.id && <div id={`planning-menu-${s.id}`} className={css.personMenu} role="group" aria-label={t('planning.actions', { name: name(a.employeeId) })}><button onClick={() => editPerson(a.employeeId, s.date!, `planning-person-${s.id}`)}>{t('planning.editPerson')}</button>
                      <button onClick={() => { setMenu(null); setSelected(s.id); onRemove(s.id) }}>{t('planning.remove')}</button></div>}
                  </div>
                  <div className={css.slotFoot}>{a?.employeeId ? <button type="button" className={css.keep}
                    aria-pressed={!!a.locked} aria-label={`${t('planning.lockPlacement')}: ${name(a.employeeId)} · ${slotLabel(s.id)}`}
                    title={t(a.locked ? 'planning.unlockPlacement' : 'planning.lockPlacement')} disabled={busy || p.isGenerating || p.storeLoading}
                    onClick={() => p.onLock(s.id, !a.locked)}><LockIcon locked={!!a.locked} /></button>
                    : <span>{s.required ? t('planning.needs') : t('planning.optional')}</span>}
                    {a?.employeeId && (!s.required || adjusted.has(s.id)) && <span>{!s.required ? t('planning.optional') : t('planning.adjusted')}</span>}
                  </div>
                </div>
              })}
            </div>)}
          </section>)}
        </div></div>
      </section>
      <aside ref={panelRef} tabIndex={-1} className={css.panel} aria-label={t('planning.editPerson')}>
        <button className={css.close} onClick={closePanel}>{t('planning.close')}</button>
        {person ? <><h2 style={personStyle(person.id)} className={css.personHeading}>{person.name}</h2>
          <p><Icon name="store" size={16} /> {t('planning.roles')}: {person.roles.map(formatRoleLabel).join(' · ')}</p>
          <label>{t('planning.day')}<input type="date" value={date} min={p.weekStart} max={dateForDay(p.weekStart, 'Saturday')} onChange={e => { if (e.target.value) setSelectedDate(e.target.value) }} /></label>
          <p>{getEmployeeAvailability(person, day, date).map(r => formatTimeRange(r)).join(', ') || t('planning.unavailable')}</p>
          <button disabled={busy} onClick={() => onRequest(person.id, date)}>{t('planning.request')}</button><p className={css.hint}>{t('planning.requestHelp')}</p>
          <button onClick={() => onEmployee(person.id)}>{t('planning.editRules')}</button>
        </> : slot ? <><h2>{slotLabel(slot.id)}</h2><RoleBadge role={slot.role} label={slot.label} /><p><Icon name="clock" size={16} /> {formatTimeRange(slot)}</p>
          <label>{t('planning.assign')}<select aria-label={t('planning.assign')} value={assignment?.employeeId ?? ''} disabled={blocked} onChange={e => updateAssignment(e.target.value)}><option value="">{t('planning.open')}</option>{p.allEmployees.filter(e => e.active).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
          {assignment?.employeeId && <><label className={css.toggle}><input type="checkbox" disabled={busy} checked={!!assignment.locked} onChange={e => p.onLock(slot.id, e.target.checked)} />{t('planning.keepPlacement')}</label>
            <button disabled={blocked} onClick={() => beginMove({ employeeId: assignment.employeeId, fromSlotId: slot.id })}>{t('planning.move', { name: name(assignment.employeeId) })}</button>
            <button disabled={blocked} onClick={() => onRemove(slot.id)}>{t('planning.remove')}</button><p className={css.hint}>{t('planning.removeHelp')}</p>
          </>}
          {!!excludedHere.length && <section aria-label={t('planning.excluded')}><h3>{t('planning.excluded')}</h3>{excludedHere.map(x => <p key={x.key}>{name(x.id)} <button disabled={blocked} onClick={() => onAllow(x.key)}>{t('planning.allow')}</button></p>)}</section>}
        </> : <><h2>{t('planning.choose')}</h2><p>{t('planning.help')}</p></>}
        {!!gaps.length && <section className={css.gaps}><h3>{t('planning.gaps', { count: gaps.length })}</h3>{gaps.map(s => <button key={s.id} onClick={() => { setSelected(s.id); setPersonId(null); setMenu(null) }}>{slotLabel(s.id)} →</button>)}</section>}
      </aside>
    </div>
    <section id="planning-team" tabIndex={-1} className={css.team}><div className={css.teamHeading}><h2>{t('planning.team')}</h2><p>{t('planning.teamHelp')}</p><label>{t('planning.search')}<input type="search" value={query} onChange={e => setQuery(e.target.value)} /></label></div>
      <div className={css.teamGrid}>{p.allEmployees.filter(e => e.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(e => {
        const stat = p.stats.find(s => s.employeeId === e.id)
        return <div key={e.id} className={css.employee} style={personStyle(e.id)} draggable={e.active && !blocked} onDragStart={event => startDrag(event, { employeeId: e.id })} onDragEnd={() => { drag.current = null }}>
          <button id={`planning-team-person-${e.id}`} className={css.employeeName} onClick={() => editPerson(e.id, date, `planning-team-person-${e.id}`)}>{e.name}</button>
          <p className={css.roleParameter}><Icon name="store" size={16} /> {t('planning.roles')}: {e.roles.map(formatRoleLabel).join(' · ')}</p>
          <p><Icon name="clock" size={16} /> {t('planning.hours')}: {e.maxHoursPerWeek ? t('planning.atLimit', { hours: Math.round((stat?.hours ?? 0) * 10) / 10, limit: e.maxHoursPerWeek }) : `${Math.round((stat?.hours ?? 0) * 10) / 10}h`}</p>
          <p className={css.ruleParameter}><Icon name="layers" size={16} /> {e.allowDoubles ? t('planning.doubles') : t('planning.noDoubles')}</p>
          <p className={css.dayParameter}><Icon name="calendar" size={16} /> {planningDate(date, locale)}: {getEmployeeAvailability(p.employees.find(person => person.id === e.id) ?? e, day, date).map(range => formatTimeRange(range)).join(', ') || t('planning.unavailable')}</p>
          <button disabled={blocked || !e.active} onClick={() => beginMove({ employeeId: e.id })}>{t('planning.place', { name: e.name })}</button>
        </div>
      })}</div>
    </section>
    <details className={css.tools}><summary>{t('planning.more')}</summary><fieldset disabled={busy || p.isGenerating}>
      <label>{t('planning.strategy')}<select aria-label={t('planning.strategy')} value={p.selectedVariant} onChange={e => p.onVariantChange(e.target.value as ScheduleVariant)}>{scheduleVariants.map(variant => <option key={variant.id} value={variant.id}>{t(`planning.goal.${variant.id}`)}</option>)}</select></label>
      <button onClick={p.onPrint} disabled={!p.schedulePassing}>{t('planning.print')}</button><button onClick={p.onCopyPrior} disabled={p.storeLoading}>{t('planning.copy')}</button>
      <button onClick={p.onAskClearWeek}>{t('planning.clear')}</button>
      <button onClick={p.onRestoreEverything} disabled={!p.changes.length}>{t('planning.restore')}</button>
      {p.canAddEmployee && <button onClick={p.onAskReset}>{t('planning.reset')}</button>}
      {p.canAddEmployee && p.confirmingReset && <div role="group" aria-label={t('planning.resetConfirm')}><p>{t('planning.resetConfirm')}</p><button onClick={p.onReset}>{t('planning.reset')}</button><button onClick={p.onCancelReset}>{t('planning.cancel')}</button></div>}
      {p.confirmingClearWeek && <div role="group" aria-label={t('planning.clearConfirm')}><p>{t('planning.clearConfirm')}</p><button onClick={p.onClearWeek}>{t('planning.clear')}</button><button onClick={p.onCancelClearWeek}>{t('planning.cancel')}</button></div>}
      <details><summary>{t('planning.month')}</summary><MonthStrip monthKey={p.monthKey} weekStart={p.weekStart} monthWeeks={p.monthWeeks} weeks={p.weeks} weekStatus={p.weekStatus} onSelectWeek={p.onSelectWeek} onSelectMonth={p.onSelectMonth} onToggleWeek={p.onToggleWeek} liveWeeks={p.liveMonthWeeks} currentState={p.publishState} editedWeeks={p.otherWeeksWithEdits} /></details>
      <details><summary>{t('planning.messages')}</summary>{p.diagnostics.map((message, i) => <p key={i}>{message}</p>)}</details>
    </fieldset></details>
  </div>
}
