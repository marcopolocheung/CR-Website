import { requestJson } from './cashout-store'
import { StoreAuthError } from './schedule-store'
import type { SalesDay } from './sales'

/** Sales could not load: `unconfigured` until the Worker has Toast settings, else Toast/network trouble. */
export class SalesUnavailableError extends Error {
  constructor(readonly reason: 'unconfigured' | 'failed') {
    super(`Toast sales ${reason}`)
    this.name = 'SalesUnavailableError'
  }
}

/** One store's business day of Toast sales (`/api/toast/sales/{store}/{date}`). Needs the manager code. */
export async function fetchSalesDay(store: string, date: string, token: string): Promise<SalesDay> {
  const { status, body } = await requestJson(`/api/toast/sales/${store}/${date}`, token, undefined, 'Could not reach Toast.')
  if (status === 200 && body && typeof body === 'object' && typeof (body as SalesDay).net === 'number') return body as SalesDay
  if (status === 401) throw new StoreAuthError()
  if (status === 503 && (body as { error?: string } | null)?.error === 'toast_unconfigured') throw new SalesUnavailableError('unconfigured')
  throw new SalesUnavailableError('failed')
}
