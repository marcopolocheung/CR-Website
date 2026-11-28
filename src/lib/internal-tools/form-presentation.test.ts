import assert from 'node:assert/strict'
import test from 'node:test'
import { DIGITAL_FORM_TYPES, DIGITAL_FORMS, digitalFields, emptyDigitalForm, isDigitalForm } from '../digital-forms'
import type { WriteUpForm } from '../writeup-store'
import { formsEnglish, formsSpanish } from './i18n/forms-entry'
import { formFieldLabel, formFieldValue, formIssues, formSections, type FormValue } from './form-presentation'

const writeUp = (): WriteUpForm => ({ date:'2026-11-23',employee:'',manager:'',violations:[],otherSpecify:'',actions:[],incident:'',incidentCont:'',expected:'',employeeComments:'',employeeSignature:'',employeeSignedDate:'',managerSignature:'',managerSignedDate:'' })
const fields = (value: FormValue) => formSections(value).flatMap(section=>section.fields)

test('presentation covers every field exactly once and has complete bilingual labels and canonical options', () => {
  const before=JSON.stringify(DIGITAL_FORMS)
  for (const type of DIGITAL_FORM_TYPES) {
    const value: FormValue={type,form:emptyDigitalForm(type,'2026-11-23')}
    const shown=fields(value)
    assert.deepEqual(shown.map(field=>field.key),digitalFields(type).map(field=>field.key))
    assert.equal(new Set(shown.map(field=>field.key)).size,shown.length)
    for (const section of formSections(value)) {
      assert.ok(Object.hasOwn(formsEnglish,section.title),section.title)
      assert.ok(Object.hasOwn(formsSpanish,section.title),section.title)
    }
    for (const field of shown) {
      assert.ok(Object.hasOwn(formsEnglish,field.label),field.label)
      assert.ok(Object.hasOwn(formsSpanish,field.label),field.label)
      const canonical=digitalFields(type).find(item=>item.key===field.key)!
      assert.deepEqual(field.options?.map(option=>option.value),canonical.options)
      for (const option of field.options??[]) {
        assert.ok(Object.hasOwn(formsEnglish,option.label),option.label)
        assert.ok(Object.hasOwn(formsSpanish,option.label),option.label)
      }
    }
  }
  const value: FormValue={type:'write-up',form:writeUp()}
  assert.deepEqual(fields(value).map(field=>field.key).sort(),Object.keys(writeUp()).sort())
  for (const field of fields(value)) assert.ok(Object.hasOwn(formsEnglish,field.label),field.label)
  assert.equal(JSON.stringify(DIGITAL_FORMS),before,'UI descriptors may not alter Worker/shared definitions')
})

test('required fields preserve all five existing contracts without inventing required optional details', () => {
  const required: Record<string,string[]>={
    'write-up':['employee'], 'injury-report':['employee','incidentDate','description'],
    'customer-complaint':[], 'payroll-change-request':['employee','periodEnd'],
    'pay-rate-increase':['employee','presentRate','proposedRate','effectiveDate'],
  }
  const values: FormValue[]=[{type:'write-up',form:writeUp()},...DIGITAL_FORM_TYPES.map(type=>({type,form:emptyDigitalForm(type,'2026-11-23')}))]
  for (const value of values) {
    assert.deepEqual(formIssues(value).map(issue=>issue.field),required[value.type])
    assert.equal(fields(value).find(field=>field.key==='employeeSignature')?.required??false,false)
  }
})

test('digital errors identify raw invalid rates/dates/times without rewriting incomplete drafts', () => {
  const form=emptyDigitalForm('pay-rate-increase','2026-11-23')
  Object.assign(form.fields,{employee:'Ana López',presentRate:'0',proposedRate:'16.',effectiveDate:'2026-02-30'})
  const value: FormValue={type:'pay-rate-increase',form},before=JSON.stringify(form)
  assert.deepEqual(formIssues(value).map(issue=>[issue.field,issue.message.key]),[['proposedRate','formsEntry.moneyError'],['effectiveDate','formsEntry.dateError']])
  assert.equal(JSON.stringify(form),before)
  Object.assign(form.fields,{proposedRate:'16.50',effectiveDate:'2026-11-24'})
  assert.deepEqual(formIssues(value),[])
  assert.ok(isDigitalForm(form,value.type,true))
  form.fields.presentRate='-1';assert.equal(formIssues(value)[0].field,'presentRate')
  form.fields.presentRate='10000000';assert.equal(formIssues(value)[0].message.key,'formsEntry.moneyError')
  const injury=emptyDigitalForm('injury-report','2026-11-23')
  Object.assign(injury.fields,{employee:'Ana',incidentDate:'2026-11-23',description:'Texto sin cambiar',incidentTime:'25:00'})
  assert.deepEqual(formIssues({type:'injury-report',form:injury}).map(issue=>issue.field),['incidentTime'])
})

test('write-up limits match submission fields and do not require comments/actions/signatures', () => {
  const form=writeUp();form.employee='Ana López'
  assert.deepEqual(formIssues({type:'write-up',form}),[])
  form.manager='M'.repeat(61);form.incident='x'.repeat(3001);form.employeeSignedDate='2026-02-30'
  assert.deepEqual(formIssues({type:'write-up',form}).map(issue=>issue.field),['manager','incident','employeeSignedDate'])
  form.manager='';form.incident='';form.employeeSignedDate='';form.violations=['unknown']
  assert.equal(formIssues({type:'write-up',form})[0].message.key,'formsEntry.choiceError')
})

test('review presentation keeps Unicode narratives, literal rates and canonical selections verbatim', () => {
  const form=emptyDigitalForm('customer-complaint','2026-11-23')
  form.fields.customer='李 Ana López';form.fields.comments='Primera línea\n第二行\n  spaces stay';form.fields.quality=['Rice cold','Meat cold']
  const value: FormValue={type:'customer-complaint',form},before=JSON.stringify(form)
  assert.deepEqual(formIssues(value),[])
  assert.equal(formFieldValue(value,'comments'),form.fields.comments)
  assert.deepEqual(formFieldValue(value,'quality'),['Rice cold','Meat cold'])
  assert.equal(JSON.stringify(form),before)
  assert.equal(formsSpanish['formsEntry.option.Rice cold'],'Arroz frío')
  assert.equal(formFieldLabel(value,'preparedBy'),'formsEntry.preparedBy')
})

test('malformed choice arrays, unknown fields and invalid context are surfaced instead of silently saved', () => {
  const form=emptyDigitalForm('customer-complaint','2026-11-23')
  form.fields.quality=['Rice cold','Rice cold']
  assert.deepEqual(formIssues({type:'customer-complaint',form}).map(issue=>issue.field),['quality'])
  form.fields.quality=[];form.fields.unknown='new unsupported value'
  assert.equal(formIssues({type:'customer-complaint',form})[0].message.key,'formsEntry.formError')
  delete form.fields.unknown;form.store='Unknown'
  assert.deepEqual(formIssues({type:'customer-complaint',form}).map(issue=>issue.field),['store'])
})
