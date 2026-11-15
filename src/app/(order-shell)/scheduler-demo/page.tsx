import type { Metadata } from 'next'
import Link from 'next/link'
import { RESTAURANTS, RESTAURANT_IDS } from '@/data/restaurants'

export const metadata: Metadata = {
  title: 'Scheduler',
  description: 'Weekly staff scheduler for China Rose managers.',
  robots: {
    index: false,
    follow: false,
  },
}

export default function SchedulerDemoPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Scheduler</p>
      <h1 className="mt-1 text-2xl font-bold">Pick a station</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Each station keeps its own staff list, rules, and published weeks. Nothing is shared between stations.
      </p>
      <Link
        href="/schedule"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center justify-center rounded border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
        title="View the published staff schedules in a new tab"
      >
        View schedule<span className="sr-only"> (opens in a new tab)</span>
      </Link>
      <ul className="mt-6 space-y-3">
        {RESTAURANT_IDS.map((id) => (
          <li key={id} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <Link className="text-lg font-semibold text-red-800 underline" href={`/scheduler-demo/${id}`}>
              {RESTAURANTS[id].name}
            </Link>
            <p className="mt-1 text-sm text-zinc-600">{RESTAURANTS[id].description}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
