import { requestRecord, saveRequests, readRequestMutation } from './schedule-requests'
import { isStationId } from '../../src/lib/internal-tools/contracts'
import { publishedHours, weeksInPeriod } from '../../src/lib/converter/published-hours'
import type { WeeklyStaffingTemplate } from '../../src/lib/scheduler/types'
import { historyPage, historyRecord, saveHistory } from './import-history'
import { directoryRecord, saveDirectory } from './import-directory'
interface KVNamespace {
  get(key: string): Promise<string | null>
  put(key: string, value: string, options?: { expirationTtl?: number; metadata?: unknown }): Promise<void>
  list(options: { prefix: string; cursor?: string }): Promise<{
    keys: { name: string; metadata?: unknown }[]
    list_complete: boolean
    cursor?: string
  }>
}

interface Env {
  SCHEDULES: KVNamespace
  /** Optional additive service binding; absence preserves legacy capabilities. */
  INTERNAL_DB?: LocalBindings['INTERNAL_DB']
  ALLOWED_ORIGIN?: string
  /** Manager write token for the golden schedule. Never shipped to browsers; the manager types it per save. */
  SCHEDULE_WRITE_TOKEN?: string
  /** Password that unlocks crew editing on schedule-only stations. Grants no other write. */
  STAFF_EDIT_PASSWORD?: string
}

export type StoredWeek = {
  v: 1 | 2
  id: string
  rev: number
  ciphertext: string
  templateHash: string
  weekStart: string
  updatedAt: string
  visible: boolean
  monthKey: string
}

export type VisibleWeekStub = {
  id: string
  weekStart: string
  rev: number
  updatedAt: string
  templateHash: string
}

const ID_RE = /^[A-Za-z0-9_-]{10}$/
const CIPHER_RE = /^[A-Za-z0-9_-]+$/
const HASH_RE = /^[0-9a-f]{1,16}$/
const WEEK_RE = /^\d{4}-\d{2}-\d{2}$/
const MONTH_RE = /^\d{4}-\d{2}$/
const MAX_CIPHER_CHARS = 16384
const MAX_BODY_CHARS = 20000
/** Cash-out days live 31 days so the 30-day history always has its oldest day. */
const CASHOUT_TTL_SECONDS = 31 * 86400
const CASHOUT_HISTORY_DAYS = 30
const CASHOUT_STORES = ['CR3', 'CR2'] as const
// Mirrors src/lib/cashout.ts (dashboard.js cannot import it); index.test.ts checks they agree.
const CASHOUT_FLOAT_CENTS = 10000
const CASHOUT_DENOMINATION_CENTS = [10000, 5000, 2000, 1000, 500, 100, 50, 25, 10, 5, 1]
const MAX_CASHIERS_PER_SHIFT = 20
const MONEY_INPUT_RE = /^-?\d{0,7}(\.\d{0,2})?$/
const DOC_TTL_SECONDS = 31536000
const WRITE_LIMIT_PER_HOUR = 60
/** Gate guesses get their own budget so they can never lock out legitimate saves. */
const VERIFY_LIMIT_PER_HOUR = 30

export const RESTAURANTS = ['CR3-diningroom', 'CR3-kitchen', 'CR2-kitchen', 'CR2-diningroom'] as const

export type RestaurantId = (typeof RESTAURANTS)[number]

export const DEFAULT_RESTAURANT: RestaurantId = 'CR3-diningroom'

/**
 * Stations whose default shift rules are fixed in code. Roster PUTs and the
 * global template PUT are refused here so nobody can fork the crew week to week
 * or replace the built-in rules. The crew is editable through the
 * password-gated `/api/staff` route, per-week rules accept the same staff
 * password, and the schedule itself stays writable.
 */
export const SCHEDULE_ONLY_RESTAURANTS: readonly RestaurantId[] = ['CR3-kitchen']

export function isScheduleOnlyRestaurant(restaurant: string): boolean {
  return (SCHEDULE_ONLY_RESTAURANTS as readonly string[]).includes(restaurant)
}

/** Schedule-only stations whose crew can still be edited behind the staff password (`/api/staff`). */
export function isStaffEditableRestaurant(restaurant: string): boolean {
  return isScheduleOnlyRestaurant(restaurant)
}

const RESTAURANT_RE = /^[A-Za-z0-9-]{2,40}$/

export function isValidRestaurant(value: unknown): value is RestaurantId {
  return typeof value === 'string' && (RESTAURANTS as readonly string[]).includes(value)
}

/** Query `?restaurant=` → validated id, default when omitted, null when invalid. */
export function restaurantFromUrl(url: URL): RestaurantId | null {
  const raw = url.searchParams.get('restaurant')
  if (raw === null || raw === '') return DEFAULT_RESTAURANT
  if (!RESTAURANT_RE.test(raw) || !isValidRestaurant(raw)) return null
  return raw
}

export function isValidId(id: string): boolean {
  return ID_RE.test(id)
}

export function monthKeyForWeekStart(weekStart: string): string {
  return weekStart.slice(0, 7)
}

export function normalizeStoredWeek(raw: unknown): StoredWeek | null {
  if (!raw || typeof raw !== 'object') return null
  const doc = raw as Record<string, unknown>
  if (typeof doc.id !== 'string' || !isValidId(doc.id)) return null
  if (typeof doc.ciphertext !== 'string' || typeof doc.templateHash !== 'string') return null
  if (typeof doc.weekStart !== 'string' || !WEEK_RE.test(doc.weekStart)) return null
  if (typeof doc.rev !== 'number' || typeof doc.updatedAt !== 'string') return null
  const visible = typeof doc.visible === 'boolean' ? doc.visible : true
  const monthKey =
    typeof doc.monthKey === 'string' && MONTH_RE.test(doc.monthKey)
      ? doc.monthKey
      : monthKeyForWeekStart(doc.weekStart)
  return {
    v: 2,
    id: doc.id,
    rev: doc.rev,
    ciphertext: doc.ciphertext,
    templateHash: doc.templateHash,
    weekStart: doc.weekStart,
    updatedAt: doc.updatedAt,
    visible,
    monthKey,
  }
}

export function validatePublishBody(body: unknown): { ciphertext: string; templateHash: string; weekStart: string; visible: boolean } | null {
  if (!body || typeof body !== 'object') return null
  const { ciphertext, templateHash, weekStart, visible } = body as Record<string, unknown>
  if (
    typeof ciphertext !== 'string' ||
    ciphertext.length === 0 ||
    ciphertext.length > MAX_CIPHER_CHARS ||
    !CIPHER_RE.test(ciphertext)
  ) {
    return null
  }
  if (typeof templateHash !== 'string' || !HASH_RE.test(templateHash)) return null
  if (typeof weekStart !== 'string' || !WEEK_RE.test(weekStart)) return null
  if (visible !== undefined && typeof visible !== 'boolean') return null
  const nextVisible = visible === undefined ? true : (visible as boolean)
  return { ciphertext, templateHash, weekStart, visible: nextVisible }
}

export function validateUpdateBody(body: unknown): { ciphertext?: string; visible?: boolean; baseRev: number } | null {
  if (!body || typeof body !== 'object') return null
  const { ciphertext, visible, baseRev } = body as Record<string, unknown>
  if (typeof baseRev !== 'number' || !Number.isInteger(baseRev) || baseRev < 1) return null
  let nextCipher: string | undefined
  if (ciphertext !== undefined) {
    if (
      typeof ciphertext !== 'string' ||
      ciphertext.length === 0 ||
      ciphertext.length > MAX_CIPHER_CHARS ||
      !CIPHER_RE.test(ciphertext)
    ) {
      return null
    }
    nextCipher = ciphertext
  }
  if (visible !== undefined && typeof visible !== 'boolean') return null
  if (nextCipher === undefined && visible === undefined) return null
  return { ciphertext: nextCipher, visible: visible as boolean | undefined, baseRev }
}

export function newShareId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(7))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

// --- Golden schedule (one persistent codeless schedule, edited by scheduler-demo) ---

export type GoldenWeekPayload = {
  version: number
  weekStart: string
  name: string
  people: string[]
  slotPeople: number[]
}

export type GoldenWeekDoc = {
  v: 3
  weekStart: string
  rev: number
  week: GoldenWeekPayload
  visible: boolean
  templateHash: string
  updatedAt: string
}

const GOLDEN_VERSION = 1
const MAX_PEOPLE = 64
const MAX_NAME_CHARS = 80
const MAX_TITLE_CHARS = 120
const MAX_SLOTS = 200

export function goldenKey(weekStart: string, restaurant: string = DEFAULT_RESTAURANT): string {
  return `r:${restaurant}:golden:${weekStart}`
}

export function legacyGoldenKey(weekStart: string): string {
  return `golden:${weekStart}`
}

export function goldenMonthRevKey(monthKey: string, restaurant: string = DEFAULT_RESTAURANT): string {
  return `r:${restaurant}:golden:month-rev:${monthKey}`
}

export function legacyGoldenMonthRevKey(monthKey: string): string {
  return `golden:month-rev:${monthKey}`
}

function shiftGoldenDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day) + days * 86400000).toISOString().slice(0, 10)
}

/** Every month grid that shows this Sunday week: its own month plus the month its Saturday falls in. */
export function goldenMonthsForWeek(weekStart: string): string[] {
  if (!WEEK_RE.test(weekStart)) return []
  return [...new Set([weekStart.slice(0, 7), shiftGoldenDate(weekStart, 6).slice(0, 7)])]
}

export async function readGoldenMonthRev(env: Env, monthKey: string, restaurant: string = DEFAULT_RESTAURANT): Promise<number> {
  try {
    const raw = await env.SCHEDULES.get(goldenMonthRevKey(monthKey, restaurant))
    const rev = raw ? Number.parseInt(raw, 10) : 0
    return Number.isInteger(rev) && rev > 0 ? rev : 0
  } catch {
    return 0
  }
}

async function bumpGoldenMonthRevs(env: Env, weekStart: string, restaurant: string = DEFAULT_RESTAURANT): Promise<void> {
  for (const month of goldenMonthsForWeek(weekStart)) {
    const rev = await readGoldenMonthRev(env, month, restaurant)
    try {
      await env.SCHEDULES.put(goldenMonthRevKey(month, restaurant), String(rev + 1), { expirationTtl: DOC_TTL_SECONDS })
    } catch {
      return
    }
  }
}

