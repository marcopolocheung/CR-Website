'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { getEmployeeAvailability } from '@/lib/scheduler/validator'
import { weekDays as DAYS, clean, dates, editAvailability, place, repair, sample, slots, violations, type BoardState } from './model'
import css from './prototype.module.css'
import { Icon, type IconName } from '@/components/internal/ui/Icon'

// Stable identity colors: placements retain their employee color after moves and repairs.
const employeeColors: Record<string, string> = Object.fromEntries([
  '#2457c5', '#a52c69', '#257348', '#7140b5', '#ac4924',
  '#007889', '#8b6415', '#b03544', '#4f5a99', '#657529',
].map((color, i) => [`sample-${i}`, color]))
const employeeStyle = (id?: string): CSSProperties => ({ '--employee-color': employeeColors[id ?? ''] ?? '#525252' } as CSSProperties)

type ParameterKind = 'day' | 'hours' | 'role' | 'rule'
const parameterIcons: Record<ParameterKind, IconName> = { day: 'calendar', hours: 'clock', role: 'store', rule: 'layers' }
// Prototype-only sun/moon specimens, using the shared 24px outline grammar.
function PeriodIcon({ period }: { period: 'AM' | 'PM' }) {
  return <svg data-period={period} width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {period === 'AM' ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5" /></> : <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" />}
  </svg>
}
function Parameter({ kind, caption, children }: { kind: ParameterKind; caption?: string; children: ReactNode }) {
  return <span className={css.parameter} data-parameter={kind}><span className={css.parameterIcon}><Icon name={parameterIcons[kind]} size={17} /></span><span>{caption && <span className={css.parameterCaption}>{caption}</span>}{children}</span></span>
}
const rolesText = (roles: string[]) => roles.map(role => role[0].toUpperCase() + role.slice(1)).join(' · ')

