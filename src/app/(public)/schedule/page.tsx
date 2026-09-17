import type { Metadata } from 'next'
import Link from 'next/link'
import { RESTAURANTS, RESTAURANT_IDS } from '@/data/restaurants'

export const metadata: Metadata = {
  title: 'Staff Schedule',
  description: 'Private weekly schedule for China Rose staff.',
  robots: {
    index: false,
    follow: false,
  },
}

export default function SchedulePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Staff schedule</p>
      <h1 className="mt-1 text-2xl font-bold">Pick your station</h1>
      <ul className="mt-6 space-y-3">
        {RESTAURANT_IDS.map((id) => (
          <li key={id} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <Link className="text-lg font-semibold text-red-800 underline" href={`/schedule/${id}`}>
              {RESTAURANTS[id].name}
            </Link>
            <p className="mt-1 text-sm text-zinc-600">{RESTAURANTS[id].description}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
