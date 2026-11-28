'use client'

import { useSchedulerText } from './useSchedulerText'
import { useWorkspaceVisible } from '@/components/internal/WorkspaceVisibility'
import css from './staff-workspace.module.css'

import { useEffect, useRef, useState } from 'react'
import {
  DEFAULT_PRIORITY,
  formatUpdatedAt,
  type Employee,
  type RuleProblem,
  type ScheduleStats,
  type StaffingSlot,
  type WeeklyStaffingTemplate,
} from '@/lib/scheduler'
import {
  availabilitySummary,
  roleChipClass,
  roleLabel,
  suspensionText,
  type EmployeeDraft,
  type StaffSnapshot,
} from './helpers'
import { Button, Disclosure } from './ui'
import { EmployeeCard, EmployeeForm, shiftRolesText } from './StaffEditor'
import { TemplateEditor } from './RulesEditor'

export type StaffWorkspaceProps = {
  focusEmployeeId?: string
  employees: Employee[]
  filteredEmployees: Employee[]
  statsById: Map<string, ScheduleStats>
  roles: string[]
  readOnly: boolean
  scheduleOnly: boolean
  staffUnlocked: boolean
  activeEmployeeCount: number
  staffQuery: string
  onStaffQueryChange: (query: string) => void
  draft: EmployeeDraft
  employeePanelOpen: boolean
  gapSlot?: StaffingSlot
  weekStart: string
  canAddEmployee: boolean
  onDraftChange: (draft: EmployeeDraft) => void
  onAddEmployee: () => void
  onAddCustomRole: (role: string) => void
  onToggleEmployeePanel: () => void
  onUpdateEmployee: (employeeId: string, update: Partial<Employee>) => void
  onRemoveEmployee: (employeeId: string) => void
  rosterLoadError: string
  staffLoadError: string
  staffUpdatedAt: string | null
  rosterUpdatedAt: string | null
  rosterDirty: boolean
  staffDirty: boolean
  passwordInput: string
  onPasswordInputChange: (value: string) => void
  checkingPassword: boolean
  onUnlock: () => void
  onLock: () => void
  staffCanUndo: boolean
  savingSetup: boolean
  onUndoCrewSave: () => void
  isDefaultRoster: boolean
  onRestoreDefaultRoster: () => void
  confirmingClearStaff: boolean
  onAskClearStaff: () => void
  onClearStaff: () => void
  onCancelClearStaff: () => void
  staffSnapshots: StaffSnapshot[]
  snapshotName: string
  onSnapshotNameChange: (name: string) => void
  onSaveSnapshot: () => void
  onRestoreSnapshot: (snapshot: StaffSnapshot) => void
  onDeleteSnapshot: (id: string) => void
  setupParts: string[]
  storeLoading: boolean
  ruleProblemCount: number
  historyLength: number
  onSave: () => void
  onUndo: () => void
  onBack: () => void
  template: WeeklyStaffingTemplate
  ruleProblems: RuleProblem[]
  templateDirty: boolean
  templateLoadError: string
  templateUpdatedAt: string | null
  isDefaultTemplate: boolean
  restaurantId?: string
  onTemplateChange: (template: WeeklyStaffingTemplate) => void
  onUseDefaultTemplate: () => void
}

function staffNotes(employee: Employee, text: (value:string,params?:Record<string,string|number>)=>string) {
  const notes: string[] = []
  if (employee.newHire) notes.push(text('New hire'))
  if ((employee.maxDaysPerWeek ?? 7) !== 7) notes.push(text('Max {count} days',{count:employee.maxDaysPerWeek ?? 7}))
  if (employee.maxHoursPerWeek !== undefined) notes.push(text('Max {hours} h',{hours:employee.maxHoursPerWeek}))
  if (employee.allowDoubles) notes.push(text('Doubles allowed'))
  if ((employee.priority ?? DEFAULT_PRIORITY) !== DEFAULT_PRIORITY) notes.push(text('Priority {rank}',{rank:employee.priority ?? DEFAULT_PRIORITY}))
  if (employee.suspendedFrom) notes.push(text('Suspended {dates}',{dates:suspensionText(employee)}))
  if ((employee.shiftRoles?.length ?? 0) > 0) notes.push(text('Only {roles}',{roles:shiftRolesText(employee)}))
  return notes
}

