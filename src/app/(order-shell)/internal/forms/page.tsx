import type { Metadata } from 'next'
import WriteUps from '@/components/internal/WriteUps'
import { BLANK_FORMS, blankFormHref } from '@/lib/forms'

export const metadata: Metadata = { title: 'Forms & write-ups' }

export default function FormsPage() {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
  return (
    <>
    <div className="max-w-3xl mx-auto px-4 py-8 print:hidden">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Forms</h1>
      <p className="text-sm text-gray-600 mb-6">Blank forms to download and print. PDFs open in the browser; Excel and Word files download.</p>
      <ul className="divide-y divide-gray-200 border border-gray-200 rounded">
        {BLANK_FORMS.map(f => (
          <li key={f.file} className="flex items-center justify-between gap-4 px-4 py-3">
            <span className="text-gray-900">{f.title}</span>
            <a href={blankFormHref(base, f.file)} download={!f.file.endsWith('.pdf') || undefined} target={f.file.endsWith('.pdf') ? '_blank' : undefined} className="text-sm font-medium text-red-700 hover:underline whitespace-nowrap">
              {f.file.split('.').pop()!.toUpperCase()}
            </a>
          </li>
        ))}
      </ul>
    </div>
    <WriteUps />
    </>
  )
}