async function readGoldenDoc(env: Env, restaurant: string, weekStart: string): Promise<string | null> {
  const raw = await env.SCHEDULES.get(goldenKey(weekStart, restaurant))
  if (raw) return raw
  // Migration fallback: pre-partition data lives under legacy keys and belongs to the default restaurant.
  if (restaurant === DEFAULT_RESTAURANT) {
    return await env.SCHEDULES.get(legacyGoldenKey(weekStart))
  }
  return null
}

export function validateGoldenWeekBody(
  body: unknown,
): { week: GoldenWeekPayload; visible: boolean; baseRev: number } | null {
  if (!body || typeof body !== 'object') return null
  const { week, visible, baseRev } = body as Record<string, unknown>
  if (typeof baseRev !== 'number' || !Number.isInteger(baseRev) || baseRev < 0) return null
  if (!week || typeof week !== 'object') return null
  const candidate = week as Record<string, unknown>
  if (candidate.version !== GOLDEN_VERSION) return null
  if (typeof candidate.weekStart !== 'string' || !WEEK_RE.test(candidate.weekStart)) return null
  if (typeof candidate.name !== 'string' || candidate.name.length > MAX_TITLE_CHARS) return null
  const people: unknown = candidate.people
  if (!Array.isArray(people) || people.length > MAX_PEOPLE) return null
  if (
    !people.every(
      (person): person is string => typeof person === 'string' && person.length > 0 && person.length <= MAX_NAME_CHARS,
    )
  ) {
    return null
  }
  const slotPeople: unknown = candidate.slotPeople
  if (!Array.isArray(slotPeople) || slotPeople.length > MAX_SLOTS) return null
  const personCount = people.length
  if (
    !slotPeople.every(
      (index): index is number =>
        typeof index === 'number' && Number.isInteger(index) && index >= -1 && index < personCount,
    )
  ) {
    return null
  }
  if (visible !== undefined && typeof visible !== 'boolean') return null
  const nextVisible = visible === undefined ? true : (visible as boolean)
  return {
    week: {
      version: GOLDEN_VERSION,
      weekStart: candidate.weekStart,
      name: candidate.name,
      people: [...(people as string[])],
      slotPeople: [...(slotPeople as number[])],
    },
    visible: nextVisible,
    baseRev,
  }
}

export function normalizeGoldenDoc(raw: unknown): GoldenWeekDoc | null {
  if (!raw || typeof raw !== 'object') return null
  const doc = raw as Record<string, unknown>
  if (doc.v !== 3) return null
  if (typeof doc.weekStart !== 'string' || !WEEK_RE.test(doc.weekStart)) return null
  if (typeof doc.rev !== 'number' || !Number.isInteger(doc.rev) || doc.rev < 1) return null
  if (typeof doc.templateHash !== 'string' || !HASH_RE.test(doc.templateHash)) return null
  if (typeof doc.updatedAt !== 'string') return null
  const week = validateGoldenWeekBody({ week: doc.week, baseRev: doc.rev })
  if (!week) return null
  if (week.week.weekStart !== doc.weekStart) return null
  return {
    v: 3,
    weekStart: doc.weekStart,
    rev: doc.rev,
    week: week.week,
    visible: doc.visible !== false,
    templateHash: doc.templateHash,
    updatedAt: doc.updatedAt,
  }
}

const GOLDEN_DAY_MS = 24 * 60 * 60 * 1000

/** Every Sunday-week touching the month, mirroring weeksForMonth in the web app. */
export function goldenWeeksForMonth(monthKey: string): string[] {
  if (!MONTH_RE.test(monthKey)) return []
  const [year, month] = monthKey.split('-').map(Number)
  const firstMs = Date.UTC(year, month - 1, 1)
  const lastMs = Date.UTC(year, month, 0)
  const firstSundayMs = firstMs - new Date(firstMs).getUTCDay() * GOLDEN_DAY_MS
  const weeks: string[] = []
  for (let cursor = firstSundayMs; cursor <= lastMs; cursor += 7 * GOLDEN_DAY_MS) {
    weeks.push(new Date(cursor).toISOString().slice(0, 10))
  }
  return weeks
}

// --- Employee roster (staff lists are per-week, with the global doc as the seed) ---

const LEGACY_ROSTER_KEY = 'roster:current'

function rosterKey(restaurant: string = DEFAULT_RESTAURANT): string {
  return `r:${restaurant}:roster:current`
}

export function rosterKeyForWeek(restaurant: string, weekStart: string): string {
  return `r:${restaurant}:roster:${weekStart}`
}

export function parseWeekStartParam(url: URL): { present: false } | { present: true; valid: boolean; value: string } {
  const raw = url.searchParams.get('weekStart')
  if (raw === null || raw === '') return { present: false }
  if (!WEEK_RE.test(raw)) return { present: true, valid: false, value: raw }
  return { present: true, valid: true, value: raw }
}

async function readRosterRaw(env: Env, restaurant: string): Promise<string | null> {
  const raw = await env.SCHEDULES.get(rosterKey(restaurant))
  if (raw) return raw
  if (restaurant === DEFAULT_RESTAURANT) {
    return await env.SCHEDULES.get(LEGACY_ROSTER_KEY)
  }
  return null
}
const ROSTER_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
// Posts are extensible: dining defaults plus every kitchen post, plus any
// manager-defined custom post slug (e.g. "sushi-chef"). Validation accepts any
// well-formed slug so new posts never need a Worker redeploy to save.
const KNOWN_ROLES = [
  'server',
  'cashier',
  'lead',
  'manager',
  'cook',
  'line-cook',
  'fried-rice',
  'dishwasher',
  'meat-prep',
  'veggie-prep',
  'mv-prep',
  'shadow',
]
const ROLE_SLUG_RE = /^[a-z0-9-]{1,40}$/

export function isValidRole(value: unknown): value is string {
  return typeof value === 'string' && ROLE_SLUG_RE.test(value)
}
const MAX_EMPLOYEES = 100
const MAX_RANGES_PER_DAY = 6
const MAX_MINUTES_PER_DAY = 24 * 60
const MAX_EMPLOYEE_ID_CHARS = 64
const MAX_INCOMPATIBLE_IDS = 20

export type StoredTimeRange = { start: number; end: number }

export type StoredEmployee = {
  id: string
  name: string
  roles: string[]
  recurringAvailability: Record<string, StoredTimeRange[]>
  maxDaysPerWeek?: number
  maxShiftsPerWeek?: number
  allowDoubles: boolean
  maxDoublesPerWeek?: number
  incompatibleEmployeeIds: string[]
  active: boolean
  newHire: boolean
  suspendedFrom?: string
  suspendedUntil?: string
  priority?: number
  shiftRoles?: { day: string; period: string; role: string }[]
}

export type RosterDoc = {
  v: 1
  rev: number
  employees: StoredEmployee[]
  updatedAt: string
}

function isValidStoredTimeRange(value: unknown): value is StoredTimeRange {
  if (!value || typeof value !== 'object') return false
  const { start, end } = value as Record<string, unknown>
  return (
    typeof start === 'number' &&
    typeof end === 'number' &&
    Number.isInteger(start) &&
    Number.isInteger(end) &&
    start >= 0 &&
    end <= MAX_MINUTES_PER_DAY &&
    start < end
  )
}

function isValidStoredEmployee(value: unknown): value is StoredEmployee {
  if (!value || typeof value !== 'object') return false
  const employee = value as Record<string, unknown>
  if (
    typeof employee.id !== 'string' ||
    employee.id.length === 0 ||
    employee.id.length > MAX_EMPLOYEE_ID_CHARS ||
    !/^[a-z0-9-]+$/.test(employee.id)
  ) {
    return false
  }
  if (typeof employee.name !== 'string' || employee.name.length === 0 || employee.name.length > MAX_NAME_CHARS) return false
  if (!Array.isArray(employee.roles) || !employee.roles.every(isValidRole)) {
    return false
  }
  if (!employee.recurringAvailability || typeof employee.recurringAvailability !== 'object') return false
  const availability = employee.recurringAvailability as Record<string, unknown>
  for (const [day, ranges] of Object.entries(availability)) {
    if (!ROSTER_DAYS.includes(day)) return false
    if (!Array.isArray(ranges) || ranges.length > MAX_RANGES_PER_DAY || !ranges.every(isValidStoredTimeRange)) return false
  }
  if (employee.maxDaysPerWeek !== undefined) {
    if (typeof employee.maxDaysPerWeek !== 'number' || !Number.isInteger(employee.maxDaysPerWeek) || employee.maxDaysPerWeek < 1 || employee.maxDaysPerWeek > 7) {
      return false
    }
  }
  if (employee.maxShiftsPerWeek !== undefined) {
    if (typeof employee.maxShiftsPerWeek !== 'number' || !Number.isInteger(employee.maxShiftsPerWeek) || employee.maxShiftsPerWeek < 1 || employee.maxShiftsPerWeek > 21) {
      return false
    }
  }
  if (typeof employee.allowDoubles !== 'boolean') return false
  if (employee.maxDoublesPerWeek !== undefined) {
    if (
      typeof employee.maxDoublesPerWeek !== 'number' ||
      !Number.isInteger(employee.maxDoublesPerWeek) ||
      employee.maxDoublesPerWeek < 0 ||
      employee.maxDoublesPerWeek > 7
    ) {
      return false
    }
  }
  if (
    !Array.isArray(employee.incompatibleEmployeeIds) ||
    employee.incompatibleEmployeeIds.length > MAX_INCOMPATIBLE_IDS ||
    !employee.incompatibleEmployeeIds.every((id) => typeof id === 'string')
  ) {
    return false
  }
  if (typeof employee.active !== 'boolean') return false
  if (employee.newHire !== undefined && typeof employee.newHire !== 'boolean') return false
  for (const date of [employee.suspendedFrom, employee.suspendedUntil]) {
    if (date !== undefined && (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date))) return false
  }
  if (employee.suspendedUntil !== undefined && employee.suspendedFrom === undefined) return false
  if (employee.suspendedFrom !== undefined && employee.suspendedUntil !== undefined && (employee.suspendedUntil as string) < (employee.suspendedFrom as string)) {
    return false
  }
  if (employee.priority !== undefined) {
    if (typeof employee.priority !== 'number' || !Number.isInteger(employee.priority) || employee.priority < 1 || employee.priority > 5) return false
  }
  if (employee.shiftRoles !== undefined) {
    if (!Array.isArray(employee.shiftRoles) || employee.shiftRoles.length > ROSTER_DAYS.length * 2) return false
    const seen = new Set<string>()
    for (const entry of employee.shiftRoles as unknown[]) {
      if (!entry || typeof entry !== 'object') return false
      const { day, period, role } = entry as Record<string, unknown>
      if (typeof day !== 'string' || !ROSTER_DAYS.includes(day) || (period !== 'AM' && period !== 'PM') || !isValidRole(role)) return false
      if (seen.has(`${day}:${period}`)) return false
      seen.add(`${day}:${period}`)
    }
  }
  return true
}

