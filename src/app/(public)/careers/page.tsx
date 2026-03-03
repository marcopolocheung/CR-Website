import type { Metadata } from 'next'
import JobApplicationForm from '@/components/JobApplicationForm'

export const metadata: Metadata = {
  title: 'Careers | China Rose',
  description: 'Apply to work at China Rose restaurants in San Antonio, TX.',
}

export default function CareersPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-red-800 mb-2">Join Our Team</h1>
      <p className="text-gray-600 mb-8">
        We&apos;re always looking for friendly, hard-working people to join the China Rose family.
        Fill out the application below and we&apos;ll be in touch.
      </p>
      <JobApplicationForm />
    </div>
  )
}
