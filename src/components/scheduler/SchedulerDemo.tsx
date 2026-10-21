'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import {
  calculateScheduleStats,
  defaultEmployeesForRestaurant,
  defaultRoleForRestaurant,
  defaultTemplateForRestaurant,
  expandTemplate,
  generateSchedule,
  normalizeRoleSlug,
  preflightDiagnostics,
  rolesForRestaurant,
  currentWeekStart,
  formatWeekRange,
  monthKeyForWeek,
  shiftWeek,
  summarizeSchedule,
  validateSchedule,
  weeksForMonth,
  publishState,
  templateProblems,
  type PublishState,
  type Employee,
  type ScheduleAssignment,
  type StaffingSlot,
  type WeeklyStaffingTemplate,
  type WeekStatus,
  formatUpdatedAt,
} from '@/lib/scheduler'
import { fetchRoster, rosterFingerprint, saveRoster } from '@/lib/employee-store'
import { fetchStaff, saveStaff, staffFingerprint, undoStaff, verifyStaffPassword, type StaffWriteResult } from '@/lib/staff-store'
import { fetchTemplate, saveTemplate, templateFingerprint } from '@/lib/template-store'
import { fetchGoldenMonth, fetchGoldenWeek, saveErrorMessage, type GoldenWeekDoc } from '@/lib/schedule-store'
import { assignmentsFromPublishedWeek, buildPublishedWeek, layoutForWeek, publishedWeekFingerprint, templateHashForSlots } from '@/lib/schedule-share'
import { RESTAURANTS, isRestaurantId, isScheduleOnlyRestaurant } from '@/data/restaurants'
import { useManagerCode } from './DemoGate'
import PublishPanel from './PublishPanel'
import { DragState, DropFeedback, EmployeeDraft, GenerationReport, HistorySnapshot, MovePreview, ScheduleVariant, ShiftKey, StaffSnapshot, UNDO_LIMIT, WeekAssignments, allDays, assignmentFingerprint, blankDraft, buildFixIssues, buildMovePreview, candidatesForSlot, changesSince, cloneAssignmentList, cloneEmployeeList, cloneEmployees, cloneTemplate, cloneWeeks, createEmployeeId, diagnosticLabel, emptyAssignments, formatReportTime, fullDay, gapAvailability, onboardingStorageKey, proposeMovedAssignments, readOnboardingDismissed, readStaffSnapshots, roleLabel, rolesInUse, scheduleVariants, snapshotStorageKey, statusForWeek, unassignableReason, uniqueMessages } from './helpers'
import { Button, Disclosure, Icon, IconButton, PublishStateBadge } from './ui'
import { EmployeeCard, EmployeeForm } from './StaffEditor'
import { TemplateEditor } from './RulesEditor'
import { WeeklyScheduleBoard } from './ScheduleBoard'
import { GenerationReportBanner, GuidedFixPanel, HoursSummary, MonthStrip, OnboardingBanner } from './SchedulePanels'
export default function SchedulerDemo({ restaurantId }: { restaurantId?: string } = {}) {
  const restaurantName = restaurantId && isRestaurantId(restaurantId) ? RESTAURANTS[restaurantId].name : null
  // Schedule-only stations (CR3 Kitchen) ship a built-in crew and default rules.
  // The crew (`/api/staff`) is one per station, shared by every week, with the
  // last saved change undoable; the rules are per-week like other stations.
  // Both stay read-only until the staff password is entered on the Staff tab.
  const scheduleOnly = isScheduleOnlyRestaurant(restaurantId)
  const [weekStart, setWeekStart] = useState('')
  const [weeks, setWeeks] = useState<WeekAssignments>({})
  const [generatedWeeks, setGeneratedWeeks] = useState<WeekAssignments>({})
  const [weekStatus, setWeekStatus] = useState<Record<string, WeekStatus>>({})
  // Staff lists and shift rules are per-week. Each weekStart gets its own roster
  // and template so edits to week 1 never bleed into week 2. The global docs on
  // the server act as the seed for weeks that have never been customized.
  const [rosters, setRosters] = useState<Record<string, Employee[]>>({})
  const [rosterRevs, setRosterRevs] = useState<Record<string, number>>({})
  const [rosterSnapshots, setRosterSnapshots] = useState<Record<string, string | null>>({})
  const [rosterUpdatedAts, setRosterUpdatedAts] = useState<Record<string, string | null>>({})
  const [rosterLoadedWeeks, setRosterLoadedWeeks] = useState<Record<string, boolean>>({})
  const [defaultRoster, setDefaultRoster] = useState<Employee[]>(() => cloneEmployees(restaurantId))
  const [defaultRosterLoaded, setDefaultRosterLoaded] = useState(false)
  const [defaultRosterRev, setDefaultRosterRev] = useState(0)
  const [templates, setTemplates] = useState<Record<string, WeeklyStaffingTemplate>>({})
  const [templateRevs, setTemplateRevs] = useState<Record<string, number>>({})
  const [templateSnapshots, setTemplateSnapshots] = useState<Record<string, string | null>>({})
  const [templateUpdatedAts, setTemplateUpdatedAts] = useState<Record<string, string | null>>({})
  const [templateLoadedWeeks, setTemplateLoadedWeeks] = useState<Record<string, boolean>>({})
  const [defaultTemplate, setDefaultTemplate] = useState<WeeklyStaffingTemplate>(() => cloneTemplate(undefined, restaurantId))
  const [defaultTemplateLoaded, setDefaultTemplateLoaded] = useState(false)
  const [defaultTemplateRev, setDefaultTemplateRev] = useState(0)
  // Editable crew for schedule-only stations. `staffDraft` is null until the
  // saved crew loads; until then the built-in crew shows.
  const [staffDraft, setStaffDraft] = useState<Employee[] | null>(null)
  const [staffLoaded, setStaffLoaded] = useState(false)
  const [staffRev, setStaffRev] = useState(0)
  const [staffCanUndo, setStaffCanUndo] = useState(false)
  const [staffUpdatedAt, setStaffUpdatedAt] = useState<string | null>(null)
  const [staffBaseline, setStaffBaseline] = useState<string | null>(null)
  // The staff password, once accepted, for this page view only — never stored. It is the editing
  // privilege for CR3 Kitchen's crew and rules; the manager code alone does not unlock them.
  const [staffPassword, setStaffPassword] = useState('')
  const staffUnlocked = staffPassword !== ''
  const [passwordInput, setPasswordInput] = useState('')
  const [checkingPassword, setCheckingPassword] = useState(false)
  const [staffLoadError, setStaffLoadError] = useState('')
  const employees = scheduleOnly
    ? staffDraft ?? defaultRoster
    : weekStart
      ? rosters[weekStart] ?? defaultRoster
      : defaultRoster
  const template = weekStart ? (templates[weekStart] ?? defaultTemplate) : defaultTemplate
  const rosterRev = weekStart ? (rosterRevs[weekStart] ?? 0) : 0
  const rosterServerSnapshot = weekStart ? (rosterSnapshots[weekStart] ?? null) : null
  const rosterUpdatedAt = weekStart ? (rosterUpdatedAts[weekStart] ?? null) : null
  const templateRev = weekStart ? (templateRevs[weekStart] ?? 0) : 0
  const templateServerSnapshot = weekStart ? (templateSnapshots[weekStart] ?? null) : null
  const templateUpdatedAt = weekStart ? (templateUpdatedAts[weekStart] ?? null) : null
  const rosterLoaded = Boolean(weekStart && defaultRosterLoaded && rosterLoadedWeeks[weekStart])
  const templateLoaded = Boolean(weekStart && defaultTemplateLoaded && templateLoadedWeeks[weekStart])

  function setEmployees(next: Employee[] | ((current: Employee[]) => Employee[])) {
    if (scheduleOnly) {
      setStaffDraft((current) => {
        const base = current ?? defaultRoster
        return typeof next === 'function' ? (next as (c: Employee[]) => Employee[])(base) : next
      })
      return
    }
    const target = weekStart
    if (!target) return
    setRosters((current) => {
      const existing = current[target] ?? defaultRoster
      const value = typeof next === 'function' ? (next as (c: Employee[]) => Employee[])(existing) : next
      return { ...current, [target]: value }
    })
  }

  function setTemplate(next: WeeklyStaffingTemplate | ((current: WeeklyStaffingTemplate) => WeeklyStaffingTemplate)) {
    const target = weekStart
    if (!target) return
    setTemplates((current) => {
      const existing = current[target] ?? defaultTemplate
      const value = typeof next === 'function' ? (next as (c: WeeklyStaffingTemplate) => WeeklyStaffingTemplate)(existing) : next
      return { ...current, [target]: value }
    })
  }

  function setRosterSaved(target: string, rev: number, updatedAt: string | null, snapshot: string) {
    setRosterRevs((current) => ({ ...current, [target]: rev }))
    setRosterSnapshots((current) => ({ ...current, [target]: snapshot }))
    setRosterUpdatedAts((current) => ({ ...current, [target]: updatedAt }))
  }

  /** Gives a week its own staff list and rules — a copy of the ones passed — unless it already has them. */
  function seedWeek(target: string, roster: Employee[] | null, rules: WeeklyStaffingTemplate | null) {
    if (roster) setRosters((current) => (current[target] ? current : { ...current, [target]: cloneEmployeeList(roster) }))
    if (rules) setTemplates((current) => (current[target] ? current : { ...current, [target]: cloneTemplate(rules) }))
  }

  function setTemplateSaved(target: string, rev: number, updatedAt: string | null, snapshot: string) {
    setTemplateRevs((current) => ({ ...current, [target]: rev }))
    setTemplateSnapshots((current) => ({ ...current, [target]: snapshot }))
    setTemplateUpdatedAts((current) => ({ ...current, [target]: updatedAt }))
  }
  const [monthKey, setMonthKey] = useState('')
  const [diagnostics, setDiagnostics] = useState<string[]>([])
  const [draft, setDraft] = useState<EmployeeDraft>(() => blankDraft(defaultRoleForRestaurant(restaurantId), allDays([fullDay]), rolesForRestaurant(restaurantId)))
  const [employeePanelOpen, setEmployeePanelOpen] = useState(false)
  const [openShiftKey, setOpenShiftKey] = useState<ShiftKey | null>(null)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [moveSource, setMoveSource] = useState<DragState | null>(null)
  const [dragOverSlotId, setDragOverSlotId] = useState<string | null>(null)
  const [dropFeedback, setDropFeedback] = useState<DropFeedback>(null)
  const [history, setHistory] = useState<HistorySnapshot[]>([])
  const [ignoredIssueIds, setIgnoredIssueIds] = useState<string[]>([])
  const [guidedChoosing, setGuidedChoosing] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [staffQuery, setStaffQuery] = useState('')
  const [selectedVariant, setSelectedVariant] = useState<ScheduleVariant>('balanced')
  const [tab, setTab] = useState<'schedule' | 'staff' | 'rules'>('schedule')
  const [isGenerating, setIsGenerating] = useState(false)
  const [lastReport, setLastReport] = useState<GenerationReport | null>(null)
  const reportId = useRef(0)
  const [onboardingDismissed, setOnboardingDismissed] = useState(true)
  const [rosterLoadError, setRosterLoadError] = useState('')
  const [confirmingClearStaff, setConfirmingClearStaff] = useState(false)
  const [staffSnapshots, setStaffSnapshots] = useState<StaffSnapshot[]>([])
  const [snapshotName, setSnapshotName] = useState('')
  // Before the first server response arrives the editor only holds the built-in
  // seeds. Treat dirty as false until loaded so Publish never tries to save
  // seeds over live data with a stale rev.
  const rosterDirty = scheduleOnly
    ? false
    : !rosterLoaded
      ? false
      : rosterServerSnapshot === null
        ? rosterFingerprint(employees) !== rosterFingerprint(defaultRoster)
        : rosterFingerprint(employees) !== rosterServerSnapshot
  // Crew edits for schedule-only stations compare against the last saved crew.
  const staffDirty =
    scheduleOnly && staffLoaded && staffDraft !== null && staffBaseline !== null
      ? staffFingerprint(staffDraft) !== staffBaseline
      : false
  const [templateLoadError, setTemplateLoadError] = useState('')
  const [confirmingClearWeek, setConfirmingClearWeek] = useState(false)
  const [publishedWeeks, setPublishedWeeks] = useState<Record<string, GoldenWeekDoc | null>>({})
  const [hydratedWeeks, setHydratedWeeks] = useState<Record<string, boolean>>({})
  // Who works where as last loaded from or published to the server, per week — the bar for "unpublished edits".
  const [publishedBaselines, setPublishedBaselines] = useState<Record<string, string>>({})
  const [layoutMismatchWeeks, setLayoutMismatchWeeks] = useState<Record<string, boolean>>({})
  const [liveMonthWeeks, setLiveMonthWeeks] = useState<Record<string, boolean>>({})
  const [copyingPrior, setCopyingPrior] = useState(false)
  const managerCode = useManagerCode()
  const [savingSetup, setSavingSetup] = useState(false)
  const [setupError, setSetupError] = useState('')
  const [setupNotice, setSetupNotice] = useState('')
  const templateDirty = !templateLoaded
      ? false
      : templateServerSnapshot === null
        ? templateFingerprint(template) !== templateFingerprint(defaultTemplateForRestaurant(restaurantId))
        : templateFingerprint(template) !== templateServerSnapshot
  const isDefaultRoster = useMemo(
    () => rosterFingerprint(employees) === rosterFingerprint(defaultEmployeesForRestaurant(restaurantId)),
    [employees, restaurantId],
  )
  const isDefaultTemplate = useMemo(
    () => templateFingerprint(template) === templateFingerprint(defaultTemplateForRestaurant(restaurantId)),
    [template, restaurantId],
  )
  // Posts offered on this page: kitchen pages show kitchen posts only, plus any
  // custom post already used by this week's staff or rules so nothing disappears.
  const availableRoles = useMemo(() => rolesInUse(employees, template, restaurantId), [employees, template, restaurantId])
  const assignments = weeks[weekStart] ?? emptyAssignments
  const generatedAssignments = generatedWeeks[weekStart] ?? emptyAssignments
  const weekVisibility = weekStart ? statusForWeek(weekStatus, weekStart, assignments) : 'off'
  const monthWeeks = monthKey ? weeksForMonth(monthKey) : []

  function setAssignments(next: ScheduleAssignment[] | ((current: ScheduleAssignment[]) => ScheduleAssignment[])) {
    setWeeks((current) => {
      const existing = current[weekStart] ?? emptyAssignments
      return { ...current, [weekStart]: typeof next === 'function' ? next(existing) : next }
    })
  }

  function setGeneratedAssignments(next: ScheduleAssignment[]) {
    setGeneratedWeeks((current) => ({ ...current, [weekStart]: next }))
  }

  const slots = useMemo(() => expandTemplate(template, weekStart || undefined), [template, weekStart])
  const ruleProblems = useMemo(() => templateProblems(template), [template])
  // Readiness matches the solver: optional spots (not yet hired) never block the week.
  const readinessProblems = useMemo(
    () => preflightDiagnostics(employees, slots.filter((slot) => slot.required)),
    [employees, slots],
  )
  const firstGap = readinessProblems.find((problem) => problem.day && problem.period && problem.role)
  const gapSlot = useMemo(
    () =>
      firstGap
        ? slots.find((slot) => slot.day === firstGap.day && slot.period === firstGap.period && slot.role === firstGap.role)
        : undefined,
    [firstGap, slots],
  )
  const violations = useMemo(
    () =>
      validateSchedule({
        employees,
        slots,
        assignments: assignments.filter((assignment) => assignment.employeeId),
        requireCoverage: assignments.length > 0,
      }),
    [assignments, employees, slots],
  )
  const stats = useMemo(() => calculateScheduleStats(employees, slots, assignments), [assignments, employees, slots])
  const assignmentMap = useMemo(
    () => new Map(assignments.map((assignment) => [assignment.slotId, assignment])),
    [assignments],
  )
  const activeMove = dragState ?? moveSource
  const movePreviews = useMemo(() => {
    const previews = new Map<string, MovePreview>()
    if (!activeMove) return previews
    for (const slot of slots) {
      const preview = buildMovePreview({ move: activeMove, targetSlotId: slot.id, employees, slots, assignments, assignmentMap, weekStart })
      if (preview) previews.set(slot.id, preview)
    }
    return previews
  }, [activeMove, assignmentMap, assignments, employees, slots, weekStart])
  const movingEmployee = employees.find((employee) => employee.id === moveSource?.employeeId)

  const fixIssues = useMemo(
    () => buildFixIssues(readinessProblems, violations, slots, employees, weekStart, assignments),
    [assignments, employees, readinessProblems, slots, violations, weekStart],
  )
  const visibleFixIssues = fixIssues.filter((issue) => !ignoredIssueIds.includes(issue.id))
  const nextIssue = visibleFixIssues[0]
  const highlightedSlotIds = useMemo(() => {
    const ids = new Set<string>()
    if (nextIssue?.slot) ids.add(nextIssue.slot.id)
    if (nextIssue?.relatedSlot) ids.add(nextIssue.relatedSlot.id)
    return ids
  }, [nextIssue])
  const changes = useMemo(
    () => changesSince(generatedAssignments, assignments, slots, employees, weekStart),
    [assignments, employees, generatedAssignments, slots, weekStart],
  )
  const changedSlotIds = useMemo(() => new Set(changes.map((change) => change.slotId)), [changes])
  const fixCandidates = useMemo(
    () =>
      nextIssue?.slot
        ? candidatesForSlot({ slot: nextIssue.slot, employees, slots, assignments })
        : [],
    [assignments, employees, nextIssue, slots],
  )
  const fixExcluded = useMemo(() => {
    if (!nextIssue?.slot) return [] as { employee: Employee; reason: string }[]
    const candidateIds = new Set(fixCandidates.map((candidate) => candidate.id))
    return employees
      .filter((employee) => !candidateIds.has(employee.id))
      .map((employee) => ({
        employee,
        reason:
          unassignableReason({ slot: nextIssue.slot as StaffingSlot, employee, employees, slots, assignments }) ??
          'not available',
      }))
  }, [assignments, employees, fixCandidates, nextIssue, slots])
  const ignoredCount = fixIssues.filter((issue) => ignoredIssueIds.includes(issue.id)).length
  const activeEmployeeCount = employees.filter((employee) => employee.active).length
  const keptCount = assignments.filter((assignment) => assignment.locked && assignment.employeeId).length
  // Only empty required spots block printing — warnings the fix panel lets you skip never do.
  const schedulePassing = assignments.length > 0 && !violations.some((violation) => violation.code === 'missing_assignment')
  const publishedDoc = weekStart ? publishedWeeks[weekStart] : undefined
  const currentPublishState: PublishState | null =
    publishedDoc === undefined
      ? null
      : publishState({
          published: publishedDoc,
          fingerprintOnScreen: publishedWeekFingerprint(
            buildPublishedWeek({ weekStart, name: '', slots, employees, assignments }),
          ),
          publishedFingerprint: publishedDoc ? publishedWeekFingerprint(publishedDoc.week) : null,
          visibleOnScreen: weekVisibility === 'on',
        })
  const otherWeeksWithEdits = Object.keys(weeks).filter(
    (week) => week !== weekStart && assignmentFingerprint(weeks[week] ?? []) !== (publishedBaselines[week] ?? ''),
  )
  // Edits made on this screen since the week was loaded or published — not drift in the staff list.
  const currentWeekUnpublished =
    Boolean(weekStart) &&
    (assignmentFingerprint(assignments) !== (publishedBaselines[weekStart] ?? '') ||
      Boolean(publishedDoc && publishedDoc.visible !== (weekVisibility === 'on')))
  const hasUnsavedWork =
    currentWeekUnpublished || otherWeeksWithEdits.length > 0 || rosterDirty || templateDirty || staffDirty
  const selectedRoles = availableRoles.filter((role) => draft.roles[role])
  const canAddEmployee = draft.name.trim().length > 0 && (selectedRoles.length > 0 || draft.newHire)

  function addCustomRoleToDraft(raw: string) {
    const slug = normalizeRoleSlug(raw)
    if (!slug) return
    setDraft((current) => ({ ...current, roles: { ...current.roles, [slug]: true } }))
  }

  useEffect(() => {
    // The date has to wait for the browser: this page is prerendered,
    // so reading it during render would not match the HTML that shipped.
    // Drafts live only in memory now; the Worker store is the source of truth.
    const start = currentWeekStart()
    setWeekStart(start)
    setMonthKey(monthKeyForWeek(start))
    setOnboardingDismissed(readOnboardingDismissed())
  }, [])

  useEffect(() => {
    setRosters({})
    setRosterRevs({})
    setRosterSnapshots({})
    setRosterUpdatedAts({})
    setRosterLoadedWeeks({})
    setDefaultRoster(cloneEmployees(restaurantId))
    setDefaultRosterLoaded(false)
    setDefaultRosterRev(0)
    setTemplates({})
    setTemplateRevs({})
    setTemplateSnapshots({})
    setTemplateUpdatedAts({})
    setTemplateLoadedWeeks({})
    setDefaultTemplate(cloneTemplate(undefined, restaurantId))
    setDraft(blankDraft(defaultRoleForRestaurant(restaurantId), allDays([fullDay]), rolesForRestaurant(restaurantId)))
    setDefaultTemplateLoaded(false)
    setDefaultTemplateRev(0)
    setWeeks({})
    setGeneratedWeeks({})
    setWeekStatus({})
    setDiagnostics([])
    setIgnoredIssueIds([])
    setGuidedChoosing(false)
    setSharing(false)
    setPublishedWeeks({})
    setHydratedWeeks({})
    setConfirmingClearStaff(false)
    setConfirmingClearWeek(false)
    setSnapshotName('')
    setStaffSnapshots(readStaffSnapshots(restaurantId))
    setStaffDraft(null)
    setStaffLoaded(false)
    setStaffRev(0)
    setStaffCanUndo(false)
    setStaffUpdatedAt(null)
    setStaffBaseline(null)
    setStaffPassword('')
    setStaffLoadError('')
  }, [restaurantId])

  useEffect(() => {
    let cancelled = false
    setRosterLoadError('')
    setDefaultRosterLoaded(false)
    if (scheduleOnly) {
      setDefaultRosterRev(0)
      setDefaultRosterLoaded(true)
      return
    }
    fetchRoster(managerCode, restaurantId)
      .then((doc) => {
        if (cancelled) return
        if (doc.rev > 0 && doc.employees.length > 0) {
          setDefaultRoster(doc.employees as Employee[])
        }
        setDefaultRosterRev(doc.rev)
        setDefaultRosterLoaded(true)
      })
      .catch(() => {
        if (!cancelled) {
          setRosterLoadError('Could not reach the server. Showing the starting staff list, not your saved one — do not save over it.')
          setDefaultRosterLoaded(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [restaurantId, scheduleOnly, managerCode])

  // Schedule-only crew: load the saved crew (one per station, shared by every
  // week). No saved crew yet means the built-in seed, which stays editable.
  useEffect(() => {
    if (!scheduleOnly) return
    let cancelled = false
    setStaffLoadError('')
    setStaffLoaded(false)
    fetchStaff(managerCode, restaurantId)
      .then((doc) => {
        if (cancelled) return
        // `null` means no crew saved yet; an empty array is a deliberately empty crew.
        const seed = doc.employees === null ? cloneEmployees(restaurantId) : (doc.employees as Employee[])
        setStaffDraft(cloneEmployeeList(seed))
        setStaffBaseline(staffFingerprint(seed))
        setStaffRev(doc.rev)
        setStaffCanUndo(doc.canUndo)
        setStaffUpdatedAt(doc.updatedAt)
        setStaffLoaded(true)
      })
      .catch(() => {
        if (cancelled) return
        const seed = cloneEmployees(restaurantId)
        setStaffDraft(seed)
        setStaffBaseline(staffFingerprint(seed))
        setStaffLoadError('Could not reach the server. Showing the starting crew, not your saved one — do not save over it.')
        setStaffLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [restaurantId, scheduleOnly, managerCode])

  useEffect(() => {
    let cancelled = false
    setTemplateLoadError('')
    setDefaultTemplateLoaded(false)
    if (scheduleOnly) {
      setDefaultTemplateRev(0)
      setDefaultTemplateLoaded(true)
      return
    }
    fetchTemplate(restaurantId)
      .then((doc) => {
        if (cancelled) return
        if (doc.rev > 0 && doc.template) {
          setDefaultTemplate(doc.template)
        }
        setDefaultTemplateRev(doc.rev)
        setDefaultTemplateLoaded(true)
      })
      .catch(() => {
        if (!cancelled) {
          setTemplateLoadError('Could not reach the server. Showing the starting shift rules, not your saved ones — do not save over them.')
          setDefaultTemplateLoaded(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [restaurantId, scheduleOnly])

  useEffect(() => {
    if (!weekStart || !defaultRosterLoaded || rosterLoadedWeeks[weekStart]) return
    let cancelled = false
    if (scheduleOnly) {
      setRosterLoadedWeeks((current) => ({ ...current, [weekStart]: true }))
      return
    }
    fetchRoster(managerCode, restaurantId, weekStart)
      .then((doc) => {
        if (cancelled) return
        if (doc.rev > 0) {
          setRosters((current) => ({ ...current, [weekStart]: cloneEmployeeList(doc.employees as Employee[]) }))
          setRosterRevs((current) => ({ ...current, [weekStart]: doc.rev }))
          setRosterSnapshots((current) => ({ ...current, [weekStart]: rosterFingerprint(doc.employees as Employee[]) }))
          setRosterUpdatedAts((current) => ({ ...current, [weekStart]: doc.updatedAt }))
        } else {
          seedWeek(weekStart, doc.employees.length > 0 ? (doc.employees as Employee[]) : defaultRoster, null)
          setRosterRevs((current) => (current[weekStart] !== undefined ? current : { ...current, [weekStart]: 0 }))
          setRosterSnapshots((current) => (current[weekStart] !== undefined ? current : { ...current, [weekStart]: null }))
          setRosterUpdatedAts((current) => (current[weekStart] !== undefined ? current : { ...current, [weekStart]: null }))
        }
        setRosterLoadedWeeks((current) => ({ ...current, [weekStart]: true }))
      })
      .catch(() => {
        if (cancelled) return
        seedWeek(weekStart, defaultRoster, null)
        setRosterLoadedWeeks((current) => ({ ...current, [weekStart]: true }))
        setRosterLoadError('Could not reach the server. Showing the starting staff list, not your saved one — do not save over it.')
      })
    return () => {
      cancelled = true
    }
  }, [weekStart, restaurantId, defaultRosterLoaded, defaultRoster, rosterLoadedWeeks, scheduleOnly, managerCode])

  useEffect(() => {
    if (!weekStart || !defaultTemplateLoaded || templateLoadedWeeks[weekStart]) return
    let cancelled = false
    fetchTemplate(restaurantId, weekStart)
      .then((doc) => {
        if (cancelled) return
        if (doc.rev > 0 && doc.template) {
          setTemplates((current) => ({ ...current, [weekStart]: cloneTemplate(doc.template as WeeklyStaffingTemplate) }))
          setTemplateRevs((current) => ({ ...current, [weekStart]: doc.rev }))
          setTemplateSnapshots((current) => ({ ...current, [weekStart]: templateFingerprint(doc.template as WeeklyStaffingTemplate) }))
          setTemplateUpdatedAts((current) => ({ ...current, [weekStart]: doc.updatedAt }))
        } else {
          seedWeek(weekStart, null, (doc.template as WeeklyStaffingTemplate | null) ?? defaultTemplate)
          setTemplateRevs((current) => (current[weekStart] !== undefined ? current : { ...current, [weekStart]: 0 }))
          setTemplateSnapshots((current) => (current[weekStart] !== undefined ? current : { ...current, [weekStart]: null }))
          setTemplateUpdatedAts((current) => (current[weekStart] !== undefined ? current : { ...current, [weekStart]: null }))
        }
        setTemplateLoadedWeeks((current) => ({ ...current, [weekStart]: true }))
      })
      .catch(() => {
        if (cancelled) return
        seedWeek(weekStart, null, defaultTemplate)
        setTemplateLoadedWeeks((current) => ({ ...current, [weekStart]: true }))
        setTemplateLoadError('Could not reach the server. Showing the starting shift rules, not your saved ones — do not save over them.')
      })
    return () => {
      cancelled = true
    }
  }, [weekStart, restaurantId, defaultTemplateLoaded, defaultTemplate, templateLoadedWeeks])

  useEffect(() => {
    if (!weekStart) return
    let cancelled = false
    fetchGoldenWeek(weekStart, restaurantId)
      .then((doc) => {
        if (cancelled) return
        setPublishedWeeks((current) => ({ ...current, [weekStart]: doc }))
        if (doc) {
          setWeekStatus((current) =>
            current[weekStart] ? current : { ...current, [weekStart]: doc.visible ? 'on' : 'off' },
          )
        }
      })
      .catch(() => {
        if (!cancelled) setPublishedWeeks((current) => (current[weekStart] === undefined ? current : current))
      })
    return () => {
      cancelled = true
    }
  }, [weekStart, restaurantId])

  useEffect(() => {
    if (!weekStart || !rosterLoaded || !templateLoaded || hydratedWeeks[weekStart]) return
    const doc = publishedWeeks[weekStart]
    if (doc === undefined || doc === null) return
    if ((weeks[weekStart]?.length ?? 0) > 0) {
      setHydratedWeeks((current) => ({ ...current, [weekStart]: true }))
      return
    }
    if (templateHashForSlots(slots) !== doc.templateHash) {
      setHydratedWeeks((current) => ({ ...current, [weekStart]: true }))
      setLayoutMismatchWeeks((current) => ({ ...current, [weekStart]: true }))
      return
    }
    const hydrated = assignmentsFromPublishedWeek({ slots, employees, published: doc.week })
    setPublishedBaselines((current) => ({ ...current, [weekStart]: assignmentFingerprint(hydrated) }))
    setWeeks((current) => (current[weekStart] ? current : { ...current, [weekStart]: hydrated }))
    setGeneratedWeeks((current) =>
      current[weekStart] ? current : { ...current, [weekStart]: hydrated.map((assignment) => ({ ...assignment })) },
    )
    setHydratedWeeks((current) => ({ ...current, [weekStart]: true }))
    if (hydrated.length > 0) {
      setDiagnostics((current) => [...current, 'Loaded the published week from the server.'])
    }
  }, [weekStart, restaurantId, rosterLoaded, templateLoaded, publishedWeeks, hydratedWeeks, slots, employees, weeks])

  useEffect(() => {
    if (!monthKey) return
    let cancelled = false
    // The month list only returns weeks staff can see — that is what "Live" means in the week strip.
    fetchGoldenMonth(monthKey, 0, restaurantId)
      .then((month) => {
        if (cancelled) return
        setLiveMonthWeeks((current) => {
          const next = { ...current }
          for (const week of weeksForMonth(monthKey)) next[week] = month.weeks.some((doc) => doc.weekStart === week)
          return next
        })
      })
      .catch(() => {
        return
      })
    return () => {
      cancelled = true
    }
  }, [monthKey, restaurantId])

  // Closing the tab, reloading, or following a link drops every edit that is not published or saved.
  useEffect(() => {
    if (!hasUnsavedWork) return
    const message = 'You have changes that are not published or saved. Leave anyway?'
    function warnOnUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }
    // In-app links swap the page without an unload, so they need their own check.
    function warnOnLink(event: MouseEvent) {
      const link = (event.target as Element | null)?.closest?.('a[href]')
      if (!link || link.getAttribute('target') === '_blank' || event.defaultPrevented) return
      const href = link.getAttribute('href') ?? ''
      if (href.startsWith('#') || href.startsWith('sms:') || href.startsWith('mailto:')) return
      if (!window.confirm(message)) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', warnOnUnload)
    document.addEventListener('click', warnOnLink, true)
    return () => {
      window.removeEventListener('beforeunload', warnOnUnload)
      document.removeEventListener('click', warnOnLink, true)
    }
  }, [hasUnsavedWork])

  function dismissOnboarding() {
    setOnboardingDismissed(true)
    try {
      window.localStorage.setItem(onboardingStorageKey, '1')
    } catch {
      return
    }
  }

  useEffect(() => {
    if (!dragState && !moveSource) return
    function cancelOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setDragState(null)
        setMoveSource(null)
        setDragOverSlotId(null)
      }
    }
    window.addEventListener('keydown', cancelOnEscape)
    return () => window.removeEventListener('keydown', cancelOnEscape)
  }, [dragState, moveSource])

  // Ctrl/Cmd+Z undoes the last change — but never while typing, where the browser's own undo applies.
  const undoRef = useRef(undoLastChange)
  undoRef.current = undoLastChange
  useEffect(() => {
    function undoOnShortcut(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.key.toLowerCase() !== 'z') return
      const target = event.target as HTMLElement | null
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return
      event.preventDefault()
      undoRef.current()
    }
    window.addEventListener('keydown', undoOnShortcut)
    return () => window.removeEventListener('keydown', undoOnShortcut)
  }, [])

  const staffStatsById = useMemo(() => new Map(stats.map((stat) => [stat.employeeId, stat])), [stats])
  const filteredEmployees = useMemo(() => {
    const query = staffQuery.trim().toLowerCase()
    if (!query) return employees
    return employees.filter(
      (employee) =>
        employee.name.toLowerCase().includes(query) ||
        employee.roles.some((role) => roleLabel(role).toLowerCase().includes(query)),
    )
  }, [employees, staffQuery])

  // Messages, skipped issues and an open shift all describe the week that was on screen.
  // Staff and rules travel with the week: opening a week with no saved list yet
  // copies the list and rules from the week being left, so week 1 (11 staff) and
  // week 2 (12 staff) stay independent.
  function goToWeek(nextWeekStart: string) {
    if (!nextWeekStart || nextWeekStart === weekStart) return
    const fromWeek = weekStart
    if (fromWeek) {
      seedWeek(nextWeekStart, rosters[fromWeek] ?? defaultRoster, templates[fromWeek] ?? defaultTemplate)
      setRosterRevs((current) => (current[nextWeekStart] !== undefined ? current : { ...current, [nextWeekStart]: 0 }))
      setTemplateRevs((current) => (current[nextWeekStart] !== undefined ? current : { ...current, [nextWeekStart]: 0 }))
    }
    setWeekStart(nextWeekStart)
    setMonthKey(monthKeyForWeek(nextWeekStart))
    setDiagnostics([])
    setLastReport(null)
    setIgnoredIssueIds([])
    setGuidedChoosing(false)
    setSharing(false)
    setConfirmingReset(false)
    setOpenShiftKey(null)
    setDropFeedback(null)
    setMoveSource(null)
    setDragState(null)
    setDragOverSlotId(null)
    setConfirmingClearWeek(false)
  }

  function goToMonth(nextMonth: string) {
    if (!nextMonth || nextMonth === monthKey) return
    setMonthKey(nextMonth)
    // The first row usually starts last month; opening it would move the month back again.
    const monthWeeks = weeksForMonth(nextMonth)
    const firstWeek = monthWeeks.find((week) => monthKeyForWeek(week) === nextMonth) ?? monthWeeks[0]
    if (firstWeek) goToWeek(firstWeek)
  }

  function setWeekVisibility(targetWeek: string, status: WeekStatus) {
    if (!targetWeek) return
    remember(status === 'on' ? 'turned a week on' : 'turned a week off')
    setWeekStatus((current) => ({ ...current, [targetWeek]: status }))
    setDiagnostics([
      status === 'on'
        ? 'That week will show to staff once you publish it.'
        : 'That week will be hidden from staff once you publish it.',
    ])
  }

  /**
   * Last week's assignments — from this session if it was opened, else from what was published.
   * Read against last week's own rules so a rules change in between cannot misfile anyone.
   */
  async function loadPriorWeek(prior: string): Promise<ScheduleAssignment[]> {
    const inMemory = weeks[prior]
    if (inMemory && inMemory.length > 0) return inMemory
    const doc = await fetchGoldenWeek(prior, restaurantId)
    if (!doc) return []
    const savedRules = templates[prior] ?? (await fetchTemplate(restaurantId, prior).then((found) => found.template))
    const { slots: priorSlots, matches } = layoutForWeek([savedRules], restaurantId, doc.templateHash)
    if (!matches) return []
    const priorAssignments = assignmentsFromPublishedWeek({ slots: priorSlots, employees, published: doc.week })
    // Only spots that still exist this week can be copied.
    const slotIds = new Set(slots.map((slot) => slot.id))
    return priorAssignments.filter((assignment) => slotIds.has(assignment.slotId))
  }

  async function copyPriorWeek() {
    if (!weekStart || copyingPrior) return
    const prior = shiftWeek(weekStart, -1)
    setCopyingPrior(true)
    let source: ScheduleAssignment[]
    try {
      source = await loadPriorWeek(prior)
    } catch {
      setDiagnostics(['Could not load last week from the server. Check the connection and try again.'])
      return
    } finally {
      setCopyingPrior(false)
    }
    if (source.length === 0) {
      setDiagnostics(['Last week has nothing to copy — it was never made or published.'])
      return
    }
    remember('copied the prior week')
    setWeeks((current) => ({ ...current, [weekStart]: cloneAssignmentList(source) }))
    setWeekStatus((current) => ({ ...current, [weekStart]: 'on' }))
    if (!scheduleOnly) {
      const priorRoster = rosters[prior]
      if (priorRoster) {
        setRosters((current) => ({ ...current, [weekStart]: cloneEmployeeList(priorRoster) }))
      }
    }
    const priorTemplate = templates[prior]
    if (priorTemplate) {
      setTemplates((current) => ({ ...current, [weekStart]: cloneTemplate(priorTemplate) }))
    }
    setDiagnostics([
      scheduleOnly
        ? 'Prior week copied here — schedule and rules. The saved crew stays as it is. Publish when it looks right.'
        : 'Prior week copied here — schedule, staff list, and rules. Review it, then publish when it looks right.',
    ])
  }

  function remember(label: string) {
    setHistory((current) => [
      {
        label,
        weekStart,
        employees: cloneEmployeeList(employees),
        template: cloneTemplate(template),
        weeks: cloneWeeks(weeks),
        generatedWeeks: cloneWeeks(generatedWeeks),
        weekStatus: { ...weekStatus },
        diagnostics: [...diagnostics],
      },
      // shortcut: 30 snapshots of every week in memory, fine for a manager's session; trim if weeks pile up.
      ...current.slice(0, UNDO_LIMIT - 1),
    ])
  }

  function undoLastChange() {
    const [snapshot, ...rest] = history
    if (!snapshot) return
    const target = snapshot.weekStart || weekStart
    if (scheduleOnly) {
      // One crew per station — bring back the crew as it was before the last edit.
      setStaffDraft(cloneEmployeeList(snapshot.employees))
    } else if (target) {
      setRosters((current) => ({ ...current, [target]: cloneEmployeeList(snapshot.employees) }))
    }
    if (target) setTemplates((current) => ({ ...current, [target]: cloneTemplate(snapshot.template) }))
    setWeeks(cloneWeeks(snapshot.weeks))
    setGeneratedWeeks(cloneWeeks(snapshot.generatedWeeks))
    setWeekStatus({ ...snapshot.weekStatus })
    setDiagnostics([`Undone: ${snapshot.label}.`])
    setLastReport(null)
    setHistory(rest)
    setDropFeedback(null)
    setDragState(null)
    setMoveSource(null)
    setDragOverSlotId(null)
    setConfirmingReset(false)
  }

  function restoreEverything() {
    if (generatedAssignments.length === 0) return
    remember('put the schedule back')
    setAssignments(cloneAssignmentList(generatedAssignments))
    setDropFeedback(null)
    setDiagnostics(['The schedule is back the way it was generated.'])
  }

  function restoreShift(shiftKey: ShiftKey) {
    const shiftSlotIds = new Set(
      slots.filter((slot) => `${slot.day}-${slot.period}` === shiftKey).map((slot) => slot.id),
    )
    if (shiftSlotIds.size === 0) return
    remember('put one shift back')
    setAssignments((current) => [
      ...current.filter((assignment) => !shiftSlotIds.has(assignment.slotId)),
      ...generatedAssignments.filter((assignment) => shiftSlotIds.has(assignment.slotId)).map((assignment) => ({ ...assignment })),
    ])
    setDropFeedback(null)
  }

  function openSlot(slotId?: string) {
    if (!slotId) return
    const slot = slots.find((candidate) => candidate.id === slotId)
    if (!slot) return
    setOpenShiftKey(`${slot.day}-${slot.period}`)
  }

  function addEmployeeForSlot(slot?: StaffingSlot) {
    if (slot) {
      setDraft(blankDraft(slot.role, gapAvailability(slot), availableRoles))
      setOpenShiftKey(`${slot.day}-${slot.period}`)
    } else if (firstGap?.role && gapSlot) {
      setDraft(blankDraft(firstGap.role, gapAvailability(gapSlot), availableRoles))
    } else {
      setDraft(blankDraft(defaultRoleForRestaurant(restaurantId), allDays([fullDay]), availableRoles))
    }
    setTab('staff')
    setEmployeePanelOpen(true)
  }

  function fixNextIssue() {
    if (!nextIssue) return
    setTab('schedule')
    setGuidedChoosing(true)
    openSlot(nextIssue.slot?.id)
    const shiftKey = nextIssue.slot ? `${nextIssue.slot.day}-${nextIssue.slot.period}` : null
    if (shiftKey) {
      requestAnimationFrame(() => {
        document.getElementById(`${shiftKey}-detail`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    }
  }

  // Staying in guided mode after a pick walks the manager straight to the next spot.
  function chooseForIssue(employeeId: string) {
    const slotId = nextIssue?.slot?.id
    if (!slotId) return
    setEmployeeAssignment(slotId, employeeId)
  }

  function ignoreNextIssue() {
    if (!nextIssue) return
    setIgnoredIssueIds((current) => [...current, nextIssue.id])
  }

  function showIgnoredIssues() {
    setIgnoredIssueIds([])
    setGuidedChoosing(true)
  }

  function generationMessage(variant: ScheduleVariant, summary: ReturnType<typeof summarizeSchedule>, kept: number) {
    const hours = `Hours run from ${summary.fewestHours} to ${summary.mostHours}.`

    if (variant === 'fewestDoubles') {
      return summary.doubles === 0
        ? 'Nobody works both shifts in the same day this week.'
        : `${summary.doubles} double shift${summary.doubles === 1 ? '' : 's'} left. That was the fewest possible with these rules.`
    }
    if (variant === 'similarWeek') {
      return `${summary.keptFromReference} of ${kept} spots stayed with the same person.`
    }
    if (variant === 'fairHours') {
      return `Hours evened out as far as the rules allow. ${hours}`
    }

    return `Balanced schedule made. ${hours}`
  }

  async function generate(variant: ScheduleVariant = selectedVariant) {
    if (isGenerating) return
    remember('previous schedule')
    setSelectedVariant(variant)
    setIsGenerating(true)
    setIgnoredIssueIds([])
    setGuidedChoosing(false)
    // Let the spinner paint before the synchronous solver blocks the main thread.
    await new Promise((resolve) => setTimeout(resolve, 350))
    let previousAssignments = assignments
    if (variant === 'similarWeek') {
      // Anchor to last week as published, not to whatever is on screen.
      const prior = await loadPriorWeek(shiftWeek(weekStart, -1)).catch(() => [])
      if (prior.length === 0) {
        setDiagnostics(['Last week has nothing to match yet — publish it first, or pick another way to build the week.'])
        setIsGenerating(false)
        return
      }
      previousAssignments = prior
    }
    try {
      const result = generateSchedule(
        { employees, template, weekStart },
        {
          strategy: variant,
          referenceAssignments: previousAssignments,
          existingAssignments: assignments.filter((assignment) => assignment.locked),
        },
      )

      if (result.status === 'INFEASIBLE') {
        const messages = uniqueMessages(result.diagnostics.map((diagnostic) => diagnosticLabel(diagnostic, weekStart)))
        setDiagnostics(['The schedule could not be made with these rules.', ...messages])
        reportId.current += 1
        setLastReport({
          id: reportId.current,
          at: formatReportTime(),
          variant,
          weekStart,
          status: 'failed',
          filled: 0,
          detail: messages[0] ?? 'No spots could be filled with these rules.',
        })
        return
      }

      const summary = summarizeSchedule(employees, slots, result.assignments, previousAssignments)
      const message = generationMessage(variant, summary, previousAssignments.length || result.assignments.length)
      setDiagnostics([
        message,
        ...uniqueMessages(result.diagnostics.map((diagnostic) => diagnosticLabel(diagnostic, weekStart))),
      ])
      const unchanged = assignmentFingerprint(result.assignments) === assignmentFingerprint(assignments)
      setAssignments(result.assignments)
      setGeneratedAssignments(cloneAssignmentList(result.assignments))
      setWeekStatus((current) => ({ ...current, [weekStart]: 'on' }))
      reportId.current += 1
      setLastReport({
        id: reportId.current,
        at: formatReportTime(),
        variant,
        weekStart,
        status: unchanged ? 'unchanged' : 'success',
        filled: result.assignments.length,
        detail: unchanged
          ? `Same ${result.assignments.length} spots — nothing new to show.`
          : message,
      })
    } finally {
      setIsGenerating(false)
    }
  }

  function reset() {
    // Inline confirm in the header calls this only after an explicit second click.
    // remember() keeps the pre-reset state so Undo can bring it back.
    remember('started over')
    setEmployees(cloneEmployees(restaurantId))
    setTemplate(cloneTemplate(undefined, restaurantId))
    setWeeks({})
    setGeneratedWeeks({})
    setWeekStatus({})
    setDiagnostics([])
    setLastReport(null)
    setDraft(blankDraft(defaultRoleForRestaurant(restaurantId), allDays([fullDay]), rolesForRestaurant(restaurantId)))
    setEmployeePanelOpen(false)
    setIgnoredIssueIds([])
    setGuidedChoosing(false)
    setSelectedVariant('balanced')
    setConfirmingReset(false)
  }

  function restoreDefaultRoster() {
    if (isDefaultRoster) return
    remember('restored default staff list')
    setEmployees(cloneEmployees(restaurantId))
    setIgnoredIssueIds([])
    setGuidedChoosing(false)
    setDiagnostics(['Staff list for this week restored to the built-in defaults. Save to keep it — Undo brings back your list.'])
  }

  function restoreDefaultTemplate() {
    if (isDefaultTemplate) return
    remember('restored default schedule rules')
    setTemplate(cloneTemplate(undefined, restaurantId))
    setIgnoredIssueIds([])
    setGuidedChoosing(false)
    setDiagnostics(['Schedule rules for this week restored to the built-in defaults. Save to keep them — Undo brings back your rules.'])
  }

  function startBlankStation() {
    remember('started blank station')
    setEmployees([])
    setWeeks({})
    setGeneratedWeeks({})
    setWeekStatus({})
    setIgnoredIssueIds([])
    setGuidedChoosing(false)
    setDiagnostics(['Blank staff list ready for this week. Add employees below, then save the staff list to keep it.'])
  }

  function clearWeek() {
    if (assignments.length === 0) {
      setConfirmingClearWeek(false)
      return
    }
    remember('cleared week')
    setAssignments([])
    setConfirmingClearWeek(false)
    setDiagnostics(['This week’s assignments are cleared. Undo brings them back — publishing saves the cleared week.'])
  }

  function clearStaff() {
    if (employees.length === 0) {
      setConfirmingClearStaff(false)
      return
    }
    remember('cleared staff list')
    setEmployees([])
    setConfirmingClearStaff(false)
    setEmployeePanelOpen(false)
    setIgnoredIssueIds([])
    setGuidedChoosing(false)
    setDiagnostics(['Staff list for this week cleared. Undo brings everyone back — saving the staff list makes the empty list permanent for this week.'])
  }

  useEffect(() => {
    try {
      window.localStorage.setItem(snapshotStorageKey(restaurantId), JSON.stringify(staffSnapshots))
    } catch {
      return
    }
  }, [staffSnapshots, restaurantId])

  function saveStaffSnapshot() {
    if (employees.length === 0) {
      setDiagnostics(['Add someone to the staff list before saving it as a snapshot.'])
      return
    }
    const name = snapshotName.trim() || `Snapshot ${staffSnapshots.length + 1} — ${employees.length} staff`
    const snapshot: StaffSnapshot = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      savedAt: new Date().toISOString(),
      employees: cloneEmployeeList(employees),
    }
    setStaffSnapshots((current) => [snapshot, ...current].slice(0, 10))
    setSnapshotName('')
    setDiagnostics([`Saved “${name}”. Restore it anytime from Saved staff lists.`])
  }

  function restoreStaffSnapshot(snapshot: StaffSnapshot) {
    remember(`restored snapshot ${snapshot.name}`)
    setEmployees(cloneEmployeeList(snapshot.employees))
    setIgnoredIssueIds([])
    setGuidedChoosing(false)
    setDiagnostics([`Restored “${snapshot.name}” (${snapshot.employees.length} staff). Save the staff list to keep it — Undo brings back the previous list.`])
  }

  function deleteStaffSnapshot(id: string) {
    setStaffSnapshots((current) => current.filter((snapshot) => snapshot.id !== id))
  }

  // Both revs start at 0, so require the loads to finish before calling a
  // station new — otherwise every deploy/reload flashes the new-station banner
  // with seeds while the fetch is still in flight.
  const storeLoading = !rosterLoaded || !templateLoaded
  const storeOffline = Boolean(rosterLoadError || templateLoadError)
  const isNewStation = !scheduleOnly && !storeLoading && defaultRosterRev === 0 && defaultTemplateRev === 0 && rosterRev === 0 && templateRev === 0

  function setEmployeeAssignment(slotId: string, employeeId: string) {
    remember('changed one assignment')
    setDropFeedback(null)
    setAssignments((current) => {
      const existing = current.find((assignment) => assignment.slotId === slotId)
      if (!employeeId) return current.filter((assignment) => assignment.slotId !== slotId)
      // A hand-picked person stays put when the week is made again.
      if (existing) {
        return current.map((assignment) =>
          assignment.slotId === slotId ? { ...assignment, employeeId, locked: true } : assignment,
        )
      }
      return [...current, { slotId, employeeId, locked: true }]
    })
  }

  function setLocked(slotId: string, locked: boolean) {
    remember(locked ? 'kept one assignment' : 'released one kept assignment')
    setAssignments((current) =>
      current.map((assignment) => (assignment.slotId === slotId ? { ...assignment, locked } : assignment)),
    )
  }

  function moveAssignmentTo(targetSlotId: string) {
    const move = activeMove
    setDragOverSlotId(null)
    setMoveSource(null)
    setDragState(null)
    if (!move || move.fromSlotId === targetSlotId) return
    const targetSlot = slots.find((slot) => slot.id === targetSlotId)
    const employee = employees.find((candidate) => candidate.id === move.employeeId)
    if (!targetSlot || !employee) return

    const preview = movePreviews.get(targetSlotId)
    if (!preview || preview.status === 'invalid') {
      setOpenShiftKey(`${targetSlot.day}-${targetSlot.period}`)
      setDropFeedback({ slotId: targetSlotId, message: preview?.message ?? `${employee.name} cannot move here.` })
      return
    }

    remember(`moved ${employee.name}`)
    setAssignments(proposeMovedAssignments(move, assignments, targetSlotId))
    setDropFeedback(null)
  }
  function activateSlot(slotId: string) {
    const assignment = assignmentMap.get(slotId)
    if (activeMove) {
      if (activeMove.fromSlotId === slotId) {
        cancelMove()
        return
      }
      moveAssignmentTo(slotId)
      return
    }
    if (assignment?.employeeId) {
      toggleMoveSource({ employeeId: assignment.employeeId, fromSlotId: slotId })
      return
    }
    const slot = slots.find((candidate) => candidate.id === slotId)
    if (slot) setOpenShiftKey(`${slot.day}-${slot.period}`)
  }

  function startAssignmentDrag(nextDragState: DragState) {
    setDropFeedback(null)
    setDragOverSlotId(null)
    setMoveSource(null)
    setDragState(nextDragState)
  }

  function toggleMoveSource(nextMoveSource: DragState) {
    setDropFeedback(null)
    setMoveSource((current) => (current?.fromSlotId === nextMoveSource.fromSlotId ? null : nextMoveSource))
  }

  function cancelMove() {
    setMoveSource(null)
    setDragState(null)
    setDragOverSlotId(null)
    setDropFeedback(null)
  }

  function endAssignmentDrag() {
    setDragState(null)
    setDragOverSlotId(null)
  }

  function previewDropSlot(slotId: string) {
    if (!activeMove || activeMove.fromSlotId === slotId) return
    setDragOverSlotId(slotId)
  }

  function clearDropPreview(slotId: string) {
    setDragOverSlotId((current) => (current === slotId ? null : current))
  }

  function updateEmployee(employeeId: string, update: Partial<Employee>) {
    remember('updated staff list')
    setEmployees((current) =>
      current.map((employee) => (employee.id === employeeId ? { ...employee, ...update } : employee)),
    )
  }

  function removeEmployee(employeeId: string) {
    remember('removed employee')
    setEmployees((current) => current.filter((employee) => employee.id !== employeeId))
  }

  function addEmployee() {
    if (!canAddEmployee) return
    remember('added employee')
    const employee: Employee = {
      id: createEmployeeId(draft.name, employees),
      name: draft.name.trim(),
      roles: selectedRoles,
      recurringAvailability: draft.recurringAvailability,
      maxDaysPerWeek: draft.maxDaysPerWeek,
      allowDoubles: draft.allowDoubles,
      newHire: draft.newHire,
      incompatibleEmployeeIds: [],
      active: true,
    }

    setEmployees((current) => [...current, employee])
    setDraft(
      blankDraft(
        firstGap?.role ?? selectedRoles[0] ?? defaultRoleForRestaurant(restaurantId),
        firstGap && gapSlot ? gapAvailability(gapSlot) : allDays([fullDay]),
        availableRoles,
      ),
    )
    setEmployeePanelOpen(false)
    setIgnoredIssueIds([])
    setDiagnostics([`${employee.name} was added. Make the schedule again when the staff list looks right.`])
  }

  // The saved crew echoes back from the Worker after a save/undo. `employees: null`
  // means "no saved crew", so fall back to the built-in seed.
  function applyStaffResult(result: StaffWriteResult) {
    const next = result.employees === null ? cloneEmployees(restaurantId) : result.employees
    setStaffDraft(cloneEmployeeList(next))
    setStaffBaseline(staffFingerprint(next))
    setStaffRev(result.rev)
    setStaffCanUndo(result.canUndo)
    setStaffUpdatedAt(result.updatedAt)
  }

  const setupParts = [
    rosterDirty && 'staff list',
    staffDirty && 'crew',
    templateDirty && 'shift rules',
  ].filter((part): part is string => Boolean(part))

  /**
   * Saves every unsaved part of this week's setup — staff list (or crew) and shift rules — with the
   * manager code. Publish runs this first so a reload brings back exactly what staff were sent.
   * `alsoRules` saves rules that were never saved for this week, so /schedule can read the week.
   * Returns false and shows why when anything fails; parts saved before the failure stay saved.
   */
  async function saveSetup({ alsoRules = false } = {}): Promise<boolean> {
    if (!weekStart || storeLoading) return false
    setSetupError('')
    setSetupNotice('')
    const target = weekStart
    let what = 'staff list'
    try {
      if (rosterDirty) {
        const result = await saveRoster(employees, rosterRev, managerCode, restaurantId, target)
        setRosterSaved(target, result.rev, result.updatedAt, rosterFingerprint(employees))
      }
      if (staffDirty && staffDraft) {
        what = 'crew'
        applyStaffResult(await saveStaff(staffDraft, staffRev, staffPassword, restaurantId))
      }
      if ((templateDirty || (alsoRules && templateRev === 0)) && ruleProblems.length === 0) {
        what = 'shift rules'
        // CR3 Kitchen rules are the password holder's to change; publishing a week still saves them with the manager code.
        const result = await saveTemplate(template, templateRev, scheduleOnly && staffPassword ? staffPassword : managerCode, restaurantId, target)
        setTemplateSaved(target, result.rev, result.updatedAt, templateFingerprint(template))
      }
      return true
    } catch (caught) {
      setSetupError(saveErrorMessage(caught, what))
      return false
    }
  }

  async function saveSetupNow() {
    if (savingSetup || setupParts.length === 0) return
    setSavingSetup(true)
    const saved = await saveSetup()
    setSavingSetup(false)
    if (saved) setSetupNotice(`Saved the ${setupParts.join(' and ')}.`)
  }

  async function unlockCrewEditing() {
    if (!passwordInput || checkingPassword) return
    setCheckingPassword(true)
    setSetupError('')
    try {
      await verifyStaffPassword(passwordInput, restaurantId)
      setStaffPassword(passwordInput)
      setPasswordInput('')
    } catch (caught) {
      setSetupError(saveErrorMessage(caught, 'crew').replace('That code was not accepted', 'That staff password was not accepted'))
    } finally {
      setCheckingPassword(false)
    }
  }

  async function undoCrewSave() {
    if (savingSetup || !staffCanUndo) return
    setSavingSetup(true)
    setSetupError('')
    try {
      applyStaffResult(await undoStaff(staffRev, staffPassword, restaurantId))
      setSetupNotice('Undid the last saved crew change.')
    } catch (caught) {
      setSetupError(saveErrorMessage(caught, 'crew'))
    } finally {
      setSavingSetup(false)
    }
  }

  return (
    <div className="bg-zinc-100 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-none flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {restaurantName ? `${restaurantName} · Scheduler` : 'Scheduler'}
            </p>
            <h1 className="text-2xl font-bold md:text-3xl">Weekly staff schedule</h1>
            {currentPublishState && (
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-600">
                <PublishStateBadge state={currentPublishState} />
                {otherWeeksWithEdits.length > 0 && (
                  <span>
                    {otherWeeksWithEdits.length} other week{otherWeeksWithEdits.length === 1 ? '' : 's'} with unpublished changes
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Button
              tone="primary"
              onClick={() => void generate()}
              icon="spark"
              loading={isGenerating}
              disabled={activeEmployeeCount === 0 || isGenerating}
              title={activeEmployeeCount === 0 ? 'Add someone to the staff list first.' : 'Build the week from the staff list.'}
            >
              {isGenerating ? 'Making schedule…' : 'Make schedule'}
            </Button>
            <select
              className="rounded border border-zinc-300 bg-white px-2 py-2 text-sm text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
              aria-label="How to build the week"
              value={selectedVariant}
              onChange={(event) => setSelectedVariant(event.target.value as ScheduleVariant)}
              disabled={isGenerating}
              title={`${scheduleVariants.find((variant) => variant.id === selectedVariant)?.description} Anyone marked Keep stays put.`}
            >
              {scheduleVariants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.label}
                </option>
              ))}
            </select>
            <Button onClick={fixNextIssue} icon="target" disabled={!nextIssue} badge={visibleFixIssues.length}>
              Fix next issue
            </Button>
            <Button
              onClick={() => setSharing((open) => !open)}
              icon="share"
              disabled={!weekStart || storeLoading || ruleProblems.length > 0}
              title={
                storeLoading
                  ? 'Waiting for your saved data to load.'
                  : ruleProblems.length > 0
                    ? 'Fix the shift rules marked in red first.'
                    : 'Send this week to the staff schedule page.'
              }
            >
              Publish to staff
            </Button>
            <Button
              onClick={undoLastChange}
              icon="undo"
              disabled={history.length === 0}
              title={history[0] ? `Undo ${history[0].label} (Ctrl+Z)` : 'Nothing to undo yet.'}
            >
              Undo
            </Button>
            {keptCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                <Icon name="lock" />
                Keep: {keptCount}
              </span>
            )}
            <span aria-hidden="true" className="mx-1 hidden h-8 w-px bg-zinc-200 sm:block" />
            <Disclosure summary="More actions" tone="quiet">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={() => {
                    flushSync(() => setTab('schedule'))
                    window.print()
                  }}
                  icon="print"
                  disabled={!schedulePassing}
                  title={!schedulePassing ? 'Fill every required spot before printing.' : 'Print this week.'}
                >
                  Print
                </Button>
                {confirmingReset ? (
                  <span className="inline-flex flex-wrap items-center gap-2 rounded border border-red-300 bg-red-50 px-2 py-1">
                    <span className="text-xs font-semibold text-red-900">Clear everything? You can undo.</span>
                    <button
                      type="button"
                      className="rounded bg-red-800 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                      onClick={reset}
                    >
                      Yes, start over
                    </button>
                    <button
                      type="button"
                      className="rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                      onClick={() => setConfirmingReset(false)}
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <Button onClick={() => setConfirmingReset(true)} icon="reset">
                    Start over
                  </Button>
                )}
              </div>
            </Disclosure>
          </div>
        </div>
        {activeEmployeeCount === 0 && (
          <p className="mx-auto w-full max-w-none px-4 pb-3 text-sm text-zinc-600">
            Add someone to the staff list before making a schedule.
          </p>
        )}
        <nav className="mx-auto flex w-full max-w-none gap-1 px-4 print:hidden" aria-label="Scheduler sections">
          {(
            [
              ['schedule', 'Schedule'],
              ['staff', `Staff (${activeEmployeeCount})`],
              ['rules', ruleProblems.length > 0 ? `Shift rules (${ruleProblems.length} to fix)` : 'Shift rules'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={tab === id}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 ${
                tab === id ? 'border-zinc-900 text-zinc-950' : 'border-transparent text-zinc-600 hover:text-zinc-900'
              }`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-none min-w-0 space-y-4 overflow-x-clip px-4 py-5">
          {storeLoading && (
            <section className="rounded-lg border border-zinc-300 bg-zinc-50 p-4 shadow-sm print:hidden" role="status">
              <h2 className="text-sm font-semibold text-zinc-900">Loading your saved schedule…</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Showing the starting setup until your saved staff list, rules, and published week load. Saving waits
                until they do, so nothing on the server gets overwritten.
              </p>
            </section>
          )}

          {!storeLoading && storeOffline && (
            <section className="rounded-lg border border-amber-500 bg-amber-50 p-4 shadow-sm print:hidden" role="alert">
              <h2 className="text-sm font-semibold text-amber-950">Could not reach the server</h2>
              <p className="mt-1 text-sm text-amber-900">
                What you see below is the starting setup, not your saved data — your staff, rules, and published
                weeks are still safe on the server. Do not save over them. Check your connection, then try again.
              </p>
              <button
                type="button"
                className="mt-3 inline-flex items-center gap-2 rounded border border-amber-700 bg-white px-3 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                onClick={() => window.location.reload()}
              >
                Try again
              </button>
            </section>
          )}

          {!scheduleOnly && !onboardingDismissed && assignments.length === 0 && (
            <OnboardingBanner activeEmployeeCount={activeEmployeeCount} onDismiss={dismissOnboarding} />
          )}

          {isNewStation && (
            <section className="rounded-lg border border-sky-300 bg-sky-50 p-4 shadow-sm print:hidden">
              <h2 className="text-sm font-semibold text-sky-950">New station — start from the usual China Rose setup, or blank</h2>
              <p className="mt-1 text-sm text-sky-900">
                Nothing is saved for{restaurantName ? ` ${restaurantName}` : ' this station'} yet. The list below is the usual
                setup so you have something to work from. Save to keep it, or start blank.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded border border-sky-700 bg-sky-700 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
                  onClick={() => setDiagnostics(['Starting setup kept — review the staff list, then press Save changes.'])}
                >
                  Use this setup
                </button>
                <button
                  type="button"
                  className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                  onClick={startBlankStation}
                >
                  Start blank
                </button>
              </div>
            </section>
          )}

          {sharing && weekStart && ruleProblems.length === 0 && (
            <PublishPanel
              weekStart={weekStart}
              weekLabel={formatWeekRange(weekStart)}
              slots={slots}
              employees={employees}
              assignments={assignments}
              visible={weekVisibility === 'on'}
              onVisibilityChange={(status) => setWeekVisibility(weekStart, status)}
              onClose={() => setSharing(false)}
              restaurantId={restaurantId}
              restaurantName={restaurantName ?? undefined}
              unsavedSetup={setupParts}
              onSaveSetup={() => saveSetup({ alsoRules: true })}
              onPublished={(doc) => {
                setPublishedWeeks((current) => ({ ...current, [weekStart]: doc }))
                setPublishedBaselines((current) => ({ ...current, [weekStart]: assignmentFingerprint(assignments) }))
                setLiveMonthWeeks((current) => ({ ...current, [weekStart]: doc.visible }))
                setLayoutMismatchWeeks((current) => ({ ...current, [weekStart]: false }))
              }}
            />
          )}

          {(setupParts.length > 0 || setupError || setupNotice) && (
            <section
              className={`flex flex-col gap-2 rounded-lg border p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between print:hidden ${
                setupError ? 'border-red-300 bg-red-50' : setupParts.length > 0 ? 'border-amber-400 bg-amber-50' : 'border-green-300 bg-green-50'
              }`}
              role="status"
            >
              <p className="text-sm text-zinc-900">
                {setupError ? (
                  <span className="font-medium text-red-900">{setupError}</span>
                ) : setupParts.length > 0 ? (
                  <>
                    <span className="font-semibold">Unsaved {setupParts.join(' and ')}.</span> They reset if you leave. Publishing also saves them.
                  </>
                ) : (
                  <span className="font-medium text-green-900">{setupNotice}</span>
                )}
              </p>
              {setupParts.length > 0 && (
                <Button
                  tone="primary"
                  onClick={() => void saveSetupNow()}
                  icon="check"
                  loading={savingSetup}
                  disabled={storeLoading || ruleProblems.length > 0}
                  title={ruleProblems.length > 0 ? 'Fix the shift rules marked in red first.' : undefined}
                >
                  Save changes
                </Button>
              )}
            </section>
          )}

          {diagnostics.length > 0 && (
            <div aria-live="polite" className="print:hidden">
              <Disclosure summary={`Messages (${diagnostics.length})`} tone="quiet">
                <ul className="space-y-1 text-sm text-zinc-700">
                  {diagnostics.map((message, index) => (
                    <li key={`${message}-${index}`}>{message}</li>
                  ))}
                </ul>
              </Disclosure>
            </div>
          )}

          {tab === 'schedule' && (
          <>
          <GuidedFixPanel
            nextIssue={nextIssue}
            weekStart={weekStart}
            issueCount={visibleFixIssues.length}
            totalCount={fixIssues.length}
            ignoredCount={ignoredCount}
            candidates={fixCandidates}
            excluded={fixExcluded}
            choosing={guidedChoosing}
            hasSchedule={assignments.length > 0}
            onChooseEmployee={fixNextIssue}
            onPickEmployee={chooseForIssue}
            onAddEmployee={() => addEmployeeForSlot(nextIssue?.slot)}
            onIgnore={ignoreNextIssue}
            onShowIgnored={showIgnoredIssues}
            canAddEmployee={!scheduleOnly || staffUnlocked}
          />

          <section className="min-w-0 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <MonthStrip
              monthKey={monthKey}
              weekStart={weekStart}
              monthWeeks={monthWeeks}
              weeks={weeks}
              weekStatus={weekStatus}
              onSelectWeek={goToWeek}
              onSelectMonth={goToMonth}
              onToggleWeek={setWeekVisibility}
              liveWeeks={liveMonthWeeks}
              currentState={currentPublishState}
              editedWeeks={otherWeeksWithEdits}
            />
            <div className="mt-4 flex flex-col gap-2 border-t border-zinc-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-1">
                <IconButton
                  icon="chevronLeft"
                  label="Previous week"
                  onClick={() => goToWeek(shiftWeek(weekStart, -1))}
                  disabled={!weekStart}
                />
                <h2 className="min-w-0 flex-1 truncate px-2 text-center text-lg font-semibold">
                  {weekStart ? formatWeekRange(weekStart) : '—'}
                </h2>
                <IconButton
                  icon="chevronRight"
                  label="Next week"
                  onClick={() => goToWeek(shiftWeek(weekStart, 1))}
                  disabled={!weekStart}
                />
                {weekStart && weekStart !== currentWeekStart() && (
                  <button
                    type="button"
                    className="ml-2 rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                    onClick={() => goToWeek(currentWeekStart())}
                  >
                    This week
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 print:hidden">
                    <button
                  type="button"
                  className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                  onClick={copyPriorWeek}
                  disabled={!weekStart}
                  title="Copy last week's assignments into this week."
                >
                  Copy last week
                </button>
                {confirmingClearWeek ? (
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      className="rounded bg-red-800 px-2 py-1 text-xs font-semibold text-white hover:bg-red-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                      onClick={clearWeek}
                    >
                      Yes, clear
                    </button>
                    <button
                      type="button"
                      className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                      onClick={() => setConfirmingClearWeek(false)}
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                    onClick={() => setConfirmingClearWeek(true)}
                    disabled={!weekStart || assignments.length === 0}
                    title="Remove every assignment from this week. You can undo."
                  >
                    Clear week
                  </button>
                )}
              </div>
            </div>
            <p className="mt-1 text-sm text-zinc-600 print:hidden">
              Click a name to move it, then click where it goes. Open a shift to pick someone — picks stay put when you
              make the schedule again.
              {weekStart && publishedWeeks[weekStart] && (
                <> Last published: {formatUpdatedAt(publishedWeeks[weekStart]?.updatedAt)}.</>
              )}
            </p>

            {weekStart && layoutMismatchWeeks[weekStart] && assignments.length === 0 && (
              <div className="mt-3 rounded border border-amber-500 bg-amber-50 p-3 text-sm text-amber-950" role="alert">
                <p className="font-semibold">This week is published, but with different shift rules — so it is not shown here.</p>
                <p className="mt-1">
                  Staff still see the published version. Making and publishing a schedule here replaces it. Check the Shift
                  rules tab first.
                </p>
              </div>
            )}
            {weekStart && currentPublishState && currentPublishState !== 'live' && (assignments.length > 0 || currentPublishState === 'hidden') && (
              <div
                className="mt-3 flex flex-col gap-2 rounded border border-amber-400 bg-amber-50 p-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between print:hidden"
                role="status"
              >
                <p>
                  {currentPublishState === 'hidden'
                    ? 'Published, but turned off — staff cannot see this week. Turn it on, then publish.'
                    : currentPublishState === 'changed'
                      ? 'You have changes staff cannot see yet. Publish to send them.'
                      : 'Staff cannot see this week yet. Publish it when it looks right.'}
                </p>
                <Button onClick={() => setSharing(true)} icon="share" disabled={storeLoading}>
                  Publish to staff
                </Button>
              </div>
            )}

            {movingEmployee && (
              <div
                className="mt-3 flex flex-col gap-2 rounded border border-green-300 bg-green-50 p-3 sm:flex-row sm:items-center sm:justify-between print:hidden"
                role="status"
              >
                <p className="flex items-center gap-2 text-sm font-semibold text-green-950">
                  <Icon name="move" />
                  Moving {movingEmployee.name}. Click a green spot to put them there.
                </p>
                <Button onClick={cancelMove} icon="close">
                  Cancel move
                </Button>
              </div>
            )}
            {lastReport && lastReport.weekStart === weekStart && (
              <GenerationReportBanner report={lastReport} onDismiss={() => setLastReport(null)} />
            )}
            <WeeklyScheduleBoard
              slots={slots}
              weekStart={weekStart}
              hasSchedule={assignments.length > 0}
              employees={employees}
              assignments={assignments}
              assignmentMap={assignmentMap}
              violations={violations}
              openShiftKey={openShiftKey}
              activeMove={activeMove}
              changedSlotIds={changedSlotIds}
              highlightedSlotIds={highlightedSlotIds}
              onResetShift={restoreShift}
              dragOverSlotId={dragOverSlotId}
              dropFeedback={dropFeedback}
              movePreviews={movePreviews}
              onOpenShift={setOpenShiftKey}
              onAssign={setEmployeeAssignment}
              onLock={setLocked}
              onDragStart={startAssignmentDrag}
              onDragEnd={endAssignmentDrag}
              onDragOverSlot={previewDropSlot}
              onDragLeaveSlot={clearDropPreview}
              onDropAssignment={moveAssignmentTo}
              onActivateSlot={activateSlot}
              roles={availableRoles}
            />
          </section>

          {changes.length > 0 && (
            <div className="print:hidden">
              <Disclosure summary={`Changes since you made the schedule (${changes.length})`}>
                <ul className="space-y-1 text-sm text-zinc-700">
                  {changes.map((change) => (
                    <li key={change.slotId}>{change.text}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="mt-3 inline-flex items-center gap-2 rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                  onClick={restoreEverything}
                >
                  <Icon name="reset" />
                  Put the whole week back
                </button>
              </Disclosure>
            </div>
          )}

          <div className="space-y-1 pt-2 print:hidden">
            <Disclosure summary="Hours for each person" tone="quiet">
              <HoursSummary stats={stats} employees={employees} />
            </Disclosure>

          </div>
          </>
          )}

          {tab === 'rules' && (
            <TemplateEditor
              template={template}
              roles={availableRoles}
              readOnly={scheduleOnly && !staffUnlocked}
              problems={ruleProblems}
              onChange={(next) => {
                remember('changed schedule rules')
                setTemplate(next)
              }}
              onUseDefault={restoreDefaultTemplate}
              isDefaultTemplate={isDefaultTemplate}
              dirty={templateDirty}
              loadError={templateLoadError}
              restaurantId={restaurantId}
              updatedAt={templateUpdatedAt}
            />
          )}

          {tab === 'staff' && (
          <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm print:hidden">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">Staff{weekStart ? ` — week of ${formatWeekRange(weekStart)}` : ''}</h2>
                <p className="mt-0.5 text-sm text-zinc-600">
                  {activeEmployeeCount} working, {employees.length - activeEmployeeCount} off the list
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {scheduleOnly
                    ? `One crew for every week. Last saved: ${formatUpdatedAt(staffUpdatedAt)}${staffDirty ? ' · unsaved changes' : ''}`
                    : `Last saved: ${formatUpdatedAt(rosterUpdatedAt)}${rosterDirty ? ' · unsaved changes' : ''} · changes stay in this week only`}
                </p>
              </div>
              {(!scheduleOnly || staffUnlocked) && (
                <div className="flex shrink-0 items-center gap-1.5">
                  <IconButton
                    icon={employeePanelOpen ? 'close' : 'plus'}
                    label={employeePanelOpen ? 'Close employee form' : 'Add employee'}
                    tone="accent"
                    onClick={() => setEmployeePanelOpen((open) => !open)}
                  />
                </div>
              )}
            </div>

            {rosterLoadError && <p className="mt-2 text-xs font-medium text-amber-800">{rosterLoadError}</p>}
            {scheduleOnly && staffLoadError && <p className="mt-2 text-xs font-medium text-amber-800">{staffLoadError}</p>}

            {scheduleOnly && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded border border-zinc-200 bg-zinc-50 p-3">
                <p className="min-w-0 flex-1 text-xs text-zinc-600">
                  {staffUnlocked
                    ? 'Editing the crew and shift rules. Crew changes apply to every week.'
                    : 'The crew and shift rules are locked. Enter the staff password to edit them.'}
                </p>
                {staffUnlocked ? (
                  <button
                    type="button"
                    className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                    onClick={() => setStaffPassword('')}
                  >
                    Lock
                  </button>
                ) : (
                  <form
                    className="flex gap-2"
                    onSubmit={(event) => {
                      event.preventDefault()
                      void unlockCrewEditing()
                    }}
                  >
                    <input
                      className="w-40 rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                      type="password"
                      autoComplete="off"
                      value={passwordInput}
                      onChange={(event) => setPasswordInput(event.target.value)}
                      placeholder="Staff password"
                      aria-label="Staff password"
                    />
                    <button
                      type="submit"
                      className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                      disabled={!passwordInput || checkingPassword}
                    >
                      {checkingPassword ? 'Checking…' : 'Unlock editing'}
                    </button>
                  </form>
                )}
                {staffUnlocked && (
                  <button
                    type="button"
                    className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                    onClick={() => void undoCrewSave()}
                    disabled={!staffCanUndo || savingSetup || staffDirty}
                    title={staffDirty ? 'Save or undo your unsaved edits first.' : staffCanUndo ? 'Bring back the crew as it was before the last save.' : 'No saved crew change to undo.'}
                  >
                    Undo last crew save
                  </button>
                )}
              </div>
            )}

            {employeePanelOpen && (!scheduleOnly || staffUnlocked) && (
              <EmployeeForm
                draft={draft}
                gapSlot={gapSlot}
                weekStart={weekStart}
                canAddEmployee={canAddEmployee}
                roles={availableRoles}
                onDraftChange={setDraft}
                onAdd={addEmployee}
                onAddCustomRole={addCustomRoleToDraft}
              />
            )}

            {!scheduleOnly && (
            <>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-zinc-600">Mistake? Go back to the starting staff list.</p>
              <button
                type="button"
                className="rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                onClick={restoreDefaultRoster}
                disabled={isDefaultRoster}
                title={
                  isDefaultRoster
                    ? 'Already using the starting staff list.'
                    : 'Replace this week’s staff list with the starting list. You can undo, then save to keep it.'
                }
              >
                Use starting staff list
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3">
              <p className="text-xs text-zinc-600">Start fresh with an empty list. Undo brings everyone back.</p>
              {confirmingClearStaff ? (
                <span className="inline-flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="rounded bg-red-800 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                    onClick={clearStaff}
                  >
                    Yes, clear all
                  </button>
                  <button
                    type="button"
                    className="rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                    onClick={() => setConfirmingClearStaff(false)}
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                  onClick={() => setConfirmingClearStaff(true)}
                  disabled={employees.length === 0}
                  title="Remove everyone from the staff list. You can undo, then save to keep it."
                >
                  Clear staff list
                </button>
              )}
            </div>

            <div className="mt-3 border-t border-zinc-100 pt-3">
              <Disclosure summary={`Saved staff lists (${staffSnapshots.length})`} tone="quiet">
                <p className="text-xs text-zinc-600">Keep a copy of a staff list on this device and bring it back anytime.</p>
                <div className="mt-2 flex gap-2">
                  <input
                    className="min-w-0 flex-1 rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                    value={snapshotName}
                    onChange={(event) => setSnapshotName(event.target.value)}
                    placeholder={`Name this list (${employees.length} staff)`}
                    aria-label="Snapshot name"
                  />
                  <button
                    type="button"
                    className="shrink-0 rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                    onClick={saveStaffSnapshot}
                    disabled={employees.length === 0}
                    title="Save a copy of the current staff list on this device."
                  >
                    Save
                  </button>
                </div>
                {staffSnapshots.length > 0 && (
                  <ul className="mt-2 space-y-2">
                    {staffSnapshots.map((snapshot) => (
                      <li key={snapshot.id} className="flex items-center justify-between gap-2 rounded border border-zinc-200 bg-zinc-50 px-2.5 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-zinc-900">{snapshot.name}</p>
                          <p className="text-xs text-zinc-500">{snapshot.employees.length} staff · {formatUpdatedAt(snapshot.savedAt)}</p>
                        </div>
                        <div className="flex shrink-0 gap-1.5">
                          <button
                            type="button"
                            className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                            onClick={() => restoreStaffSnapshot(snapshot)}
                            title={`Replace the staff list with “${snapshot.name}”. You can undo.`}
                          >
                            Restore
                          </button>
                          <button
                            type="button"
                            className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                            onClick={() => deleteStaffSnapshot(snapshot.id)}
                            title={`Delete “${snapshot.name}”.`}
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Disclosure>
            </div>
            </>
            )}

            <div className="mt-3 border-t border-zinc-100 pt-3">
              <label className="block text-sm font-medium text-zinc-800">
                <span className="sr-only">Search staff</span>
                <input
                  className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                  value={staffQuery}
                  onChange={(event) => setStaffQuery(event.target.value)}
                  placeholder={employees.length > 8 ? `Search ${employees.length} staff by name or position` : 'Search by name or position'}
                />
              </label>
              <p className="mt-2 text-sm font-semibold text-zinc-800">
                Everyone on the list ({filteredEmployees.length}/{employees.length})
              </p>
              <div className="mt-3 grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {filteredEmployees.map((employee) => (
                    <EmployeeCard
                      key={employee.id}
                      employee={employee}
                      stat={staffStatsById.get(employee.id)}
                      roles={availableRoles}
                      onUpdate={updateEmployee}
                      onRemove={removeEmployee}
                      readOnly={scheduleOnly && !staffUnlocked}
                    />
                  ))}
                  {filteredEmployees.length === 0 && (
                    <p className="text-sm text-zinc-600">Nobody matches &ldquo;{staffQuery.trim()}&rdquo;.</p>
                  )}
              </div>
            </div>
          </section>
          )}
      </main>
    </div>
  )
}