export function validateRosterBody(body: unknown): { employees: StoredEmployee[]; baseRev: number } | null {
  if (!body || typeof body !== 'object') return null
  const { employees, baseRev } = body as Record<string, unknown>
  if (typeof baseRev !== 'number' || !Number.isInteger(baseRev) || baseRev < 0) return null
  if (!Array.isArray(employees) || employees.length > MAX_EMPLOYEES) return null
  if (!employees.every(isValidStoredEmployee)) return null
  const ids = new Set((employees as StoredEmployee[]).map((employee) => employee.id))
  if (ids.size !== employees.length) return null
  return {
    employees: (employees as StoredEmployee[]).map((employee) => ({ ...employee, newHire: employee.newHire ?? false })),
    baseRev,
  }
}

export function normalizeRosterDoc(raw: unknown): RosterDoc | null {
  if (!raw || typeof raw !== 'object') return null
  const doc = raw as Record<string, unknown>
  if (doc.v !== 1) return null
  if (typeof doc.rev !== 'number' || !Number.isInteger(doc.rev) || doc.rev < 1) return null
  if (typeof doc.updatedAt !== 'string') return null
  const valid = validateRosterBody({ employees: doc.employees, baseRev: doc.rev })
  if (!valid) return null
  return { v: 1, rev: doc.rev, employees: valid.employees, updatedAt: doc.updatedAt }
}

// --- Station crew (password-gated staff editing for schedule-only stations) ---
// One crew per station, shared by every week. `employees: null` means the
// built-in crew from code. Each save pushes the replaced crew onto `history`
// so `POST /api/staff/undo` can step back through recent saves.

const STAFF_HISTORY_LIMIT = 10

export type StaffHistoryEntry = { employees: StoredEmployee[] | null; updatedAt: string | null }

export type StaffDoc = {
  v: 1
  rev: number
  employees: StoredEmployee[] | null
  updatedAt: string
  history: StaffHistoryEntry[]
}

export function staffKey(restaurant: string): string {
  return `r:${restaurant}:staff:current`
}

function normalizeStaffEmployees(value: unknown): StoredEmployee[] | null | undefined {
  if (value === null) return null
  const valid = validateRosterBody({ employees: value, baseRev: 0 })
  return valid ? valid.employees : undefined
}

export function normalizeStaffDoc(raw: unknown): StaffDoc | null {
  if (!raw || typeof raw !== 'object') return null
  const doc = raw as Record<string, unknown>
  if (doc.v !== 1) return null
  if (typeof doc.rev !== 'number' || !Number.isInteger(doc.rev) || doc.rev < 1) return null
  if (typeof doc.updatedAt !== 'string') return null
  const employees = normalizeStaffEmployees(doc.employees)
  if (employees === undefined) return null
  if (!Array.isArray(doc.history)) return null
  const history: StaffHistoryEntry[] = []
  for (const entry of doc.history.slice(0, STAFF_HISTORY_LIMIT)) {
    if (!entry || typeof entry !== 'object') return null
    const { employees: entryEmployees, updatedAt } = entry as Record<string, unknown>
    const normalized = normalizeStaffEmployees(entryEmployees)
    if (normalized === undefined) return null
    if (updatedAt !== null && typeof updatedAt !== 'string') return null
    history.push({ employees: normalized, updatedAt: (updatedAt as string | null) ?? null })
  }
  return { v: 1, rev: doc.rev, employees, updatedAt: doc.updatedAt, history }
}

export function validateStaffUndoBody(body: unknown): { baseRev: number } | null {
  if (!body || typeof body !== 'object') return null
  const { baseRev } = body as Record<string, unknown>
  if (typeof baseRev !== 'number' || !Number.isInteger(baseRev) || baseRev < 1) return null
  return { baseRev }
}

async function readStaffDoc(env: Env, restaurant: string): Promise<StaffDoc | null> {
  const raw = await env.SCHEDULES.get(staffKey(restaurant))
  return raw ? normalizeStaffDoc(safeParse(raw)) : null
}

function staffResponse(doc: StaffDoc | null) {
  return {
    employees: doc?.employees ?? null,
    rev: doc?.rev ?? 0,
    updatedAt: doc?.updatedAt ?? null,
    canUndo: (doc?.history.length ?? 0) > 0,
  }
}

// --- Staffing template (rules are per-week, with the global doc as the seed) ---

const LEGACY_TEMPLATE_KEY = 'template:current'

function templateKey(restaurant: string = DEFAULT_RESTAURANT): string {
  return `r:${restaurant}:template:current`
}

export function templateKeyForWeek(restaurant: string, weekStart: string): string {
  return `r:${restaurant}:template:${weekStart}`
}

async function readTemplateRaw(env: Env, restaurant: string): Promise<string | null> {
  const raw = await env.SCHEDULES.get(templateKey(restaurant))
  if (raw) return raw
  if (restaurant === DEFAULT_RESTAURANT) {
    return await env.SCHEDULES.get(LEGACY_TEMPLATE_KEY)
  }
  return null
}
const MAX_SLOTS_PER_DAY = 20
const MAX_LABEL_CHARS = 60

export type StoredTemplateSlot = {
  period: 'AM' | 'PM'
  role: string
  label: string
  start: number
  end: number
  required: boolean
}

export type StoredTemplate = Record<string, StoredTemplateSlot[]>

export type TemplateDoc = {
  v: 1
  rev: number
  template: StoredTemplate
  updatedAt: string
}

function isValidStoredTemplateSlot(value: unknown): value is StoredTemplateSlot {
  if (!value || typeof value !== 'object') return false
  const slot = value as Record<string, unknown>
  if (slot.period !== 'AM' && slot.period !== 'PM') return false
  if (!isValidRole(slot.role)) return false
  if (typeof slot.label !== 'string' || slot.label.length === 0 || slot.label.length > MAX_LABEL_CHARS) return false
  if (typeof slot.start !== 'number' || !Number.isInteger(slot.start) || slot.start < 0 || slot.start >= MAX_MINUTES_PER_DAY) return false
  if (typeof slot.end !== 'number' || !Number.isInteger(slot.end) || slot.end <= slot.start || slot.end > MAX_MINUTES_PER_DAY) return false
  if (typeof slot.required !== 'boolean') return false
  return true
}

export function validateTemplateBody(body: unknown): { template: StoredTemplate; baseRev: number } | null {
  if (!body || typeof body !== 'object') return null
  const { template, baseRev } = body as Record<string, unknown>
  if (typeof baseRev !== 'number' || !Number.isInteger(baseRev) || baseRev < 0) return null
  if (!template || typeof template !== 'object') return null
  const candidate = template as Record<string, unknown>
  if (Object.keys(candidate).some((key) => !ROSTER_DAYS.includes(key))) return null
  const result: StoredTemplate = {}
  for (const day of ROSTER_DAYS) {
    const slots = candidate[day] ?? []
    if (!Array.isArray(slots) || slots.length > MAX_SLOTS_PER_DAY || !slots.every(isValidStoredTemplateSlot)) return null
    result[day] = slots as StoredTemplateSlot[]
  }
  return { template: result, baseRev }
}

export function normalizeTemplateDoc(raw: unknown): TemplateDoc | null {
  if (!raw || typeof raw !== 'object') return null
  const doc = raw as Record<string, unknown>
  if (doc.v !== 1) return null
  if (typeof doc.rev !== 'number' || !Number.isInteger(doc.rev) || doc.rev < 1) return null
  if (typeof doc.updatedAt !== 'string') return null
  const valid = validateTemplateBody({ template: doc.template, baseRev: doc.rev })
  if (!valid) return null
  return { v: 1, rev: doc.rev, template: valid.template, updatedAt: doc.updatedAt }
}


export type CashoutCashier = { name: string; counts: number[]; toast: string }
export type CashoutTotals = {
  amDeposit: number
  pmDeposit: number
  amOverShort: number | null
  pmOverShort: number | null
  deposit: number
  overShort: number | null
  zOverShort: number | null
}
export type CashoutDay = {
  v: 1
  store: (typeof CASHOUT_STORES)[number]
  date: string
  sheet: { am: CashoutCashier[]; pm: CashoutCashier[]; zReport: string }
  totals: CashoutTotals
  updatedAt: string
}

function validateCashier(raw: unknown): CashoutCashier | null {
  if (!raw || typeof raw !== 'object') return null
  const c = raw as Record<string, unknown>
  if (typeof c.name !== 'string' || c.name.length > 60) return null
  if (typeof c.toast !== 'string' || !MONEY_INPUT_RE.test(c.toast)) return null
  if (!Array.isArray(c.counts) || c.counts.length !== CASHOUT_DENOMINATION_CENTS.length) return null
  if (!c.counts.every((n) => Number.isInteger(n) && n >= 0 && n <= 100000)) return null
  return { name: c.name, counts: c.counts as number[], toast: c.toast }
}

const moneyCents = (text: string) => {
  const n = parseFloat(text)
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}
const addOrNull = (a: number | null, b: number | null) => (a === null || b === null ? null : a + b)

function shiftCashoutTotals(cashiers: CashoutCashier[]) {
  return cashiers.reduce<{ deposit: number; overShort: number | null }>((t, c) => {
    const turnIn = c.counts.reduce((sum, n, i) => sum + CASHOUT_DENOMINATION_CENTS[i] * n, 0) - CASHOUT_FLOAT_CENTS
    const overShort = c.toast.trim() === '' ? null : turnIn - moneyCents(c.toast)
    return { deposit: t.deposit + turnIn, overShort: addOrNull(t.overShort, overShort) }
  }, { deposit: 0, overShort: 0 })
}

