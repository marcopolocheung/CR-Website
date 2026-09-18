interface KVNamespace {
  get(key: string): Promise<string | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
}

interface Env {
  SCHEDULES: KVNamespace
  ALLOWED_ORIGIN?: string
  /** Manager write token for the golden schedule. Never shipped to browsers; the manager types it per save. */
  SCHEDULE_WRITE_TOKEN?: string
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
const DOC_TTL_SECONDS = 31536000
const WRITE_LIMIT_PER_HOUR = 60
/** Gate guesses get their own budget so they can never lock out legitimate saves. */
const VERIFY_LIMIT_PER_HOUR = 30

export const RESTAURANTS = ['CR3-diningroom', 'CR3-kitchen', 'CR2-kitchen', 'CR2-diningroom'] as const

export type RestaurantId = (typeof RESTAURANTS)[number]

export const DEFAULT_RESTAURANT: RestaurantId = 'CR3-diningroom'

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
const ROSTER_ROLES = ['server', 'cashier', 'lead', 'manager']
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
  incompatibleEmployeeIds: string[]
  active: boolean
  newHire: boolean
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
  if (!Array.isArray(employee.roles) || !employee.roles.every((role) => typeof role === 'string' && ROSTER_ROLES.includes(role))) {
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
  if (
    !Array.isArray(employee.incompatibleEmployeeIds) ||
    employee.incompatibleEmployeeIds.length > MAX_INCOMPATIBLE_IDS ||
    !employee.incompatibleEmployeeIds.every((id) => typeof id === 'string')
  ) {
    return false
  }
  if (typeof employee.active !== 'boolean') return false
  if (employee.newHire !== undefined && typeof employee.newHire !== 'boolean') return false
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
  if (typeof slot.role !== 'string' || !ROSTER_ROLES.includes(slot.role)) return false
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

export function goldenWriteError(env: Env): 'write_not_configured' | null {
  return env.SCHEDULE_WRITE_TOKEN ? null : 'write_not_configured'
}

export function isGoldenWriteAuthorized(request: Request, env: Env): boolean {
  const token = env.SCHEDULE_WRITE_TOKEN ?? ''
  if (!token) return false
  return request.headers.get('Authorization') === `Bearer ${token}`
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

async function readBody(request: Request): Promise<unknown> {
  const text = await request.text()
  if (text.length > MAX_BODY_CHARS) throw new Error('body_too_large')
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
        if (goldenWriteError(env)) return json({ error: 'write_not_configured' }, 503, request, env)
        if (!isGoldenWriteAuthorized(request, env)) return json({ error: 'unauthorized' }, 401, request, env)
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
