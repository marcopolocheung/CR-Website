import type { Metadata } from 'next'
import WriteUps from '@/components/internal/WriteUps'

export const metadata: Metadata = { title: 'Forms & write-ups' }

// Files live in public/internal/forms.
const FORMS = [
  { title: 'Hiring application', file: 'hiring-application.xlsx' },
  { title: 'New hire packet', file: 'new-hire.pdf' },
  { title: 'Payroll change request', file: 'payroll-change-request.pdf' },
  { title: 'Pay rate increase application', file: 'pay-rate-increase.xlsx' },
  { title: 'Paycheck deduction approval (drawer short)', file: 'paycheck-deduction-approval.docx' },
  { title: 'Employee write-up (corrective action)', file: 'employee-write-up.xlsx' },
  { title: 'Injury report', file: 'injury-report.pdf' },
  { title: 'Customer complaint form', file: 'customer-complaint.xlsx' },
  { title: 'Daily cash difference record', file: 'daily-cash-difference.xlsx' },
  { title: 'CR3 inventory list', file: 'cr3-inventory-list.xlsx' },
  { title: 'CR3 daily preparation list', file: 'cr3-daily-prep-list.xlsx' },
]

export default function FormsPage() {
  const base = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/internal/forms`
  return (
    <>
    <div className="max-w-3xl mx-auto px-4 py-8 print:hidden">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Forms</h1>
      <p className="text-sm text-gray-600 mb-6">Blank forms to download and print. PDFs open in the browser; Excel and Word files download.</p>
      <ul className="divide-y divide-gray-200 border border-gray-200 rounded">
        {FORMS.map(f => (
          <li key={f.file} className="flex items-center justify-between gap-4 px-4 py-3">
            <span className="text-gray-900">{f.title}</span>
            <a href={`${base}/${f.file}`} download={!f.file.endsWith('.pdf') || undefined} target={f.file.endsWith('.pdf') ? '_blank' : undefined} className="text-sm font-medium text-red-700 hover:underline whitespace-nowrap">
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
