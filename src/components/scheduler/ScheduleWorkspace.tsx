'use client'

import { useRef, useState, type ReactNode } from 'react'
import {
  type Employee,
  type PublishState,
  type ScheduleAssignment,
  type ScheduleStats,
  type StaffingSlot,
  type ValidationViolation,
  type WeekStatus,
} from '@/lib/scheduler'
import {
  scheduleVariants,
  type DragState,
  type DropFeedback,
  type FixIssue,
  type GenerationReport,
  type MovePreview,
  type ScheduleChange,
  type ScheduleVariant,
  type ShiftKey,
  type WeekAssignments,
} from './helpers'
import { Button, Disclosure, Icon } from './ui'
import { BoardLegend, WeeklyScheduleBoard } from './ScheduleBoard'
import { GenerationReportBanner, GuidedFixPanel, HoursSummary, MonthStrip } from './SchedulePanels'

export type ScheduleWorkspaceProps = {
  weekStart: string
  assignments: ScheduleAssignment[]
  slots: StaffingSlot[]
  employees: Employee[]
  allEmployees: Employee[]
  assignmentMap: Map<string, ScheduleAssignment>
  violations: ValidationViolation[]
  openShiftKey: ShiftKey | null
  activeMove: DragState | null
  dragOverSlotId: string | null
  dropFeedback: DropFeedback
  movePreviews: Map<string, MovePreview>
  changedSlotIds: Set<string>
  highlightedSlotIds: Set<string>
  roles: string[]
  storeLoading: boolean
  ruleProblemCount: number
  publishState: PublishState | null
  schedulePassing: boolean
  isGenerating: boolean
  activeEmployeeCount: number
  selectedVariant: ScheduleVariant
  historyLength: number
  undoLabel?: string
  keptCount: number
  stats: ScheduleStats[]
  changes: ScheduleChange[]
  lastReport: GenerationReport | null
  diagnostics: string[]
  layoutMismatch: boolean
  movingEmployee?: Employee
  nextIssue?: FixIssue
  visibleIssueCount: number
  totalIssueCount: number
  ignoredIssueCount: number
  fixCandidates: Employee[]
  fixExcluded: { employee: Employee; reason: string }[]
  guidedChoosing: boolean
  canAddEmployee: boolean
  monthKey: string
  monthWeeks: string[]
  weeks: WeekAssignments
  weekStatus: Record<string, WeekStatus>
  liveMonthWeeks: Record<string, boolean>
  otherWeeksWithEdits: string[]
  confirmingClearWeek: boolean
  confirmingReset: boolean
  requestsPanel: ReactNode
  onMake: () => void
  onVariantChange: (variant: ScheduleVariant) => void
  onPublish: () => void
  onUndo: () => void
  onChooseEmployee: () => void
  onPickEmployee: (employeeId: string) => void
  onAddEmployee: () => void
  onIgnoreIssue: () => void
  onShowIgnored: () => void
  onCopyPrior: () => void
  onAskClearWeek: () => void
  onClearWeek: () => void
  onCancelClearWeek: () => void
  onSelectWeek: (week: string) => void
  onSelectMonth: (month: string) => void
  onToggleWeek: (week: string, status: WeekStatus) => void
  onRestoreEverything: () => void
  onAskReset: () => void
  onReset: () => void
  onCancelReset: () => void
  onDismissReport: () => void
  onCancelMove: () => void
  onReviewRules: () => void
  onPrint: () => void
  onResetShift: (shiftKey: ShiftKey) => void
  onOpenShift: (shiftKey: ShiftKey | null) => void
  onAssign: (slotId: string, employeeId: string) => void
  onLock: (slotId: string, locked: boolean) => void
  onDragStart: (dragState: DragState) => void
  onDragEnd: () => void
  onDragOverSlot: (slotId: string) => void
  onDragLeaveSlot: (slotId: string) => void
  onDropAssignment: (slotId: string) => void
  onActivateSlot: (slotId: string) => void
}

function isBlocker(issue: FixIssue) {
  return issue.id.includes('missing_assignment') || issue.id.startsWith('ready:')
}

