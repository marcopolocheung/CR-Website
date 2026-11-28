'use client'
import type { ReactNode } from 'react'
import { ACTIONS, VIOLATIONS, type WriteUpForm } from '@/lib/writeup-store'

// --- The paper form: mirrors docs/forms/25-1024 CHINA ROSE WRITE_UP_Form.xlsx (two sheets, Arial, bold boxes). ---

type Change = (patch: Partial<WriteUpForm>) => void
const line = 'border-0 border-b border-black bg-transparent px-1 font-normal focus:outline-none focus:bg-yellow-50 disabled:text-black'

function Sheet({ children, pageBreak }: { children: ReactNode; pageBreak?: boolean }) {
  return (
    <div className={`max-w-[8.5in] mx-auto bg-white border border-gray-300 shadow-sm px-10 py-8 mb-6 font-[Arial,Helvetica,sans-serif] font-bold text-black print:border-0 print:shadow-none print:m-0 print:p-0 ${pageBreak ? 'print:break-before-page' : ''}`}>
      <img src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/imgs/china-rose-logo.png`} alt="China Rose" className="h-9 mb-2" />
      <h2 className="text-[25px] text-center border-b-2 border-black pb-2 mb-4 print:mb-2">RECORD OF EMPLOYEE CORRECTIVE ACTION</h2>
      {children}
      <p className="text-right text-xs mt-3">OCT, 2025</p>
    </div>
  )
}

function Box({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="border-2 border-black mb-4 print:mb-2">
      {title && <h3 className="border-b-2 border-black px-2 py-2 text-lg print:py-1 print:text-base">{title}</h3>}
      <div className="px-3 py-3 print:py-1">{children}</div>
    </section>
  )
}

function Check({ label, checked, onToggle }: { label: string; checked: boolean; onToggle?: () => void }) {
  return (
    <label className="flex items-center gap-2 text-lg">
      {/* Not disabled when read-only: disabled checkboxes print grey, and the tick must stay legible. */}
      <input type="checkbox" checked={checked} aria-readonly={!onToggle} onChange={onToggle ?? (() => {})} className={`size-5 accent-black ${onToggle ? '' : 'pointer-events-none'}`} />
      {label}
    </label>
  )
}

function Area({ label, value, rows, onChange }: { label: string; value: string; rows: number; onChange?: (v: string) => void }) {
  return (
    <Box title={label}>
      <textarea
        aria-label={label.replace(/ :$/, '')}
        value={value}
        rows={rows}
        maxLength={3000}
        disabled={!onChange}
        onChange={e => onChange?.(e.target.value)}
        className="w-full resize-none bg-transparent font-normal text-base leading-10 focus:outline-none focus:bg-yellow-50 disabled:text-black print:hidden"
      />
      {/* A textarea prints only its visible rows, so paper gets the full text instead. */}
      <p data-print-text className="hidden whitespace-pre-wrap break-words font-normal text-base leading-7 print:block" style={{ minHeight: `${rows * 1.75}rem` }}>
        {value}
      </p>
    </Box>
  )
}

/** Editable when `onChange` is given, otherwise a read-only copy of a saved write-up. */
export default function PaperForm({ form, onChange, lockDate }: { form: WriteUpForm; onChange?: Change; lockDate?: boolean }) {
  const readOnly = !onChange
  const set = <K extends keyof WriteUpForm>(key: K) => (onChange ? (value: WriteUpForm[K]) => onChange({ [key]: value }) : undefined)
  const toggle = (key: 'violations' | 'actions', id: string) =>
    onChange ? () => onChange({ [key]: form[key].includes(id) ? form[key].filter(x => x !== id) : [...form[key], id] }) : undefined
  const violation = (id: string) => VIOLATIONS.find(v => v.id === id)!.label
  const action = (id: string) => ACTIONS.find(a => a.id === id)!.label

  return (
    <>
      <Sheet>
        <Box>
          <label className="flex items-center gap-3 text-base mb-6 print:mb-2">
            DATE
            <input type="date" required value={form.date} disabled={readOnly || lockDate} onChange={e => set('date')?.(e.target.value)} className={`${line} w-48`} />
          </label>
          <div className="grid grid-cols-2 gap-10 text-base">
            <label className="flex flex-col-reverse gap-1">
              EMPLOYEE
              <input required maxLength={60} value={form.employee} disabled={readOnly} onChange={e => set('employee')?.(e.target.value)} className={line} />
            </label>
            <label className="flex flex-col-reverse gap-1">
              MANAGER / SUPERVISOR
              <input maxLength={60} value={form.manager} disabled={readOnly} onChange={e => set('manager')?.(e.target.value)} className={line} />
            </label>
          </div>
        </Box>
        <Box>
          <p className="text-[13px] leading-6">
            This is a record of correction action taken to address infrractions of company policy, attendance, job performance
            infractions, conduct or behavior infractions or other voilations of the operational policies, procedures or code of
            conduct per operation guidance.
          </p>
        </Box>
        <Box title="This corrective action is being taken for violation(s) of following conducts">
          <div className="grid grid-cols-3 gap-x-4 gap-y-5 py-2 print:gap-y-2 print:py-0">
            <Check label={violation('attendance')} checked={form.violations.includes('attendance')} onToggle={toggle('violations', 'attendance')} />
            <Check label={violation('job-performance')} checked={form.violations.includes('job-performance')} onToggle={toggle('violations', 'job-performance')} />
            <Check label={violation('others')} checked={form.violations.includes('others')} onToggle={toggle('violations', 'others')} />
            <Check label={violation('conduct')} checked={form.violations.includes('conduct')} onToggle={toggle('violations', 'conduct')} />
            <Check label={violation('company-policy')} checked={form.violations.includes('company-policy')} onToggle={toggle('violations', 'company-policy')} />
            <label className="flex items-center gap-2 text-base">
              SPECIFY :
              <input maxLength={60} value={form.otherSpecify} disabled={readOnly} onChange={e => set('otherSpecify')?.(e.target.value)} className={`${line} min-w-0 flex-1`} />
            </label>
          </div>
        </Box>
        <Box title="Type of Warning / Actions by Company :">
          <div className="grid grid-cols-3 gap-x-4 gap-y-5 py-2 print:gap-y-2 print:py-0">
            <Check label={action('verbal')} checked={form.actions.includes('verbal')} onToggle={toggle('actions', 'verbal')} />
            <Check label={action('written')} checked={form.actions.includes('written')} onToggle={toggle('actions', 'written')} />
            <span />
            <Check label={action('suspension')} checked={form.actions.includes('suspension')} onToggle={toggle('actions', 'suspension')} />
            <Check label={action('termination')} checked={form.actions.includes('termination')} onToggle={toggle('actions', 'termination')} />
          </div>
        </Box>
        <Area label="Incident Descriptions :" rows={4} value={form.incident} onChange={set('incident')} />
      </Sheet>

      <Sheet pageBreak>
        <Area label="Incident Descriptions (Cont'd) :" rows={4} value={form.incidentCont} onChange={set('incidentCont')} />
        <Area label="Expected Correction Action(s) from Manager / Supervisor :" rows={5} value={form.expected} onChange={set('expected')} />
        <Area label="Employee Comments :" rows={5} value={form.employeeComments} onChange={set('employeeComments')} />
        <Box>
          {(
            [
              ['Employee Signature :', 'employeeSignature', 'employeeSignedDate'],
              ['Manager Signature :', 'managerSignature', 'managerSignedDate'],
            ] as const
          ).map(([label, name, date]) => (
            <div key={name} className="grid grid-cols-[13rem_1fr_auto_10rem] items-end gap-3 text-lg py-3">
              <span>{label}</span>
              <input aria-label={label.replace(' :', '')} maxLength={60} value={form[name]} disabled={readOnly} onChange={e => set(name)?.(e.target.value)} className={line} />
              <span>Date</span>
              <input type="date" aria-label={`${label.replace(' Signature :', '')} signed date`} value={form[date]} disabled={readOnly} onChange={e => set(date)?.(e.target.value)} className={line} />
            </div>
          ))}
        </Box>
      </Sheet>
    </>
  )
}
