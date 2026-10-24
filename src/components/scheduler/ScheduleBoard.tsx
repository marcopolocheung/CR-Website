'use client'

import {
  DAYS,
  PERIODS,
  formatTimeRange,
  formatDayLabel,
  type DayOfWeek,
  type Employee,
  type ScheduleAssignment,
  type ShiftPeriod,
  type StaffingSlot,
  type ValidationViolation,
} from '@/lib/scheduler'
import { DragState, DropFeedback, MovePreview, ShiftKey, SpotStatus, periodLabels, reviewLabel, roleChipClass, roleInitial, roleLabel, shiftStatus, shortTimeRange, slotBadge, spotStatus, statusMeta, unassignableReason } from './helpers'
import { Icon } from './ui'
export function WeeklyScheduleBoard({
  slots,
  weekStart,
  hasSchedule,
  employees,
  assignments,
  assignmentMap,
  violations,
  openShiftKey,
  dragOverSlotId,
  dropFeedback,
  movePreviews,
  activeMove,
  changedSlotIds,
  highlightedSlotIds,
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
  roles,
  showLegend = true,
}: {
  slots: StaffingSlot[]
  weekStart: string
  hasSchedule: boolean
  employees: Employee[]
  assignments: ScheduleAssignment[]
  assignmentMap: Map<string, ScheduleAssignment>
  violations: ValidationViolation[]
  openShiftKey: ShiftKey | null
  dragOverSlotId: string | null
  dropFeedback: DropFeedback
  movePreviews: Map<string, MovePreview>
  activeMove: DragState | null
  changedSlotIds: Set<string>
  highlightedSlotIds: Set<string>
  onResetShift: (shiftKey: ShiftKey) => void
  onOpenShift: (shiftKey: ShiftKey | null) => void
  onAssign: (slotId: string, employeeId: string) => void
  onLock: (slotId: string, locked: boolean) => void
  onDragStart: (dragState: DragState) => void
  onDragEnd: () => void
  onDragOverSlot: (slotId: string) => void
  onDragLeaveSlot: (slotId: string) => void
  onDropAssignment: (targetSlotId: string) => void
  onActivateSlot: (slotId: string) => void
  roles: string[]
  showLegend?: boolean
}) {
  return (
    <div className="mt-4 min-w-0">
      <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
        {DAYS.map((day) => {
          const daySlots = slots.filter((slot) => slot.day === day)
          const filled = daySlots.filter((slot) => assignmentMap.get(slot.id)?.employeeId).length
          const dayComplete = daySlots.length > 0 && filled === daySlots.length
          return (
            <div key={day} className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50/60 p-2">
              <h3 className="flex min-w-0 items-baseline gap-1 px-0.5 text-sm font-bold text-zinc-900">
                <span className="truncate">{weekStart ? formatDayLabel(weekStart, day) : day.slice(0, 3)}</span>
                <span
                  className={`ml-auto inline-flex shrink-0 items-center rounded-full border px-1.5 py-px text-[11px] font-semibold ${
                    daySlots.length === 0
                      ? 'border-zinc-200 bg-zinc-50 text-zinc-500'
                      : dayComplete
                        ? 'border-green-300 bg-green-50 text-green-900'
                        : hasSchedule
                          ? 'border-amber-300 bg-amber-50 text-amber-950'
                          : 'border-zinc-200 bg-zinc-50 text-zinc-600'
                  }`}
                >
                  {filled}/{daySlots.length}
                </span>
              </h3>
              {PERIODS.map((period) => {
                const shiftKey = `${day}-${period}` as ShiftKey
                const shiftSlots = slots.filter((slot) => slot.day === day && slot.period === period)
                return (
                  <ShiftRow
                    key={shiftKey}
                    shiftKey={shiftKey}
                    weekStart={weekStart}
                    period={period}
                    slots={shiftSlots}
                    allSlots={slots}
                    hasSchedule={hasSchedule}
                    employees={employees}
                    assignments={assignments}
                    assignmentMap={assignmentMap}
                    violations={violations}
                    open={openShiftKey === shiftKey}
                    dragOverSlotId={dragOverSlotId}
                    dropFeedback={dropFeedback}
                    movePreviews={movePreviews}
                    activeMove={activeMove}
                    changedSlotIds={changedSlotIds}
                    highlightedSlotIds={highlightedSlotIds}
                    onResetShift={onResetShift}
                    onOpenShift={onOpenShift}
                    onAssign={onAssign}
                    onLock={onLock}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    onDragOverSlot={onDragOverSlot}
                    onDragLeaveSlot={onDragLeaveSlot}
                    onDropAssignment={onDropAssignment}
                    onActivateSlot={onActivateSlot}
                  />
                )
              })}
            </div>
          )
        })}
      </div>
      {openShiftKey && (
        <OpenShiftDetail
          shiftKey={openShiftKey}
          weekStart={weekStart}
          slots={slots}
          employees={employees}
          assignments={assignments}
          assignmentMap={assignmentMap}
          violations={violations}
          changedSlotIds={changedSlotIds}
          activeMove={activeMove}
          dragOverSlotId={dragOverSlotId}
          dropFeedback={dropFeedback}
          movePreviews={movePreviews}
          onResetShift={onResetShift}
          onOpenShift={onOpenShift}
          onAssign={onAssign}
          onLock={onLock}
          onDragOverSlot={onDragOverSlot}
          onDragLeaveSlot={onDragLeaveSlot}
          onDropAssignment={onDropAssignment}
        />
      )}
      {showLegend && <BoardLegend roles={roles} />}
    </div>
  )
}

