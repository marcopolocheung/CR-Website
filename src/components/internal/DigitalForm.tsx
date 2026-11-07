'use client'

import { useMemo, useState } from 'react'
import { DIGITAL_FORMS, emptyDigitalForm, isDigitalForm, type DigitalForm, type DigitalFormType, type FormField } from '@/lib/digital-forms'
import FormDraftWorkspace, { type FormEditorProps } from './FormDraftWorkspace'
import type { TranslationKey } from '@/lib/internal-tools/i18n'

const fieldClass = 'mt-1 block w-full min-h-11 rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900'
const button = 'min-h-11 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium disabled:opacity-50'
const primary = `${button} border-red-600 bg-red-600 text-white hover:bg-red-700`

export function NewDigitalForm({ type, busy, onSave }: { type: DigitalFormType; busy: boolean; onSave: (form: DigitalForm, markSaved: (id: string) => void) => void }) {
  const validate = useMemo(() => (value: unknown): value is DigitalForm => isDigitalForm(value, type), [type])
  return (
    <FormDraftWorkspace formType={type} title={`formDrafts.${type}Title` as TranslationKey} validateForm={validate}
      createForm={(date, context) => ({ ...emptyDigitalForm(type, date), store: context.store, preparedBy: context.preparer })}>
      {editor => <DigitalFormEditor key={editor.draft.id} type={type} editor={editor} busy={busy} onSave={form => onSave(form, editor.markSaved)} />}
    </FormDraftWorkspace>
  )
}

