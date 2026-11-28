'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import Link from 'next/link'
import {
  calculateScheduleStats,
  defaultRoleForRestaurant,
  defaultTemplateForRestaurant,
  expandTemplate,
  generateSchedule,
  normalizeRoleSlug,
  preflightDiagnostics,
  rolesForRestaurant,
  currentWeekStart,
  formatWeekRange,
  dateForDay,
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
import { assignmentsFromPublishedWeek, buildPublishedWeek, layoutForPublication, publishedWeekFingerprint } from '@/lib/schedule-share'
import { buildScheduleSnapshot } from '@/lib/schedule-snapshot'
import { businessDate } from '@/lib/internal-tools/contracts'
import { resolveSpecialHours, type DraftHoursReviews, type HoursReviewRecord } from '@/lib/scheduler/special-hours'
import { useSpecialHours } from './useSpecialHours'
import HoursEditor from './HoursEditor'
import type { HoursResult } from '@/lib/scheduler/hours-batch'
import type { SpecialHoursPage } from '@/lib/scheduler/special-hours'
import { HoursBanner, HoursStationStatus, HoursSummary as SpecialHoursSummary } from './SpecialHours'
import { RESTAURANTS, isRestaurantId, isScheduleOnlyRestaurant } from '@/data/restaurants'
import { useManagerSession } from '@/components/internal/ManagerSession'
import { useInternalLanguage } from '@/components/internal/InternalLanguage'
import { useWorkspaceVisible } from '@/components/internal/WorkspaceVisibility'
import { useShellTask } from '@/components/internal/ShellTask'
import { useNavigationProtection } from '@/components/internal/NavigationProtection'
import { InternalTheme } from '@/components/internal/ui/Theme'
import { managerSession, SessionChangedError } from '@/lib/internal-tools/manager-session'
import css from './scheduler-workspace.module.css'
import { useSchedulerText } from './useSchedulerText'
import { DEFAULT_STATION, isStationId, type Locale } from '@/lib/internal-tools/contracts'
import { LOCALE_STORAGE_KEY, translate } from '@/lib/internal-tools/i18n'
import RequestsPanel from './RequestsPanel'
import { useScheduleRequests } from './useScheduleRequests'
import { withApprovedRequests, type ScheduleRequest } from '@/lib/scheduler/requests'
import { exclusionKey, preparePlacement, prepareRemoval, reconcileAvailability, type Placement } from '@/lib/scheduler/repair'
import { DraftJob } from '@/lib/scheduler/draft-job'
import { AGENT_API } from '@/lib/scheduler/agent-client'
import useDraftAdjustment from './useDraftAdjustment'
import PlanningShell from './PlanningShell'
import PlanningWorkspace from './PlanningWorkspace'
import { planningWeek } from './planning-format'
import PublishPanel from './PublishPanel'
import SchedulerNavigation, { type SchedulerView } from './SchedulerNavigation'
import { DragState, DropFeedback, EmployeeDraft, GenerationReport, HistorySnapshot, MovePreview, ScheduleVariant, ShiftKey, StaffSnapshot, UNDO_LIMIT, WeekAssignments, allDays, assignmentFingerprint, blankDraft, buildFixIssues, buildMovePreview, candidatesForSlot, changesSince, cloneAssignmentList, cloneEmployeeList, cloneTemplate, cloneWeeks, createEmployeeId, diagnosticLabel, emptyAssignments, formatReportTime, fullDay, gapAvailability, layoutStorageKey, onboardingStorageKey, proposeMovedAssignments, readLayoutPreference, readOnboardingDismissed, readStaffSnapshots, roleLabel, rolesInUse, scheduleVariants, snapshotStorageKey, statusForWeek, type SchedulerLayout, unassignableReason, uniqueMessages } from './helpers'
import { Button, Disclosure, FlipSwitch, Icon, IconButton, PublishStateBadge } from './ui'
import { EmployeeCard, EmployeeForm } from './StaffEditor'
import { TemplateEditor } from './RulesEditor'
import { WeeklyScheduleBoard } from './ScheduleBoard'
import { GenerationReportBanner, GuidedFixPanel, HoursSummary, MonthStrip, OnboardingBanner } from './SchedulePanels'
import ScheduleWorkspace, { type ScheduleWorkspaceProps } from './ScheduleWorkspace'
import StaffWorkspace, { type StaffWorkspaceProps } from './StaffWorkspace'
import SchedulingAgent from './SchedulingAgent'
export default function SchedulerDemo({ restaurantId }: { restaurantId?: string } = {}) {
  const controller=useRef<HTMLDivElement>(null)
  const findElement=(id:string)=>controller.current?.querySelector<HTMLElement>(`[id="${CSS.escape(id)}"]`)??null
  const restaurantName = restaurantId && isRestaurantId(restaurantId) ? RESTAURANTS[restaurantId].name : null
  // Schedule-only stations (CR3 Kitchen) ship default rules; their crew lives on the Worker.
  // The crew (`/api/staff`) is one per station, shared by every week, with the
  // last saved change undoable; the rules are per-week like other stations.
  // Both stay read-only until the staff password is accepted in Staff & rules or Hours.
  const scheduleOnly = isScheduleOnlyRestaurant(restaurantId)
  const [weekStart, setWeekStart] = useState('')
  const [weeks, setWeeks] = useState<WeekAssignments>({})
  // Draft-only "don't consider here" marks (date|period|role|employee); see repair.ts exclusionKey.
  const [exclusions, setExclusions] = useState<string[]>([])
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
  const [defaultRoster, setDefaultRoster] = useState<Employee[]>([])
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
  // saved crew loads; until then the list is empty.
  const [staffDraft, setStaffDraft] = useState<Employee[] | null>(null)
  const [staffLoaded, setStaffLoaded] = useState(false)
  const [staffRev, setStaffRev] = useState(0)
  const [staffCanUndo, setStaffCanUndo] = useState(false)
  const [staffUpdatedAt, setStaffUpdatedAt] = useState<string | null>(null)
  const [staffBaseline, setStaffBaseline] = useState<string | null>(null)
  // The staff password, once accepted, for this page view only — never stored. It is the editing
  // privilege for CR3 Kitchen's crew and rules; the manager code alone does not unlock them.
  const [staffPassword, setStaffPassword] = useState('')
  const crewAttempt=useRef(0)
  const [employeeDraftTouched,setEmployeeDraftTouched]=useState(false)
  const staffUnlocked = staffPassword !== ''
  const [passwordInput, setPasswordInput] = useState('')
  const [checkingPassword, setCheckingPassword] = useState(false)
  const [staffLoadError, setStaffLoadError] = useState('')
  // What "no saved crew" means for this station: its saved roster (empty if none).
  const [staffFallback, setStaffFallback] = useState<Employee[]>([])
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
  const [tab, setTab] = useState<SchedulerView>('schedule')
  // The new layout is the default; Classic is a per-device choice for managers who prefer it.
  const layout = 'workspace' as const
  const [autoAdjust, setAutoAdjust] = useState(true)
  const [focusEmployeeId, setFocusEmployeeId] = useState<string>()
  const [requestPrefill, setRequestPrefill] = useState<{ id: string; employeeId: string; date: string } | null>(null)
  const [pendingApproval, setPendingApproval] = useState<{ request: ScheduleRequest; week: string; layout: SchedulerLayout } | null>(null)
  const handledApprovals = useRef(new Set<string>())
  const previousRequestRevision = useRef<number | null>(null)
  const [externalAvailability, setExternalAvailability] = useState(false)
  const generationJobs = useRef(new DraftJob())
  const rulesDisclosure = useRef<HTMLDetailsElement>(null)
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
  const session = useManagerSession()
  const managerCode = session.token
  const visible = useWorkspaceVisible()
  const {locale: requestLocale, choose: setRequestLocale} = useInternalLanguage()
  const active = visible && !!managerCode
  const sessionRef = useRef(session); sessionRef.current = session
  const viewRef = useRef(active); viewRef.current = active
  const contextRef = useRef({weekStart, generation: session.generation}); contextRef.current = {weekStart,generation:session.generation}
  const setupFlight = useRef(false)
  const [publishBusy, setPublishBusy] = useState(false)
  const requestStation = isStationId(restaurantId) ? restaurantId : DEFAULT_STATION
  const requestSource = useScheduleRequests(requestStation, managerCode)
  const hoursSource = useSpecialHours(requestStation, weekStart, managerCode)
  const [hoursDraftReviews, setHoursDraftReviews] = useState<Record<string,DraftHoursReviews>>({})
  const [hoursEditor,setHoursEditor] = useState<{date:string|null;anchor:HTMLElement|null}|null>(null)
  const [hoursBusy,setHoursBusy] = useState(false)
  const [hoursDirty,setHoursDirty] = useState(false)
  const hoursScope=useRef('')
  hoursScope.current=`${requestStation}:${weekStart}`
  useEffect(()=>{
    if(hoursSource.phase!=='ready'||!hoursSource.page)return
    const page=hoursSource.page
    setHoursDraftReviews(old=>old[weekStart]!==undefined?old:{...old,[weekStart]:Object.fromEntries(page.events.map(event=>[
      event.data.date,page.reviews.find(r=>r.data.stationId===requestStation&&r.data.date===event.data.date)??null]))})
  },[hoursSource.phase,hoursSource.page,weekStart,requestStation])
  const [requestDirty, setRequestDirty] = useState(false)
  const [requestBusy, setRequestBusy] = useState(false)
  const [savingSetup, setSavingSetup] = useState(false)
  const [setupError, setSetupError] = useState('')
  const [retryLoad,setRetryLoad] = useState(0)
  const [setupNotice, setSetupNotice] = useState('')
  const templateDirty = !templateLoaded
      ? false
      : templateServerSnapshot === null
        ? templateFingerprint(template) !== templateFingerprint(defaultTemplateForRestaurant(restaurantId))
        : templateFingerprint(template) !== templateServerSnapshot
  const isDefaultRoster = useMemo(
    () => rosterFingerprint(employees) === rosterFingerprint(defaultRoster),
    [employees, defaultRoster],
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
    adjustment.clearReport()
    setWeeks((current) => {
      const existing = current[weekStart] ?? emptyAssignments
      return { ...current, [weekStart]: typeof next === 'function' ? next(existing) : next }
    })
  }

  function setGeneratedAssignments(next: ScheduleAssignment[]) {
    setGeneratedWeeks((current) => ({ ...current, [weekStart]: next }))
  }

  const baseSlots = useMemo(() => expandTemplate(template, weekStart || undefined), [template, weekStart])
  const activeHoursReviews=useMemo(()=>{
    if(hoursDraftReviews[weekStart]!==undefined)return Object.values(hoursDraftReviews[weekStart]).filter((r):r is HoursReviewRecord=>r!==null)
    return hoursSource.page?.reviews.filter(r=>r.data.stationId===requestStation)??[]
  },[hoursDraftReviews,weekStart,hoursSource.page,requestStation])
  const resolvedHours=useMemo(()=>resolveSpecialHours(baseSlots,hoursSource.page?.events??[],activeHoursReviews,requestStation),[baseSlots,hoursSource.page,activeHoursReviews,requestStation])
  const slots=resolvedHours.slots
  const hoursBlocked=hoursBusy||hoursSource.phase==='loading'||hoursSource.phase==='failed'||hoursSource.phase==='uncertain'||resolvedHours.pending.length>0
  const canPublishEmpty=slots.length===0&&resolvedHours.days.length===7&&resolvedHours.days.every(day=>day.mode==='closed')&&!hoursBlocked
  const hoursSnapshot=useMemo(()=>buildScheduleSnapshot(slots,'published',resolvedHours.days),[slots,resolvedHours.days])
  // Scheduling checks see approved requests as dated overrides; the saved staff list never stores them.
  const scheduleEmployees = useMemo(
    () => withApprovedRequests(employees, requestSource.record?.data, weekStart),
    [employees, requestSource.record, weekStart],
  )
  const requestsUnconfirmed = requestSource.phase === 'failed' || requestSource.phase === 'uncertain'
  const ruleProblems = useMemo(() => templateProblems(template), [template])
  const t = (key: string) => translate(requestLocale, key)
  const text=useSchedulerText()
  const draftContext = JSON.stringify([restaurantId, weekStart, session.generation, active, employees, template, assignments,
    exclusions, requestSource.record?.revision, hoursSource.page?.events, activeHoursReviews, slots])
  const currentDraftContext = useRef(draftContext)
  currentDraftContext.current = draftContext
  const adjustment = useDraftAdjustment({
    input: { employees: scheduleEmployees, slots, assignments, exclusions },
    contextKey: `${draftContext}:${isGenerating}`, scope: `${restaurantId}:${weekStart}`,
    disabled: !active || !weekStart || !rosterLoaded || !templateLoaded || !!rosterLoadError || !!templateLoadError ||
      isGenerating || !!staffLoadError || ruleProblems.length > 0 || hoursBlocked,
    onCommit: (next, nextExclusions) => { commitSchedule('draft before adjustment', next); setExclusions([...nextExclusions]) },
  })
  useEffect(()=>{
    if(hoursBusy){adjustment.cancel();generationJobs.current.cancel();setIsGenerating(false)}
  },[hoursBusy])
  useEffect(() => {
    generationJobs.current.cancel(); setIsGenerating(false)
    return () => generationJobs.current.cancel()
  }, [draftContext])
  useEffect(() => {
    const revision = requestSource.record?.revision ?? 0
    if (requestSource.phase !== 'ready') return
    if (previousRequestRevision.current !== null && previousRequestRevision.current !== revision && !pendingApproval) setExternalAvailability(true)
    previousRequestRevision.current = revision
    if (!pendingApproval) return
    // The request form clears its attempted-save state in its own effect.
    // Wait for that transition before starting a job against the settled draft.
    if (requestDirty) return
    const { request, week, layout: originLayout } = pendingApproval
    setPendingApproval(null)
    const key = `${requestStation}:${request.id}:${week}`
    if (handledApprovals.current.has(key)) return
    handledApprovals.current.add(key)
    if (originLayout !== 'workspace' || layout !== 'workspace' || week !== weekStart) { setExternalAvailability(true); return }
    if (!employees.some(employee => employee.id === request.employee.sourceEmployeeId) ||
      !slots.some(slot => slot.date && slot.date >= request.startDate && slot.date <= request.endDate)) return
    setExternalAvailability(false)
    void adjustment.run(input => reconcileAvailability(input, request.employee.sourceEmployeeId, request.startDate, request.endDate), autoAdjust, 'planning.approved')
  }, [pendingApproval, requestSource.phase, requestSource.record, requestDirty, layout, weekStart])

  // Readiness matches the solver: optional spots (not yet hired) never block the week.
  const readinessProblems = useMemo(
    () => preflightDiagnostics(scheduleEmployees, slots.filter((slot) => slot.required)),
    [scheduleEmployees, slots],
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
        employees: scheduleEmployees,
        slots,
        assignments: assignments.filter((assignment) => assignment.employeeId),
        requireCoverage: assignments.length > 0,
      }),
    [assignments, scheduleEmployees, slots],
  )
  const stats = useMemo(() => calculateScheduleStats(scheduleEmployees, slots, assignments), [assignments, scheduleEmployees, slots])
  const assignmentMap = useMemo(
    () => new Map(assignments.map((assignment) => [assignment.slotId, assignment])),
    [assignments],
  )
  const activeMove = dragState ?? moveSource
  const movePreviews = useMemo(() => {
    const previews = new Map<string, MovePreview>()
    if (!activeMove) return previews
    for (const slot of slots) {
      const preview = buildMovePreview({ move: activeMove, targetSlotId: slot.id, employees: scheduleEmployees, slots, assignments, assignmentMap, weekStart })
      if (preview) previews.set(slot.id, preview)
    }
    return previews
  }, [activeMove, assignmentMap, assignments, scheduleEmployees, slots, weekStart])
  const movingEmployee = employees.find((employee) => employee.id === moveSource?.employeeId)

  const fixIssues = useMemo(
    () => buildFixIssues(readinessProblems, violations, slots, scheduleEmployees, weekStart, assignments),
    [assignments, scheduleEmployees, readinessProblems, slots, violations, weekStart],
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
    () => changesSince(generatedAssignments, assignments, slots, scheduleEmployees, weekStart),
    [assignments, scheduleEmployees, generatedAssignments, slots, weekStart],
  )
  const changedSlotIds = useMemo(() => new Set(changes.map((change) => change.slotId)), [changes])
  const fixCandidates = useMemo(
    () =>
      nextIssue?.slot
        ? candidatesForSlot({ slot: nextIssue.slot, employees: scheduleEmployees, slots, assignments })
        : [],
    [assignments, scheduleEmployees, nextIssue, slots],
  )
  const fixExcluded = useMemo(() => {
    if (!nextIssue?.slot) return [] as { employee: Employee; reason: string }[]
    const candidateIds = new Set(fixCandidates.map((candidate) => candidate.id))
    return scheduleEmployees
      .filter((employee) => !candidateIds.has(employee.id))
      .map((employee) => ({
        employee,
        reason:
          unassignableReason({ slot: nextIssue.slot as StaffingSlot, employee, employees: scheduleEmployees, slots, assignments }) ??
          'not available',
      }))
  }, [assignments, scheduleEmployees, fixCandidates, nextIssue, slots])
  const ignoredCount = fixIssues.filter((issue) => ignoredIssueIds.includes(issue.id)).length
  const activeEmployeeCount = employees.filter((employee) => employee.active).length
  const keptCount = assignments.filter((assignment) => assignment.locked && assignment.employeeId).length
  // Only empty required spots block printing — warnings the fix panel lets you skip never do.
  const schedulePassing = (assignments.length > 0 || canPublishEmpty) && !violations.some((violation) => violation.code === 'missing_assignment')
  const publishedDoc = weekStart ? publishedWeeks[weekStart] : undefined
  const currentPublishState: PublishState | null =
    publishedDoc === undefined
      ? null
      : publishState({
          published: publishedDoc,
          fingerprintOnScreen: publishedWeekFingerprint(
            buildPublishedWeek({ weekStart, name: '', slots, employees, assignments }),
            hoursSnapshot,
          ),
          publishedFingerprint: publishedDoc ? publishedWeekFingerprint(publishedDoc.week, publishedDoc.snapshot) : null,
          visibleOnScreen: weekVisibility === 'on',
        })
  const otherWeeksWithEdits = [...new Set([...Object.keys(weeks),...Object.keys(rosters),...Object.keys(templates),...Object.keys(weekStatus)])].filter(week=>week!==weekStart&&(
    assignmentFingerprint(weeks[week]??[])!==(publishedBaselines[week]??'') ||
    !!rosters[week]&&rosterFingerprint(rosters[week])!==(rosterSnapshots[week]??rosterFingerprint(defaultRoster)) ||
    !!templates[week]&&templateFingerprint(templates[week])!==(templateSnapshots[week]??templateFingerprint(defaultTemplateForRestaurant(restaurantId))) ||
    weekStatus[week]!==undefined&&weekStatus[week]!== (publishedWeeks[week]?.visible?'on':'off')
  ))
  // Edits made on this screen since the week was loaded or published — not drift in the staff list.
  const currentWeekUnpublished =
    Boolean(weekStart) &&
    (assignmentFingerprint(assignments) !== (publishedBaselines[weekStart] ?? '') ||
      currentPublishState === 'changed' ||
      Boolean(publishedDoc && publishedDoc.visible !== (weekVisibility === 'on')))
  const hasUnsavedWork =
    currentWeekUnpublished || otherWeeksWithEdits.length > 0 || rosterDirty || templateDirty || staffDirty || requestDirty || hoursDirty
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
    const query=new URLSearchParams(window.location.search),requested=query.get('week')??''
    const start = businessDate(requested)&&new Date(requested+'T00:00:00Z').getUTCDay()===0?requested:currentWeekStart()
    const requestedHours=query.get('hoursDate')??''
    if(businessDate(requestedHours)&&requestedHours>=start&&requestedHours<=dateForDay(start,'Saturday'))setHoursEditor({date:requestedHours,anchor:null})
    setWeekStart(start)
    setMonthKey(monthKeyForWeek(start))
    setOnboardingDismissed(readOnboardingDismissed())

  }, [])

  useEffect(() => {
    setRosters({})
    setHoursDraftReviews({})
    setRosterRevs({})
    setRosterSnapshots({})
    setRosterUpdatedAts({})
    setRosterLoadedWeeks({})
    setDefaultRoster([])
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
    if (!managerCode || (defaultRosterLoaded&&!rosterLoadError)) return
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
          setRosterLoadError('Could not load the staff list from the server. Saving is off until it loads — reload to try again.')
          setDefaultRosterLoaded(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [restaurantId, scheduleOnly, managerCode, retryLoad])

  // Schedule-only crew: load the saved crew (one per station, shared by every
  // week). No saved crew yet means the station's saved roster, which stays editable.
  useEffect(() => {
    if (!scheduleOnly || !managerCode || (staffLoaded&&!staffLoadError)) return
    let cancelled = false
    setStaffLoadError('')
    setStaffLoaded(false)
    fetchStaff(managerCode, restaurantId)
      .then(async (doc) => {
        // `null` means no crew saved yet; an empty array is a deliberately empty crew.
        const fallback = doc.employees === null ? (await fetchRoster(managerCode, restaurantId)).employees : null
        if (cancelled) return
        const seed = fallback ? (fallback as Employee[]) : (doc.employees as Employee[])
        setStaffFallback(fallback ? cloneEmployeeList(fallback as Employee[]) : [])
        setStaffDraft(cloneEmployeeList(seed))
        setStaffBaseline(staffFingerprint(seed))
        setStaffRev(doc.rev)
        setStaffCanUndo(doc.canUndo)
        setStaffUpdatedAt(doc.updatedAt)
        setStaffLoaded(true)
      })
      .catch(() => {
        if (cancelled) return
        setStaffDraft([])
        setStaffBaseline(staffFingerprint([]))
        setStaffLoadError('Could not load the crew from the server. Saving is off until it loads — reload to try again.')
        setStaffLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [restaurantId, scheduleOnly, managerCode, retryLoad])

  useEffect(() => {
    if (!managerCode || (defaultTemplateLoaded&&!templateLoadError)) return
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
  }, [restaurantId, scheduleOnly, managerCode, retryLoad])

  useEffect(() => {
    if (!managerCode || !weekStart || !defaultRosterLoaded || rosterLoadedWeeks[weekStart]) return
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
        setRosterLoadError('Could not load the staff list from the server. Saving is off until it loads — reload to try again.')
      })
    return () => {
      cancelled = true
    }
  }, [weekStart, restaurantId, defaultRosterLoaded, defaultRoster, rosterLoadedWeeks, scheduleOnly, managerCode, retryLoad])

  useEffect(() => {
    if (!managerCode || !weekStart || !defaultTemplateLoaded || templateLoadedWeeks[weekStart]) return
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
  }, [weekStart, restaurantId, defaultTemplateLoaded, defaultTemplate, templateLoadedWeeks, managerCode, retryLoad])

  useEffect(() => {
    if (!managerCode || !weekStart || publishedWeeks[weekStart] !== undefined) return
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
  }, [weekStart, restaurantId, managerCode])

  useEffect(() => {
    if (!weekStart || !rosterLoaded || !templateLoaded || hoursSource.phase==='loading' || hydratedWeeks[weekStart]) return
    const doc = publishedWeeks[weekStart]
    if (doc === undefined || doc === null) return
    if ((weeks[weekStart]?.length ?? 0) > 0) {
      setHydratedWeeks((current) => ({ ...current, [weekStart]: true }))
      return
    }
    const layout = layoutForPublication(doc, [template], restaurantId)
    if (!layout.matches) {
      setHydratedWeeks((current) => ({ ...current, [weekStart]: true }))
      setLayoutMismatchWeeks((current) => ({ ...current, [weekStart]: true }))
      return
    }
    const currentIds = new Set(slots.map(slot => slot.id))
    const hydrated = assignmentsFromPublishedWeek({ slots: layout.slots, employees, published: doc.week })
      .filter(assignment => currentIds.has(assignment.slotId))
    setPublishedBaselines((current) => ({ ...current, [weekStart]: assignmentFingerprint(hydrated) }))
    setWeeks((current) => (current[weekStart] ? current : { ...current, [weekStart]: hydrated }))
    setGeneratedWeeks((current) =>
      current[weekStart] ? current : { ...current, [weekStart]: hydrated.map((assignment) => ({ ...assignment })) },
    )
    setHydratedWeeks((current) => ({ ...current, [weekStart]: true }))
    if (hydrated.length > 0) {
      setDiagnostics((current) => [...current, 'Loaded the published week from the server.'])
    }
  }, [weekStart, restaurantId, rosterLoaded, templateLoaded, publishedWeeks, hydratedWeeks, slots, employees, weeks, hoursSource.phase])

  useEffect(() => {
    if (!active || !monthKey) return
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
  }, [monthKey, restaurantId, active])

  // The host retains controllers during private navigation and lock. No device copy is claimed.
  const working = hasUnsavedWork || (employeePanelOpen && (employeeDraftTouched || !!draft.name.trim()))
  const mutationBusy = savingSetup || publishBusy || hoursBusy || checkingPassword || requestBusy
  useNavigationProtection({scope:`schedule:${requestStation}`,dirty:working,deviceSaved:false,busy:mutationBusy,
    checkpoint:()=>!mutationBusy,leave:()=>{setStaffPassword('');setPasswordInput('')}})
  useShellTask(`schedule-${requestStation}`, {context: active ? `${restaurantName ?? requestStation} · ${weekStart ? planningWeek(weekStart,dateForDay(weekStart,'Saturday'),requestLocale) : t('planning.loading')} · ${t(currentPublishState ? `planning.status.${currentPublishState}` : 'planning.status.draft')}` : null})
  useEffect(()=>{
    crewAttempt.current++;setStaffPassword('');setPasswordInput('');setCheckingPassword(false)
    generationJobs.current.cancel();adjustment.cancel();setIsGenerating(false)
  },[session.generation])
  useEffect(()=>{
    if(!active){generationJobs.current.cancel();adjustment.cancel();setIsGenerating(false)}
  },[active])
  function writeLocation(week:string,view:SchedulerView,replace=false) {
    const url=new URL(window.location.href)
    if(week)url.searchParams.set('week',week)
    url.searchParams.delete('hoursDate')
    url.hash=view==='settings'?'staff':view
    if(url.href===window.location.href)return
    if(replace)window.history.replaceState(window.history.state,'',url)
    else window.history.pushState(window.history.state,'',url)
  }
  // Tabs and jump helpers place focus themselves; only shortcuts from the board ask to focus the panel.
  function changeView(next:SchedulerView,focusPanel=false) {
    if(!active||mutationBusy)return
    if(hoursDirty||hoursBusy){setSetupNotice(t('hours.finishFirst'));return}
    setHoursEditor(null);setTab(next);writeLocation(weekStart,next)
    if(focusPanel)requestAnimationFrame(()=>findElement(`scheduler-panel-${next}`)?.focus({preventScroll:true}))
  }
  useEffect(()=>{
    if(!active)return
    const sync=()=>{
      const url=new URL(window.location.href)
      const next:SchedulerView=url.hash==='#staff'?'settings':url.hash==='#requests'?'requests':'schedule'
      if(mutationBusy||hoursDirty){writeLocation(weekStart,tab,true);return}
      const requested=url.searchParams.get('week')??''
      if(businessDate(requested)&&new Date(`${requested}T00:00:00Z`).getUTCDay()===0&&requested!==weekStart)goToWeek(requested,false)
      setTab(next)
    }
    sync();window.addEventListener('hashchange',sync);window.addEventListener('popstate',sync)
    return()=>{window.removeEventListener('hashchange',sync);window.removeEventListener('popstate',sync)}
  },[active,mutationBusy,hoursDirty,weekStart])
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
  undoRef.current = ()=>{if(!mutationBusy)undoLastChange()}
  useEffect(() => {
    function undoOnShortcut(event: KeyboardEvent) {
      if (!viewRef.current || !(event.ctrlKey || event.metaKey) || event.shiftKey || event.key.toLowerCase() !== 'z') return
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
  function goToWeek(nextWeekStart: string, updateHistory = true) {
    if (!active || mutationBusy || !nextWeekStart || nextWeekStart === weekStart) return
    if(hoursDirty||hoursBusy){setSetupNotice(translate(requestLocale,'hours.finishFirst'));return}
    adjustment.cancel(); generationJobs.current.cancel(); setIsGenerating(false)
    setExternalAvailability(false)
    const fromWeek = weekStart
    if (fromWeek) {
      seedWeek(nextWeekStart, rosters[fromWeek] ?? defaultRoster, templates[fromWeek] ?? defaultTemplate)
      setRosterRevs((current) => (current[nextWeekStart] !== undefined ? current : { ...current, [nextWeekStart]: 0 }))
      setTemplateRevs((current) => (current[nextWeekStart] !== undefined ? current : { ...current, [nextWeekStart]: 0 }))
    }
    setWeekStart(nextWeekStart)
    if(updateHistory) writeLocation(nextWeekStart,tab)
    setHoursEditor(null)
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
    const { slots: priorSlots, matches } = layoutForPublication(doc, [savedRules], restaurantId)
    if (!matches) return []
    const priorAssignments = assignmentsFromPublishedWeek({ slots: priorSlots, employees, published: doc.week })
    // Only spots that still exist this week can be copied.
    const slotIds = new Set(slots.map((slot) => slot.id))
    return priorAssignments.filter((assignment) => slotIds.has(assignment.slotId))
  }

  async function copyPriorWeek() {
    if (!active || !weekStart || copyingPrior || mutationBusy) return
    const origin={...contextRef.current}
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
    if (!viewRef.current || origin.weekStart!==contextRef.current.weekStart || origin.generation!==contextRef.current.generation) return
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
        exclusions: [...exclusions],
        generatedWeeks: cloneWeeks(generatedWeeks),
        weekStatus: { ...weekStatus },
        diagnostics: [...diagnostics],
        hoursReviews: {...(hoursDraftReviews[weekStart]??Object.fromEntries(activeHoursReviews.map(r=>[r.data.date,r])))},
      },
      // shortcut: 30 snapshots of every week in memory, fine for a manager's session; trim if weeks pile up.
      ...current.slice(0, UNDO_LIMIT - 1),
    ])
  }

  function undoLastChange() {
    if(hoursBusy)return
    adjustment.cancel(); adjustment.clearReport(); generationJobs.current.cancel(); setIsGenerating(false)
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
    if (target) setHoursDraftReviews(current=>({...current,[target]:snapshot.hoursReviews??{}}))
    setWeeks(cloneWeeks(snapshot.weeks))
    setExclusions([...snapshot.exclusions])
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

  function openEmployeeSettings(showRules = false) {
    changeView('settings')
    const disclosure = rulesDisclosure.current ?? findElement('scheduler-rules') as HTMLDetailsElement | null
    if (showRules && disclosure) {
      disclosure.open = true
      requestAnimationFrame(() => {
        disclosure.querySelector('summary')?.focus()
        disclosure.scrollIntoView({ block: 'start' })
      })
    } else {
      findElement('scheduler-tab-settings')?.focus()
    }
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
    openEmployeeSettings()
    setEmployeePanelOpen(true)
  }

  function fixNextIssue() {
    if (!nextIssue) return
    changeView('schedule')
    setGuidedChoosing(true)
    openSlot(nextIssue.slot?.id)
    const shiftKey = nextIssue.slot ? `${nextIssue.slot.day}-${nextIssue.slot.period}` : null
    if (shiftKey) {
      requestAnimationFrame(() => {
        findElement(`${shiftKey}-detail`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
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
    if (isGenerating || adjustment.busy || hoursBlocked) return
    adjustment.clearReport()
    const job = generationJobs.current.begin(draftContext)
    setSelectedVariant(variant)
    setIsGenerating(true)
    setIgnoredIssueIds([])
    setGuidedChoosing(false)
    // Let the spinner paint before the synchronous solver blocks the main thread.
    await new Promise((resolve) => setTimeout(resolve, 350))
    if (!generationJobs.current.canCommit(job, currentDraftContext.current)) return
    let previousAssignments = assignments
    if (variant === 'similarWeek') {
      // Anchor to last week as published, not to whatever is on screen.
      const prior = await loadPriorWeek(shiftWeek(weekStart, -1)).catch(() => [])
      if (!generationJobs.current.canCommit(job, currentDraftContext.current)) return
      if (prior.length === 0) {
        setDiagnostics(['Last week has nothing to match yet — publish it first, or pick another way to build the week.'])
        setIsGenerating(false)
        return
      }
      previousAssignments = prior
    }
    try {
      const result = generateSchedule(
        { employees: scheduleEmployees, template, weekStart, slots },
        {
          strategy: variant,
          referenceAssignments: previousAssignments,
          existingAssignments: assignments.filter((assignment) => assignment.locked),
        },
      )

      if (!generationJobs.current.canCommit(job, currentDraftContext.current)) return
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

      const summary = summarizeSchedule(scheduleEmployees, slots, result.assignments, previousAssignments)
      const message = generationMessage(variant, summary, previousAssignments.length || result.assignments.length)
      setDiagnostics([
        message,
        ...(requestsUnconfirmed ? ['Time off and availability requests could not be confirmed with the server, so this schedule may miss a recent approval. Reload requests, then make the schedule again.'] : []),
        ...uniqueMessages(result.diagnostics.map((diagnostic) => diagnosticLabel(diagnostic, weekStart))),
      ])
      const unchanged = assignmentFingerprint(result.assignments) === assignmentFingerprint(assignments)
      commitSchedule('previous schedule', result.assignments)
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
      if (generationJobs.current.owns(job)) { generationJobs.current.finish(job); setIsGenerating(false) }
    }
  }

  function reset() {
    // Inline confirm in the header calls this only after an explicit second click.
    // remember() keeps the pre-reset state so Undo can bring it back.
    remember('started over')
    setEmployees(cloneEmployeeList(defaultRoster))
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
    setEmployees(cloneEmployeeList(defaultRoster))
    setIgnoredIssueIds([])
    setGuidedChoosing(false)
    setDiagnostics(['Staff list for this week restored to the station’s saved list. Save to keep it — Undo brings back your list.'])
  }

  function restoreDefaultTemplate() {
    if (isDefaultTemplate) return
    remember('restored default schedule rules')
    setTemplate(cloneTemplate(undefined, restaurantId))
    setIgnoredIssueIds([])
    setGuidedChoosing(false)
    setDiagnostics(['Schedule rules for this week restored to the built-in defaults. Save to keep them — Undo brings back your rules.'])
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
  const storeOffline = Boolean(rosterLoadError || templateLoadError || staffLoadError)
  const isNewStation = !scheduleOnly && !storeLoading && defaultRosterRev === 0 && defaultTemplateRev === 0 && rosterRev === 0 && templateRev === 0

  function commitSchedule(label: string, next: ScheduleAssignment[]) {
    remember(label)
    setLastReport(null)
    setAssignments(cloneAssignmentList(next))
    setIgnoredIssueIds([])
  }

  function openHours(date:string,anchor?:HTMLElement) { openHoursEditor(date,anchor) }
  function openHoursEditor(date:string|null,anchor?:HTMLElement) {
    if(hoursDirty||hoursBusy){setSetupNotice(translate(requestLocale,'hours.finishFirst'));return}
    if(adjustment.busy||isGenerating||hoursSource.phase!=='ready'||storeLoading||storeOffline)return
    setHoursEditor({date,anchor:anchor??document.activeElement as HTMLElement|null})
  }
  function applyHours(results:readonly HoursResult[],page:SpecialHoursPage) {
    if(!results.length||results.some(result=>hoursScope.current!==`${result.review.data.stationId}:${weekStart}`))return
    adjustment.cancel();generationJobs.current.cancel();setIsGenerating(false)
    remember('updated restaurant hours')
    const dates=new Set(results.map(result=>result.event.data.date))
    const nextReviews=activeHoursReviews.filter(r=>!dates.has(r.data.date)).concat(results.map(result=>result.review))
    const next=resolveSpecialHours(baseSlots,page.events,nextReviews,requestStation)
    const ids=new Set(next.slots.map(slot=>slot.id)),removed=assignments.filter(a=>!ids.has(a.slotId))
    setHoursDraftReviews(old=>({...old,[weekStart]:{
      ...(old[weekStart]??Object.fromEntries(activeHoursReviews.map(r=>[r.data.date,r]))),
      ...Object.fromEntries(results.map(result=>[result.event.data.date,result.review]))}}))
    setAssignments(assignments.filter(a=>ids.has(a.slotId)))
    setWeekStatus(old=>old[weekStart]?old:{...old,[weekStart]:'on'})
    setDiagnostics([translate(requestLocale,'hours.batchUpdated',{count:results.length,removed:translate(requestLocale,'hours.removed',{count:removed.length,kept:removed.filter(a=>a.locked).length})}),t('hours.undo')])
    setSetupNotice(t('hours.saved'))
  }

  function placeInWorkspace(placement: Placement) {
    if (adjustment.busy || isGenerating) return
    // Already assigned here: leave both shifts and Keep marks untouched.
    if (assignments.some(a => a.slotId === placement.slotId && a.employeeId === placement.employeeId)) return
    const slot = slots.find(s => s.id === placement.slotId)
    const key = slot ? exclusionKey(slot, placement.employeeId) : ''
    // A deliberate placement overrides an earlier "not this shift" removal.
    void adjustment.run(input => input.exclusions?.includes(key)
      ? { assignments: preparePlacement(input, placement), exclusions: input.exclusions.filter(k => k !== key) }
      : preparePlacement(input, placement), autoAdjust)
  }

  function removeFromWorkspace(slotId: string) {
    if (adjustment.busy || isGenerating) return
    void adjustment.run(input => prepareRemoval(input, slotId), autoAdjust, 'planning.removed')
  }

  function allowInWorkspace(key: string) {
    if (adjustment.busy || isGenerating || !exclusions.includes(key)) return
    remember('allowed an employee back on a shift')
    adjustment.clearReport()
    setExclusions(current => current.filter(k => k !== key))
  }

  function setEmployeeAssignment(slotId: string, employeeId: string) {
    if (adjustment.busy || isGenerating) return
    adjustment.clearReport()
    setLastReport(null)

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
    if (adjustment.busy || isGenerating) return
    adjustment.clearReport()
    setLastReport(null)
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
      maxHoursPerWeek: draft.maxHoursPerWeek,
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
  // means "no saved crew", so fall back to the station's saved roster.
  function applyStaffResult(result: StaffWriteResult) {
    const next = result.employees === null ? cloneEmployeeList(staffFallback) : result.employees
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
    if (!active || !weekStart || storeLoading || setupFlight.current) return false
    const current=managerSession.capture(managerCode)
    const origin={...contextRef.current}
    const check=()=>{current();if(origin.weekStart!==contextRef.current.weekStart)throw new SessionChangedError()}
    setupFlight.current=true
    if(scheduleOnly&&(staffDirty||templateDirty)&&!staffUnlocked){setSetupError(text('Unlock Staff & rules before saving crew or rule changes.'));setupFlight.current=false;return false}
    // An empty list shown after a failed load must never overwrite the saved staff.
    if (rosterLoadError || staffLoadError) {
      setSetupError('The staff list did not load, so saving is off. Reload the page and try again.')
      setupFlight.current=false
      return false
    }
    setSetupError('')
    setSetupNotice('')
    const target = weekStart
    let what = 'staff list'
    try {
      if (rosterDirty) {
        const result = await saveRoster(employees, rosterRev, managerCode, restaurantId, target)
        check();setRosterSaved(target, result.rev, result.updatedAt, rosterFingerprint(employees))
      }
      if (staffDirty && staffDraft) {
        what = 'crew'
        const saved=await saveStaff(staffDraft, staffRev, staffPassword, restaurantId);check();applyStaffResult(saved)
      }
      if ((templateDirty || (alsoRules && templateRev === 0)) && ruleProblems.length === 0) {
        what = 'shift rules'
        // CR3 Kitchen rules are the password holder's to change; publishing a week still saves them with the manager code.
        const result = await saveTemplate(template, templateRev, scheduleOnly && staffPassword ? staffPassword : managerCode, restaurantId, target, scheduleOnly && staffPassword ? 'staff' : 'manager')
        check();setTemplateSaved(target, result.rev, result.updatedAt, templateFingerprint(template))
        if (result.preservedPublication) {
          const publication = result.preservedPublication
          setPublishedWeeks(current => ({ ...current, [target]: publication }))
        }
      }
      return true
    } catch (caught) {
      if(!(caught instanceof SessionChangedError))setSetupError(saveErrorMessage(caught, what))
      return false
    } finally {setupFlight.current=false}
  }

  async function saveSetupNow() {
    if (!active || setupFlight.current || savingSetup || setupParts.length === 0) return
    setSavingSetup(true)
    const saved = await saveSetup()
    setSavingSetup(false)
    if (saved) setSetupNotice(`Saved the ${setupParts.join(' and ')}.`)
  }

  async function unlockCrewEditing(password = passwordInput): Promise<string|null> {
    if (!active || !password || checkingPassword) return translate(requestLocale,'hours.unlockFailed')
    const generation=session.generation
    const attempt=++crewAttempt.current
    setCheckingPassword(true)
    setSetupError('')
    try {
      await verifyStaffPassword(password, restaurantId)
      if(generation!==sessionRef.current.generation||attempt!==crewAttempt.current)throw new SessionChangedError()
      setStaffPassword(password)
      setPasswordInput('')
      return null
    } catch (caught) {
      if(caught instanceof SessionChangedError)return caught.message
      const message=saveErrorMessage(caught, 'crew').replace('That code was not accepted', 'That staff password was not accepted')
      setSetupError(message)
      return message
    } finally {
      if(attempt===crewAttempt.current)setCheckingPassword(false)
    }
  }

  async function undoCrewSave() {
    if (!active || savingSetup || !staffCanUndo) return
    const generation=session.generation
    setSavingSetup(true)
    setSetupError('')
    try {
      const result=await undoStaff(staffRev, staffPassword, restaurantId)
      if(generation!==sessionRef.current.generation)return
      applyStaffResult(result)
      setSetupNotice('Undid the last saved crew change.')
    } catch (caught) {
      setSetupError(saveErrorMessage(caught, 'crew'))
    } finally {
      setSavingSetup(false)
    }
  }

  const requestsPanel = (
    <RequestsPanel key={requestStation} source={requestSource} employees={employees} weekStart={weekStart} token={managerCode}
      locale={requestLocale} onLocaleChange={setRequestLocale} onDirtyChange={setRequestDirty} onBusyChange={setRequestBusy} prefill={requestPrefill} hideLanguage
      onApproved={request => setPendingApproval({ request, week: weekStart, layout })} />
  )
  // Ordinary weeks retain the legacy assistant wire shape. Dated-hours weeks
  // require the compatible assistant that validates the reviewed effective layout.
  const agentHoursContext=hoursSource.page?.events.length?{
    hoursFingerprint:JSON.stringify([hoursSource.page.events.map(e=>[e.data.date,e.revision]),activeHoursReviews.map(r=>[r.data.date,r.revision,r.data.eventRevision])]),
    effectiveSlots:slots.map(slot=>({...slot,date:slot.date??dateForDay(weekStart,slot.day)})),
  }:{}

  const scheduleWorkspace: ScheduleWorkspaceProps = {
    hoursDays:hoursSource.page?.events.map(e=>e.data)??[],
    publishedHours:resolvedHours.days,
    hoursPending:resolvedHours.pending,
    hoursDisabled:hoursSource.phase!=='ready'||isGenerating||adjustment.busy||storeLoading||storeOffline,
    hoursBlocked,
    canPublishEmpty,
    hoursLocale:requestLocale,
    onEditHours:openHours,
    weekStart,
    assignments,
    slots,
    employees: scheduleEmployees,
    allEmployees: employees,
    assignmentMap,
    violations,
    openShiftKey,
    activeMove,
    dragOverSlotId,
    dropFeedback,
    movePreviews,
    changedSlotIds,
    highlightedSlotIds,
    roles: availableRoles,
    storeLoading:storeLoading||hoursBlocked,
    ruleProblemCount: ruleProblems.length,
    publishState: currentPublishState,
    schedulePassing,
    isGenerating: isGenerating || adjustment.busy,
    activeEmployeeCount,
    selectedVariant,
    historyLength: history.length,
    undoLabel: history[0]?.label,
    keptCount,
    stats,
    changes,
    lastReport,
    diagnostics,
    layoutMismatch: Boolean(weekStart && layoutMismatchWeeks[weekStart]),
    movingEmployee,
    nextIssue,
    visibleIssueCount: visibleFixIssues.length,
    totalIssueCount: fixIssues.length,
    ignoredIssueCount: ignoredCount,
    fixCandidates,
    fixExcluded,
    guidedChoosing,
    canAddEmployee: !scheduleOnly || staffUnlocked,
    monthKey,
    monthWeeks,
    weeks,
    weekStatus,
    liveMonthWeeks,
    otherWeeksWithEdits,
    confirmingClearWeek,
    confirmingReset,
    requestsPanel: null,
    onMake: () => void generate(),
    onVariantChange: setSelectedVariant,
    onPublish: () => {if(!hoursBlocked)setSharing(true)},
    onUndo: undoLastChange,
    onChooseEmployee: fixNextIssue,
    onPickEmployee: chooseForIssue,
    onAddEmployee: () => addEmployeeForSlot(nextIssue?.slot),
    onIgnoreIssue: ignoreNextIssue,
    onShowIgnored: showIgnoredIssues,
    onCopyPrior: copyPriorWeek,
    onAskClearWeek: () => setConfirmingClearWeek(true),
    onClearWeek: clearWeek,
    onCancelClearWeek: () => setConfirmingClearWeek(false),
    onSelectWeek: goToWeek,
    onSelectMonth: goToMonth,
    onToggleWeek: setWeekVisibility,
    onRestoreEverything: restoreEverything,
    onAskReset: () => setConfirmingReset(true),
    onReset: reset,
    onCancelReset: () => setConfirmingReset(false),
    onDismissReport: () => setLastReport(null),
    onCancelMove: cancelMove,
    onReviewRules: () => openEmployeeSettings(true),
    onPrint: () => { if(active) window.print() },
    onResetShift: restoreShift,
    onOpenShift: setOpenShiftKey,
    onAssign: setEmployeeAssignment,
    onLock: setLocked,
    onDragStart: startAssignmentDrag,
    onDragEnd: endAssignmentDrag,
    onDragOverSlot: previewDropSlot,
    onDragLeaveSlot: clearDropPreview,
    onDropAssignment: moveAssignmentTo,
    onActivateSlot: activateSlot,
  }

  const staffWorkspace: StaffWorkspaceProps = {
    focusEmployeeId,
    employees,
    filteredEmployees,
    statsById: staffStatsById,
    roles: availableRoles,
    readOnly: scheduleOnly && !staffUnlocked,
    scheduleOnly,
    staffUnlocked,
    activeEmployeeCount,
    staffQuery,
    onStaffQueryChange: setStaffQuery,
    draft,
    employeePanelOpen,
    gapSlot,
    weekStart,
    canAddEmployee,
    onDraftChange: value=>{setEmployeeDraftTouched(true);setDraft(value)},
    onAddEmployee: ()=>{addEmployee();setEmployeeDraftTouched(false)},
    onAddCustomRole: value=>{setEmployeeDraftTouched(true);addCustomRoleToDraft(value)},
    onToggleEmployeePanel: () => setEmployeePanelOpen((open) => !open),
    onUpdateEmployee: updateEmployee,
    onRemoveEmployee: removeEmployee,
    rosterLoadError,
    staffLoadError,
    staffUpdatedAt,
    rosterUpdatedAt,
    rosterDirty,
    staffDirty,
    passwordInput,
    onPasswordInputChange: setPasswordInput,
    checkingPassword,
    onUnlock: () => void unlockCrewEditing(),
    onLock: () => setStaffPassword(''),
    staffCanUndo,
    savingSetup,
    onUndoCrewSave: () => void undoCrewSave(),
    isDefaultRoster,
    onRestoreDefaultRoster: restoreDefaultRoster,
    confirmingClearStaff,
    onAskClearStaff: () => setConfirmingClearStaff(true),
    onClearStaff: clearStaff,
    onCancelClearStaff: () => setConfirmingClearStaff(false),
    staffSnapshots,
    snapshotName,
    onSnapshotNameChange: setSnapshotName,
    onSaveSnapshot: saveStaffSnapshot,
    onRestoreSnapshot: restoreStaffSnapshot,
    onDeleteSnapshot: deleteStaffSnapshot,
    setupParts,
    storeLoading,
    ruleProblemCount: ruleProblems.length,
    historyLength: history.length,
    onSave: () => void saveSetupNow(),
    onUndo: undoLastChange,
    onBack: () => {
      changeView('schedule')
      findElement('scheduler-tab-schedule')?.focus()
    },
    template,
    ruleProblems,
    templateDirty,
    templateLoadError,
    templateUpdatedAt,
    isDefaultTemplate,
    restaurantId,
    onTemplateChange: (next) => {
      remember('changed schedule rules')
      setTemplate(next)
    },
    onUseDefaultTemplate: restoreDefaultTemplate,
  }

  return <div ref={controller} data-scheduler-station={requestStation} hidden={!active} inert={!active}>
    <InternalTheme><div className={css.screen} data-scheduler-content>
      <header className={css.header}>
        <h1>{t('planning.title')}</h1>
        <div className={css.actions}>
          <Link href="/scheduler-demo">{text('Change station')}</Link>
          <Link href={`/schedule/${requestStation}`} target="_blank" rel="noopener noreferrer">{t('planning.staffView')}<span className="sr-only"> {text('(opens in a new tab)')}</span></Link>
          <button type="button" onClick={()=>window.print()} disabled={!schedulePassing || mutationBusy}>{t('planning.print')}</button>
        </div>
      </header>
      <SchedulerNavigation view={tab} settingsDirty={setupParts.length>0} onChange={changeView}
        labels={{schedule:t('planning.schedule'),settings:t('planning.settings'),requests:text('Requests')}} neutral />
      <div className={css.week} aria-label={text('Selected week')}>
        <button type="button" aria-label={t('planning.previous')} disabled={!weekStart||mutationBusy} onClick={()=>goToWeek(shiftWeek(weekStart,-1))}>←</button>
        <p aria-live="polite">{weekStart ? planningWeek(weekStart,dateForDay(weekStart,'Saturday'),requestLocale) : t('planning.loading')}</p>
        <button type="button" aria-label={t('planning.next')} disabled={!weekStart||mutationBusy} onClick={()=>goToWeek(shiftWeek(weekStart,1))}>→</button>
        {weekStart!==currentWeekStart()&&<button type="button" disabled={mutationBusy} onClick={()=>goToWeek(currentWeekStart())}>{t('planning.thisWeek')}</button>}
        <button type="button" id="set-week-hours" aria-expanded={!!hoursEditor} disabled={!weekStart||scheduleWorkspace.hoursDisabled||mutationBusy} onClick={event=>openHoursEditor(null,event.currentTarget)}>{t('hours.setHours')}</button>
      </div>
      <p className={css.status} role="status">{working ? text('Draft for this visit. Reloading or closing this tab loses unsaved changes.') : currentPublishState ? t(`planning.status.${currentPublishState}`) : text('Not published')}
        {otherWeeksWithEdits.length>0&&<span> · {otherWeeksWithEdits.length} {text('other weeks with unpublished changes')}</span>}
      </p>
      <HoursBanner source={hoursSource} pending={resolvedHours.pending} locale={requestLocale} onReview={openHours}/>
      {hoursSource.phase==='ready'&&hoursSource.page&&hoursSource.page.events.length>0&&<HoursStationStatus page={hoursSource.page} week={weekStart} station={requestStation} base={baseSlots} reviews={activeHoursReviews} locale={requestLocale} onReview={openHours}/>}
      {storeLoading&&<p role="status">{text('Loading your saved schedule…')}</p>}
      {!storeLoading&&storeOffline&&<div className={css.warning} role="alert"><p>{text('Could not reach the server. Your working copy is retained. Saving is unavailable until the saved setup loads.')}</p><button onClick={()=>{if(rosterLoadError){setDefaultRosterLoaded(false);setRosterLoadedWeeks(current=>({...current,[weekStart]:false}))}if(templateLoadError){setDefaultTemplateLoaded(false);setTemplateLoadedWeeks(current=>({...current,[weekStart]:false}))}if(staffLoadError)setStaffLoaded(false);setRetryLoad(value=>value+1)}}>{text('Try again')}</button></div>}
      {(setupParts.length>0||setupError||setupNotice)&&<div className={css.notice} role="status">
        <p>{setupError ? text(setupError) : setupNotice ? text(setupNotice) : text('Staff or rule changes are unsaved. They stay when you switch views.')}</p>
        {setupParts.length>0&&tab!=='settings'&&<button onClick={()=>openEmployeeSettings(ruleProblems.length>0)}>{t('planning.settings')}</button>}
      </div>}
      {tab==='settings'&&isNewStation&&<p className={css.notice}>{text('New station — add your staff to begin')}</p>}
      <section id="scheduler-panel-schedule" role="tabpanel" aria-labelledby="scheduler-tab-schedule" tabIndex={-1} hidden={tab!=='schedule'}>
        {externalAvailability&&<p role="status" className={css.warning}>{t('planning.external')}</p>}
        {ruleProblems.length>0&&<div role="alert" className={css.warning}><p>{text('Fix shift rules before building or publishing.')}</p><button onClick={()=>openEmployeeSettings(true)}>{text('Review shift rules')}</button></div>}
        {!storeLoading&&activeEmployeeCount===0&&<p className={css.notice}><button onClick={()=>openEmployeeSettings()}>{text('Add employees in Staff & rules before making a schedule.')}</button></p>}
        {sharing&&weekStart&&ruleProblems.length===0&&<fieldset disabled={adjustment.busy||isGenerating||hoursBlocked}><PublishPanel snapshot={hoursSnapshot} canPublishEmpty={canPublishEmpty}
          weekStart={weekStart} weekLabel={formatWeekRange(weekStart)} slots={slots} employees={scheduleEmployees} assignments={assignments}
          visible={weekVisibility==='on'} onVisibilityChange={status=>setWeekVisibility(weekStart,status)} onClose={()=>setSharing(false)}
          restaurantId={restaurantId} restaurantName={restaurantName??undefined} unsavedSetup={setupParts}
          onSaveSetup={()=>saveSetup({alsoRules:true})} onBusyChange={setPublishBusy}
          onPublished={doc=>{adjustment.clearReport();setPublishedWeeks(current=>({...current,[weekStart]:doc}));setPublishedBaselines(current=>({...current,[weekStart]:assignmentFingerprint(assignments)}));setLiveMonthWeeks(current=>({...current,[weekStart]:doc.visible}));setLayoutMismatchWeeks(current=>({...current,[weekStart]:false}));void hoursSource.reload()}}/>
        </fieldset>}
        <fieldset disabled={mutationBusy}>
          <PlanningWorkspace data={scheduleWorkspace} locale={requestLocale} auto={autoAdjust} onAuto={setAutoAdjust} busy={adjustment.busy}
            disabled={!active||storeLoading||storeOffline||hoursBlocked} report={adjustment.report} error={adjustment.error}
            onPlace={placeInWorkspace} exclusions={exclusions} onRemove={removeFromWorkspace} onAllow={allowInWorkspace}
            onAdjust={()=>{setExternalAvailability(false);void adjustment.run(input=>input.assignments,true)}}
            onRequest={(employeeId,date)=>{setRequestPrefill({id:crypto.randomUUID(),employeeId,date});changeView('requests',true)}}
            onEmployee={employeeId=>{setFocusEmployeeId(employeeId);setStaffQuery(employees.find(e=>e.id===employeeId)?.name??'');openEmployeeSettings()}}/>
        </fieldset>
      </section>
      {AGENT_API&&<details className={css.assistant} hidden={tab!=='schedule'}><summary>{t('planning.assistant')}</summary>{weekStart&&active&&<SchedulingAgent key={`${requestStation}:${weekStart}:${session.generation}`} token={managerCode}
        context={{...agentHoursContext,stationId:requestStation,weekStart,employees,template,assignments:assignments.filter(item=>item.employeeId),requests:{phase:requestSource.phase,revision:requestSource.record?.revision??0,data:requestSource.record?.data??null}}}
        disabled={storeLoading||storeOffline||isGenerating||adjustment.busy||mutationBusy||ruleProblems.length>0||requestSource.phase!=='ready'||requestDirty||hoursBlocked}
        onApply={next=>{adjustment.clearReport();commitSchedule('schedule before assistant proposal',next);setGeneratedAssignments(cloneAssignmentList(next));setWeekStatus(current=>({...current,[weekStart]:'on'}));setIgnoredIssueIds([]);setDiagnostics(['Assistant proposal added to the draft. Review the board, then publish when ready.'])}}/>}</details>}
      <section id="scheduler-panel-settings" role="tabpanel" aria-labelledby="scheduler-tab-settings" tabIndex={-1} hidden={tab!=='settings'}><fieldset disabled={mutationBusy||storeLoading||storeOffline}><StaffWorkspace {...staffWorkspace}/></fieldset></section>
      <section id="scheduler-panel-requests" role="tabpanel" aria-labelledby="scheduler-tab-requests" tabIndex={-1} hidden={tab!=='requests'}>{requestsPanel}</section>
    </div></InternalTheme>
    <div className={css.paper} data-scheduler-print hidden={!active}>
      <header><h1>{restaurantName??requestStation} — Weekly schedule</h1><p>{weekStart?formatWeekRange(weekStart):''} · {currentPublishState??'draft'}</p></header>
      <SpecialHoursSummary days={resolvedHours.days} locale="en"/>
      <ScheduleWorkspace {...scheduleWorkspace} hoursLocale="en"/>
    </div>
    {hoursEditor&&rosterLoaded&&templateLoaded&&!storeOffline&&hoursSource.page&&<HoursEditor key={`${requestStation}:${weekStart}:${hoursEditor.date??'week'}`} active={active}
      date={hoursEditor.date} week={weekStart} anchor={hoursEditor.anchor} station={requestStation} locale={requestLocale} source={hoursSource} base={baseSlots}
      assignments={assignments} employees={employees} locked={scheduleOnly&&!staffUnlocked} activeReviews={activeHoursReviews}
      onClose={()=>setHoursEditor(null)} onDirty={setHoursDirty} onBusy={setHoursBusy} onApplied={applyHours} onUnlock={unlockCrewEditing}/>}
  </div>
}
