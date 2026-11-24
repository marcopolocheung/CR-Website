import type { InventoryCounts, InventorySheet } from '../inventory'
import type { InventoryDay } from '../inventory-store'
import { StoreUnavailableError } from '../schedule-store'
import { businessDate } from './contracts'
import { readInventoryProgress, validInventoryCounts } from './inventory-progress'

/** The existing service reads fourteen calendar dates, including the end date. */
export function inventoryHistoryWindow(to: string): { from: string; to: string } {
  if (!businessDate(to)) throw new StoreUnavailableError()
  const start = new Date(`${to}T00:00:00.000Z`)
  start.setUTCDate(start.getUTCDate() - 13)
  return { from: start.toISOString().slice(0, 10), to }
}

/** Reject an invalid response as a whole so it cannot replace a valid prior window. */
export function validatedInventoryHistory(value: unknown, to: string): InventoryDay[] {
  const window = inventoryHistoryWindow(to)
  if (!Array.isArray(value) || value.length > 14) throw new StoreUnavailableError()
  const dates = new Set<string>()
  for (const day of value) {
    if (!day || typeof day !== 'object' || !businessDate(day.date)
      || day.date < window.from || day.date > window.to || dates.has(day.date)
      || !validInventoryCounts(day.counts)
      || typeof day.updatedAt !== 'string' || !Number.isFinite(Date.parse(day.updatedAt))) {
      throw new StoreUnavailableError()
    }
    dates.add(day.date)
  }
  // Keep the result independent of both the response and working-count objects.
  return structuredClone(value as InventoryDay[]).sort((a, b) => b.date.localeCompare(a.date))
}

export type SavedInventoryCatalog = {
  catalog: InventorySheet[]
  source: 'device' | 'current'
  revision: number | null
}

/** The service normalizes an unchecked mark to an omitted `done` property. */
export function sameInventoryFields(a: InventoryCounts, b: InventoryCounts): boolean {
  const ids = Object.keys(a)
  return ids.length === Object.keys(b).length && ids.every(id => Object.hasOwn(b, id)
    && a[id].inv === b[id].inv && a[id].order === b[id].order && !!a[id].done === !!b[id].done)
}

/**
 * Server days contain no historical catalog. A strict matching-date device
 * envelope can supply labels only; its unsaved counts and skips are never read
 * into a saved record. Invalid, unsupported or inaccessible bytes stay untouched.
 */
export function savedInventoryCatalog(storage: Pick<Storage, 'getItem'> | null, date: string, current: InventorySheet[]): SavedInventoryCatalog {
  const saved = storage && readInventoryProgress(storage, date)
  if (saved && saved.state === 'ready') {
    return { catalog: structuredClone(saved.value.catalog), source: 'device', revision: saved.value.catalogRevision }
  }
  return { catalog: structuredClone(current), source: 'current', revision: null }
}

/** Include every raw ID in the displayed record/columns, even if its label is gone. */
export function inventoryReportCatalog(catalog: InventorySheet[], counts: readonly InventoryCounts[], unknownTitle = 'Unknown / removed IDs'): InventorySheet[] {
  const result = structuredClone(catalog)
  const known = new Set(catalog.flatMap(sheet => sheet.items.map(item => item.id)))
  const unknown: string[] = []
  for (const values of counts) {
    for (const id of Object.keys(values)) {
      if (!known.has(id)) {
        known.add(id)
        unknown.push(id)
      }
    }
  }
  if (unknown.length) {
    let id = 'inventory-unknown-ids'
    for (let suffix = 2; result.some(sheet => sheet.id === id); suffix++) id = `inventory-unknown-ids-${suffix}`
    result.push({ id, title: unknownTitle, useLabel: 'Use', showSup: true,
      items: unknown.map(id => ({ id, name: id, sup: '', use: '', gray: false })) })
  }
  return result
}
