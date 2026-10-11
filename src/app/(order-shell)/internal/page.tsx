import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Internal' }

const PAGES = [
  { href: '/internal/bookkeeping', title: 'Bookkeeping', blurb: 'Cash out, daily sales report, and employee hours.' },
  { href: '/scheduler-demo', title: 'Scheduler', blurb: 'Build and publish weekly staff schedules.' },
  { href: '/internal/forms', title: 'Forms & write-ups', blurb: 'Blank forms to print, plus saved employee write-ups.' },
]

export default function InternalDashboard() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
      <ul className="grid gap-4 sm:grid-cols-3">
        {PAGES.map(p => (
          <li key={p.href}>
            <Link href={p.href} className="block h-full rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-red-300 hover:shadow">
              <span className="text-lg font-semibold text-red-700">{p.title}</span>
              <p className="mt-1 text-sm text-gray-600">{p.blurb}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
