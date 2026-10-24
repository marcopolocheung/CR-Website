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
