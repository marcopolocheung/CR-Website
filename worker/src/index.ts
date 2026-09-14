interface KVNamespace {
  get(key: string): Promise<string | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
}

interface Env {
  SCHEDULES: KVNamespace
  ALLOWED_ORIGIN?: string
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
  return { ciphertext, templateHash, weekStart, visible: visible ?? true }
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
  return { ciphertext: nextCipher, visible, baseRev }
}

export function newShareId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(7))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
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

async function readBody(request: Request): Promise<unknown> {
  const text = await request.text()
  if (text.length > MAX_BODY_CHARS) throw new Error('body_too_large')
  try {
    return JSON.parse(text)
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
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      })
    }

    const url = new URL(request.url)
    const path = url.pathname.replace(/\/+$/, '') || '/'

    if (request.method === 'GET' && (path === '/' || path === '/api/health')) {
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
