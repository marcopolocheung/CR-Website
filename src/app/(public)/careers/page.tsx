import type { Metadata } from 'next'
import { publicPageMetadata } from '@/lib/seo'

export const metadata: Metadata = publicPageMetadata({
  title: 'Careers',
  description: 'Careers information for China Rose restaurants in San Antonio, TX.',
  path: '/careers',
})

export default function CareersPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-red-800 mb-2">Join Our Team</h1>
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-6">
        <p className="text-gray-700">
          We are not currently accepting applications through this website.
        </p>
        <p className="text-gray-600 text-sm mt-3">
          Please contact your preferred China Rose location directly for current hiring information.
        </p>
      </div>
    </div>
  )
}