function DigitalFormEditor({ type, editor, busy, onSave }: { type: DigitalFormType; editor: FormEditorProps<DigitalForm>; busy: boolean; onSave: (form: DigitalForm) => void }) {
  const [form, setForm] = useState(editor.draft.payload.form)
  const [review, setReview] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const alreadySaved = !!editor.draft.payload.savedId && !acknowledged
  const change = (key: string, value: string | string[]) => {
    const next = { ...form, fields: { ...form.fields, [key]: value } }
    setForm(next)
    editor.persist(next)
  }
  const valid = isDigitalForm(form, type, true)
  return (
    <form onSubmit={e => { e.preventDefault(); if (!busy && !alreadySaved && valid) { if (review) onSave(form); else { setReview(true); window.scrollTo({ top: 0, behavior: 'smooth' }) } } }}>
      {alreadySaved && <div role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 print:hidden">
        <p>This draft was already saved. Creating another form makes a separate record.</p>
        <button type="button" className={`${button} mt-2`} onClick={() => setAcknowledged(true)}>Edit as a new form</button>
      </div>}
      {review && <p role="status" className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 print:hidden">Review your answers before saving. Once saved, the form cannot be edited; its manager label can be changed.</p>}
      {!review && <p className="mb-3 text-sm text-gray-600 print:hidden">* Required fields. Other fields may be completed as needed.</p>}
      <DigitalPaperForm type={type} form={form} onChange={!review && !alreadySaved ? change : undefined} />
      <div className="mx-auto mt-4 flex max-w-[8.5in] flex-wrap items-center justify-end gap-3 print:hidden">
        {review && <button type="button" disabled={busy} className={button} onClick={() => setReview(false)}>Edit answers</button>}
        {!review && <p className="text-sm text-gray-600">Review your answers, then save a permanent copy.</p>}
        <button type="submit" disabled={busy || alreadySaved || !valid} className={primary}>{busy ? 'Saving…' : review ? 'Save form' : 'Review form'}</button>
      </div>
    </form>
  )
}

export function DigitalPaperForm({ type, form, onChange }: { type: DigitalFormType; form: DigitalForm; onChange?: (key: string, value: string | string[]) => void }) {
  const definition = DIGITAL_FORMS[type]
  return (
    <article className="mx-auto max-w-[8.5in] rounded-lg border border-gray-300 bg-white p-4 text-gray-900 shadow-sm sm:p-8 print:border-0 print:p-0 print:shadow-none">
      <img src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/imgs/china-rose-logo.png`} alt="China Rose" className="mb-3 h-9" />
      <h2 className="mb-5 border-b-2 border-black pb-3 text-center text-2xl font-bold">{definition.title}</h2>
      <dl className="mb-5 grid gap-3 text-sm sm:grid-cols-3">
        <div><dt className="font-semibold">Store</dt><dd>{form.store}</dd></div>
        <div><dt className="font-semibold">Form date</dt><dd>{form.date}</dd></div>
        <div><dt className="font-semibold">Prepared by</dt><dd className="break-words">{form.preparedBy}</dd></div>
      </dl>
      {definition.sections.map(section => (
        <section key={section.title} className="mb-5 border-t border-gray-300 pt-3">
          <h3 className="mb-3 text-lg font-semibold">{section.title}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {section.fields.map(field => <DigitalField key={field.key} field={field} value={form.fields[field.key]} onChange={onChange ? value => onChange(field.key, value) : undefined} />)}
          </div>
        </section>
      ))}
      {type === 'pay-rate-increase' && <p className="mt-4 text-sm">I have reviewed the employee’s performance record and recommend consideration for the increase indicated above.</p>}
      {type === 'payroll-change-request' && <p className="mt-4 text-sm">Attach a copy of ID for a full name change. Keep the completed W-4 in the employee folder for tax withholding changes.</p>}
      <p className="mt-5 border-t border-gray-300 pt-3 text-sm">Print for any required handwritten signatures or supporting documents.</p>
    </article>
  )
}

function DigitalField({ field, value, onChange }: { field: FormField; value: string | string[]; onChange?: (value: string | string[]) => void }) {
  const required = field.required || field.key === 'employee'
  const label = `${field.label}${required ? ' *' : ''}`
  const wide = field.kind === 'textarea' || field.kind === 'checks'
  if (!onChange) return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <p className="text-sm font-semibold">{field.label}</p>
      <p className="min-h-8 whitespace-pre-wrap break-words border-b border-gray-200 py-1 text-base">{Array.isArray(value) ? value.join(', ') || '—' : value || '—'}</p>
    </div>
  )
  if (field.kind === 'checks') return (
    <fieldset className="sm:col-span-2">
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      <div className="grid gap-2 sm:grid-cols-2">{field.options!.map(option => <label key={option} className="flex min-h-11 items-center gap-2 rounded border border-gray-200 px-3 py-2">
        <input type="checkbox" checked={Array.isArray(value) && value.includes(option)} onChange={e => onChange(e.target.checked ? [...(value as string[]), option] : (value as string[]).filter(v => v !== option))} className="size-5 accent-red-600" />{option}
      </label>)}</div>
    </fieldset>
  )
  return (
    <label className={`text-sm font-medium ${wide ? 'sm:col-span-2' : ''}`}>
      {label}
      {field.kind === 'textarea'
        ? <textarea aria-label={label} value={value as string} required={required} rows={4} maxLength={3000} onChange={e => onChange(e.target.value)} className={fieldClass} />
        : field.kind === 'select'
          ? <select aria-label={label} value={value as string} required={required} onChange={e => onChange(e.target.value)} className={fieldClass}><option value="">Select…</option>{field.options!.map(option => <option key={option}>{option}</option>)}</select>
          : <input aria-label={label} type={field.kind === 'date' || field.kind === 'time' ? field.kind : field.kind === 'money' ? 'number' : 'text'} inputMode={field.kind === 'money' ? 'decimal' : undefined} min={field.kind === 'money' ? '0' : undefined} max={field.kind === 'money' ? '9999999.99' : undefined} step={field.kind === 'money' ? '0.01' : undefined} required={required} maxLength={['employee', 'customer'].includes(field.key) ? 60 : 120} value={value as string} onChange={e => onChange(e.target.value)} className={fieldClass} />}
    </label>
  )
}