/** Notebook totals from the sheet alone: $100 kept per drawer, blank Toast/Z leaves that difference null. */
export function cashoutTotals(sheet: CashoutDay['sheet']): CashoutTotals {
  const am = shiftCashoutTotals(sheet.am)
  const pm = shiftCashoutTotals(sheet.pm)
  const deposit = am.deposit + pm.deposit
  return {
    amDeposit: am.deposit,
    pmDeposit: pm.deposit,
    amOverShort: am.overShort,
    pmOverShort: pm.overShort,
    deposit,
    overShort: addOrNull(am.overShort, pm.overShort),
    zOverShort: sheet.zReport.trim() === '' ? null : deposit - moneyCents(sheet.zReport),
  }
}

/** Validates the sheet and recomputes totals; any client-sent `totals` (older pages always send them) is ignored. */
export function validateCashoutBody(raw: unknown): Pick<CashoutDay, 'sheet' | 'totals'> | null {
  if (!raw || typeof raw !== 'object') return null
  const sheet = (raw as Record<string, unknown>).sheet as Record<string, unknown> | undefined
  if (!sheet || typeof sheet !== 'object') return null
  if (typeof sheet.zReport !== 'string' || !MONEY_INPUT_RE.test(sheet.zReport)) return null
  const shifts = [sheet.am, sheet.pm].map((shift) =>
    Array.isArray(shift) && shift.length <= MAX_CASHIERS_PER_SHIFT ? shift.map(validateCashier) : null,
  )
  if (shifts.some((shift) => !shift || shift.some((c) => !c))) return null
  const valid = { am: shifts[0] as CashoutCashier[], pm: shifts[1] as CashoutCashier[], zReport: sheet.zReport }
  return { sheet: valid, totals: cashoutTotals(valid) }
}

function cashoutKey(store: string, date: string) {
  return `cashout:${store}:${date}`
}

/** The 30 dates ending at `to`, newest first (UTC date math, no time zones involved). */
export function cashoutHistoryDates(to: string): string[] {
  const end = Date.parse(`${to}T00:00:00Z`)
  return Array.from({ length: CASHOUT_HISTORY_DAYS }, (_, i) => new Date(end - i * 86400000).toISOString().slice(0, 10))
}

// --- Supply inventory counts (one sheet per store per day) ---

const INVENTORY_TTL_SECONDS = 366 * 86400
const INVENTORY_HISTORY_DAYS = 14
const MAX_INVENTORY_ITEMS = 300
const INVENTORY_ITEM_RE = /^[a-z0-9-]{1,60}$/
// Counts like "3", "1/2", "3B/2T", or the ✓ mark for "enough".
const INVENTORY_CELL_RE = /^[A-Za-z0-9./ ✓]{0,12}$/

export type InventoryCell = { inv: string; order: string; done?: true }
export type InventoryDay = { v: 1; store: 'CR3'; date: string; counts: Record<string, InventoryCell>; updatedAt: string }

export function validateInventoryBody(raw: unknown): Pick<InventoryDay, 'counts'> | null {
  const counts = (raw as { counts?: unknown } | null)?.counts
  if (!counts || typeof counts !== 'object' || Array.isArray(counts)) return null
  const entries = Object.entries(counts)
  if (entries.length > MAX_INVENTORY_ITEMS) return null
  const out: Record<string, InventoryCell> = {}
  for (const [id, cell] of entries) {
    const { inv, order, done } = (cell ?? {}) as Record<string, unknown>
    if (!INVENTORY_ITEM_RE.test(id) || typeof inv !== 'string' || typeof order !== 'string') return null
    if (!INVENTORY_CELL_RE.test(inv) || !INVENTORY_CELL_RE.test(order) || (done !== undefined && typeof done !== 'boolean')) return null
    out[id] = done ? { inv, order, done } : { inv, order }
  }
  return { counts: out }
}

function inventoryKey(store: string, date: string) {
  return `inventory:${store}:${date}`
}

// The item list itself. Absent until a manager first saves it; the page then uses the built-in paper list.
const MAX_INVENTORY_SHEETS = 20
const MAX_INVENTORY_LIST_CHARS = 64000

export type InventoryListItem = { id: string; name: string; sup: string; use: string; gray: boolean; note?: string }
export type InventoryListSheet = { id: string; title?: string; account?: string; useLabel: string; showSup: boolean; items: InventoryListItem[] }
export type InventoryListDoc = { v: 1; rev: number; sheets: InventoryListSheet[]; updatedAt: string }

const optionalText = (v: unknown, max: number) => v === undefined || isText(v, max)

export function validateInventoryListBody(raw: unknown): { sheets: InventoryListSheet[]; baseRev: number } | null {
  const { sheets, baseRev } = (raw ?? {}) as Record<string, unknown>
  if (!Number.isInteger(baseRev) || (baseRev as number) < 0) return null
  if (!Array.isArray(sheets) || sheets.length < 1 || sheets.length > MAX_INVENTORY_SHEETS) return null
  const ids = new Set<string>()
  const out: InventoryListSheet[] = []
  for (const sheet of sheets) {
    const s = (sheet ?? {}) as Record<string, unknown>
    if (!INVENTORY_ITEM_RE.test(String(s.id)) || !isText(s.useLabel, 20) || typeof s.showSup !== 'boolean') return null
    if (!optionalText(s.title, 60) || !optionalText(s.account, 30) || !Array.isArray(s.items)) return null
    const items: InventoryListItem[] = []
    for (const item of s.items) {
      const i = (item ?? {}) as Record<string, unknown>
      if (typeof i.id !== 'string' || !INVENTORY_ITEM_RE.test(i.id) || ids.has(i.id)) return null
      if (!isText(i.name, 60) || !i.name.trim() || !isText(i.sup, 10) || typeof i.gray !== 'boolean') return null
      if (typeof i.use !== 'string' || !INVENTORY_CELL_RE.test(i.use) || i.use.includes('✓') || !optionalText(i.note, 20)) return null
      ids.add(i.id)
      items.push({ id: i.id, name: i.name, sup: i.sup, use: i.use, gray: i.gray, ...(i.note ? { note: i.note as string } : {}) })
    }
    const { title, account } = s as { title?: string; account?: string }
    out.push({ id: String(s.id), ...(title ? { title } : {}), ...(account ? { account } : {}), useLabel: s.useLabel as string, showSup: s.showSup, items })
  }
  if (ids.size > MAX_INVENTORY_ITEMS) return null
  return { sheets: out, baseRev: baseRev as number }
}

function inventoryListKey(store: string) {
  return `inventory-list:${store}`
}

// --- Employee write-ups (record of corrective action) ---

export const WRITEUP_VIOLATIONS = ['attendance', 'job-performance', 'conduct', 'company-policy', 'others'] as const
export const WRITEUP_ACTIONS = ['verbal', 'written', 'suspension', 'termination'] as const
const WRITEUP_SHORT_CHARS = 60
const WRITEUP_LONG_CHARS = 3000
/** Kept short so the list summary fits KV's 1024-byte metadata limit. */
const WRITEUP_LABEL_CHARS = 120

export type WriteUpForm = {
  date: string
  employee: string
  manager: string
  violations: string[]
  otherSpecify: string
  actions: string[]
  incident: string
  incidentCont: string
  expected: string
  employeeComments: string
  employeeSignature: string
  employeeSignedDate: string
  managerSignature: string
  managerSignedDate: string
}
export type WriteUpSummary = { id: string; date: string; employee: string; label: string }
export type WriteUpDoc = { v: 1; id: string; form: WriteUpForm; label: string; createdAt: string; labelUpdatedAt: string | null }

const isDate = (v: unknown): v is string => typeof v === 'string' && WEEK_RE.test(v) && !Number.isNaN(Date.parse(v))
const isText = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max
const isSubset = (v: unknown, allowed: readonly string[]): v is string[] =>
  Array.isArray(v) && v.length <= allowed.length && new Set(v).size === v.length && v.every((x) => allowed.includes(x))

export function validateWriteUpForm(raw: unknown): WriteUpForm | null {
  if (!raw || typeof raw !== 'object') return null
  const f = raw as Record<string, unknown>
  if (!isDate(f.date)) return null
  if (!isText(f.employee, WRITEUP_SHORT_CHARS) || !f.employee.trim()) return null
  if (!isSubset(f.violations, WRITEUP_VIOLATIONS) || !isSubset(f.actions, WRITEUP_ACTIONS)) return null
  const short = ['manager', 'otherSpecify', 'employeeSignature', 'managerSignature'] as const
  const long = ['incident', 'incidentCont', 'expected', 'employeeComments'] as const
  if (!short.every((k) => isText(f[k], WRITEUP_SHORT_CHARS))) return null
  if (!long.every((k) => isText(f[k], WRITEUP_LONG_CHARS))) return null
  if (![f.employeeSignedDate, f.managerSignedDate].every((d) => d === '' || isDate(d))) return null
  const form = Object.fromEntries(
    [...short, ...long, 'employeeSignedDate', 'managerSignedDate'].map((k) => [k, f[k]]),
  ) as Omit<WriteUpForm, 'date' | 'employee' | 'violations' | 'actions'>
  return { date: f.date, employee: f.employee.trim(), violations: f.violations, actions: f.actions, ...form }
}

export function validateWriteUpLabel(raw: unknown): string | null {
  const label = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).label : undefined
  return isText(label, WRITEUP_LABEL_CHARS) ? label.trim() : null
}

function writeUpKey(id: string) {
  return `writeup:${id}`
}

async function putWriteUp(env: Env, doc: WriteUpDoc): Promise<void> {
  // No TTL: these are personnel records. The metadata is the list row, so listing needs no per-record reads.
  const metadata = { date: doc.form.date, employee: doc.form.employee, label: doc.label }
  await env.SCHEDULES.put(writeUpKey(doc.id), JSON.stringify(doc), { metadata })
}

