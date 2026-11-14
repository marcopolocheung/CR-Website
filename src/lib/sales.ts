/** One store's business day from `GET /api/toast/sales/{store}/{date}`. All money is integer cents. */
export type SalesSplit = { net: number; orders: number }
export type SalesDay = {
  net: number
  gross: number
  discounts: number
  orders: number
  shift: { am: SalesSplit; pm: SalesSplit }
  service: { lunch: SalesSplit; dinner: SalesSplit; other: SalesSplit }
  voids: { items: number; amount: number; orders: number }
  discountsByName: { name: string; count: number; amount: number }[]
  voidsByReason: { name: string; items: number; amount: number }[]
}
export type SalesSplitKind = 'shift' | 'service'
export type SalesPartKey = 'am' | 'pm' | 'lunch' | 'dinner' | 'other'

export const emptySalesDay = (): SalesDay => ({
  net: 0, gross: 0, discounts: 0, orders: 0,
  shift: { am: { net: 0, orders: 0 }, pm: { net: 0, orders: 0 } },
  service: { lunch: { net: 0, orders: 0 }, dinner: { net: 0, orders: 0 }, other: { net: 0, orders: 0 } },
  voids: { items: 0, amount: 0, orders: 0 },
  discountsByName: [], voidsByReason: [],
})

const addSplit = (a: SalesSplit, b: SalesSplit): SalesSplit => ({ net: a.net + b.net, orders: a.orders + b.orders })
const byAmount = <T extends { name: string; amount: number }>(rows: T[]) => rows.sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))

/** Adds days (several stores, several dates) into one total. */
export function sumSalesDays(days: SalesDay[]): SalesDay {
  const total = emptySalesDay()
  const discounts = new Map<string, { count: number; amount: number }>()
  const voids = new Map<string, { items: number; amount: number }>()
  for (const d of days) {
    total.net += d.net
    total.gross += d.gross
    total.discounts += d.discounts
    total.orders += d.orders
    total.shift = { am: addSplit(total.shift.am, d.shift.am), pm: addSplit(total.shift.pm, d.shift.pm) }
    total.service = { lunch: addSplit(total.service.lunch, d.service.lunch), dinner: addSplit(total.service.dinner, d.service.dinner), other: addSplit(total.service.other, d.service.other) }
    total.voids = { items: total.voids.items + d.voids.items, amount: total.voids.amount + d.voids.amount, orders: total.voids.orders + d.voids.orders }
    for (const r of d.discountsByName) {
      const row = discounts.get(r.name) ?? { count: 0, amount: 0 }
      discounts.set(r.name, { count: row.count + r.count, amount: row.amount + r.amount })
    }
    for (const r of d.voidsByReason) {
      const row = voids.get(r.name) ?? { items: 0, amount: 0 }
      voids.set(r.name, { items: row.items + r.items, amount: row.amount + r.amount })
    }
  }
  total.discountsByName = byAmount([...discounts].map(([name, r]) => ({ name, ...r })))
  total.voidsByReason = byAmount([...voids].map(([name, r]) => ({ name, ...r })))
  return total
}

export const salesKey = (store: string, date: string) => `${store}:${date}`

/** Runs `work` over items with at most `limit` in flight; the first failure stops new work and rejects. */
export async function runLimited<T>(items: T[], limit: number, work: (item: T) => Promise<void>): Promise<void> {
  let next = 0
  let failed = false
  const lane = async () => {
    while (!failed && next < items.length) {
      const item = items[next++]
      try { await work(item) } catch (caught) { failed = true; throw caught }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane))
}

export type SalesRow = { date: string; day: SalesDay | null; stores: number }
/** One row per date, combining whichever of the chosen stores have loaded. */
export function salesRows(dates: string[], stores: readonly string[], loaded: Record<string, SalesDay>): SalesRow[] {
  return dates.map(date => {
    const days = stores.flatMap(store => (loaded[salesKey(store, date)] ? [loaded[salesKey(store, date)]] : []))
    return { date, day: days.length ? sumSalesDays(days) : null, stores: days.length }
  })
}

/** The pieces a day splits into for the chosen split. Orders without a Toast meal period show only if there are any. */
export function splitParts(day: SalesDay, kind: SalesSplitKind): { key: SalesPartKey; net: number; orders: number }[] {
  if (kind === 'shift') return [{ key: 'am', ...day.shift.am }, { key: 'pm', ...day.shift.pm }]
  const parts: { key: SalesPartKey; net: number; orders: number }[] = [{ key: 'lunch', ...day.service.lunch }, { key: 'dinner', ...day.service.dinner }]
  if (day.service.other.orders || day.service.other.net) parts.push({ key: 'other', ...day.service.other })
  return parts
}
