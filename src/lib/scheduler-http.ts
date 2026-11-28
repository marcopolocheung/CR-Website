import { managerSession, SessionChangedError } from './internal-tools/manager-session'

export type SchedulerAuthScope = 'manager' | 'staff'
export type SchedulerRequestScope = SchedulerAuthScope | 'public' | 'verification'

/** The scheduler's legacy/public reads and separate staff password share one visit lifetime, not one privilege. */
export function captureSchedulerSession(scope: SchedulerRequestScope = 'public', token?: string) {
  if (!managerSession.active) return (_status?: number) => {}
  const { generation, token: current } = managerSession.getSnapshot()
  if (scope === 'manager' && (!current || current !== token)) throw new SessionChangedError()
  if (scope === 'staff' && !current) throw new SessionChangedError()
  return (status?: number) => {
    if (!managerSession.active || managerSession.getSnapshot().generation !== generation) throw new SessionChangedError()
    if (scope === 'manager' && (status === 401 || status === 403)) managerSession.expire(generation)
  }
}

/** Check the full response body before exposing data or acknowledging a legacy write. Never replay a request. */
export async function schedulerRequestJson(
  url: string,
  init: RequestInit | undefined,
  scope: SchedulerRequestScope,
  unavailable: () => Error,
  credential?: string,
): Promise<{ status: number; body: unknown }> {
  const headers = new Headers(init?.headers)
  const authorization = headers.get('Authorization')
  const token = credential ?? (authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined)
  const check = captureSchedulerSession(scope, token)
  const requestHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
  headers.forEach((value, key) => { requestHeaders[key === 'authorization' ? 'Authorization' : key === 'content-type' ? 'Content-Type' : key] = value })
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  try {
    check()
    const response = await fetch(url, {
      ...init,
      cache: 'no-store',
      signal: controller.signal,
      headers: requestHeaders,
    })
    let body: unknown = null
    try { body = await response.json() } catch { /* Missing/malformed acknowledgements remain unknown to the caller. */ }
    check(response.status)
    return { status: response.status, body }
  } catch (caught) {
    if (caught instanceof SessionChangedError) throw caught
    check()
    throw unavailable()
  } finally {
    clearTimeout(timer)
  }
}
