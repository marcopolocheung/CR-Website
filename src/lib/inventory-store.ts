import { StoreAuthError, StoreUnavailableError } from './schedule-store'
import { requestJson } from './cashout-store'
import type { InventoryCounts } from './inventory'

/**
 * Inventory count store (`/api/inventory/CR3/{date}`). Reads and writes need the
 * manager token. Days are kept a year; the list returns the last 14.
 */
export type InventoryDay = { date: string; counts: InventoryCounts; updatedAt: string }

const UNREACHABLE = 'Could not reach the inventory store.'

export async function fetchInventoryHistory(to: string, token: string): Promise<InventoryDay[]> {
  const { status, body } = await requestJson(`/api/inventory/CR3?to=${to}`, token, undefined, UNREACHABLE)
  if (status === 200 && Array.isArray((body as { days?: unknown } | null)?.days)) return (body as { days: InventoryDay[] }).days
  throw errorFor(status)
}

export async function saveInventoryDay(date: string, counts: InventoryCounts, token: string): Promise<void> {
  const { status } = await requestJson(`/api/inventory/CR3/${date}`, token, { method: 'PUT', body: JSON.stringify({ counts }) }, UNREACHABLE)
  if (status === 200) return
  throw errorFor(status)
}

function errorFor(status: number): Error {
  if (status === 401) return new StoreAuthError()
  if (status === 429) return new StoreUnavailableError('Too many requests. Wait a bit and try again.')
  if (status === 400) return new StoreUnavailableError('The server rejected this count. Keep each box short: numbers, fractions like 1/2, or counts like 3B/2T.')
  if (status === 503) return new StoreUnavailableError('Saving is not set up yet. Set the SCHEDULE_WRITE_TOKEN secret on the Worker.')
  return new StoreUnavailableError(UNREACHABLE)
}
