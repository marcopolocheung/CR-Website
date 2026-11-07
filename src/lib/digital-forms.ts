/** Shared by the editor and Worker so saved records use the same field contract. */
export const DIGITAL_FORM_TYPES = ['injury-report', 'customer-complaint', 'payroll-change-request', 'pay-rate-increase'] as const
export type DigitalFormType = (typeof DIGITAL_FORM_TYPES)[number]
export type FormField = { key: string; label: string; kind?: 'date' | 'time' | 'money' | 'textarea' | 'select' | 'checks'; required?: boolean; options?: readonly string[] }
export type FormDefinition = { title: string; sections: { title: string; fields: FormField[] }[] }
const f = (key: string, label: string, kind?: FormField['kind'], options?: readonly string[]): FormField => ({ key, label, kind, options, required: ['employee', 'incidentDate', 'description', 'periodEnd', 'presentRate', 'proposedRate', 'effectiveDate'].includes(key) })
export const DIGITAL_FORMS: Record<DigitalFormType, FormDefinition> = {
  'customer-complaint': {
    title: 'Customer complaint', sections: [
      { title: 'Complaint details', fields: [f('shift', 'Shift of complaint', 'select', ['AM', 'PM']), f('customer', 'Customer name (optional)')] },
      { title: 'Customer service', fields: [f('service', 'Customer service concerns', 'checks', ['Incorrect credit card charges', 'Rude food server', 'Rude cashier', 'Rude shift leader / manager'])] },
      { title: 'Food quality', fields: [f('quality', 'Food quality concerns', 'checks', ['Too salty', 'Strange taste', 'Too much sauce', 'Sauce not enough', 'Meat too tough', 'Meat not done', 'Rice too hard', 'Rice burnt', 'Rice raw', 'Rice cold', 'Meat cold'])] },
      { title: 'Food quantity and other concerns', fields: [f('quantity', 'Food quantity concerns', 'checks', ['Meat not enough', 'Vegetables not enough', 'Rice not enough']), f('other', 'Other concerns', 'checks', ['Table / chair dirty', 'Floor dirty', 'Restroom smells / messy', 'Dining room too hot', 'Dining room dirty', 'Other'])] },
      { title: 'Follow-up', fields: [f('comments', 'Additional comments', 'textarea'), f('resolution', 'Action taken / resolution', 'textarea'), f('manager', 'Shift manager name'), f('managerDate', 'Manager date', 'date')] },
    ],
  },
  'pay-rate-increase': {
    title: 'Pay rate increase application', sections: [
      { title: 'Employee details', fields: [f('employee', 'Employee name'), f('employeeNumber', 'Employee number'), f('department', 'Department'), f('position', 'Position')] },
      { title: 'Proposed increase', fields: [f('presentRate', 'Present rate ($)', 'money'), f('proposedRate', 'Increase to ($)', 'money'), f('payBasis', 'Pay basis', 'select', ['Hourly', 'Salary']), f('raiseDate', 'Date of raise', 'date'), f('effectiveDate', 'Effective date', 'date'), f('reason', 'Reason / performance review', 'textarea')] },
      { title: 'Manager and office review', fields: [f('manager', 'Store manager'), f('managerDate', 'Manager date', 'date'), f('approvedBy', 'Approved by'), f('denialReason', 'Application denied for the following reasons', 'textarea')] },
    ],
  },
  'payroll-change-request': {
    title: 'Payroll change request', sections: [
      { title: 'Employee and pay period', fields: [f('company', 'Company'), f('employeeNumber', 'Employee number'), f('employee', 'Employee name'), f('periodEnd', 'Pay period ending date', 'date')] },
      { title: 'Payroll discrepancy', fields: [f('hoursShort', 'Hours short'), f('payShort', 'Pay short ($)', 'money'), f('otherDiscrepancy', 'Other discrepancy'), f('explanation', 'Explanation', 'textarea')] },
      { title: 'Change information on payroll', fields: [f('nameChange', 'Name change'), f('addressChange', 'Address change', 'textarea'), f('taxChange', 'Tax withholding change'), f('otherChange', 'Other change', 'textarea')] },
      { title: 'Signatures and approvals', fields: [f('employeeSignature', 'Employee signature / name'), f('signedDate', 'Employee signed date', 'date'), f('manager', 'Manager approved'), f('officeApproved', 'Office approved')] },
    ],
  },
  'injury-report': {
    title: 'Injury report', sections: [
      { title: 'Injured person', fields: [f('company', 'Company'), f('personType', 'Injured person type', 'select', ['Employee', 'Customer', 'Other']), f('employee', 'Injured person name'), f('phone', 'Contact phone'), f('address', 'Address', 'textarea')] },
      { title: 'Incident and first response', fields: [f('incidentDate', 'Date of incident', 'date'), f('incidentTime', 'Time of incident', 'time'), f('manager', 'Manager on duty'), f('firstResponse', 'First reaction to incident', 'textarea'), f('emergencyResponse', 'Emergency services contacted', 'checks', ['Called 911', 'Called police']), f('referenceNumber', '911 reference number'), f('paramedic', 'Name of paramedic'), f('policeCase', 'Police case number'), f('officer', 'Name of officer'), f('locationType', 'Location of incident', 'select', ['Inside the store', 'Outside the store', 'Other']), f('location', 'Where did the incident happen?')] },
      { title: 'Witnesses and evidence', fields: [f('witness1', 'First witness name'), f('witness1Phone', 'First witness phone'), f('witness1Address', 'First witness address'), f('witness2', 'Second witness name'), f('witness2Phone', 'Second witness phone'), f('witness2Address', 'Second witness address'), f('evidence', 'Evidence and where it is kept', 'textarea')] },
      { title: 'Report', fields: [f('description', 'Describe the incident', 'textarea'), f('reportedBy', 'Report filled by'), f('reportDate', 'Report date', 'date')] },
    ],
  },
}
export const isDigitalFormType = (value: unknown): value is DigitalFormType => typeof value === 'string' && Object.hasOwn(DIGITAL_FORMS, value)
export type DigitalForm = { date: string; store: string; preparedBy: string; fields: Record<string, string | string[]> }
export type DigitalFormDoc = { v: 1; id: string; type: DigitalFormType; form: DigitalForm; label: string; createdAt: string; labelUpdatedAt: string | null }
export const digitalFields = (type: DigitalFormType) => DIGITAL_FORMS[type].sections.flatMap(section => section.fields)
export function emptyDigitalForm(type: DigitalFormType, date: string): DigitalForm {
  return { date, store: 'CR3', preparedBy: '', fields: Object.fromEntries(digitalFields(type).map(field => [field.key, field.kind === 'checks' ? [] : ''])) }
}
export const validFormDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
const text = (value: unknown, max: number): value is string => typeof value === 'string' && value.length <= max
/** Drafts permit incomplete values, but never unknown fields or credentials. */
export function isDigitalForm(value: unknown, type: DigitalFormType, complete = false): value is DigitalForm {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const form = value as DigitalForm
  if (Object.keys(form).sort().join(',') !== 'date,fields,preparedBy,store' || !validFormDate(form.date) || !['CR2', 'CR3'].includes(form.store) || !text(form.preparedBy, 120)) return false
  if (!form.fields || typeof form.fields !== 'object' || Array.isArray(form.fields)) return false
  const fields = digitalFields(type)
  if (Object.keys(form.fields).length !== fields.length) return false
  return fields.every(field => {
    const v = form.fields[field.key]
    if (field.kind === 'checks') return Array.isArray(v) && new Set(v).size === v.length && v.every(choice => field.options!.includes(choice))
    if (!text(v, field.kind === 'textarea' ? 3000 : ['employee', 'customer'].includes(field.key) ? 60 : 120)) return false
    if (complete && (field.required || field.key === 'employee') && !v.trim()) return false
    if (field.kind === 'select') return !v || field.options!.includes(v)
    // Incomplete drafts may contain partially typed dates and rates.
    if (!complete) return true
    if (field.kind === 'date') return !v || validFormDate(v)
    if (field.kind === 'time') return !v || /^([01]\d|2[0-3]):[0-5]\d$/.test(v)
    if (field.kind === 'money') return !v || /^\d{1,7}(\.\d{1,2})?$/.test(v)
    return true
  })
}
export function digitalFormPerson(type: DigitalFormType, form: DigitalForm): string {
  const value = form.fields[type === 'customer-complaint' ? 'customer' : 'employee']
  return typeof value === 'string' && value.trim() ? value.trim() : 'Anonymous customer'
}