export default function ScheduleWorkspace(props: ScheduleWorkspaceProps) {
  const {
    weekStart,
    assignments,
    slots,
    employees,
    allEmployees,
    assignmentMap,
    violations,
    openShiftKey,
    activeMove,
    dragOverSlotId,
    dropFeedback,
    movePreviews,
    changedSlotIds,
    highlightedSlotIds,
    roles,
    storeLoading,
    ruleProblemCount,
    publishState,
    schedulePassing,
    isGenerating,
    activeEmployeeCount,
    selectedVariant,
    historyLength,
    undoLabel,
    keptCount,
    stats,
    changes,
    lastReport,
    diagnostics,
    layoutMismatch,
    movingEmployee,
    nextIssue,
    visibleIssueCount,
    totalIssueCount,
    ignoredIssueCount,
    fixCandidates,
    fixExcluded,
    guidedChoosing,
    canAddEmployee,
    monthKey,
    monthWeeks,
    weeks,
    weekStatus,
    liveMonthWeeks,
    otherWeeksWithEdits,
    confirmingClearWeek,
    confirmingReset,
    requestsPanel,
    onMake,
    onVariantChange,
    onPublish,
    onUndo,
    onChooseEmployee,
    onPickEmployee,
    onAddEmployee,
    onIgnoreIssue,
    onShowIgnored,
    onCopyPrior,
    onAskClearWeek,
    onClearWeek,
    onCancelClearWeek,
    onSelectWeek,
    onSelectMonth,
    onToggleWeek,
    onRestoreEverything,
    onAskReset,
    onReset,
    onCancelReset,
    onDismissReport,
    onCancelMove,
    onReviewRules,
    onPrint,
    onResetShift,
    onOpenShift,
    onAssign,
    onLock,
    onDragStart,
    onDragEnd,
    onDragOverSlot,
    onDragLeaveSlot,
    onDropAssignment,
    onActivateSlot,
  } = props

  const [fixOpen, setFixOpen] = useState(false)
  const fixRef = useRef<HTMLDivElement>(null)
  const blocking = visibleIssueCount > 0 && Boolean(nextIssue && isBlocker(nextIssue))
  const hasSchedule = assignments.length > 0
  const showFixPanel = visibleIssueCount > 0 || (fixOpen && ignoredIssueCount > 0)
  const working = stats.filter((stat) => stat.shifts > 0)
  const totalHours = working.reduce((sum, stat) => sum + stat.hours, 0)
  const byId = new Map(allEmployees.map((employee) => [employee.id, employee]))
  const overCount = working.filter((stat) => {
    const employee = byId.get(stat.employeeId)
    const maxDays = employee?.maxDaysPerWeek ?? 7
    const maxShifts = employee?.maxShiftsPerWeek
    const maxHours = employee?.maxHoursPerWeek
    return stat.days > maxDays || (maxShifts !== undefined && stat.shifts > maxShifts) || (maxHours !== undefined && stat.hours > maxHours)
  }).length
  const hoursSummary = !hasSchedule
    ? 'Hours this week'
    : `Total ${Math.round(totalHours)} h${overCount > 0 ? ` · ${overCount} person${overCount === 1 ? '' : 's'} over` : ''}`
  const publishLabel =
    publishState === 'live' ? 'Published ✓' : publishState === 'changed' ? 'Publish changes' : 'Publish to staff'
  const publishTitle =
    storeLoading
      ? 'Waiting for your saved data to load.'
      : ruleProblemCount > 0
        ? 'Fix the shift rules marked in red first.'
        : publishState === 'live'
          ? 'Staff already see this week.'
          : 'Send this week to the staff schedule page.'
  const pillLabel = visibleIssueCount > 0
    ? `${visibleIssueCount} to fix`
    : ignoredIssueCount > 0
      ? `✓ ${ignoredIssueCount} skipped`
      : '✓ All spots filled'

  function focusFixPanel() {
    setFixOpen(true)
    requestAnimationFrame(() => {
      fixRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      fixRef.current?.focus()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        {hasSchedule ? (
          <>
            <Button
              tone="primary"
              onClick={onPublish}
              icon="share"
              disabled={!weekStart || storeLoading || ruleProblemCount > 0 || publishState === 'live'}
              title={publishTitle}
            >
              {publishLabel}
            </Button>
            <Button
              onClick={onMake}
              icon="spark"
              loading={isGenerating}
              disabled={activeEmployeeCount === 0 || isGenerating}
              title={activeEmployeeCount === 0 ? 'Add someone to the staff list first.' : 'Make the week again from the staff list.'}
            >
              {isGenerating ? 'Making schedule…' : 'Remake'}
            </Button>
          </>
        ) : (
          <Button
            tone="primary"
            onClick={onMake}
            icon="spark"
            loading={isGenerating}
            disabled={activeEmployeeCount === 0 || isGenerating}
            title={activeEmployeeCount === 0 ? 'Add someone to the staff list first.' : 'Build the week from the staff list.'}
          >
            {isGenerating ? 'Making schedule…' : 'Make schedule'}
          </Button>
        )}
        <Button
          onClick={onUndo}
          icon="undo"
          disabled={historyLength === 0}
          title={undoLabel ? `Undo ${undoLabel} (Ctrl+Z)` : 'Nothing to undo yet.'}
        >
          Undo
        </Button>
        {keptCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-700">
            <Icon name="lock" />
            Keep: {keptCount}
          </span>
        )}
        {(hasSchedule || visibleIssueCount > 0) && (
          <button
            type="button"
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 ${
              blocking
                ? 'border-red-300 bg-red-50 text-red-900'
                : visibleIssueCount > 0
                  ? 'border-amber-400 bg-amber-50 text-amber-950'
                  : 'border-green-300 bg-green-50 text-green-900'
            }`}
            onClick={focusFixPanel}
            aria-controls="schedule-fix"
          >
            <Icon name={visibleIssueCount > 0 ? 'warning' : 'check'} />
            {pillLabel}
          </button>
        )}
        <Disclosure summary="More" tone="quiet">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={onCopyPrior} icon="share" disabled={!weekStart} title="Copy last week's assignments into this week.">
              Copy last week
            </Button>
            {confirmingClearWeek ? (
              <span className="inline-flex flex-wrap items-center gap-2 rounded border border-red-300 bg-red-50 px-2 py-1">
                <span className="text-xs font-semibold text-red-900">Clear this week? You can undo.</span>
                <button
                  type="button"
                  className="min-h-11 rounded bg-red-800 px-3 text-sm font-semibold text-white hover:bg-red-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                  onClick={onClearWeek}
                >
                  Yes, clear week
                </button>
                <button
                  type="button"
                  className="min-h-11 rounded border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                  onClick={onCancelClearWeek}
                >
                  Keep it
                </button>
              </span>
            ) : (
              <Button onClick={onAskClearWeek} icon="reset" disabled={!weekStart || !hasSchedule} title="Remove every assignment from this week. You can undo.">
                Clear week
              </Button>
            )}
            <label className="flex flex-wrap items-center gap-2 text-sm font-medium">
              How to build the week
              <select
                className="min-h-11 rounded border border-zinc-300 bg-white px-2 py-2 text-sm text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                aria-label="How to build the week"
                value={selectedVariant}
                onChange={(event) => onVariantChange(event.target.value as ScheduleVariant)}
                disabled={isGenerating}
                title={`${scheduleVariants.find((variant) => variant.id === selectedVariant)?.description} Anyone marked Keep stays put.`}
              >
                {scheduleVariants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.label}
                  </option>
                ))}
              </select>
            </label>
            <Button
              onClick={onPrint}
              icon="print"
              disabled={!schedulePassing}
              title={!schedulePassing ? 'Fill every required spot before printing.' : 'Print this week.'}
            >
              Print
            </Button>
            <Disclosure summary="Month view and week visibility" tone="quiet">
              <MonthStrip
                monthKey={monthKey}
                weekStart={weekStart}
                monthWeeks={monthWeeks}
                weeks={weeks}
                weekStatus={weekStatus}
                onSelectWeek={onSelectWeek}
                onSelectMonth={onSelectMonth}
                onToggleWeek={onToggleWeek}
                liveWeeks={liveMonthWeeks}
                currentState={publishState}
                editedWeeks={otherWeeksWithEdits}
              />
            </Disclosure>
            {changes.length > 0 && (
              <Disclosure summary={`Changes since you made the schedule (${changes.length})`} tone="quiet">
                <ul className="space-y-1 text-sm text-zinc-700">
                  {changes.map((change) => (
                    <li key={change.slotId}>{change.text}</li>
                  ))}
                </ul>
                <Button onClick={onRestoreEverything} icon="reset">
                  Put the whole week back
                </Button>
              </Disclosure>
            )}
            {confirmingReset ? (
              <span className="inline-flex flex-wrap items-center gap-2 rounded border border-red-300 bg-red-50 px-2 py-1">
                <span className="text-xs font-semibold text-red-900">Clear everything? You can undo.</span>
                <button
                  type="button"
                  className="min-h-11 rounded bg-red-800 px-3 text-sm font-semibold text-white hover:bg-red-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                  onClick={onReset}
                >
                  Yes, start over
                </button>
                <button
                  type="button"
                  className="min-h-11 rounded border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                  onClick={onCancelReset}
                >
                  Cancel
                </button>
              </span>
            ) : (
              <Button onClick={onAskReset} icon="reset">
                Start over
              </Button>
            )}
          </div>
        </Disclosure>
      </div>

      {showFixPanel && (
        <div ref={fixRef} id="schedule-fix" tabIndex={-1} className="rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900">
          <GuidedFixPanel
            nextIssue={nextIssue}
            weekStart={weekStart}
            issueCount={visibleIssueCount}
            totalCount={totalIssueCount}
            ignoredCount={ignoredIssueCount}
            candidates={fixCandidates}
            excluded={fixExcluded}
            choosing={guidedChoosing}
            hasSchedule={hasSchedule}
            onChooseEmployee={onChooseEmployee}
            onPickEmployee={onPickEmployee}
            onAddEmployee={onAddEmployee}
            onIgnore={onIgnoreIssue}
            onShowIgnored={onShowIgnored}
            canAddEmployee={canAddEmployee}
            emphasizeChoose={false}
          />
        </div>
      )}

      {lastReport && lastReport.weekStart === weekStart && (
        <GenerationReportBanner
          report={lastReport}
          onDismiss={onDismissReport}
          details={diagnostics.filter((message) => message !== lastReport.detail)}
        />
      )}
      {!lastReport && diagnostics.length > 0 && (
        <div className="print:hidden" aria-live="polite">
          <Disclosure summary={`Messages (${diagnostics.length})`} tone="quiet">
            <ul className="space-y-1 text-sm text-zinc-700">
              {diagnostics.map((message, index) => (
                <li key={`${message}-${index}`}>{message}</li>
              ))}
            </ul>
          </Disclosure>
        </div>
      )}

      {!hasSchedule && !layoutMismatch && (
        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm print:hidden">
          <h2 className="text-lg font-semibold">No schedule yet</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Make schedule or copy last week. Nothing is lost — you can undo.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              onClick={onMake}
              icon="spark"
              loading={isGenerating}
              disabled={activeEmployeeCount === 0 || isGenerating}
              title={activeEmployeeCount === 0 ? 'Add someone to the staff list first.' : 'Build the week from the staff list.'}
            >
              Make schedule
            </Button>
            <Button onClick={onCopyPrior} icon="share" disabled={!weekStart} title="Copy last week's assignments into this week.">
              Copy last week
            </Button>
          </div>
        </section>
      )}

      <section className="min-w-0 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-zinc-600 print:hidden">
          Click a name to move it, then click where it goes. Open a shift to pick someone.
        </p>

        {layoutMismatch && !hasSchedule && (
          <div className="mt-3 rounded border border-amber-500 bg-amber-50 p-3 text-sm text-amber-950" role="alert">
            <p className="font-semibold">This week is published, but with different shift rules — so it is not shown here.</p>
            <p className="mt-1">
              Staff still see the published version. Making and publishing a schedule here replaces it.
              <button type="button" className="ml-1 rounded font-semibold underline focus-visible:outline focus-visible:outline-2" onClick={onReviewRules}>
                Review shift rules
              </button>{' '}
              first.
            </p>
          </div>
        )}

        {movingEmployee && (
          <div className="mt-3 flex flex-col gap-2 rounded border border-green-300 bg-green-50 p-3 sm:flex-row sm:items-center sm:justify-between print:hidden" role="status">
            <p className="flex items-center gap-2 text-sm font-semibold text-green-950">
              <Icon name="move" />
              Moving {movingEmployee.name}. Click a green spot to put them there.
            </p>
            <Button onClick={onCancelMove} icon="close">
              Cancel move
            </Button>
          </div>
        )}

        <WeeklyScheduleBoard
          slots={slots}
          weekStart={weekStart}
          hasSchedule={hasSchedule}
          employees={employees}
          assignments={assignments}
          assignmentMap={assignmentMap}
          violations={violations}
          openShiftKey={openShiftKey}
          activeMove={activeMove}
          changedSlotIds={changedSlotIds}
          highlightedSlotIds={highlightedSlotIds}
          onResetShift={onResetShift}
          dragOverSlotId={dragOverSlotId}
          dropFeedback={dropFeedback}
          movePreviews={movePreviews}
          onOpenShift={onOpenShift}
          onAssign={onAssign}
          onLock={onLock}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragOverSlot={onDragOverSlot}
          onDragLeaveSlot={onDragLeaveSlot}
          onDropAssignment={onDropAssignment}
          onActivateSlot={onActivateSlot}
          roles={roles}
          showLegend={false}
        />

        <div className="mt-3 print:hidden">
          <Disclosure summary="Color key" tone="quiet">
            <BoardLegend roles={roles} />
          </Disclosure>
        </div>
      </section>

      <div className="print:hidden">
        <Disclosure summary={hoursSummary} tone="quiet">
          <HoursSummary stats={stats} employees={allEmployees} />
        </Disclosure>
      </div>

      {requestsPanel}
    </div>
  )
}
