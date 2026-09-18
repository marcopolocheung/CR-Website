import type { Metadata } from 'next'
import Link from 'next/link'
import DemoGate from '@/components/scheduler/DemoGate'
import { RESTAURANTS, RESTAURANT_IDS } from '@/data/restaurants'

export const metadata: Metadata = {
  title: 'Scheduler Demo',
  description: 'Internal deterministic employee scheduling demo for China Rose.',
  robots: {
    index: false,
    follow: false,
  },
}

export default function SchedulerDemoPage() {
  return (
    <DemoGate>
    <div className="mx-auto max-w-2xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Scheduler demo</p>
      <h1 className="mt-1 text-2xl font-bold">Pick a station</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Each station keeps its own staff list, rules, and published weeks. Nothing is shared between stations.
      </p>
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
    </DemoGate>
  )
}