/** Newest date first, then employee name. */
export async function listWriteUps(env: Env): Promise<WriteUpSummary[]> {
  const out: WriteUpSummary[] = []
  let cursor: string | undefined
  do {
    const page = await env.SCHEDULES.list({ prefix: 'writeup:', cursor })
    for (const key of page.keys) {
      const meta = key.metadata as Omit<WriteUpSummary, 'id'> | undefined
      if (meta) out.push({ id: key.name.slice('writeup:'.length), ...meta })
    }
    cursor = page.list_complete ? undefined : page.cursor
  } while (cursor)
  return out.sort((a, b) => b.date.localeCompare(a.date) || a.employee.localeCompare(b.employee))
}

export function goldenWriteError(env: Env): 'write_not_configured' | null {
  return env.SCHEDULE_WRITE_TOKEN ? null : 'write_not_configured'
}

export function isGoldenWriteAuthorized(request: Request, env: Env): boolean {
  const token = env.SCHEDULE_WRITE_TOKEN ?? ''
  if (!token) return false
  return request.headers.get('Authorization') === `Bearer ${token}`
}

/**
 * Demo staff password. Hardcoded for now so crew editing works with no Worker
 * setup; set the STAFF_EDIT_PASSWORD secret to override it in production.
 */
export const DEFAULT_STAFF_EDIT_PASSWORD = 'test'

function staffPassword(env: Env): string {
  return env.STAFF_EDIT_PASSWORD || DEFAULT_STAFF_EDIT_PASSWORD
}

/** Crew and schedule-only per-week rule edits accept the staff password or the manager token. */
export function isStaffEditAuthorized(request: Request, env: Env): boolean {
  if (request.headers.get('Authorization') === `Bearer ${staffPassword(env)}`) return true
  return isGoldenWriteAuthorized(request, env)
}

/** Manager-token gate for private data. Null when authorized, else the error response to return. */
async function managerAuthError(request: Request, env: Env): Promise<Response | null> {
  if (goldenWriteError(env)) return json({ error: 'write_not_configured' }, 503, request, env)
  if (isGoldenWriteAuthorized(request, env)) return null
  // Wrong codes share the gate's guess budget so these routes can't be used to brute-force the token.
  if (!(await checkVerifyThrottle(env, clientIp(request)))) {
    return json({ error: 'rate_limited' }, 429, request, env, { 'Retry-After': '3600' })
  }
  return json({ error: 'unauthorized' }, 401, request, env)
}

function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ?? request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ?? 'unknown'
}

function corsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get('Origin') ?? ''
  const configured = (env.ALLOWED_ORIGIN ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
  const defaultOk =
    origin.startsWith('https://chinarose') ||
    origin.endsWith('.github.io') ||
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:')
  const allow = configured.length > 0 ? configured.includes(origin) : origin === '' || origin.startsWith('https://') || defaultOk
  return allow && origin !== ''
    ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
    : { 'Access-Control-Allow-Origin': '*' }
}

function json(data: unknown, status: number, request: Request, env: Env, extra?: HeadersInit): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env), ...extra },
  })
}

async function checkWriteThrottle(env: Env, ip: string): Promise<boolean> {
  try {
    const key = `rl:${ip}:${new Date().toISOString().slice(0, 13)}`
    const raw = await env.SCHEDULES.get(key)
    const count = raw ? Number.parseInt(raw, 10) || 0 : 0
    if (count >= WRITE_LIMIT_PER_HOUR) return false
    await env.SCHEDULES.put(key, String(count + 1), { expirationTtl: 3600 })
    return true
  } catch {
    return true
  }
}

/** Separate throttle for gate guesses (`GET /api/auth/verify`) — see VERIFY_LIMIT_PER_HOUR. */
async function checkVerifyThrottle(env: Env, ip: string): Promise<boolean> {
  try {
    const key = `rlv:${ip}:${new Date().toISOString().slice(0, 13)}`
    const raw = await env.SCHEDULES.get(key)
    const count = raw ? Number.parseInt(raw, 10) || 0 : 0
    if (count >= VERIFY_LIMIT_PER_HOUR) return false
    await env.SCHEDULES.put(key, String(count + 1), { expirationTtl: 3600 })
    return true
  } catch {
    return true
  }
}

async function readBody(request: Request, maxChars = MAX_BODY_CHARS): Promise<unknown> {
  const text = await request.text()
  if (text.length > maxChars) throw new Error('body_too_large')
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function monthIndexKey(monthKey: string) {
  return `month:${monthKey}`
}

async function readMonthIndex(env: Env, monthKey: string): Promise<string[]> {
  try {
    const raw = await env.SCHEDULES.get(monthIndexKey(monthKey))
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is string => typeof id === 'string' && isValidId(id))
  } catch {
    return []
  }
}

