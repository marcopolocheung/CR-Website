/** Blank paper forms served from public/internal/forms. */
export const BLANK_FORMS = [
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
] as const

export const blankFormHref = (basePath: string, file: string) => `${basePath}/internal/forms/${file}`

/** Every saved form type shares one list row shape so the forms list can search them together. */
export const SAVED_FORM_TYPES = ['write-up'] as const
export type SavedFormType = (typeof SAVED_FORM_TYPES)[number]
export type SavedFormRow = { type: SavedFormType; id: string; date: string; employee: string; label: string }
export type SavedFormFilter = { query: string; type: SavedFormType | ''; from: string; to: string }
export const NO_FILTER: SavedFormFilter = { query: '', type: '', from: '', to: '' }

const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

/** Keeps the server's order (newest date first, then employee); dates compare as ISO strings. */
export function filterSavedForms(rows: SavedFormRow[], { query, type, from, to }: SavedFormFilter): SavedFormRow[] {
  const words = fold(query).split(/\s+/).filter(Boolean)
  return rows.filter(row => {
    if (type && row.type !== type) return false
    if (from && row.date < from) return false
    if (to && row.date > to) return false
    const text = fold(`${row.employee} ${row.label}`)
    return words.every(word => text.includes(word))
  })
}

export const isFiltered = (filter: SavedFormFilter) => Object.values(filter).some(Boolean)
