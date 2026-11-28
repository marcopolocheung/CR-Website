'use client'

import type { FormValue, FormIssue, PresentationField } from '@/lib/internal-tools/form-presentation'
import { formFieldValue, formSections } from '@/lib/internal-tools/form-presentation'
import { useInternalLanguage } from './InternalLanguage'
import { Button } from './ui/controls'
import styles from './form-content.module.css'

/** Entry/review presentation only. Official English paper output uses the existing renderers. */
export default function FormContent({ value, onChange, issues = [], onEditSection, idPrefix = 'form', showContext = true }: {
  value: FormValue
  onChange?: (value: FormValue) => void
  issues?: FormIssue[]
  onEditSection?: (sectionId: string) => void
  idPrefix?: string
  showContext?: boolean
}) {
  const { t } = useInternalLanguage()
  const sections = formSections(value)
  const set = (field: string, next: string | string[]) => {
    if (value.type === 'write-up') onChange?.({ type: 'write-up', form: { ...value.form, [field]: next } })
    else onChange?.({ type: value.type, form: { ...value.form, fields: { ...value.form.fields, [field]: next } } })
  }
  const focus = (id: string) => {
    const element = document.getElementById(id)
    element?.focus(); element?.scrollIntoView({ block: 'start' })
  }
  return <div className={styles.content} id={`${idPrefix}-field-form`} tabIndex={-1} data-form-content={value.type}>
    <nav aria-label={t('formsEntry.jump')} className={styles.jump}>

    {sections.map(section => <Button key={section.id} variant="quiet" onClick={() => focus(`${idPrefix}-section-${section.id}`)}>{t(section.title)}</Button>)}
    </nav>
    {showContext && value.type !== 'write-up' && <dl className={styles.context} aria-label={t('formsEntry.context')}>
      {([['store',value.form.store],['date',value.form.date],['preparedBy',value.form.preparedBy]] as const).map(([field,raw]) => <div key={field} id={`${idPrefix}-field-${field}`} tabIndex={-1}><dt>{t(`formsEntry.${field}`)}</dt><dd>{raw || t('formsEntry.notProvided')}</dd></div>)}
    </dl>}
    {value.type==='write-up'&&<section className={styles.section}><h3>{t('formsEntry.originalDeclaration')}</h3><p lang="en">This is a record of correction action taken to address infrractions of company policy, attendance, job performance infractions, conduct or behavior infractions or other voilations of the operational policies, procedures or code of conduct per operation guidance.</p></section>}
    {sections.map(section => <section key={section.id} className={styles.section} aria-labelledby={`${idPrefix}-section-${section.id}`}>
      <div className={styles.sectionHeading}><h3 id={`${idPrefix}-section-${section.id}`} tabIndex={-1}>{t(section.title)}</h3>{onEditSection && <Button onClick={() => onEditSection(section.id)}>{t('formsEntry.editSection',{section:t(section.title)})}</Button>}</div>
      <div className={styles.fields}>{section.fields.map(field => <ContentField key={field.key} field={field} raw={formFieldValue(value,field.key)} id={`${idPrefix}-field-${field.key}`} issue={issues.find(issue => issue.field === field.key)} onChange={onChange ? next => set(field.key,next) : undefined}/>)}</div>
      {section.signature && <p className={styles.hint}>{t('formsEntry.recordedSignature')}</p>}
    </section>)}
    {value.type==='pay-rate-increase'&&<section className={styles.section}><h3>{t('formsEntry.originalDeclaration')}</h3><p lang="en">I have reviewed the employee’s performance record and recommend consideration for the increase indicated above.</p></section>}
    {value.type==='payroll-change-request'&&<section className={styles.section}><h3>{t('formsEntry.originalDeclaration')}</h3><p lang="en">Attach a copy of ID for a full name change. Keep the completed W-4 in the employee folder for tax withholding changes.</p></section>}
  </div>
}

function ContentField({ field, raw, id, issue, onChange }: { field: PresentationField; raw: string | string[]; id: string; issue?: FormIssue; onChange?: (value:string|string[])=>void }) {
  const { t } = useInternalLanguage()
  const errorId = `${id}-error`
  const label = t(field.label)
  const full = field.kind === 'textarea' || field.kind === 'checks'
  const annotation = <span className={styles.requirement}>{t(field.required?'formsEntry.required':'formsEntry.optional')}</span>
  const displayValue = field.kind === 'select' && typeof raw === 'string' && field.options?.some(option=>option.value===raw) ? t(field.options.find(option=>option.value===raw)!.label) : raw
  const error = issue && <p id={errorId} className={styles.error} role="alert">{t(issue.message.key,issue.message.params)}</p>
  if (!onChange) return <div className={`${styles.readField} ${full?styles.wide:''}`} id={id}>
    <p className={styles.label}>{label} {annotation}</p>
    {Array.isArray(raw) ? raw.length ? <ul className={styles.answers}>{raw.map(option => <li key={option}>{field.options?.some(item=>item.value===option)?t(field.options.find(item=>item.value===option)!.label):option}</li>)}</ul> : <p className={styles.missing}>{t('formsEntry.notProvided')}</p> : <p className={raw ? styles.answer : styles.missing}>{displayValue || t('formsEntry.notProvided')}</p>}
  </div>
  const shared = { id, 'aria-invalid': !!issue || undefined, 'aria-describedby': issue?errorId:undefined, required: field.required, className: styles.input }
  if (field.kind === 'checks') return <fieldset id={id} className={`${styles.wide} ${styles.checkField}`} tabIndex={-1} aria-describedby={issue?errorId:undefined} aria-invalid={!!issue || undefined}>
    <legend className={styles.label}>{label} {annotation}</legend><div className={styles.checks}>{field.options?.map(option => <label key={option.value} className={styles.check}><input type="checkbox" checked={Array.isArray(raw)&&raw.includes(option.value)} onChange={event=>onChange(event.target.checked?[...(Array.isArray(raw)?raw:[]),option.value]:(Array.isArray(raw)?raw:[]).filter(item=>item!==option.value))}/><span>{t(option.label)}</span></label>)}</div>{error}
  </fieldset>
  return <div className={full?styles.wide:undefined}><label htmlFor={id} className={styles.label}>{label} {annotation}</label>
    {field.kind === 'textarea' ? <textarea {...shared} rows={5} maxLength={field.maxLength} value={typeof raw==='string'?raw:''} onChange={event=>onChange(event.target.value)}/>
      : field.kind === 'select' ? <select {...shared} value={typeof raw==='string'?raw:''} onChange={event=>onChange(event.target.value)}><option value="">{t('formsEntry.choose')}</option>{field.options?.map(option=><option key={option.value} value={option.value}>{t(option.label)}</option>)}</select>
        : <input {...shared} type={field.kind==='date'||field.kind==='time'?field.kind:'text'} inputMode={field.kind==='money'?'decimal':undefined} maxLength={field.maxLength} readOnly={field.readOnly} value={typeof raw==='string'?raw:''} onChange={event=>onChange(event.target.value)}/>}
    {error}
  </div>
}