async function addToMonthIndex(env: Env, monthKey: string, id: string): Promise<void> {
  const existing = await readMonthIndex(env, monthKey)
  if (existing.includes(id)) return
  const next = [...existing, id].sort().slice(0, 60)
  try {
    await env.SCHEDULES.put(monthIndexKey(monthKey), JSON.stringify(next), { expirationTtl: DOC_TTL_SECONDS })
  } catch {
    return
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders(request, env),
          'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      })
    }

    const url = new URL(request.url)
    const path = url.pathname.replace(/\/+$/, '') || '/'

    if (request.method === 'GET' && (path === '/' || path === '/api/health')) {
      return json({ ok: true }, 200, request, env)
    }

    // Gate check for the scheduler demo entry screen. Same manager token as
    // the golden/roster/template PUTs — read-only, never writes anything.
    if (request.method === 'GET' && path === '/api/auth/verify') {
      if (goldenWriteError(env)) return json({ error: 'write_not_configured' }, 503, request, env)
      if (!(await checkVerifyThrottle(env, clientIp(request)))) {
        return json({ error: 'rate_limited' }, 429, request, env, { 'Retry-After': '3600' })
      }
      if (!isGoldenWriteAuthorized(request, env)) return json({ error: 'unauthorized' }, 401, request, env)
      return json({ ok: true }, 200, request, env)
    }

    const requestsMatch = path.match(/^\/api\/internal\/schedule-requests\/([^/]+)$/)
    if (requestsMatch && (request.method === 'GET' || request.method === 'PUT')) {
      const denied = await managerAuthError(request, env)
      if (denied) return denied
      const noStore = { 'Cache-Control': 'no-store' }
      const station = requestsMatch[1]
      if (!isStationId(station)) return json({ schemaVersion: 1, error: { code: 'validation_failed' } }, 400, request, env, noStore)
      if (!env.INTERNAL_DB) return json({ schemaVersion: 1, error: { code: 'backend_unconfigured' } }, 503, request, env, noStore)
      try {
        if (request.method === 'GET') return json({ record: await requestRecord(env.INTERNAL_DB, station) }, 200, request, env, noStore)
        if (!(await checkWriteThrottle(env, clientIp(request)))) return json({ error: 'rate_limited' }, 429, request, env, noStore)
        const result = await saveRequests(env.INTERNAL_DB, station, await readRequestMutation(request))
        return json(result.ok ? { record: result.record, replayed: result.replayed } : result.body, result.ok ? 200 : result.status, request, env, noStore)
      } catch { return json({ schemaVersion: 1, error: { code: 'unavailable' } }, 503, request, env, noStore) }
    }

    const importSchedulesMatch = path.match(/^\/api\/internal\/import-schedules\/(CR2|CR3)$/)
    if (importSchedulesMatch && request.method === 'GET') {
      const denied = await managerAuthError(request, env)
      if (denied) return denied
      const store = importSchedulesMatch[1], start = url.searchParams.get('start') ?? '', end = url.searchParams.get('end') ?? ''
      let weeks: string[]
      try { weeks = weeksInPeriod(start,end) } catch { return json({error:'invalid_period'},400,request,env) }
      try {
        const stations = RESTAURANTS.filter(station => station.startsWith(store+'-'))
        const publications = await Promise.all(stations.flatMap(station => weeks.map(async week => {
          const [raw,weekRaw,globalRaw] = await Promise.all([readGoldenDoc(env,station,week),env.SCHEDULES.get(templateKeyForWeek(station,week)),readTemplateRaw(env,station)])
          const weekDoc = weekRaw ? normalizeTemplateDoc(safeParse(weekRaw)) : null
          const globalDoc = globalRaw ? normalizeTemplateDoc(safeParse(globalRaw)) : null
          return publishedHours(station,week,raw?(safeParse(raw)??{}):null,(weekDoc?.template ?? null) as WeeklyStaffingTemplate|null,(globalDoc?.template ?? null) as WeeklyStaffingTemplate|null)
        })))
        return json({version:1,storeId:store,start,end,publications},200,request,env,{'Cache-Control':'no-store'})
      } catch { return json({schemaVersion:1,error:{code:'unavailable'}},503,request,env,{'Cache-Control':'no-store'}) }
    }

    const importHistoryMatch = path.match(/^\/api\/internal\/import-history\/(CR2|CR3)(?:\/([A-Za-z0-9_-]{1,128}))?$/)
    if (importHistoryMatch && (request.method === 'GET' || request.method === 'POST')) {
      const denied = await managerAuthError(request, env)
      if (denied) return denied
      const noStore = { 'Cache-Control': 'no-store' }
      if (!env.INTERNAL_DB) return json({schemaVersion:1,error:{code:'backend_unconfigured'}},503,request,env,noStore)
      const store = importHistoryMatch[1] as 'CR2'|'CR3'
      try {
        if (request.method === 'GET') {
          if (importHistoryMatch[2]) return json({record:await historyRecord(env.INTERNAL_DB,store,importHistoryMatch[2])},200,request,env,noStore)
          const page = await historyPage(env.INTERNAL_DB,store,url.searchParams.get('kind')??'',url.searchParams.get('start')??'',url.searchParams.get('end')??'',url.searchParams.get('cursor')??'')
          return json(page,200,request,env,noStore)
        }
        if (importHistoryMatch[2]) return json({error:'not_found'},404,request,env,noStore)
        if (!(await checkWriteThrottle(env,clientIp(request)))) return json({error:'rate_limited'},429,request,env)
        const result = await saveHistory(env.INTERNAL_DB,store,await readBody(request,1000000))
        return json(result.ok?{record:result.record,replayed:result.replayed}:result.body,result.ok?200:result.status,request,env,noStore)
      } catch { return json({schemaVersion:1,error:{code:'unavailable'}},503,request,env,noStore) }
    }

    const directoryMatch = path.match(/^\/api\/internal\/import-directory\/(CR2|CR3)$/)
    if (directoryMatch && (request.method === 'GET' || request.method === 'PUT')) {
      const denied = await managerAuthError(request, env)
      if (denied) return denied
      const noStore = { 'Cache-Control': 'no-store' }
      if (!env.INTERNAL_DB) return json({ schemaVersion: 1, error: { code: 'backend_unconfigured' } }, 503, request, env, noStore)
      const store = directoryMatch[1] as 'CR2' | 'CR3'
      try {
        if (request.method === 'GET') return json({ record: await directoryRecord(env.INTERNAL_DB, store) }, 200, request, env, noStore)
        if (!(await checkWriteThrottle(env, clientIp(request)))) return json({ error: 'rate_limited' }, 429, request, env)
        const result = await saveDirectory(env.INTERNAL_DB, store, await readBody(request, 300000))
        return json(result.ok ? { record: result.record, replayed: result.replayed } : result.body, result.ok ? 200 : result.status, request, env, noStore)
      } catch { return json({ schemaVersion: 1, error: { code: 'unavailable' } }, 503, request, env, noStore) }
    }

    // Cash-out days: manager token for reads and writes — these are cash figures.
    const cashoutMatch = path.match(/^\/api\/cashout\/(CR3|CR2)(?:\/(\d{4}-\d{2}-\d{2}))?$/)
    if (cashoutMatch && (request.method === 'GET' || request.method === 'PUT')) {
      const store = cashoutMatch[1] as CashoutDay['store']
      const date = cashoutMatch[2]
      const denied = await managerAuthError(request, env)
      if (denied) return denied
      const noStore = { 'Cache-Control': 'no-store' }

      if (request.method === 'GET' && !date) {
        const to = url.searchParams.get('to') ?? ''
        if (!WEEK_RE.test(to) || Number.isNaN(Date.parse(to))) return json({ error: 'invalid_to' }, 400, request, env)
        const raws = await Promise.all(cashoutHistoryDates(to).map((d) => env.SCHEDULES.get(cashoutKey(store, d))))
        const days = raws.flatMap((raw) => {
          const doc = raw ? (safeParse(raw) as CashoutDay | null) : null
          return doc ? [{ date: doc.date, totals: doc.totals, updatedAt: doc.updatedAt }] : []
        })
        return json({ days }, 200, request, env, noStore)
      }
      if (!date || Number.isNaN(Date.parse(date))) return json({ error: 'not_found' }, 404, request, env)

      if (request.method === 'GET') {
        const raw = await env.SCHEDULES.get(cashoutKey(store, date))
        const doc = raw ? safeParse(raw) : null
        if (!doc) return json({ error: 'not_found' }, 404, request, env)
        return json(doc, 200, request, env, noStore)
      }

      if (!(await checkWriteThrottle(env, clientIp(request)))) {
        return json({ error: 'rate_limited' }, 429, request, env, { 'Retry-After': '3600' })
      }
      let body: unknown
      try {
        body = await readBody(request)
      } catch {
        return json({ error: 'body_too_large' }, 413, request, env)
      }
      const valid = validateCashoutBody(body)
      if (!valid) return json({ error: 'invalid_body' }, 400, request, env)
      // shortcut: last save wins, add a rev check if two managers ever edit the same day at once.
      const doc: CashoutDay = { v: 1, store, date, ...valid, updatedAt: new Date().toISOString() }
      await env.SCHEDULES.put(cashoutKey(store, date), JSON.stringify(doc), { expirationTtl: CASHOUT_TTL_SECONDS })
      return json({ updatedAt: doc.updatedAt }, 200, request, env)
    }

    // Inventory item list: manager token for reads and writes, rev-checked so two editors cannot clobber each other.
    const inventoryListMatch = path.match(/^\/api\/inventory\/(CR3)\/list$/)
    if (inventoryListMatch && (request.method === 'GET' || request.method === 'PUT')) {
      const store = inventoryListMatch[1]
      const denied = await managerAuthError(request, env)
      if (denied) return denied
      const current = safeParse((await env.SCHEDULES.get(inventoryListKey(store))) ?? '') as InventoryListDoc | null
      if (request.method === 'GET') {
        const body = current ?? { v: 1, rev: 0, sheets: null, updatedAt: null }
        return json(body, 200, request, env, { 'Cache-Control': 'no-store' })
      }

      if (!(await checkWriteThrottle(env, clientIp(request)))) {
        return json({ error: 'rate_limited' }, 429, request, env, { 'Retry-After': '3600' })
      }
      let body: unknown
      try {
        body = await readBody(request, MAX_INVENTORY_LIST_CHARS)
      } catch {
        return json({ error: 'body_too_large' }, 413, request, env)
      }
      const valid = validateInventoryListBody(body)
      if (!valid) return json({ error: 'invalid_body' }, 400, request, env)
      const rev = current?.rev ?? 0
      if (valid.baseRev !== rev) return json({ error: 'conflict', rev, updatedAt: current?.updatedAt }, 409, request, env)
      const doc: InventoryListDoc = { v: 1, rev: rev + 1, sheets: valid.sheets, updatedAt: new Date().toISOString() }
      await env.SCHEDULES.put(inventoryListKey(store), JSON.stringify(doc))
      return json({ rev: doc.rev, updatedAt: doc.updatedAt }, 200, request, env)
    }

    // Inventory counts: manager token for reads and writes. GET returns the last 14 days so the sheet can show earlier columns.
    const inventoryMatch = path.match(/^\/api\/inventory\/(CR3)(?:\/(\d{4}-\d{2}-\d{2}))?$/)
    if (inventoryMatch && ((request.method === 'GET' && !inventoryMatch[2]) || (request.method === 'PUT' && inventoryMatch[2]))) {
      const store = inventoryMatch[1] as InventoryDay['store']
      const date = inventoryMatch[2]
      const denied = await managerAuthError(request, env)
      if (denied) return denied

      if (request.method === 'GET') {
        const to = url.searchParams.get('to') ?? ''
        if (!WEEK_RE.test(to) || Number.isNaN(Date.parse(to))) return json({ error: 'invalid_to' }, 400, request, env)
        const dates = cashoutHistoryDates(to).slice(0, INVENTORY_HISTORY_DAYS)
        const raws = await Promise.all(dates.map((d) => env.SCHEDULES.get(inventoryKey(store, d))))
        const days = raws.flatMap((raw) => {
          const doc = raw ? (safeParse(raw) as InventoryDay | null) : null
          return doc ? [{ date: doc.date, counts: doc.counts, updatedAt: doc.updatedAt }] : []
        })
        return json({ days }, 200, request, env, { 'Cache-Control': 'no-store' })
      }
      if (Number.isNaN(Date.parse(date))) return json({ error: 'not_found' }, 404, request, env)

      if (!(await checkWriteThrottle(env, clientIp(request)))) {
        return json({ error: 'rate_limited' }, 429, request, env, { 'Retry-After': '3600' })
      }
      let body: unknown
      try {
        body = await readBody(request)
      } catch {
        return json({ error: 'body_too_large' }, 413, request, env)
      }
      const valid = validateInventoryBody(body)
      if (!valid) return json({ error: 'invalid_body' }, 400, request, env)
      // shortcut: last save wins, add a rev check if two people ever count the same day at once.
      const doc: InventoryDay = { v: 1, store, date, ...valid, updatedAt: new Date().toISOString() }
      await env.SCHEDULES.put(inventoryKey(store, date), JSON.stringify(doc), { expirationTtl: INVENTORY_TTL_SECONDS })
      return json({ updatedAt: doc.updatedAt }, 200, request, env)
    }

    // Employee write-ups: manager token for reads and writes. The form is fixed once saved; only the label changes.
    const writeUpMatch = path.match(/^\/api\/writeups(?:\/([A-Za-z0-9_-]{10})(\/label)?)?$/)
    if (writeUpMatch) {
      const [, id, labelPath] = writeUpMatch
      const route = !id ? `${request.method} list` : labelPath ? `${request.method} label` : `${request.method} one`
      if (!['GET list', 'POST list', 'GET one', 'PUT label'].includes(route)) return json({ error: 'not_found' }, 404, request, env)
      const denied = await managerAuthError(request, env)
      if (denied) return denied
      const noStore = { 'Cache-Control': 'no-store' }

      if (route === 'GET list') return json({ writeUps: await listWriteUps(env) }, 200, request, env, noStore)
      const existing = id ? (safeParse((await env.SCHEDULES.get(writeUpKey(id))) ?? '') as WriteUpDoc | null) : null
      if (route === 'GET one') {
        return existing ? json(existing, 200, request, env, noStore) : json({ error: 'not_found' }, 404, request, env)
      }

      if (!(await checkWriteThrottle(env, clientIp(request)))) {
        return json({ error: 'rate_limited' }, 429, request, env, { 'Retry-After': '3600' })
      }
      let body: unknown
      try {
        body = await readBody(request)
      } catch {
        return json({ error: 'body_too_large' }, 413, request, env)
      }
      const now = new Date().toISOString()
      if (route === 'POST list') {
        const form = validateWriteUpForm(body)
        if (!form) return json({ error: 'invalid_body' }, 400, request, env)
        const doc: WriteUpDoc = { v: 1, id: newShareId(), form, label: '', createdAt: now, labelUpdatedAt: null }
        await putWriteUp(env, doc)
        return json({ id: doc.id, createdAt: doc.createdAt }, 201, request, env)
      }
      if (!existing) return json({ error: 'not_found' }, 404, request, env)
      const label = validateWriteUpLabel(body)
      if (label === null) return json({ error: 'invalid_body' }, 400, request, env)
      // shortcut: last save wins on the label, add a rev check if managers start overwriting each other.
      await putWriteUp(env, { ...existing, label, labelUpdatedAt: now })
      return json({ label, labelUpdatedAt: now }, 200, request, env)
    }

    if (request.method === 'POST' && path === '/api/weeks') {
      if (!(await checkWriteThrottle(env, clientIp(request)))) {
        return json({ error: 'rate_limited' }, 429, request, env, { 'Retry-After': '3600' })
      }
      let body: unknown
      try {
        body = await readBody(request)
      } catch {
        return json({ error: 'body_too_large' }, 413, request, env)
      }
      const valid = validatePublishBody(body)
      if (!valid) return json({ error: 'invalid_body' }, 400, request, env)
      const monthKey = monthKeyForWeekStart(valid.weekStart)
      const doc: StoredWeek = {
        v: 2,
        id: newShareId(),
        rev: 1,
        ciphertext: valid.ciphertext,
        templateHash: valid.templateHash,
        weekStart: valid.weekStart,
        updatedAt: new Date().toISOString(),
        visible: valid.visible,
        monthKey,
      }
      await env.SCHEDULES.put(`week:${doc.id}`, JSON.stringify(doc), { expirationTtl: DOC_TTL_SECONDS })
      await addToMonthIndex(env, monthKey, doc.id)
      return json({ id: doc.id, rev: doc.rev }, 201, request, env)
    }

    if (request.method === 'GET' && path === '/api/weeks') {
      const month = url.searchParams.get('month') ?? ''
      if (!MONTH_RE.test(month)) return json({ error: 'invalid_month' }, 400, request, env)
      const ids = await readMonthIndex(env, month)
      const weeks: VisibleWeekStub[] = []
      for (const id of ids) {
        const raw = await env.SCHEDULES.get(`week:${id}`)
        if (!raw) continue
        let parsed: unknown
        try {
          parsed = JSON.parse(raw)
        } catch {
          continue
        }
        const doc = normalizeStoredWeek(parsed)
        if (!doc || !doc.visible) continue
        if (doc.monthKey !== month && monthKeyForWeekStart(doc.weekStart) !== month) continue
        weeks.push({
          id: doc.id,
          weekStart: doc.weekStart,
          rev: doc.rev,
          updatedAt: doc.updatedAt,
          templateHash: doc.templateHash,
        })
      }
      weeks.sort((a, b) => a.weekStart.localeCompare(b.weekStart))
      return json({ weeks }, 200, request, env)
    }

    if (request.method === 'GET' && path === '/api/schedule') {
      const restaurant = restaurantFromUrl(url)
      if (!restaurant) return json({ error: 'invalid_restaurant' }, 400, request, env)
      const month = url.searchParams.get('month') ?? ''
      if (!MONTH_RE.test(month)) return json({ error: 'invalid_month' }, 400, request, env)
      const knownRaw = url.searchParams.get('knownRev') ?? ''
      const knownRev = /^\d+$/.test(knownRaw) ? Number.parseInt(knownRaw, 10) : 0
      const rev = await readGoldenMonthRev(env, month, restaurant)
      if (knownRev > 0 && rev > 0 && rev === knownRev) {
        return json({ weeks: [], rev, notModified: true }, 200, request, env, { 'Cache-Control': 'no-store' })
      }
      const weeks: GoldenWeekDoc[] = []
      for (const weekStart of goldenWeeksForMonth(month)) {
        const raw = await readGoldenDoc(env, restaurant, weekStart)
        if (!raw) continue
        let parsed: unknown
        try {
          parsed = JSON.parse(raw)
        } catch {
          continue
        }
        const doc = normalizeGoldenDoc(parsed)
        if (!doc || !doc.visible) continue
        weeks.push(doc)
      }
      weeks.sort((a, b) => a.weekStart.localeCompare(b.weekStart))
      return json({ weeks, rev, notModified: false }, 200, request, env, { 'Cache-Control': 'no-store' })
    }

    const goldenMatch = path.match(/^\/api\/schedule\/(\d{4}-\d{2}-\d{2})$/)
    if (goldenMatch) {
      const weekStart = goldenMatch[1]
      const restaurant = restaurantFromUrl(url)
      if (!restaurant) return json({ error: 'invalid_restaurant' }, 400, request, env)
      const key = goldenKey(weekStart, restaurant)

      if (request.method === 'GET') {
        const raw = await readGoldenDoc(env, restaurant, weekStart)
        if (!raw) return json({ error: 'not_found' }, 404, request, env)
        let parsed: unknown
        try {
          parsed = JSON.parse(raw)
        } catch {
          return json({ error: 'not_found' }, 404, request, env)
        }
        const doc = normalizeGoldenDoc(parsed)
        if (!doc) return json({ error: 'not_found' }, 404, request, env)
        return new Response(JSON.stringify(doc), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
        })
      }

      if (request.method === 'PUT') {
        if (goldenWriteError(env)) return json({ error: 'write_not_configured' }, 503, request, env)
        if (!isGoldenWriteAuthorized(request, env)) return json({ error: 'unauthorized' }, 401, request, env)
        if (!(await checkWriteThrottle(env, clientIp(request)))) {
          return json({ error: 'rate_limited' }, 429, request, env, { 'Retry-After': '3600' })
        }
        let templateHash: string | null = null
        let body: unknown
        try {
          body = await readBody(request)
        } catch {
          return json({ error: 'body_too_large' }, 413, request, env)
        }
        const rawBody = body && typeof body === 'object' ? (body as Record<string, unknown>) : null
        if (rawBody && typeof rawBody.templateHash === 'string' && HASH_RE.test(rawBody.templateHash)) {
          templateHash = rawBody.templateHash
        }
        const valid = validateGoldenWeekBody(body)
        if (!valid || !templateHash || valid.week.weekStart !== weekStart) {
          return json({ error: 'invalid_body' }, 400, request, env)
        }
        const existing = await readGoldenDoc(env, restaurant, weekStart)
        if (!existing) {
          if (valid.baseRev !== 0) return json({ error: 'conflict', rev: 0 }, 409, request, env)
          const next: GoldenWeekDoc = {
            v: 3,
            weekStart,
            rev: 1,
            week: valid.week,
            visible: valid.visible,
            templateHash,
            updatedAt: new Date().toISOString(),
          }
          await env.SCHEDULES.put(key, JSON.stringify(next), { expirationTtl: DOC_TTL_SECONDS })
          await bumpGoldenMonthRevs(env, weekStart, restaurant)
          return json({ rev: next.rev, updatedAt: next.updatedAt }, 201, request, env)
        }
        let parsed: unknown
        try {
          parsed = JSON.parse(existing)
        } catch {
          return json({ error: 'not_found' }, 404, request, env)
        }
        const current = normalizeGoldenDoc(parsed)
        if (!current) return json({ error: 'not_found' }, 404, request, env)
        if (valid.baseRev !== current.rev) {
          return json({ error: 'conflict', rev: current.rev, updatedAt: current.updatedAt }, 409, request, env)
        }
        const next: GoldenWeekDoc = {
          ...current,
          week: valid.week,
          visible: valid.visible,
          templateHash,
          rev: current.rev + 1,
          updatedAt: new Date().toISOString(),
        }
        await env.SCHEDULES.put(key, JSON.stringify(next), { expirationTtl: DOC_TTL_SECONDS })
        await bumpGoldenMonthRevs(env, weekStart, restaurant)
        return json({ rev: next.rev, updatedAt: next.updatedAt }, 200, request, env)
      }
    }

    if (path === '/api/employees') {
      const restaurant = restaurantFromUrl(url)
      if (!restaurant) return json({ error: 'invalid_restaurant' }, 400, request, env)
      const weekParam = parseWeekStartParam(url)
      if (weekParam.present && !weekParam.valid) return json({ error: 'invalid_weekStart' }, 400, request, env)
      const weekStart = weekParam.present && weekParam.valid ? weekParam.value : undefined
      if (request.method === 'GET') {
        // Rosters hold availability and who is kept apart, so reads need the manager token too.
        const denied = await managerAuthError(request, env)
        if (denied) return denied
        if (weekStart) {
          const weekRaw = await env.SCHEDULES.get(rosterKeyForWeek(restaurant, weekStart))
          const weekDoc = weekRaw ? normalizeRosterDoc(safeParse(weekRaw)) : null
          if (weekDoc) {
            return json(
              { employees: weekDoc.employees, rev: weekDoc.rev, updatedAt: weekDoc.updatedAt, weekStart, inherited: false },
              200,
              request,
              env,
              { 'Cache-Control': 'no-store' },
            )
          }
          const globalRaw = await readRosterRaw(env, restaurant)
          const globalDoc = globalRaw ? normalizeRosterDoc(safeParse(globalRaw)) : null
          return json(
            {
              employees: globalDoc?.employees ?? [],
              rev: 0,
              updatedAt: null,
              weekStart,
              inherited: true,
              fallbackRev: globalDoc?.rev ?? 0,
            },
            200,
            request,
            env,
            { 'Cache-Control': 'no-store' },
          )
        }
        const raw = await readRosterRaw(env, restaurant)
        const doc = raw ? normalizeRosterDoc(safeParse(raw)) : null
        return json(
          { employees: doc?.employees ?? [], rev: doc?.rev ?? 0, updatedAt: doc?.updatedAt ?? null },
          200,
          request,
          env,
          { 'Cache-Control': 'no-store' },
        )
      }

      if (request.method === 'PUT') {
        if (goldenWriteError(env)) return json({ error: 'write_not_configured' }, 503, request, env)
        if (!isGoldenWriteAuthorized(request, env)) return json({ error: 'unauthorized' }, 401, request, env)
        if (isScheduleOnlyRestaurant(restaurant)) return json({ error: 'station_locked' }, 403, request, env)
        if (!(await checkWriteThrottle(env, clientIp(request)))) {
          return json({ error: 'rate_limited' }, 429, request, env, { 'Retry-After': '3600' })
        }
        let body: unknown
        try {
          body = await readBody(request)
        } catch {
          return json({ error: 'body_too_large' }, 413, request, env)
        }
        const valid = validateRosterBody(body)
        if (!valid) return json({ error: 'invalid_body' }, 400, request, env)
        const targetKey = weekStart ? rosterKeyForWeek(restaurant, weekStart) : rosterKey(restaurant)
        const existingRaw = weekStart ? await env.SCHEDULES.get(targetKey) : await readRosterRaw(env, restaurant)
        let currentRev = 0
        let currentUpdatedAt: string | undefined
        if (existingRaw) {
          const current = normalizeRosterDoc(safeParse(existingRaw))
          currentRev = current?.rev ?? 0
          currentUpdatedAt = current?.updatedAt
        }
        if (valid.baseRev !== currentRev) {
          return json({ error: 'conflict', rev: currentRev, updatedAt: currentUpdatedAt }, 409, request, env)
        }
        const next: RosterDoc = {
          v: 1,
          rev: currentRev + 1,
          employees: valid.employees,
          updatedAt: new Date().toISOString(),
        }
        await env.SCHEDULES.put(targetKey, JSON.stringify(next), { expirationTtl: DOC_TTL_SECONDS })
        return json({ rev: next.rev, updatedAt: next.updatedAt }, currentRev === 0 ? 201 : 200, request, env)
      }
    }

    if (path === '/api/staff' || path === '/api/staff/undo' || path === '/api/staff/verify') {
      const restaurant = restaurantFromUrl(url)
      if (!restaurant) return json({ error: 'invalid_restaurant' }, 400, request, env)
      if (!isStaffEditableRestaurant(restaurant)) return json({ error: 'staff_editing_not_enabled' }, 403, request, env)

      if (request.method === 'GET' && path === '/api/staff') {
        const denied = await managerAuthError(request, env)
        if (denied) return denied
        return json(staffResponse(await readStaffDoc(env, restaurant)), 200, request, env, { 'Cache-Control': 'no-store' })
      }

      // Unlock check for the staff editor — read-only, throttled like the demo gate.
      if (request.method === 'GET' && path === '/api/staff/verify') {
        if (!(await checkVerifyThrottle(env, clientIp(request)))) {
          return json({ error: 'rate_limited' }, 429, request, env, { 'Retry-After': '3600' })
        }
        if (!isStaffEditAuthorized(request, env)) return json({ error: 'unauthorized' }, 401, request, env)
        return json({ ok: true }, 200, request, env)
      }

      const isSave = request.method === 'PUT' && path === '/api/staff'
      const isUndo = request.method === 'POST' && path === '/api/staff/undo'
      if (isSave || isUndo) {
        if (!isStaffEditAuthorized(request, env)) return json({ error: 'unauthorized' }, 401, request, env)
        if (!(await checkWriteThrottle(env, clientIp(request)))) {
          return json({ error: 'rate_limited' }, 429, request, env, { 'Retry-After': '3600' })
        }
        let body: unknown
        try {
          body = await readBody(request)
        } catch {
          return json({ error: 'body_too_large' }, 413, request, env)
        }
        const current = await readStaffDoc(env, restaurant)
        const currentRev = current?.rev ?? 0
        const updatedAt = new Date().toISOString()
        let next: StaffDoc
        if (isSave) {
          const valid = validateRosterBody(body)
          if (!valid) return json({ error: 'invalid_body' }, 400, request, env)
          if (valid.baseRev !== currentRev) {
            return json({ error: 'conflict', rev: currentRev, updatedAt: current?.updatedAt }, 409, request, env)
          }
          const replaced: StaffHistoryEntry = { employees: current?.employees ?? null, updatedAt: current?.updatedAt ?? null }
          next = {
            v: 1,
            rev: currentRev + 1,
            employees: valid.employees,
            updatedAt,
            history: [replaced, ...(current?.history ?? [])].slice(0, STAFF_HISTORY_LIMIT),
          }
        } else {
          const valid = validateStaffUndoBody(body)
          if (!valid) return json({ error: 'invalid_body' }, 400, request, env)
          if (valid.baseRev !== currentRev) {
            return json({ error: 'conflict', rev: currentRev, updatedAt: current?.updatedAt }, 409, request, env)
          }
          const [previous, ...older] = current?.history ?? []
          if (!current || !previous) return json({ error: 'nothing_to_undo', rev: currentRev }, 409, request, env)
          next = { v: 1, rev: currentRev + 1, employees: previous.employees, updatedAt, history: older }
        }
        await env.SCHEDULES.put(staffKey(restaurant), JSON.stringify(next), { expirationTtl: DOC_TTL_SECONDS })
        return json(staffResponse(next), currentRev === 0 ? 201 : 200, request, env)
      }
    }

    if (path === '/api/template') {
      const restaurant = restaurantFromUrl(url)
      if (!restaurant) return json({ error: 'invalid_restaurant' }, 400, request, env)
      const weekParam = parseWeekStartParam(url)
      if (weekParam.present && !weekParam.valid) return json({ error: 'invalid_weekStart' }, 400, request, env)
      const weekStart = weekParam.present && weekParam.valid ? weekParam.value : undefined
      if (request.method === 'GET') {
        if (weekStart) {
          const weekRaw = await env.SCHEDULES.get(templateKeyForWeek(restaurant, weekStart))
          const weekDoc = weekRaw ? normalizeTemplateDoc(safeParse(weekRaw)) : null
          if (weekDoc) {
            return json(
              { template: weekDoc.template, rev: weekDoc.rev, updatedAt: weekDoc.updatedAt, weekStart, inherited: false },
              200,
              request,
              env,
              { 'Cache-Control': 'no-store' },
            )
          }
          const globalRaw = await readTemplateRaw(env, restaurant)
          const globalDoc = globalRaw ? normalizeTemplateDoc(safeParse(globalRaw)) : null
          return json(
            {
              template: globalDoc?.template ?? null,
              rev: 0,
              updatedAt: null,
              weekStart,
              inherited: true,
              fallbackRev: globalDoc?.rev ?? 0,
            },
            200,
            request,
            env,
            { 'Cache-Control': 'no-store' },
          )
        }
        const raw = await readTemplateRaw(env, restaurant)
        const doc = raw ? normalizeTemplateDoc(safeParse(raw)) : null
        return json(
          { template: doc?.template ?? null, rev: doc?.rev ?? 0, updatedAt: doc?.updatedAt ?? null },
          200,
          request,
          env,
          { 'Cache-Control': 'no-store' },
        )
      }

      if (request.method === 'PUT') {
        // Schedule-only stations: per-week rules unlock with the staff password; the global seed stays fixed in code.
        if (isScheduleOnlyRestaurant(restaurant)) {
          if (!weekStart) return json({ error: 'station_locked' }, 403, request, env)
          if (!isStaffEditAuthorized(request, env)) return json({ error: 'unauthorized' }, 401, request, env)
        } else {
          if (goldenWriteError(env)) return json({ error: 'write_not_configured' }, 503, request, env)
          if (!isGoldenWriteAuthorized(request, env)) return json({ error: 'unauthorized' }, 401, request, env)
        }
        if (!(await checkWriteThrottle(env, clientIp(request)))) {
          return json({ error: 'rate_limited' }, 429, request, env, { 'Retry-After': '3600' })
        }
        let body: unknown
        try {
          body = await readBody(request)
        } catch {
          return json({ error: 'body_too_large' }, 413, request, env)
        }
        const valid = validateTemplateBody(body)
        if (!valid) return json({ error: 'invalid_body' }, 400, request, env)
        const targetKey = weekStart ? templateKeyForWeek(restaurant, weekStart) : templateKey(restaurant)
        const existingRaw = weekStart ? await env.SCHEDULES.get(targetKey) : await readTemplateRaw(env, restaurant)
        let currentRev = 0
        let currentUpdatedAt: string | undefined
        if (existingRaw) {
          const current = normalizeTemplateDoc(safeParse(existingRaw))
          currentRev = current?.rev ?? 0
          currentUpdatedAt = current?.updatedAt
        }
        if (valid.baseRev !== currentRev) {
          return json({ error: 'conflict', rev: currentRev, updatedAt: currentUpdatedAt }, 409, request, env)
        }
        const next: TemplateDoc = {
          v: 1,
          rev: currentRev + 1,
          template: valid.template,
          updatedAt: new Date().toISOString(),
        }
        await env.SCHEDULES.put(targetKey, JSON.stringify(next), { expirationTtl: DOC_TTL_SECONDS })
        return json({ rev: next.rev, updatedAt: next.updatedAt }, currentRev === 0 ? 201 : 200, request, env)
      }
    }

    const weekMatch = path.match(/^\/api\/weeks\/([A-Za-z0-9_-]+)$/)
    if (weekMatch) {
      const id = weekMatch[1]
      if (!isValidId(id)) return json({ error: 'not_found' }, 404, request, env)
      const key = `week:${id}`

      if (request.method === 'GET') {
        const raw = await env.SCHEDULES.get(key)
        if (!raw) return json({ error: 'not_found' }, 404, request, env)
        let parsed: unknown
        try {
          parsed = JSON.parse(raw)
        } catch {
          return json({ error: 'not_found' }, 404, request, env)
        }
        const doc = normalizeStoredWeek(parsed)
        if (!doc) return json({ error: 'not_found' }, 404, request, env)
        // Repair the month index for docs written before the index existed.
        await addToMonthIndex(env, doc.monthKey, doc.id)
        return new Response(JSON.stringify(doc), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
        })
      }

      if (request.method === 'PUT') {
        if (!(await checkWriteThrottle(env, clientIp(request)))) {
          return json({ error: 'rate_limited' }, 429, request, env, { 'Retry-After': '3600' })
        }
        let body: unknown
        try {
          body = await readBody(request)
        } catch {
          return json({ error: 'body_too_large' }, 413, request, env)
        }
        const valid = validateUpdateBody(body)
        if (!valid) return json({ error: 'invalid_body' }, 400, request, env)
        const raw = await env.SCHEDULES.get(key)
        if (!raw) return json({ error: 'not_found' }, 404, request, env)
        let parsed: unknown
        try {
          parsed = JSON.parse(raw)
        } catch {
          return json({ error: 'not_found' }, 404, request, env)
        }
        const current = normalizeStoredWeek(parsed)
        if (!current) return json({ error: 'not_found' }, 404, request, env)
        if (valid.baseRev !== current.rev) {
          return json({ error: 'conflict', rev: current.rev, updatedAt: current.updatedAt }, 409, request, env)
        }
        const next: StoredWeek = {
          ...current,
          v: 2,
          ciphertext: valid.ciphertext ?? current.ciphertext,
          visible: valid.visible ?? current.visible,
          rev: current.rev + 1,
          updatedAt: new Date().toISOString(),
        }
        await env.SCHEDULES.put(key, JSON.stringify(next), { expirationTtl: DOC_TTL_SECONDS })
        await addToMonthIndex(env, next.monthKey, next.id)
        return json({ rev: next.rev, updatedAt: next.updatedAt }, 200, request, env)
      }
    }

    return json({ error: 'not_found' }, 404, request, env)
  },
}