export default function StaffWorkspace(props: StaffWorkspaceProps) {
  const text = useSchedulerText()
  const visible = useWorkspaceVisible()
  const host = useRef<HTMLDivElement>(null)
  const {
    employees,
    filteredEmployees,
    statsById,
    roles,
    readOnly,
    scheduleOnly,
    staffUnlocked,
    activeEmployeeCount,
    staffQuery,
    onStaffQueryChange,
    draft,
    employeePanelOpen,
    gapSlot,
    weekStart,
    canAddEmployee,
    onDraftChange,
    onAddEmployee,
    onAddCustomRole,
    onToggleEmployeePanel,
    onUpdateEmployee,
    onRemoveEmployee,
    rosterLoadError,
    staffLoadError,
    staffUpdatedAt,
    rosterUpdatedAt,
    rosterDirty,
    staffDirty,
    passwordInput,
    onPasswordInputChange,
    checkingPassword,
    onUnlock,
    onLock,
    staffCanUndo,
    savingSetup,
    onUndoCrewSave,
    isDefaultRoster,
    onRestoreDefaultRoster,
    confirmingClearStaff,
    onAskClearStaff,
    onClearStaff,
    onCancelClearStaff,
    staffSnapshots,
    snapshotName,
    onSnapshotNameChange,
    onSaveSnapshot,
    onRestoreSnapshot,
    onDeleteSnapshot,
    setupParts,
    storeLoading,
    ruleProblemCount,
    historyLength,
    onSave,
    onUndo,
    onBack,
    template,
    ruleProblems,
    templateDirty,
    templateLoadError,
    templateUpdatedAt,
    isDefaultTemplate,
    restaurantId,
    onTemplateChange,
    onUseDefaultTemplate,
  } = props

  const [openEmployeeId, setOpenEmployeeId] = useState<string | null>(null)
  useEffect(() => {
    if (!props.focusEmployeeId || !visible) return
    setOpenEmployeeId(props.focusEmployeeId)
    requestAnimationFrame(() => {
      const row = host.current?.querySelector<HTMLElement>(`#${CSS.escape(`scheduler-employee-${props.focusEmployeeId}`)}`)
      row?.scrollIntoView({ block: 'center' })
      row?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true })
    })
  }, [props.focusEmployeeId, visible])
  const rulesDisclosure = useRef<HTMLDetailsElement>(null)

  function openRules() {
    if (!rulesDisclosure.current) return
    rulesDisclosure.current.open = true
    requestAnimationFrame(() => {
      rulesDisclosure.current?.querySelector('summary')?.focus()
      rulesDisclosure.current?.scrollIntoView({ block: 'start' })
    })
  }

  return (
    <div ref={host} className={`${css.staff} space-y-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{text("Staff & rules")}</h2>
          <p className="mt-1 text-sm text-zinc-600">{text("Set who can work, their availability, and their weekly limits.")}</p>
          <p className="mt-1 text-sm text-zinc-600">
            {scheduleOnly ? text("Crew changes apply to every week. Shift rules apply to the selected week.") : text("Staff and shift rules apply to the selected week only.")}
            {' '}{' '}{text("Switch views anytime; your edits stay here until you leave the page.")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            tone="primary"
            onClick={onSave}
            icon="check"
            loading={savingSetup}
            disabled={setupParts.length === 0 || storeLoading || ruleProblemCount > 0}
            title={ruleProblemCount > 0 ? text("Fix the shift rules below before saving.") : undefined}
          >{text("Save changes")}</Button>
          <Button onClick={onUndo} icon="undo" disabled={historyLength === 0}>{text("Undo")}</Button>
          <Button onClick={onBack} icon="chevronRight">{text("Back to schedule")}</Button>
          {!scheduleOnly && (
            <Disclosure summary={text("More")} tone="quiet">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-zinc-600">{text("Mistake? Go back to the station’s saved staff list.")}</p>
                  <button
                    type="button"
                    className="min-h-11 rounded border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                    onClick={onRestoreDefaultRoster}
                    disabled={isDefaultRoster}
                    title={isDefaultRoster ? text("Already using the saved staff list.") : text("Replace this week’s staff list with the station’s saved list. You can undo, then save to keep it.")}
                  >{text("Use saved staff list")}</button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3">
                  <p className="text-xs text-zinc-600">{text("Start fresh with an empty list. Undo brings everyone back.")}</p>
                  {confirmingClearStaff ? (
                    <span className="inline-flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="min-h-11 rounded bg-red-800 px-3 text-sm font-semibold text-white hover:bg-red-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                        onClick={onClearStaff}
                      >{text("Yes, clear all")}</button>
                      <button
                        type="button"
                        className="min-h-11 rounded border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                        onClick={onCancelClearStaff}
                      >{text("Cancel")}</button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="min-h-11 rounded border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                      onClick={onAskClearStaff}
                      disabled={employees.length === 0}
                      title={text("Remove everyone from the staff list. You can undo, then save to keep it.")}
                    >{text("Clear staff list")}</button>
                  )}
                </div>

                <div className="border-t border-zinc-100 pt-3">
                  <Disclosure summary={text('Copies on this device ({count})',{count:staffSnapshots.length})} tone="quiet">
                    <p className="text-xs text-zinc-600">{text("Keep a copy of a staff list on this device and bring it back anytime.")}</p>
                    <div className="mt-2 flex gap-2">
                      <input
                        className="min-w-0 flex-1 rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                        value={snapshotName}
                        onChange={(event) => onSnapshotNameChange(event.target.value)}
                        placeholder={text('Name this list ({count} staff)',{count:employees.length})}
                        aria-label={text("Snapshot name")}
                      />
                      <button
                        type="button"
                        className="min-h-11 shrink-0 rounded border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                        onClick={onSaveSnapshot}
                        disabled={employees.length === 0}
                        title={text("Save a copy of the current staff list on this device.")}
                      >{text("Save")}</button>
                    </div>
                    {staffSnapshots.length > 0 && (
                      <ul className="mt-2 space-y-2">
                        {staffSnapshots.map((snapshot) => (
                          <li key={snapshot.id} className="flex items-center justify-between gap-2 rounded border border-zinc-200 bg-zinc-50 px-2.5 py-2">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold text-zinc-900">{snapshot.name}</p>
                              <p className="text-xs text-zinc-600">{text('{count} staff · {saved}',{count:snapshot.employees.length,saved:formatUpdatedAt(snapshot.savedAt)})}</p>
                            </div>
                            <div className="flex shrink-0 gap-1.5">
                              <button
                                type="button"
                                className="min-h-11 rounded border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                                onClick={() => onRestoreSnapshot(snapshot)}
                                title={text('Replace the staff list with “{name}”. You can undo.',{name:snapshot.name})}
                              >{text("Restore")}</button>
                              <button
                                type="button"
                                className="min-h-11 rounded border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                                onClick={() => onDeleteSnapshot(snapshot.id)}
                                title={text('Delete “{name}”.',{name:snapshot.name})}
                              >{text("Delete")}</button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Disclosure>
                </div>
              </div>
            </Disclosure>
          )}
        </div>
      </div>

      {ruleProblems.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-300 bg-red-50 p-3" role="alert">
          <p className="text-sm text-red-900">{text('Fix {count} shift rule problems before saving.',{count:ruleProblems.length})}</p>
          <Button onClick={openRules} icon="target">{text("Review shift rules")}</Button>
        </div>
      )}

      {scheduleOnly && (
        <div className="flex flex-wrap items-center gap-2 rounded border border-zinc-200 bg-zinc-50 p-3">
          <p className="min-w-0 flex-1 text-sm text-zinc-600">
            {staffUnlocked
              ? text("Editing the crew and shift rules. Crew changes apply to every week.")
              : text("The crew and shift rules are locked. Enter the staff password to edit them.")}
          </p>
          {staffUnlocked ? (
            <button
              type="button"
              className="min-h-11 rounded border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
              onClick={onLock}
            >{text("Lock")}</button>
          ) : (
            <form
              className="flex min-w-0 flex-wrap gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                onUnlock()
              }}
            >
              <input
                className="min-h-11 w-40 rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                type="password"
                autoComplete="off"
                value={passwordInput}
                onChange={(event) => onPasswordInputChange(event.target.value)}
                placeholder={text("Staff password")}
                aria-label={text("Staff password")}
              />
              <button
                type="submit"
                className="min-h-11 rounded border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                disabled={!passwordInput || checkingPassword}
              >
                {checkingPassword ? text("Checking…") : text("Unlock editing")}
              </button>
            </form>
          )}
          {staffUnlocked && (
            <button
              type="button"
              className="min-h-11 rounded border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
              onClick={onUndoCrewSave}
              disabled={!staffCanUndo || savingSetup || staffDirty}
              title={staffDirty ? text("Save or undo your unsaved edits first.") : staffCanUndo ? text("Bring back the crew as it was before the last save.") : text("No saved crew change to undo.")}
            >{text("Undo last crew save")}</button>
          )}
        </div>
      )}

      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">{text("Employees")}</h3>
            <p className="mt-0.5 text-sm text-zinc-600">
              {text('{working} working, {inactive} off the list',{working:activeEmployeeCount,inactive:employees.length-activeEmployeeCount})}</p>
            <p className="mt-0.5 text-xs text-zinc-600">
              {scheduleOnly
                ? text('One crew for every week. Last saved: {saved}{dirty}',{saved:formatUpdatedAt(staffUpdatedAt),dirty:staffDirty?text(' · unsaved changes'):''})
                : text('Last saved: {saved}{dirty} · changes stay in this week only',{saved:formatUpdatedAt(rosterUpdatedAt),dirty:rosterDirty?text(' · unsaved changes'):''})}
            </p>
          </div>
          {!readOnly && (
            <Button icon={employeePanelOpen ? 'close' : 'plus'} onClick={onToggleEmployeePanel}>
              {employeePanelOpen ? text("Close employee form") : text("Add employee")}
            </Button>
          )}
        </div>

        {rosterLoadError && <p className="mt-2 text-sm font-medium text-amber-800">{rosterLoadError}</p>}
        {scheduleOnly && staffLoadError && <p className="mt-2 text-sm font-medium text-amber-800">{staffLoadError}</p>}

        {employeePanelOpen && !readOnly && (
          <EmployeeForm
            draft={draft}
            gapSlot={gapSlot}
            weekStart={weekStart}
            canAddEmployee={canAddEmployee}
            roles={roles}
            onDraftChange={onDraftChange}
            onAdd={onAddEmployee}
            onAddCustomRole={onAddCustomRole}
          />
        )}

        <div className="mt-3 border-t border-zinc-100 pt-3">
          <label className="block text-sm font-medium text-zinc-800">
            <span className="sr-only">{text("Search staff")}</span>
            <input
              className="min-h-11 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
              value={staffQuery}
              onChange={(event) => onStaffQueryChange(event.target.value)}
              placeholder={employees.length > 8 ? text('Search {count} staff by name or position',{count:employees.length}) : text("Search by name or position")}
            />
          </label>
          <p className="mt-2 text-sm font-semibold text-zinc-800">{text("Everyone on the list (")}{filteredEmployees.length}/{employees.length})
          </p>
          <ul className="mt-3 divide-y divide-zinc-100 rounded-lg border border-zinc-200">
            {filteredEmployees.map((employee) => {
              const stat = statsById.get(employee.id)
              const notes = staffNotes(employee,text)
              const expanded = openEmployeeId === employee.id
              return (
                <li key={employee.id} id={`scheduler-employee-${employee.id}`}>
                  <div className="flex flex-wrap items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-zinc-950">{employee.name}</span>
                        {employee.roles.map((role) => (
                          <span key={role} className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${roleChipClass(role)}`}>
                            {roleLabel(role)}
                          </span>
                        ))}
                        {!employee.active && <span className="text-xs font-semibold text-zinc-600">{text("Off the list")}</span>}
                      </div>
                      <p className="mt-0.5 text-xs text-zinc-600">
                        {availabilitySummary(employee).split(/(Any day|mornings|dinners|mixed hours|No availability set|Sun|Mon|Tue|Wed|Thu|Fri|Sat)/).map(part=>text(part)).join('')} · {stat && stat.shifts > 0 ? text('{hours}h · {days}d this week',{hours:stat.hours.toFixed(1),days:stat.days}) : text("off this week")}
                      </p>
                      {notes.length > 0 && <p className="mt-0.5 text-xs text-zinc-600">{notes.join(' · ')}</p>}
                    </div>
                    <label className="flex min-h-11 items-center gap-2 text-sm text-zinc-700">
                      <input
                        type="checkbox"
                        checked={employee.active}
                        aria-label={text('{name} working',{name:employee.name})}
                        disabled={readOnly}
                        onChange={(event) => onUpdateEmployee(employee.id, { active: event.target.checked })}
                      />{text("Working")}</label>
                    <button
                      type="button"
                      className="min-h-11 rounded border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                      aria-expanded={expanded}
                      onClick={() => setOpenEmployeeId(expanded ? null : employee.id)}
                    >
                      {expanded ? text("Close") : text("Edit")}
                    </button>
                  </div>
                  {expanded && (
                    <div className="border-t border-zinc-100 bg-zinc-50 p-3">
                      <EmployeeCard
                        employee={employee}
                        stat={stat}
                        roles={roles}
                        onUpdate={onUpdateEmployee}
                        onRemove={onRemoveEmployee}
                        readOnly={readOnly}
                      />
                    </div>
                  )}
                </li>
              )
            })}
            {filteredEmployees.length === 0 && (
              <li className="p-3 text-sm text-zinc-600">
                {employees.length === 0 ? text("Nobody on the list yet.") : text('Nobody matches “{query}”.',{query:staffQuery.trim()})}
              </li>
            )}
          </ul>
        </div>
      </section>

      <details ref={rulesDisclosure} id="scheduler-rules" className="rounded-lg border border-zinc-200 bg-white shadow-sm">
        <summary className="min-h-11 cursor-pointer px-4 py-3 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900">{text("Shift rules")}{' '}{ruleProblems.length > 0 ? text(' ({count} to fix)',{count:ruleProblems.length}) : ''}
        </summary>
        <p className="px-4 pb-3 text-sm text-zinc-600">{text("Change the positions and times needed for the selected week.")}</p>
        <TemplateEditor
          template={template}
          roles={roles}
          readOnly={readOnly}
          problems={ruleProblems}
          onChange={onTemplateChange}
          onUseDefault={onUseDefaultTemplate}
          isDefaultTemplate={isDefaultTemplate}
          dirty={templateDirty}
          loadError={templateLoadError}
          restaurantId={restaurantId}
          updatedAt={templateUpdatedAt}
        />
      </details>
    </div>
  )
}