export function BoardLegend({ roles }: { roles: string[] }) {
  const statusOrder: SpotStatus[] = ['good', 'review', 'missing', 'open', 'idle']

  return (
    <div className="space-y-2 border-t border-zinc-100 pt-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-zinc-500">Position:</span>
        {roles.map((role) => (
          <span key={role} className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 font-medium ${roleChipClass(role)}`}>
            <span aria-hidden="true" className="font-bold">
              {roleInitial(role)}
            </span>
            {roleLabel(role)}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-zinc-500">Spot:</span>
        {statusOrder.map((status) => (
          <span key={status} className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 font-medium ${statusMeta[status].chip}`}>
            <Icon name={statusMeta[status].icon} />
            {statusMeta[status].shiftLabel}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 rounded border border-zinc-300 bg-white px-2 py-1 font-medium text-zinc-700">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-blue-600" />
          Changed
        </span>
        <span className="inline-flex items-center gap-1 rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] font-bold text-white">
          Keep
        </span>
      </div>
    </div>
  )
}

export function ShiftRow({
  shiftKey,
  weekStart,
  period,
  slots,
  allSlots,
  hasSchedule,
  employees,
  assignments,
  assignmentMap,
  violations,
  open,
  dragOverSlotId,
  dropFeedback,
  movePreviews,
  activeMove,
  changedSlotIds,
  highlightedSlotIds,
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
}: {
  shiftKey: ShiftKey
  weekStart: string
  period: ShiftPeriod
  slots: StaffingSlot[]
  allSlots: StaffingSlot[]
  hasSchedule: boolean
  employees: Employee[]
  assignments: ScheduleAssignment[]
  assignmentMap: Map<string, ScheduleAssignment>
  violations: ValidationViolation[]
  open: boolean
  dragOverSlotId: string | null
  dropFeedback: DropFeedback
  movePreviews: Map<string, MovePreview>
  activeMove: DragState | null
  changedSlotIds: Set<string>
  highlightedSlotIds: Set<string>
  onResetShift: (shiftKey: ShiftKey) => void
  onOpenShift: (shiftKey: ShiftKey | null) => void
  onAssign: (slotId: string, employeeId: string) => void
  onLock: (slotId: string, locked: boolean) => void
  onDragStart: (dragState: DragState) => void
  onDragEnd: () => void
  onDragOverSlot: (slotId: string) => void
  onDragLeaveSlot: (slotId: string) => void
  onDropAssignment: (targetSlotId: string) => void
  onActivateSlot: (slotId: string) => void
}) {
  const slotStatuses = slots.map((slot) =>
    spotStatus({
      hasEmployee: Boolean(assignmentMap.get(slot.id)?.employeeId),
      hasSchedule,
      optional: !slot.required,
      violations: violations.filter((violation) => violation.slotId === slot.id),
    }),
  )
  const status = shiftStatus(slotStatuses)
  const missingCount = slotStatuses.filter((slotStatus) => slotStatus === 'missing').length
  const reviewCount = slotStatuses.filter((slotStatus) => slotStatus === 'review').length
  const statusLabel =
    status === 'missing'
      ? `Needs ${missingCount} more`
      : status === 'review'
        ? `${reviewCount} to check`
        : statusMeta[status].shiftLabel

  return (
    <div className={`min-w-0 overflow-hidden rounded ${statusMeta[status].shiftRow}`}>
      <div className="flex min-w-0 flex-col gap-1.5 px-2 py-2">
        <button
          type="button"
          className="flex min-w-0 items-center gap-1.5 rounded text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
          onClick={() => onOpenShift(open ? null : shiftKey)}
          aria-expanded={open}
          aria-controls={`${shiftKey}-detail`}
        >
          <Icon name={open ? 'chevronDown' : 'chevronRight'} />
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{periodLabels[period]}</span>
          {status !== 'good' && (
            <span className={`ml-auto inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-px text-[11px] font-semibold ${statusMeta[status].badge}`}>
              <Icon name={statusMeta[status].icon} />
              {statusLabel}
            </span>
          )}
        </button>
        <div className="flex min-w-0 flex-col gap-1.5">
          {slots.map((slot, index) => (
            <AssignmentChip
              key={slot.id}
              slot={slot}
              weekStart={weekStart}
              assignment={assignmentMap.get(slot.id)}
              employee={employees.find((candidate) => candidate.id === assignmentMap.get(slot.id)?.employeeId)}
              status={slotStatuses[index]}
              isChanged={changedSlotIds.has(slot.id)}
              isHighlighted={highlightedSlotIds.has(slot.id)}
              activeMove={activeMove}
              dragOverSlotId={dragOverSlotId}
              movePreview={movePreviews.get(slot.id) ?? null}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragOverSlot={onDragOverSlot}
              onDragLeaveSlot={onDragLeaveSlot}
              onDropAssignment={onDropAssignment}
              onActivateSlot={onActivateSlot}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export function OpenShiftDetail({
  shiftKey,
  weekStart,
  slots,
  employees,
  assignments,
  assignmentMap,
  violations,
  changedSlotIds,
  activeMove,
  dragOverSlotId,
  dropFeedback,
  movePreviews,
  onResetShift,
  onOpenShift,
  onAssign,
  onLock,
  onDragOverSlot,
  onDragLeaveSlot,
  onDropAssignment,
}: {
  shiftKey: ShiftKey
  weekStart: string
  slots: StaffingSlot[]
  employees: Employee[]
  assignments: ScheduleAssignment[]
  assignmentMap: Map<string, ScheduleAssignment>
  violations: ValidationViolation[]
  changedSlotIds: Set<string>
  activeMove: DragState | null
  dragOverSlotId: string | null
  dropFeedback: DropFeedback
  movePreviews: Map<string, MovePreview>
  onResetShift: (shiftKey: ShiftKey) => void
  onOpenShift: (shiftKey: ShiftKey | null) => void
  onAssign: (slotId: string, employeeId: string) => void
  onLock: (slotId: string, locked: boolean) => void
  onDragOverSlot: (slotId: string) => void
  onDragLeaveSlot: (slotId: string) => void
  onDropAssignment: (targetSlotId: string) => void
}) {
  const [day, period] = shiftKey.split('-') as [DayOfWeek, ShiftPeriod]
  const shiftSlots = slots.filter((slot) => slot.day === day && slot.period === period)
  if (shiftSlots.length === 0) return null
  return (
    <div id={`${shiftKey}-detail`} className="mt-2 rounded-lg border border-zinc-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-bold text-zinc-900">
          {weekStart ? formatDayLabel(weekStart, day) : day} {periodLabels[period]} · {shiftSlots.length} spots
        </h4>
        <button
          type="button"
          className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
          onClick={() => onOpenShift(null)}
        >
          Close
        </button>
      </div>
      <div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {shiftSlots.map((slot) => (
          <SlotEditor
            key={slot.id}
            slot={slot}
            weekStart={weekStart}
            status={spotStatus({
              hasEmployee: Boolean(assignmentMap.get(slot.id)?.employeeId),
              hasSchedule: assignments.length > 0,
              optional: !slot.required,
              violations: violations.filter((violation) => violation.slotId === slot.id),
            })}
            activeMove={activeMove}
            employees={employees}
            allSlots={slots}
            allAssignments={assignments}
            assignment={assignmentMap.get(slot.id)}
            violations={violations.filter((violation) => violation.slotId === slot.id)}
            dragOverSlotId={dragOverSlotId}
            movePreview={movePreviews.get(slot.id) ?? null}
            dropFeedback={dropFeedback?.slotId === slot.id ? dropFeedback.message : null}
            onAssign={onAssign}
            onLock={onLock}
            onDragOverSlot={onDragOverSlot}
            onDragLeaveSlot={onDragLeaveSlot}
            onDropAssignment={onDropAssignment}
          />
        ))}
      </div>
      {shiftSlots.some((slot) => changedSlotIds.has(slot.id)) && (
        <button
          type="button"
          className="mt-3 inline-flex items-center gap-2 rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
          onClick={() => onResetShift(shiftKey)}
        >
          <Icon name="reset" />
          Put this shift back
        </button>
      )}
    </div>
  )
}

export function AssignmentChip({
  slot,
  weekStart,
  assignment,
  employee,
  status,
  isChanged,
  isHighlighted,
  activeMove,
  dragOverSlotId,
  movePreview,
  onDragStart,
  onDragEnd,
  onDragOverSlot,
  onDragLeaveSlot,
  onDropAssignment,
  onActivateSlot,
}: {
  slot: StaffingSlot
  weekStart: string
  assignment?: ScheduleAssignment
  employee?: Employee
  status: SpotStatus
  isChanged: boolean
  isHighlighted: boolean
  activeMove: DragState | null
  dragOverSlotId: string | null
  movePreview: MovePreview | null
  onDragStart: (dragState: DragState) => void
  onDragEnd: () => void
  onDragOverSlot: (slotId: string) => void
  onDragLeaveSlot: (slotId: string) => void
  onDropAssignment: (targetSlotId: string) => void
  onActivateSlot: (slotId: string) => void
}) {
  const canDrag = Boolean(assignment?.employeeId && employee)
  const isMoveActive = Boolean(activeMove)
  const isSource = activeMove?.fromSlotId === slot.id
  const isHovered = dragOverSlotId === slot.id && isMoveActive && !isSource
  const preview = isSource ? null : movePreview
  const isGhosted = isHovered && preview?.status === 'valid'
  const movingName = activeMove ? preview?.employeeName : undefined
  const day = weekStart ? formatDayLabel(weekStart, slot.day) : slot.day

  // Whatever matters most for this spot gets the big text: a name when there is one,
  // otherwise the position that still needs filling.
  let primaryText = employee?.name ?? slot.label
  if (isSource) {
    primaryText = 'Open'
  } else if (isGhosted && preview) {
    primaryText = preview.employeeName
  }
  const primaryTone = employee && !isSource ? 'font-semibold text-zinc-900' : 'font-medium'

  const label = isSource
    ? `Stop moving ${employee?.name ?? 'this person'}`
    : isMoveActive && preview
      ? `Move ${movingName} to ${day} ${periodLabels[slot.period]} ${slot.label}. ${preview.message}`
      : canDrag
        ? `Move ${employee?.name} out of ${day} ${periodLabels[slot.period]} ${slot.label}`
        : `Open ${day} ${periodLabels[slot.period]} to fill ${slot.label}`

  return (
    <button
      type="button"
      className={assignmentChipClass({
        status,
        isMoveActive,
        isSource,
        isHovered,
        preview,
        wouldReplace: Boolean(employee),
        isHighlighted,
      })}
      draggable={canDrag}
      aria-label={label}
      aria-pressed={isSource}
      title={preview?.message ?? label}
      onClick={(event) => {
        event.stopPropagation()
        onActivateSlot(slot.id)
      }}
      onDragStart={(event) => {
        if (!assignment?.employeeId) return
        event.stopPropagation()
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', assignment.employeeId)
        onDragStart({ employeeId: assignment.employeeId, fromSlotId: slot.id })
      }}
      onDragEnd={onDragEnd}
      onDragOver={(event) => {
        if (!isMoveActive) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        onDragOverSlot(slot.id)
      }}
      onDragEnter={() => {
        onDragOverSlot(slot.id)
      }}
      onDragLeave={(event) => {
        if (!leftDropTarget(event)) return
        onDragLeaveSlot(slot.id)
      }}
      onMouseEnter={() => {
        if (isMoveActive) onDragOverSlot(slot.id)
      }}
      onMouseLeave={() => onDragLeaveSlot(slot.id)}
      onDrop={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onDropAssignment(slot.id)
      }}
    >
      <span
        aria-hidden="true"
        className={`inline-flex h-6 shrink-0 items-center justify-center rounded-sm border px-1 text-xs font-bold leading-none ${roleChipClass(slot.role)}`}
      >
        {slotBadge(slot)}
      </span>
      <span className={`truncate text-sm ${primaryTone}${isGhosted ? ' italic opacity-80' : ''}`}>
        {primaryText}
        <span aria-hidden="true" className="ml-1 font-normal opacity-70">
          · {shortTimeRange(slot)}
        </span>
      </span>
      {!isMoveActive && isChanged && (
        <>
          <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-blue-600 ring-2 ring-white" />
          <span className="sr-only">Changed since the schedule was made.</span>
        </>
      )}
      {!isMoveActive && status !== 'good' && status !== 'idle' && <Icon name={statusMeta[status].icon} />}
      {isMoveActive && !isSource && preview && <Icon name={preview.status === 'valid' ? 'check' : 'close'} />}
      {assignment?.locked && (
        <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-zinc-900 px-1.5 py-0.5 text-xs font-bold leading-none text-white [&>svg]:h-3 [&>svg]:w-3">
          <Icon name="lock" />
          <span aria-hidden="true">Keep</span>
          <span className="sr-only">Kept in place.</span>
        </span>
      )}
      <span className="sr-only">{`${slot.label} ${shortTimeRange(slot)}. ${statusMeta[status].shiftLabel}.`}</span>
    </button>
  )
}

export function SlotEditor({
  slot,
  weekStart,
  status,
  activeMove,
  employees,
  allSlots,
  allAssignments,
  assignment,
  violations,
  dragOverSlotId,
  movePreview,
  dropFeedback,
  onAssign,
  onLock,
  onDragOverSlot,
  onDragLeaveSlot,
  onDropAssignment,
}: {
  slot: StaffingSlot
  weekStart: string
  status: SpotStatus
  activeMove: DragState | null
  employees: Employee[]
  allSlots: StaffingSlot[]
  allAssignments: ScheduleAssignment[]
  assignment?: ScheduleAssignment
  violations: ValidationViolation[]
  dragOverSlotId: string | null
  movePreview: MovePreview | null
  dropFeedback: string | null
  onAssign: (slotId: string, employeeId: string) => void
  onLock: (slotId: string, locked: boolean) => void
  onDragOverSlot: (slotId: string) => void
  onDragLeaveSlot: (slotId: string) => void
  onDropAssignment: (targetSlotId: string) => void
}) {
  const currentId = assignment?.employeeId ?? ''
  const eligibleEmployees = employees.filter(
    (employee) =>
      unassignableReason({ slot, employee, employees, slots: allSlots, assignments: allAssignments }) === null,
  )
  const otherEmployees = employees.filter((employee) => !eligibleEmployees.includes(employee))
  const currentReason = employees.find((employee) => employee.id === currentId)
    ? unassignableReason({
        slot,
        employee: employees.find((employee) => employee.id === currentId) as Employee,
        employees,
        slots: allSlots,
        assignments: allAssignments,
      })
    : null
  const showInvalidKept = Boolean(currentId && currentReason)
  const isSource = activeMove?.fromSlotId === slot.id
  const isDropTarget = dragOverSlotId === slot.id && Boolean(activeMove) && !isSource
  const panelTone =
    isDropTarget
      ? movePreview?.status === 'invalid'
        ? 'border-red-500 bg-red-50 ring-2 ring-red-200'
        : 'border-green-500 bg-green-50 ring-2 ring-green-200'
      : isSource
        ? 'border-dashed border-zinc-400 bg-zinc-50'
        : dropFeedback
          ? 'border-amber-400 bg-amber-50'
          : `bg-white ${statusMeta[status].row}`

  return (
    <div
      className={`rounded border p-3 transition duration-150 ${panelTone}`}
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        onDragOverSlot(slot.id)
      }}
      onDragEnter={() => {
        onDragOverSlot(slot.id)
      }}
      onDragLeave={(event) => {
        if (!leftDropTarget(event)) return
        onDragLeaveSlot(slot.id)
      }}
      onDrop={(event) => {
        event.preventDefault()
        onDropAssignment(slot.id)
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-900">{slot.label}</div>
          <div className="text-xs text-zinc-500">{formatTimeRange(slot)}</div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs font-medium ${roleChipClass(slot.role)}`}>
            <span aria-hidden="true" className="font-bold">
              {roleInitial(slot.role)}
            </span>
            {roleLabel(slot.role)}
          </span>
          <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium ${statusMeta[status].badge}`}>
            <Icon name={statusMeta[status].icon} />
            {statusMeta[status].shiftLabel}
          </span>
        </div>
      </div>
      <select
        className="mt-3 w-full rounded border border-zinc-300 bg-white px-2 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
        value={assignment?.employeeId ?? ''}
        onChange={(event) => onAssign(slot.id, event.target.value)}
      >
        <option value="">Unassigned</option>
        {eligibleEmployees.length > 0 && (
          <optgroup label="Best choices — free and trained">
            {eligibleEmployees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </optgroup>
        )}
        {otherEmployees.length > 0 && (
          <optgroup label="Other employees — needs a fix">
            {otherEmployees.map((employee) => {
              const reason = unassignableReason({ slot, employee, employees, slots: allSlots, assignments: allAssignments })
              const isCurrent = employee.id === currentId
              return (
                <option key={employee.id} value={employee.id} disabled={!isCurrent}>
                  {employee.name} — {reason}
                </option>
              )
            })}
          </optgroup>
        )}
      </select>
      {showInvalidKept && (
        <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-950" role="note">
          {employees.find((employee) => employee.id === currentId)?.name} is kept here but {currentReason}. Pick someone from
          Best choices to fix it.
        </p>
      )}
      <label className="mt-2 flex items-center gap-2 text-xs text-zinc-600">
        <input
          type="checkbox"
          disabled={!assignment}
          checked={assignment?.locked ?? false}
          onChange={(event) => onLock(slot.id, event.target.checked)}
        />
        Keep here when making the schedule
      </label>
      {isDropTarget && movePreview && (
        <div
          className={`mt-2 rounded border bg-white px-2 py-1 text-xs font-medium ${
            movePreview.status === 'valid'
              ? 'border-green-300 text-green-900'
              : 'border-red-300 text-red-900'
          }`}
        >
          {movePreview.message}
        </div>
      )}
      {dropFeedback && (
        <div className="mt-2 rounded border border-amber-300 bg-white px-2 py-1 text-xs font-medium text-amber-950">
          {dropFeedback}
        </div>
      )}
      {violations.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs leading-4 text-amber-900">
          {violations.map((violation) => (
            <li key={`${slot.id}-${violation.code}-${violation.employeeId ?? ''}`}>
              {reviewLabel(violation, slot, employees.find((candidate) => candidate.id === violation.employeeId), weekStart, allSlots)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function assignmentChipClass({
    status,
    isMoveActive,
    isSource,
    isHovered,
    preview,
    wouldReplace,
    isHighlighted,
  }: {
    status: SpotStatus
    isMoveActive: boolean
    isSource: boolean
    isHovered: boolean
    preview: MovePreview | null
    wouldReplace: boolean
    isHighlighted: boolean
  },
) {
  const base =
    'flex min-h-11 w-full min-w-0 items-center gap-1.5 rounded border px-1.5 py-1.5 text-left transition duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900' +
    (isHighlighted ? ' ring-2 ring-offset-1 ring-blue-500' : '')

  if (isSource) {
    return `${base} border-dashed border-zinc-400 bg-zinc-50 text-zinc-500 opacity-70`
  }

  if (isMoveActive && preview) {
    if (preview.status === 'invalid') {
      return `${base} border-dashed border-red-400 bg-red-50 text-red-900 ${isHovered ? 'ring-2 ring-red-400' : 'opacity-70'}`
    }
    // An empty spot is the one we most want the manager to notice.
    const emphasis = preview.isEmptyTarget ? 'ring-2 ring-green-400 shadow-sm' : 'ring-1 ring-green-200'
    const hovered = isHovered ? 'ring-4 ring-green-400 shadow-md' : emphasis
    const pulse = isHovered && wouldReplace ? ' animate-pulse' : ''
    return `${base} border-green-500 bg-green-50 text-green-950 ${hovered}${pulse}`
  }

  if (isMoveActive) {
    return `${base} border-zinc-200 bg-white text-zinc-500 opacity-70`
  }

  return `${base} ${statusMeta[status].chip}`
}

export function leftDropTarget(event: React.DragEvent<HTMLElement>) {
  const nextTarget = event.relatedTarget
  return !(nextTarget instanceof Node && event.currentTarget.contains(nextTarget))
}
