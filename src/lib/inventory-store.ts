import { StoreAuthError, StoreConflictError, StoreUnavailableError } from './schedule-store'
import { requestJson } from './cashout-store'
import type { InventoryCounts, InventorySheet } from './inventory'

/**
 * Inventory store: count days (`/api/inventory/CR3/{date}`, kept a year, history
 * returns the last 14) and the item list (`/api/inventory/CR3/list`). Both need the manager token.
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

/** The saved item list, or `sheets: null` (rev 0) when nobody has edited it yet. */
export async function fetchInventoryList(token: string): Promise<{ rev: number; sheets: InventorySheet[] | null }> {
  const { status, body } = await requestJson('/api/inventory/CR3/list', token, undefined, UNREACHABLE)
  if (status === 200 && body && typeof body === 'object' && 'rev' in body) return body as { rev: number; sheets: InventorySheet[] | null }
  throw errorFor(status)
}

/** Saves the item list over `baseRev`; returns the new rev. Throws StoreConflictError if someone saved first. */
export async function saveInventoryList(sheets: InventorySheet[], baseRev: number, token: string): Promise<number> {
  const { status, body } = await requestJson('/api/inventory/CR3/list', token, { method: 'PUT', body: JSON.stringify({ sheets, baseRev }) }, UNREACHABLE)
  if (status === 200) return (body as { rev: number }).rev
  if (status === 409) throw new StoreConflictError((body as { rev?: number } | null)?.rev ?? 0)
  if (status === 400) throw new StoreUnavailableError('The server rejected this list. Check names, SUP, and Use on every row.')
  throw errorFor(status)
}

function errorFor(status: number): Error {
  if (status === 401) return new StoreAuthError()
  if (status === 429) return new StoreUnavailableError('Too many requests. Wait a bit and try again.')
  if (status === 400) return new StoreUnavailableError('The server rejected this count. Keep each box short: numbers, fractions like 1/2, or counts like 3B/2T.')
  if (status === 503) return new StoreUnavailableError('Saving is not set up yet. Set the SCHEDULE_WRITE_TOKEN secret on the Worker.')
  return new StoreUnavailableError(UNREACHABLE)
}
