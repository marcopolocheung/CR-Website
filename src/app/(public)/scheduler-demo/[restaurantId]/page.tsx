import type { Metadata } from 'next'
import Link from 'next/link'
import DemoGate from '@/components/scheduler/DemoGate'
import SchedulerDemo from '@/components/scheduler/SchedulerDemo'
import { RESTAURANTS, RESTAURANT_IDS, isRestaurantId } from '@/data/restaurants'

export async function generateMetadata({ params }: { params: Promise<{ restaurantId: string }> }): Promise<Metadata> {
  const { restaurantId } = await params
  const station = isRestaurantId(restaurantId) ? RESTAURANTS[restaurantId].name : null
  return {
    title: station ? `${station} — Scheduler` : 'Scheduler Demo',
    description: 'Internal deterministic employee scheduling demo for China Rose.',
    robots: {
      index: false,
      follow: false,
    },
  }
}

export function generateStaticParams() {
  return RESTAURANT_IDS.map((restaurantId) => ({ restaurantId }))
}

export default async function SchedulerStationPage({ params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params
  if (!isRestaurantId(restaurantId)) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <p className="text-sm font-semibold uppercase tracking-wide text-red-700">Unknown station</p>
        <h1 className="mt-1 text-2xl font-bold">No scheduler here</h1>
        <ul className="mt-4 space-y-2">
          {RESTAURANT_IDS.map((id) => (
            <li key={id}>
              <Link className="text-red-800 underline" href={`/scheduler-demo/${id}`}>
                {RESTAURANTS[id].name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    )
  }
  return (
    <DemoGate>
      <SchedulerDemo restaurantId={restaurantId} />
    </DemoGate>
  )
}
