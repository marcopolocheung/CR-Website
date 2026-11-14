/**
 * Toast sales days kept in browser memory for the manager session, shared by the preload (started as soon as the
 * manager code is entered on any internal page) and the Reports page. Same subscribe/getSnapshot shape as
 * `managerSession`, so React reads it with `useSyncExternalStore`.
 */
import { datesEnding } from './dashboard'
import { runLimited, salesKey, type SalesDay } from './sales'
import { fetchSalesDay, fetchSalesRange, SalesUnavailableError } from './sales-store'

export const SALES_STORES = ['CR3', 'CR2'] as const
/** The longest range Reports offers; the preload fetches all of it. */
export const SALES_PRELOAD_DAYS = 30
/** Day requests in flight at once; each uncached day pages through Toast on the Worker. */
const PARALLEL_DAYS = 2
/** Yesterday and today still change (late voids, open checks): refresh them after this long, like the Worker. */
const RECENT_MS = 10 * 60 * 1000
/** Waits before retrying a day that timed out or hit Toast's rate limit. */
const RETRY_WAITS_MS = [1000, 3000]

type Entry = { day: SalesDay; fetchedAt: number }
export type SalesSnapshot = Readonly<Record<string, SalesDay>>
export type SalesDeps = {
  fetchDay: typeof fetchSalesDay
  fetchRange: typeof fetchSalesRange
  sleep: (ms: number) => Promise<void>
  now: () => number
  /** Browser-local YYYY-MM-DD (the stores and managers share a time zone). */
  today: () => string
}

const defaults: SalesDeps = {
  fetchDay: fetchSalesDay,
  fetchRange: fetchSalesRange,
  sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
  now: () => Date.now(),
  today: () => new Date().toLocaleDateString('en-CA'),
}

const dayBefore = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) - 86400000).toISOString().slice(0, 10)

export class SalesCache {
  private entries = new Map<string, Entry>()
  private inflight = new Map<string, Promise<void>>()
  private snapshot: SalesSnapshot = {}
  private listeners = new Set<() => void>()
  private generation = 0
  private token = ''

  constructor(private deps: SalesDeps = defaults) {}

  getSnapshot = () => this.snapshot
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }

  /** Forget everything (manager session locked, expired or changed). Answers still on the way are dropped. */
  clear = () => {
    this.generation += 1
    this.token = ''
    this.inflight.clear()
    if (!this.entries.size) return
    this.entries.clear()
    this.publish()
  }

  /**
   * Make sure every store × date is loaded and fresh: one cache-only range read per store, then the rest one day at a
   * time (2 in flight, shared with any other caller asking for the same day). Rejects with the first failure; days
   * that did load are kept.
   */
  ensure = async (stores: readonly string[], dates: string[], token: string): Promise<void> => {
    if (token !== this.token) { this.clear(); this.token = token }
    const generation = this.generation
    const stale = () => stores.flatMap(store => dates.filter(date => !this.isFresh(store, date)).map(date => ({ store, date })))
    let wanted = stale()
    if (!wanted.length) return

    const ranges = new Map<string, string[]>()
    for (const { store, date } of wanted) ranges.set(store, [...(ranges.get(store) ?? []), date])
    await Promise.all([...ranges].map(async ([store, storeDates]) => {
      const sorted = [...storeDates].sort()
      const found = await this.deps.fetchRange(store, sorted[0], sorted[sorted.length - 1], token)
      if (!found || generation !== this.generation) return
      const at = this.deps.now()
      for (const date of storeDates) if (found.days[date]) this.entries.set(salesKey(store, date), { day: found.days[date], fetchedAt: at })
      this.publish()
    }))
    if (generation !== this.generation) return

    wanted = stale()
    await runLimited(wanted, PARALLEL_DAYS, ({ store, date }) => this.loadDay(store, date, token, generation))
  }

  private isFresh(store: string, date: string): boolean {
    const entry = this.entries.get(salesKey(store, date))
    if (!entry) return false
    return date < dayBefore(this.deps.today()) || this.deps.now() - entry.fetchedAt < RECENT_MS
  }

  private loadDay(store: string, date: string, token: string, generation: number): Promise<void> {
    const key = salesKey(store, date)
    const running = this.inflight.get(key)
    if (running) return running
    const work = (async () => {
      for (let attempt = 0; ; attempt += 1) {
        try {
          const day = await this.deps.fetchDay(store, date, token)
          if (generation !== this.generation) return
          this.entries.set(key, { day, fetchedAt: this.deps.now() })
          this.publish()
          return
        } catch (caught) {
          const transient = caught instanceof SalesUnavailableError && (caught.reason === 'timeout' || caught.reason === 'busy')
          if (!transient || attempt >= RETRY_WAITS_MS.length || generation !== this.generation) throw caught
          await this.deps.sleep(RETRY_WAITS_MS[attempt])
        }
      }
    })()
    this.inflight.set(key, work)
    void work.then(() => this.release(key, work), () => this.release(key, work))
    return work
  }

  private release(key: string, work: Promise<void>) {
    if (this.inflight.get(key) === work) this.inflight.delete(key)
  }

  private publish() {
    this.snapshot = Object.fromEntries([...this.entries].map(([key, entry]) => [key, entry.day]))
    this.listeners.forEach(listener => listener())
  }
}

export const salesCache = new SalesCache()

/** Start loading the longest Reports view in the background. Failures are left for the Reports page to show. */
export function preloadSales(token: string, cache = salesCache, today = defaults.today()): void {
  void cache.ensure(SALES_STORES, datesEnding(today, SALES_PRELOAD_DAYS), token).catch(() => {})
}