type Pick = { employeeId: string; fromSlotId?: string }
type Change = { slotId: string; before: string; after: string }
const label = (id: string) => { const s = slots.find(s => s.id === id)!; return `${s.day.slice(0, 3)} ${s.period} ${s.label}` }
const time = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`
const minute = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3))
export default function Prototype() {
  const [state, setState] = useState<BoardState>(sample)
  const [auto, setAuto] = useState(true)
  const [navIndex, setNavIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [history, setHistory] = useState<BoardState[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [menuSlot, setMenuSlot] = useState<string | null>(null)
  useEffect(() => {
    if (!menuSlot) return
    function dismiss(event: PointerEvent) {
      if (!(event.target instanceof Element) || !event.target.closest('[data-person-actions]')) setMenuSlot(null)
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuSlot(null)
        document.querySelector<HTMLButtonElement>(`[data-slot="${menuSlot}"] [data-person-trigger]`)?.focus()
      }
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape) }
  }, [menuSlot])
  const [employeeId, setEmployeeId] = useState<string | null>(null)
  const [pick, setPick] = useState<Pick | null>(null)
  const [date, setDate] = useState(dates[0])
  const [recurring, setRecurring] = useState(false)
  const [allDay, setAllDay] = useState(true)
  const [start, setStart] = useState('09:30')
  const [end, setEnd] = useState('23:00')
  const [notice, setNotice] = useState('Ready to plan. Select a person or move an assignment.')
  const [error, setError] = useState('')
  const [changes, setChanges] = useState<Change[]>([])
  const [limited, setLimited] = useState(false)
  const drag = useRef<Pick | null>(null)
  const issues = violations(state)
  const gaps = slots.filter(s => !state.assignments.some(a => a.slotId === s.id))
  const employee = state.employees.find(e => e.id === employeeId)
  const slot = slots.find(s => s.id === selected)
  const assigned = state.assignments.find(a => a.slotId === selected)
  const name = (id?: string) => state.employees.find(e => e.id === id)?.name ?? 'Open'
  function editor(id: string, selectedDate = date) {
    setMenuSlot(null); setEmployeeId(id); setDate(selectedDate); setRecurring(false); setAllDay(true); setError('')
  }
  async function commit(next: BoardState, message: string, adjust = auto, keepPick = false) {
    if (busyRef.current) return
    setMenuSlot(null); busyRef.current = true; setBusy(true); setError(''); setLimited(false)
    const before = state
    try {
      const result = adjust ? await repair(next) : { state: next, limited: false }
      const diff = slots.flatMap(s => {
        const old = next.assignments.find(a => a.slotId === s.id)?.employeeId
        const updated = result.state.assignments.find(a => a.slotId === s.id)?.employeeId
        return old === updated ? [] : [{ slotId: s.id, before: name(old), after: name(updated) }]
      })
      setHistory(h => [...h.slice(-29), before]); setState(result.state); setChanges(diff); setLimited(result.limited)
      const open = slots.length - result.state.assignments.length
      setNotice(`${message}${adjust ? ` · ${diff.length} automatic ${diff.length === 1 ? 'change' : 'changes'}` : auto ? '' : ' · Auto-adjust is off'}${open ? ` · ${open} open ${open === 1 ? 'slot' : 'slots'}` : ''}.`)
      if (!keepPick) setPick(null)
    } catch { setError('Adjustment failed. Your previous board is preserved; try again.') }
    finally { busyRef.current = false; setBusy(false) }
  }
  function drop(slotId: string, choice = pick) {
    if (!choice || busyRef.current) return
    if (choice.fromSlotId === slotId) { setPick(null); return }
    try { void commit(place(state, slotId, choice.employeeId, choice.fromSlotId), `${name(choice.employeeId)} placed and kept`); setSelected(slotId); setEmployeeId(null) }
    catch (e) { setError((e as Error).message) }
  }
  function undo() {
    const prior = history.at(-1)
    if (!prior || busyRef.current) return
    setMenuSlot(null); setState(prior); setHistory(h => h.slice(0, -1)); setChanges([]); setLimited(false); setPick(null); setNotice('Undone · assignments, Keeps, and availability restored.'); setError('')
  }
  function availability(event: React.FormEvent) {
    event.preventDefault()
    if (!employee) return
    if (!allDay && minute(start) >= minute(end)) { setError('Available until must be after available from.'); return }
    void commit(editAvailability(state, employee.id, date, allDay ? [] : [{ start: minute(start), end: minute(end) }], recurring), `${employee.name} ${allDay ? 'unavailable' : 'availability updated'} · ${recurring ? `every ${DAYS[dates.indexOf(date)]}` : date}`)
  }
  function beginDrag(event: React.DragEvent, choice: Pick) {
    setMenuSlot(null); drag.current = choice; event.dataTransfer.setData('text/plain', JSON.stringify(choice)); event.dataTransfer.effectAllowed = 'move'
  }
  const hours = (id: string) => state.assignments.filter(a => a.employeeId === id).reduce((n, a) => { const s = slots.find(s => s.id === a.slotId)!; return n + (s.end - s.start) / 60 }, 0)
  return <div className={css.app}>
    <header className={css.header}><div className={css.brand}>CHINA ROSE <span>MANAGER WORKSPACE</span></div><span className={css.prototype}>Prototype · Sample data</span></header>
    <div className={css.shell}>
      <nav className={css.nav} aria-label="Prototype navigation" style={{ '--nav-index': navIndex } as React.CSSProperties} onMouseLeave={() => setNavIndex(0)} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setNavIndex(0) }}><span className={css.navHighlight} aria-hidden="true" />{[['#planning', 'Schedule'], ['#team', 'Team'], ['#review', 'Review']].map(([href, title], i) => <a key={href} href={href} onMouseEnter={() => setNavIndex(i)} onFocus={() => setNavIndex(i)}>{title}</a>)}<div className={css.navFoot}>Sample station<br />Draft on this page</div></nav>
      <main className={css.main} id="planning">
        <div className={css.title}><div><div className={css.eyebrow}>WEEKLY PLANNING / SAMPLE STATION</div><h1>Schedule</h1><p>November 16–22, 2026 <span className={css.draft}>Draft</span></p></div><button disabled={busy} onClick={() => { setMenuSlot(null); setState(sample()); setHistory([]); setChanges([]); setLimited(false); setPick(null); setSelected(null); setEmployeeId(null); setAuto(true); setError(''); setNotice('Sample restored.'); }}>Reset sample</button></div>
        <div className={css.toolbar}><label className={css.toggle}><input type="checkbox" checked={auto} disabled={busy} onChange={e => setAuto(e.target.checked)} />Auto-adjust</label><span>Keep your placements. Adjust the rest.</span><div className={css.actions}><button disabled={busy} onClick={() => void commit(clean(state), 'Schedule adjusted', true)}>Adjust now</button><button disabled={busy || !history.length} onClick={undo}>Undo{history.length ? ` (${history.length})` : ''}</button></div></div>
        <div id="review" className={css.feedback} aria-live="polite" aria-busy={busy}><strong>{busy ? 'Adjusting the week…' : notice}</strong><span>{state.assignments.length}/{slots.length} covered · {state.assignments.filter(a => a.locked).length} kept</span></div>
        {error && <div role="alert" className={css.error}>{error}</div>}
        {limited && <p className={css.limit}>Search limit reached. Showing the best valid result found; a better repair may exist.</p>}
        {changes.length > 0 && <details className={css.changes}><summary>Review {changes.length} automatic {changes.length === 1 ? 'change' : 'changes'}</summary>{changes.map(c => <p key={c.slotId}>{label(c.slotId)}: {c.before} → {c.after}</p>)}</details>}
        {pick && <div className={css.moving} role="status">Placing {name(pick.employeeId)} — choose a destination.<button disabled={busy} onClick={() => setPick(null)}>Cancel move</button></div>}
        <div className={css.workspace}>
          <section className={css.paper} aria-label="Weekly schedule">
            <div className={css.paperHead}><h2>The week</h2><div className={css.periodLegend}><span className={css.shiftTag}><PeriodIcon period="AM" />AM 9:30–16:00</span><span className={css.shiftTag}><PeriodIcon period="PM" />PM 16:00–23:00</span></div></div>
            <div className={css.boardScroll} tabIndex={0} aria-label="Scroll weekly schedule"><div className={css.board}>
              {DAYS.map((day, i) => <section key={day} className={css.day}><h3><span>{day.slice(0, 3).toUpperCase()} {16 + i}</span></h3>{slots.filter(s => s.day === day).map(s => {
                const a = state.assignments.find(a => a.slotId === s.id)
                const changed = changes.some(c => c.slotId === s.id)
                return <div key={s.id} data-slot={s.id} className={`${css.slot} ${selected === s.id ? css.selected : ''} ${changed ? css.changed : ''} ${!a ? css.open : ''}`} onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }} onDrop={e => { e.preventDefault(); drop(s.id, drag.current); drag.current = null }}>
                  <div className={css.slotLabel}><span className={css.shiftTag}><PeriodIcon period={s.period} />{s.period}</span><span className={css.roleTag}><Icon name={s.role === 'cashier' ? 'cash' : 'store'} size={14} />{s.label}</span></div>
                  <div className={css.personControl} data-person-actions><button data-person-trigger aria-expanded={a ? menuSlot === s.id : undefined} aria-controls={menuSlot === s.id ? `person-actions-${s.id}` : undefined} className={css.person} style={employeeStyle(a?.employeeId)} disabled={busy} draggable={!!a && !busy} onDragStart={e => { if (a) beginDrag(e, { employeeId: a.employeeId, fromSlotId: s.id }) }} onDragEnd={() => { drag.current = null }} onClick={() => { if (pick) drop(s.id); else { setSelected(s.id); setEmployeeId(null); setMenuSlot(current => a && current !== s.id ? s.id : null) } }} aria-label={`${label(s.id)}: ${name(a?.employeeId)}${a?.locked ? ', Keep' : ''}`}>{name(a?.employeeId)}</button>
                    {a && menuSlot === s.id && <div id={`person-actions-${s.id}`} className={css.personMenu} role="group" aria-label={`${name(a.employeeId)} actions`}><button disabled={busy} aria-label={`Edit ${name(a.employeeId)} availability on ${s.date}`} onClick={() => editor(a.employeeId, s.date)}>Edit person</button></div>}
                  </div>
                  <div className={css.slotFoot}>{a?.locked ? <span className={css.keep}><Icon name="lock" size={12} />Keep</span> : <span>{!a ? 'Needs coverage' : changed ? 'Adjusted' : ' '}</span>}</div>
                </div>
              })}</section>)}
            </div></div>
            <div className={css.legend}><span>Keep = your placement stays fixed</span><span className={css.changedKey}>Teal edge = automatically changed</span></div>
          </section>
          <aside className={`${css.panel} ${employee ? css.employeePanel : ''}`} style={employeeStyle(employee?.id)} aria-label={employee ? 'Employee editor' : slot ? 'Shift details' : 'Scheduling help'}>
            {employee ? <><div className={css.panelHead}><h2>{employee.name}</h2><button disabled={busy} onClick={() => setEmployeeId(null)}>Close</button></div><div className={css.parameters}><Parameter kind="role" caption="Roles">{rolesText(employee.roles)}</Parameter><Parameter kind="hours" caption="Weekly hours">{hours(employee.id)}h / {employee.maxHoursPerWeek}h</Parameter></div>
              <form onSubmit={availability}><label><span className={css.fieldLabel}><Icon name="calendar" size={17} />Date</span><select aria-label="Date" disabled={busy} value={date} onChange={e => setDate(e.target.value)}>{dates.map((d, i) => <option key={d} value={d}>{DAYS[i]} · Nov {16 + i}</option>)}</select></label>
                <div className={css.current}><Icon name="calendar" size={17} />Current availability: {getEmployeeAvailability(employee, DAYS[dates.indexOf(date)], date).map(r => `${time(r.start)}–${time(r.end)}`).join(', ') || 'Unavailable'}</div>
                <label className={css.check}><input type="checkbox" checked={allDay} disabled={busy} onChange={e => setAllDay(e.target.checked)} />Unavailable all day / called out</label>
                {!allDay && <div className={css.times}><label>Available from<input type="time" required disabled={busy} value={start} onChange={e => setStart(e.target.value)} /></label><label>Available until<input type="time" required disabled={busy} value={end} onChange={e => setEnd(e.target.value)} /></label></div>}
                <label>Applies to<select aria-label="Applies to" disabled={busy} value={recurring ? 'recurring' : 'date'} onChange={e => setRecurring(e.target.value === 'recurring')}><option value="date">This date only</option><option value="recurring">Every {DAYS[dates.indexOf(date)]}</option></select></label>
                <p className={css.hint}>{allDay ? 'Affected assignments and their Keeps will be removed.' : 'Only shifts fully inside this window can be assigned.'} {auto ? 'The rest of the week will adjust.' : 'Gaps will stay open until you adjust.'}</p>
                <button className={css.primary} disabled={busy} type="submit">{allDay ? 'Save callout' : 'Save availability'}</button>
              </form></> : slot ? <><h2>{label(slot.id)}</h2><div className={css.parameters}><Parameter kind="role" caption="Position">{slot.label}</Parameter><Parameter kind="hours" caption="Shift hours">{time(slot.start)}–{time(slot.end)}</Parameter></div><label>Assign employee<select aria-label="Assign employee" value={assigned?.employeeId ?? ''} disabled={busy} onChange={e => { if (e.target.value) drop(slot.id, { employeeId: e.target.value }); else void commit({ ...state, assignments: state.assignments.filter(a => a.slotId !== slot.id) }, 'Assignment removed', false) }}><option value="">Open</option>{state.employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
              {assigned && <><label className={css.check}><input type="checkbox" disabled={busy} checked={!!assigned.locked} onChange={e => { const locked = e.target.checked; void commit({ ...state, assignments: state.assignments.map(a => a.slotId === slot.id ? { ...a, locked } : a) }, locked ? 'Placement kept' : 'Keep released', false) }} />Keep this placement</label><button disabled={busy} onClick={() => { setPick({ employeeId: assigned.employeeId, fromSlotId: slot.id }); setError('') }}>Move {name(assigned.employeeId)}</button><button disabled={busy} onClick={() => editor(assigned.employeeId, slot.date)}>Edit person’s availability</button></>}
              <p className={css.hint}>A placement becomes Keep. Release Keep before replacing someone in this slot.</p>
            </> : <><div className={css.eyebrow}>WORK ON THE BOARD</div><h2>Make it your week.</h2><p>Move a name into a slot. Your placement stays fixed while the rest adjusts.</p><hr /><p>Someone called out? Click their name, then <strong>Edit person</strong>.</p><p className={css.hint}>Try Jesus on Monday, then move two people and watch which placements stay kept.</p></>}
            {gaps.length > 0 && <section className={css.gaps}><h3>{gaps.length} open {gaps.length === 1 ? 'slot' : 'slots'}</h3>{gaps.map(s => <button key={s.id} disabled={busy} onClick={() => { setSelected(s.id); setEmployeeId(null); setMenuSlot(null) }}>{label(s.id)} →</button>)}</section>}
            {issues.filter(i => i.code !== 'missing_assignment').map((i, n) => <p className={css.error} key={n}>{i.message}</p>)}
          </aside>
        </div>
        <section id="team" className={css.team}><div className={css.teamHeading}><h2>Team</h2><span>Sample staff · drag a person or choose Place</span></div><div className={css.teamGrid}>{state.employees.map(e => <div className={css.employee} style={employeeStyle(e.id)} key={e.id} draggable={!busy} onDragStart={event => beginDrag(event, { employeeId: e.id })} onDragEnd={() => { drag.current = null }}><button disabled={busy} className={css.employeeName} onClick={() => editor(e.id)}>{e.name}</button><div className={css.parameters}>
          <Parameter kind="role" caption="Roles">{rolesText(e.roles)}</Parameter>
          <Parameter kind="hours" caption="Weekly hours">{hours(e.id)}h / {e.maxHoursPerWeek}h</Parameter>
          <Parameter kind="rule" caption="Shift rule">{e.allowDoubles ? 'Doubles allowed' : 'No doubles'}</Parameter>
          <Parameter kind="day" caption={DAYS[dates.indexOf(date)]}>{getEmployeeAvailability(e, DAYS[dates.indexOf(date)], date).map(r => `${time(r.start)}–${time(r.end)}`).join(', ') || 'Unavailable'}</Parameter>
        </div><button disabled={busy} onClick={() => { setPick({ employeeId: e.id }); setError('') }}>Place<span className={css.sr}> {e.name}</span></button></div>)}</div></section>
        <footer className={css.footer}>Sample data only. Changes stay on this page and reset on reload. No staff notifications or publishing.</footer>
      </main>
    </div>
  </div>
}
