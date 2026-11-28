'use client'
import { useCallback, useEffect, useRef, useState, type FormEvent, type MouseEvent, type ReactNode } from 'react'
import { useManagerSession } from './ManagerSession'
import { useWorkspaceVisible } from './WorkspaceVisibility'
import { useNavigationProtection, useWorkTransitions } from './NavigationProtection'
import { useShellTask } from './ShellTask'
import { useInternalLanguage } from './InternalLanguage'
import { CodeGate } from './CashOut'
import { EmptyState, ErrorSummary, focusField } from './Feedback'
import { InternalTheme } from './ui/Theme'
import { Button, Paper } from './ui/controls'
import FormDraftWorkspace, { type FormDraftPayload, type FormEditorProps } from './FormDraftWorkspace'
import FormDraftLibrary from './FormDraftLibrary'
import FormContent from './FormContent'
import WriteUpPaper from './WriteUpPaper'
import { DigitalPaperForm } from './DigitalForm'
import { formIssues, type FormValue } from '@/lib/internal-tools/form-presentation'
import { isWriteUpDraft } from '@/lib/internal-tools/writeup-draft'
import { newDraft, type Draft } from '@/lib/internal-tools/drafts'
import type { ReadyFormDraftSource } from '@/lib/internal-tools/form-drafts'
import { BLANK_FORMS, blankFormHref, NO_FILTER, SAVED_FORM_TYPES, filterSavedForms, isFiltered, type SavedFormFilter, type SavedFormRow, type SavedFormType } from '@/lib/forms'
import { DIGITAL_FORMS, emptyDigitalForm, isDigitalForm, digitalFormPerson, type DigitalForm, type DigitalFormDoc } from '@/lib/digital-forms'
import { fetchWriteUp, fetchWriteUps, saveWriteUp, saveWriteUpLabel, type WriteUpDoc, type WriteUpForm } from '@/lib/writeup-store'
import { deleteSavedForm, fetchDigitalForm, fetchDigitalForms, saveDigitalForm, saveDigitalFormLabel } from '@/lib/digital-form-store'
import { StoreAuthError } from '@/lib/schedule-store'
import { errorKey, type Message } from '@/lib/internal-tools/i18n'
import styles from './forms-workspace.module.css'

type Library = 'saved'|'drafts'|'blank'
type FormData = WriteUpForm|DigitalForm
type Slot = {type:SavedFormType;id:string;initial?:Draft<FormDraftPayload<FormData>>}
type RecordSelection = {type:SavedFormType;id:string;doc:WriteUpDoc|DigitalFormDoc|null}
const LIBRARIES: Library[] = ['saved','drafts','blank']
const libraryHash = (): Library => LIBRARIES.includes(location.hash.slice(1) as Library) ? location.hash.slice(1) as Library : 'saved'
const button = 'min-h-11 px-4 py-2 text-sm font-medium disabled:opacity-50'
const primary = `${button} bg-red-800 text-white`
const secondary = `${button} border border-gray-400 bg-white`
const field = 'mt-1 block w-full min-h-11 border border-gray-400 bg-white px-3 py-2 text-base'
const emptyWriteUp = (date:string):WriteUpForm => ({date,employee:'',manager:'',violations:[],otherSpecify:'',actions:[],incident:'',incidentCont:'',expected:'',employeeComments:'',employeeSignature:'',employeeSignedDate:'',managerSignature:'',managerSignedDate:''})
const asValue = (type:SavedFormType,form:FormData):FormValue => type==='write-up'?{type,form:form as WriteUpForm}:{type,form:form as DigitalForm}
const person = (type:SavedFormType,form:FormData) => type==='write-up'?(form as WriteUpForm).employee.trim():digitalFormPerson(type,form as DigitalForm)
const summary = (type:SavedFormType,id:string,form:FormData,label=''):SavedFormRow => ({type,id,date:form.date,employee:person(type,form),label,...(type!=='write-up'?{store:(form as DigitalForm).store}:{})})
function failure(caught:unknown):Message {
  const message=caught instanceof Error?caught.message:''
  if (/not found/i.test(message)) return {key:'formsWorkspace.notFound'}
  if (/required|rejected|Check the date/.test(message)) return {key:'formsWorkspace.rejected'}
  if (/too large/i.test(message)) return {key:'formsWorkspace.tooLarge'}
  return {key:errorKey(caught)}
}

/** One retained forms controller; library browsing never replaces the active draft. */
export default function WriteUps() {
  const session=useManagerSession(), liveSession=useRef(session); liveSession.current=session
  const {token}=session, visible=useWorkspaceVisible(), {t}=useInternalLanguage(), transitions=useWorkTransitions()
  const mounted=useRef(true), requests=useRef({list:0,record:0}), mutationBusy=useRef(false)
  const [library,setLibrary]=useState<Library>('saved'), [pane,setPane]=useState<'library'|'editor'|'record'>('library')
  const paneRef=useRef(pane);paneRef.current=pane
  const [unlocked,setUnlocked]=useState(false), [busy,setBusy]=useState(false), [opening,setOpening]=useState(false)
  const [list,setList]=useState<SavedFormRow[]|null>(null), [loading,setLoading]=useState(false), [loadFailed,setLoadFailed]=useState(false)
  const [filter,setFilter]=useState<SavedFormFilter>(NO_FILTER), [status,setStatus]=useState<Message|null>(null)
  const [slot,setSlot]=useState<Slot|null>(null), slotRef=useRef(slot);slotRef.current=slot
  const [activeDraft,setActiveDraft]=useState<Draft<FormDraftPayload<FormData>>|null>(null)
  const [selection,setSelection]=useState<RecordSelection|null>(null), selectionRef=useRef(selection);selectionRef.current=selection
  const [chooser,setChooser]=useState(false), [resume,setResume]=useState<ReadyFormDraftSource|null>(null), [deleting,setDeleting]=useState<SavedFormRow|null>(null)
  const [draftRefresh,setDraftRefresh]=useState(0)
  const heading=useRef<HTMLHeadingElement>(null)
  const savedHere=useRef(new Map<string,SavedFormRow>()), deleted=useRef(new Set<string>())
  const focusHeading=()=>requestAnimationFrame(()=>heading.current?.focus())
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;requests.current.list++;requests.current.record++}},[])
  useEffect(()=>{
    requests.current.list++;requests.current.record++;mutationBusy.current=false;setBusy(false);setOpening(false);setLoading(false)
    setChooser(false);setResume(null);setDeleting(null);setStatus(null)
    if(token)setUnlocked(true)
  },[session.generation,token])
  useEffect(()=>{
    const follow=()=>{if(!visible)return;requests.current.record++;setOpening(false);setLibrary(libraryHash());setPane('library');focusHeading()}
    follow();window.addEventListener('hashchange',follow);window.addEventListener('popstate',follow)
    return()=>{window.removeEventListener('hashchange',follow);window.removeEventListener('popstate',follow)}
  },[visible])
  function navigate(event:MouseEvent<HTMLAnchorElement>,next:Library) {
    if(event.metaKey||event.ctrlKey||event.altKey||event.shiftKey)return
    event.preventDefault()
    if(location.hash!==`#${next}`)history.pushState(history.state,'',`#${next}`)
    requests.current.record++;setOpening(false);setLibrary(next);setPane('library');focusHeading()
  }
  function credential() {
    const current=liveSession.current, generation=current.generation, value=current.token
    return {token:value,live:()=>mounted.current&&!!value&&liveSession.current.token===value&&liveSession.current.generation===generation}
  }
  const refresh=useCallback(async()=>{
    const generation=liveSession.current.generation, credential=liveSession.current.token
    if(!credential)return
    const request=++requests.current.list
    const live=()=>mounted.current&&request===requests.current.list&&generation===liveSession.current.generation&&credential===liveSession.current.token
    setLoading(true);setLoadFailed(false)
    try {
      const [writeups,forms]=await Promise.all([fetchWriteUps(credential),fetchDigitalForms(credential)])
      if(!live())return
      const merged=new Map<string,SavedFormRow>([...writeups.map(row=>({...row,type:'write-up' as const})),...forms].map(row=>[`${row.type}:${row.id}`,row]))
      for(const [key,row] of savedHere.current)merged.set(key,row)
      setList([...merged.values()].filter(row=>!deleted.current.has(`${row.type}:${row.id}`)).sort((a,b)=>b.date.localeCompare(a.date)||a.employee.localeCompare(b.employee)))
    } catch(caught) {if(live()){setLoadFailed(true);if(caught instanceof StoreAuthError)liveSession.current.expire()}}
    finally {if(live())setLoading(false)}
  },[])
  useEffect(()=>{if(token&&visible)void refresh()},[token,session.generation,visible,refresh])
  const onActiveChange=useCallback((draft:Draft<FormDraftPayload<FormData>>|null)=>{setActiveDraft(draft);setDraftRefresh(value=>value+1)},[])
  useShellTask('forms',{onLock:token?session.expire:undefined})
  useShellTask('forms-context',{context:!token?null:pane==='editor'&&activeDraft?`${activeDraft.context.storeId} · ${activeDraft.context.businessDate}`:pane==='record'&&selection?.doc?`${selection.type==='write-up'?'':(selection.doc.form as DigitalForm).store+' · '}${selection.doc.form.date}`:null})
  useNavigationProtection({dirty:false,deviceSaved:true,busy,leave:()=>{requests.current.record++;setPane('library');setChooser(false);setResume(null);setDeleting(null)}})

  function begin(type:SavedFormType, initial?:Draft<FormDraftPayload<FormData>>) {
    if(mutationBusy.current)return
    setChooser(false);setResume(null)
    void transitions.change(()=>{
      setSlot({type,id:crypto.randomUUID(),initial});setActiveDraft(null);setPane('editor');setChooser(false);setResume(null);setStatus(null);focusHeading()
    })
  }
  async function readRecord(row:Pick<SavedFormRow,'type'|'id'>,show=true) {
    const auth=credential();if(!auth.token)return
    const request=++requests.current.record
    const live=()=>auth.live()&&request===requests.current.record
    setOpening(true);setStatus(null)
    if(show){setSelection({...row,doc:null});setPane('record');focusHeading()}
    try {
      const doc=row.type==='write-up'?await fetchWriteUp(row.id,auth.token):await fetchDigitalForm(row.id,auth.token)
      if(live()){setSelection({...row,doc});savedHere.current.set(`${row.type}:${row.id}`,summary(row.type,row.id,doc.form,doc.label))}
    } catch(caught) {if(live()){setStatus(failure(caught));if(caught instanceof StoreAuthError)liveSession.current.expire()}}
    finally {if(live())setOpening(false)}
  }
  async function mutate(task:(auth:ReturnType<typeof credential>)=>Promise<void>) {
    if(mutationBusy.current)return
    const auth=credential();if(!auth.token)return
    mutationBusy.current=true;setBusy(true);setStatus(null)
    try {await task(auth)}
    catch(caught){if(auth.live()){setStatus(failure(caught));if(caught instanceof StoreAuthError)liveSession.current.expire()}}
    finally {if(auth.live()){mutationBusy.current=false;setBusy(false)}}
  }
  function save(type:SavedFormType,form:FormData,editor:FormEditorProps<FormData>) {
    const activeSlot=slotRef.current, draftId=editor.draft.id, submitted=structuredClone(form)
    void mutate(async auth=>{
      let accepted=false
      const same=()=>auth.live()&&slotRef.current===activeSlot
      try {
        let id:string,doc:DigitalFormDoc|undefined
        if(type==='write-up')id=await saveWriteUp(submitted as WriteUpForm,auth.token)
        else {doc=await saveDigitalForm(type,submitted as DigitalForm,auth.token);id=doc.id}
        accepted=true
        if(!same())return
        // Acknowledge before a subsequent GET. Its failure can only offer GET retry.
        editor.markSaved(id)
        savedHere.current.set(`${type}:${id}`,summary(type,id,doc?.form??submitted,doc?.label??''))
        setList(rows=>[summary(type,id,doc?.form??submitted,doc?.label??''),...(rows??[]).filter(row=>row.type!==type||row.id!==id)].sort((a,b)=>b.date.localeCompare(a.date)||a.employee.localeCompare(b.employee)))
        const recordRequest=++requests.current.record
        setSelection({type,id,doc:doc??null})
        if(paneRef.current==='editor'){setPane('record');focusHeading()}
        setStatus({key:'formsWorkspace.saveConfirmed'})
        if(type==='write-up') {
          try {
            const saved=await fetchWriteUp(id,auth.token)
            if(same()&&recordRequest===requests.current.record)setSelection({type,id,doc:saved})
          } catch(caught) {
            if(!same()||recordRequest!==requests.current.record)return
            setStatus({key:'formsWorkspace.savedReadFailed'})
            if(caught instanceof StoreAuthError)liveSession.current.expire()
          }
        }
      } catch(caught) {
        if(!same()||editor.draft.id!==draftId)return
        if(caught instanceof StoreAuthError){liveSession.current.expire();return}
        const reason=failure(caught)
        setStatus(accepted?{key:'formsWorkspace.savedReadFailed'}:reason.key==='errors.unavailable'?{key:'formsWorkspace.unconfirmed'}:reason)
      }
    })
  }
  function labelRecord(label:string) {
    const target=selectionRef.current;if(!target?.doc)return
    void mutate(async auth=>{
      let doc:WriteUpDoc|DigitalFormDoc
      if(target.type==='write-up'){const acknowledged=await saveWriteUpLabel(target.id,label,auth.token);doc={...target.doc!,...acknowledged}}
      else doc=await saveDigitalFormLabel(target.id,label,auth.token)
      if(!auth.live())return
      const row=summary(target.type,target.id,doc.form,doc.label);savedHere.current.set(`${target.type}:${target.id}`,row)
      setList(rows=>rows?.map(value=>value.type===target.type&&value.id===target.id?row:value)??null)
      if(selectionRef.current?.id===target.id&&selectionRef.current.type===target.type)setSelection({...target,doc})
      setStatus({key:'formsWorkspace.labelSaved'})
    })
  }
  function deleteRecord() {
    const target=deleting;if(!target)return
    void mutate(async auth=>{
      await deleteSavedForm(target,auth.token)
      if(!auth.live())return
      const key=`${target.type}:${target.id}`;deleted.current.add(key);savedHere.current.delete(key)
      setList(rows=>rows?.filter(row=>row.type!==target.type||row.id!==target.id)??null)
      if(selectionRef.current?.id===target.id&&selectionRef.current.type===target.type){requests.current.record++;setSelection(null);setPane('library')}
      setDeleting(null);setStatus({key:'formsWorkspace.deleted'});void refresh();focusHeading()
    })
  }
  const recordValue=selection?.doc?asValue(selection.type,selection.doc.form):null
  const printable=pane==='record'?recordValue:pane==='editor'&&activeDraft?asValue(slot!.type,activeDraft.payload.form):null
  return <><InternalTheme><div className={styles.workspace}>
    <div className={styles.screen}>
      <div className={styles.titleRow}><h1>{t('shell.forms')}</h1>{token&&<Button data-forms-new onClick={()=>setChooser(true)} disabled={busy} variant="primary">{t('formsWorkspace.new')}</Button>}</div>
      <nav aria-label={t('formsWorkspace.navigation')} className={styles.views}>{LIBRARIES.map(value=><a key={value} data-local-view="true" href={`#${value}`} aria-current={pane==='library'&&library===value?'page':undefined} onClick={event=>navigate(event,value)}>{t(`formsWorkspace.${value}`)}</a>)}</nav>
      {token&&activeDraft&&pane!=='editor'&&<div className={styles.resumeBar}><p>{t('formsWorkspace.active',{type:t(`forms.type.${slot!.type}`),date:activeDraft.context.businessDate!,store:activeDraft.context.storeId})}</p><Button data-forms-return-draft onClick={()=>{setPane('editor');focusHeading()}}>{t('formsWorkspace.returnDraft')}</Button></div>}
      <h2 ref={heading} tabIndex={-1} data-forms-heading className={styles.heading}>{pane==='editor'&&slot?t(`forms.type.${slot.type}`):pane==='record'?t('formsWorkspace.record'):t(`formsWorkspace.${library}`)}</h2>
      {(library!=='blank'||pane!=='library')&&!token&&visible&&<CodeGate onUnlock={session.unlock} title={t('forms.savedTitle')}/>}
      <div hidden={!token}>
        {status&&<p role="status" className={styles.status}>{t(status.key,status.params)}</p>}
        {unlocked&&<>
          <section hidden={pane!=='library'||library!=='saved'} data-forms-library="saved"><div className={styles.actions}><Button disabled={busy||loading} onClick={()=>void refresh()}>{t('formsWorkspace.refresh')}</Button></div><SavedFormsList list={list} failed={loadFailed} busy={busy||loading} filter={filter} setFilter={setFilter} onOpen={row=>void readRecord(row)} onRetry={()=>void refresh()} onDelete={row=>{setStatus(null);setDeleting(row)}}/></section>
          <section hidden={pane!=='library'||library!=='drafts'} data-forms-library="drafts"><FormDraftLibrary busy={busy} refreshKey={draftRefresh} onResume={source=>setResume(source)}/></section>
          <section hidden={pane!=='editor'} data-form-editor>{slot&&<ActiveForm key={slot.id} slot={slot} busy={busy} onActiveChange={onActiveChange} onSave={save}/>}</section>
          <section hidden={pane!=='record'} data-form-record data-form-record-type={selection?.type} data-form-record-id={selection?.id}>
            <div className={styles.actions}><Button onClick={()=>{setPane('library');setLibrary('saved');void refresh();focusHeading()}}>{t('formsWorkspace.back')}</Button><Button data-forms-print-action disabled={!recordValue} onClick={()=>window.print()}>{t('common.print')}</Button>{selection?.doc&&<Button disabled={busy} onClick={()=>{setStatus(null);setDeleting(summary(selection.type,selection.id,selection.doc!.form,selection.doc!.label))}}>{t('formsWorkspace.deleteForm')}</Button>}</div>
            {opening&&<p role="status">{t('common.loading')}</p>}
            {!selection?.doc&&selection&&!opening&&<Button onClick={()=>void readRecord(selection)}>{t('formsWorkspace.retryRecord')}</Button>}
            {selection?.doc&&recordValue&&<>
              <LabelEditor key={`${selection.type}:${selection.id}`} doc={selection.doc} busy={busy} onSave={labelRecord}/>
              <p className="my-3">{t('formsWorkspace.immutable')}</p>
              {selection.type==='write-up'&&<p className="my-3">{t('formsWorkspace.storeUnavailable')}</p>}
              <Paper emphasis="active"><FormContent value={recordValue} idPrefix="saved-form"/></Paper>
            </>}
          </section>
        </>}
      </div>
      <section hidden={pane!=='library'||library!=='blank'} data-forms-library="blank"><BlankForms/></section>
      {visible&&token&&chooser&&<Modal title={t('formsWorkspace.choose')} onClose={()=>setChooser(false)}><div className={styles.chooser}>{SAVED_FORM_TYPES.map(type=><Button key={type} data-forms-new-type={type} disabled={busy} onClick={()=>begin(type)}><span><strong>{t(`forms.type.${type}`)}</strong><span className="block font-normal mt-2">{t(`formsWorkspace.purpose.${type}`)}</span></span></Button>)}</div></Modal>}
      {visible&&token&&resume&&<ResumeDialog source={resume} busy={busy} onClose={()=>setResume(null)} onResume={preparer=>begin(resume.formType,newDraft(resume.draft.context,preparer,resume.draft.payload,{source:resume.draft}))}/>}
      {visible&&token&&deleting&&<Modal footer={false} title={t('forms.deleteTitle')} onClose={()=>{if(!busy){setDeleting(null);setStatus(null)}}}><p>{t(`forms.type.${deleting.type}`)} · {deleting.employee} · {deleting.date}{deleting.store&&` · ${deleting.store}`}</p><p className="my-3">{t('forms.deleteDescription')}</p>{status&&<p role="alert">{t(status.key,status.params)}</p>}<div className={styles.actions}><Button autoFocus disabled={busy} onClick={()=>setDeleting(null)}>{t('feedback.cancel')}</Button><Button variant="primary" disabled={busy} onClick={deleteRecord}>{t('forms.delete')}</Button></div></Modal>}
    </div>
    </div></InternalTheme>
    <div className={styles.print} data-forms-print hidden={!token||!printable}>{printable&&(printable.type==='write-up'?<WriteUpPaper form={printable.form}/>:<DigitalPaperForm type={printable.type} form={printable.form}/>)}</div>
  </>
}

function ActiveForm({slot,busy,onActiveChange,onSave}:{slot:Slot;busy:boolean;onActiveChange:(draft:Draft<FormDraftPayload<FormData>>|null)=>void;onSave:(type:SavedFormType,form:FormData,editor:FormEditorProps<FormData>)=>void}) {
  const validate=useCallback((value:unknown):value is FormData=>slot.type==='write-up'?isWriteUpDraft(value):isDigitalForm(value,slot.type),[slot.type])
  return <FormDraftWorkspace<FormData> formType={slot.type} title={slot.type==='write-up'?'formDrafts.writeUpTitle':`formDrafts.${slot.type}Title`} initialDraft={slot.initial} onActiveChange={onActiveChange} busy={busy} validateForm={validate} createForm={(date,context)=>slot.type==='write-up'?emptyWriteUp(date):{...emptyDigitalForm(slot.type,date),store:context.store,preparedBy:context.preparer}}>
    {editor=><Editor key={editor.draft.id} type={slot.type} editor={editor} busy={busy} onSave={form=>onSave(slot.type,form,editor)}/>}
  </FormDraftWorkspace>
}
function Editor({type,editor,busy,onSave}:{type:SavedFormType;editor:FormEditorProps<FormData>;busy:boolean;onSave:(form:FormData)=>void}) {
  const {t}=useInternalLanguage(), [form,setForm]=useState(editor.draft.payload.form), [review,setReview]=useState(false), [attempted,setAttempted]=useState(false), [acknowledged,setAcknowledged]=useState<string|null>(null)
  const issues=formIssues(asValue(type,form)), alreadySaved=!!editor.draft.payload.savedId&&editor.draft.payload.savedId!==acknowledged
  const title=useRef<HTMLHeadingElement>(null)
  const focus=()=>requestAnimationFrame(()=>title.current?.focus())
  const change=(next:FormValue)=>{setForm(next.form);editor.persist(next.form)}
  function submit(event:FormEvent) {
    event.preventDefault();if(busy||alreadySaved)return
    setAttempted(true)
    if(issues.length){requestAnimationFrame(()=>focusField(`form-field-${issues[0].field}`));return}
    if(review)onSave(form)
    else {setReview(true);focus()}
  }
  return <form onSubmit={submit} noValidate>
    <div className={styles.actions}><h3 ref={title} tabIndex={-1}>{t(review?'formsWorkspace.review':'formsWorkspace.edit')}</h3><Button data-forms-print-action onClick={()=>window.print()}>{t('common.print')}</Button></div>
    {alreadySaved&&<div role="alert" className={styles.notice}><p>{t('formsWorkspace.alreadySaved')}</p><Button onClick={()=>{setAcknowledged(editor.draft.payload.savedId);setReview(false);focus()}}>{t('formsWorkspace.editNew')}</Button></div>}
    {review&&<p className={styles.notice}>{t('formsWorkspace.immutable')}</p>}
    {!review&&<p className="my-3">{t('formsWorkspace.requiredHelp')}</p>}
    {attempted&&!review&&<ErrorSummary issues={issues.map(issue=>({fieldId:`form-field-${issue.field}`,message:issue.message}))}/>}
    <Paper emphasis="active"><fieldset disabled={busy||alreadySaved} className="min-w-0"><div data-form-review={review||undefined}><FormContent value={asValue(type,form)} showContext={false} onChange={!review&&!alreadySaved?change:undefined} issues={attempted?issues:[]} onEditSection={review?section=>{setReview(false);requestAnimationFrame(()=>document.getElementById(`form-section-${section}`)?.focus())}:undefined}/></div></fieldset></Paper>
    <div className={styles.actions}>{review&&<Button disabled={busy} onClick={()=>{setReview(false);focus()}}>{t('formsWorkspace.editAnswers')}</Button>}<Button type="submit" variant="primary" busy={busy} disabled={alreadySaved}>{t(review?'formsWorkspace.save':'formsWorkspace.reviewAction')}</Button></div>
  </form>
}
function LabelEditor({doc,busy,onSave}:{doc:Pick<WriteUpDoc,'label'|'createdAt'|'labelUpdatedAt'>;busy:boolean;onSave:(label:string)=>void}) {
  const {t}=useInternalLanguage(),[label,setLabel]=useState(doc.label)
  return <form onSubmit={event=>{event.preventDefault();if(!busy&&label.trim()!==doc.label)onSave(label.trim())}} className={styles.labelEditor}>
    <div><label htmlFor="forms-label">{t('formsWorkspace.label')}</label><p id="forms-label-help">{t('formsWorkspace.labelHelp')}</p><input id="forms-label" aria-describedby="forms-label-help" value={label} maxLength={120} onChange={event=>setLabel(event.target.value)}/></div><Button type="submit" disabled={busy||label.trim()===doc.label} variant="primary">{t('formsWorkspace.saveLabel')}</Button><p>{t('formsWorkspace.savedTime',{time:new Date(doc.createdAt).toLocaleString()})}{doc.labelUpdatedAt&&` · ${t('formsWorkspace.labelTime',{time:new Date(doc.labelUpdatedAt).toLocaleString()})}`}</p>
  </form>
}
function BlankForms() {
  const {t}=useInternalLanguage(),base=process.env.NEXT_PUBLIC_BASE_PATH??''
  return <><p className="mb-5">{t('formsWorkspace.blankHelp')}</p><ul className={styles.blanks}>{BLANK_FORMS.map((form,index)=><li key={form.file}><span>{t(`formsWorkspace.blank.${index}` as Parameters<typeof t>[0])}</span><a href={blankFormHref(base,form.file)} download={!form.file.endsWith('.pdf')||undefined} target={form.file.endsWith('.pdf')?'_blank':undefined} rel={form.file.endsWith('.pdf')?'noopener':undefined}>{form.file.split('.').pop()!.toUpperCase()}<span className="sr-only"> · {t(`formsWorkspace.blank.${index}` as Parameters<typeof t>[0])}</span></a></li>)}</ul></>
}
function Modal({title,children,onClose,footer=true}:{title:string;children:ReactNode;onClose:()=>void;footer?:boolean}) {
  const {t}=useInternalLanguage(), dialog=useRef<HTMLDialogElement>(null)
  useEffect(()=>{const trigger=document.activeElement as HTMLElement|null,element=dialog.current!;element.showModal();return()=>{element.close();if(trigger?.isConnected)trigger.focus()}},[])
  return <dialog ref={dialog} className={styles.modal} aria-label={title} onCancel={event=>{event.preventDefault();onClose()}}><h2>{title}</h2>{children}{footer&&<div className="mt-5"><Button onClick={onClose}>{t('feedback.cancel')}</Button></div>}</dialog>
}
function ResumeDialog({source,busy,onClose,onResume}:{source:ReadyFormDraftSource;busy:boolean;onClose:()=>void;onResume:(preparer:string)=>void}) {
  const {t}=useInternalLanguage(),[preparer,setPreparer]=useState(source.draft.preparer)
  return <Modal title={t('drafts.resumeCopy')} onClose={onClose}><form onSubmit={event=>{event.preventDefault();if(preparer.trim()&&!busy)onResume(preparer.trim())}}><p className="my-3">{t(`forms.type.${source.formType}`)} · {source.draft.context.storeId} · {source.draft.context.businessDate}</p><label htmlFor="forms-resume-preparer">{t('drafts.preparer')}</label><input id="forms-resume-preparer" value={preparer} maxLength={120} onChange={event=>setPreparer(event.target.value)}/><p className="my-3">{t('drafts.preparerHelp')}</p><Button type="submit" variant="primary" disabled={busy||!preparer.trim()}>{t('drafts.resumeCopy')}</Button></form></Modal>
}
/** Search/filter over the saved list; `list` null with `failed` means the last load did not arrive. */
function SavedFormsList({ list, failed, busy, onOpen, onRetry, onDelete, filter, setFilter }: { list: SavedFormRow[] | null; failed: boolean; busy: boolean; onOpen: (row: SavedFormRow) => void; onRetry: () => void; onDelete: (row: SavedFormRow) => void; filter: SavedFormFilter; setFilter: (update: (filter: SavedFormFilter) => SavedFormFilter) => void }) {
  const { t } = useInternalLanguage()
  const set = (patch: Partial<SavedFormFilter>) => setFilter(f => ({ ...f, ...patch }))
  const shown = list ? filterSavedForms(list, filter) : []
  return (
    <section aria-labelledby="saved-forms-title">
      <h2 id="saved-forms-title" className="sr-only">{t('forms.savedTitle')}</h2>
      <div className={styles.savedFilters}>
        <div>
          <label htmlFor="saved-forms-search" className="text-sm font-medium text-gray-700">{t('forms.search')}</label>
          <input id="saved-forms-search" type="search" value={filter.query} onChange={e => set({ query: e.target.value })} className={field} />
        </div>
        <div>
          <label htmlFor="saved-forms-type" className="text-sm font-medium text-gray-700">{t('forms.type')}</label>
          <select id="saved-forms-type" value={filter.type} onChange={e => set({ type: e.target.value as SavedFormFilter['type'] })} className={field}>
            <option value="">{t('forms.allTypes')}</option>
            {SAVED_FORM_TYPES.map(type => <option key={type} value={type}>{t(`forms.type.${type}`)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="saved-forms-from" className="text-sm font-medium text-gray-700">{t('forms.from')}</label>
          <input id="saved-forms-from" type="date" value={filter.from} max={filter.to || undefined} onChange={e => set({ from: e.target.value })} className={field} />
        </div>
        <div>
          <label htmlFor="saved-forms-to" className="text-sm font-medium text-gray-700">{t('forms.to')}</label>
          <input id="saved-forms-to" type="date" value={filter.to} min={filter.from || undefined} onChange={e => set({ to: e.target.value })} className={field} />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p role="status" aria-live="polite" className="text-sm text-gray-700">{list ? t('forms.count', { shown: shown.length, total: list.length }) : busy ? t('common.loading') : ''}</p>
        {isFiltered(filter) && <button type="button" onClick={() => { setFilter(() => NO_FILTER); focusField('saved-forms-search') }} className={secondary}>{t('forms.clearFilters')}</button>}
      </div>
      {failed && (
        <div role="alert" className="mb-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          <p>✕ {t('forms.loadFailed')}</p>
          <button type="button" disabled={busy} onClick={onRetry} className={`${secondary} mt-2`}>{t('forms.retry')}</button>
        </div>
      )}
      {list && list.length === 0 && <EmptyState message={{ key: 'forms.none' }} />}
      {list && list.length > 0 && shown.length === 0 && <EmptyState message={{ key: 'forms.noMatches' }} />}
      {shown.length > 0 && (
        <div className={styles.savedTable}><table className="w-full text-base border border-gray-200 rounded">
          <thead className="bg-gray-50 text-left text-sm text-gray-700">
            <tr>
              <th className="px-3 py-2 font-medium">{t('forms.colDate')}</th>
              <th className="px-3 py-2 font-medium hidden sm:table-cell">{t('forms.colType')}</th>
              <th className="px-3 py-2 font-medium">{t('forms.colEmployee')}</th>
              <th className="px-3 py-2 font-medium hidden sm:table-cell">{t('forms.colLabel')}</th>
              <th className="px-3 py-2"><span className="sr-only">{t('forms.open')} / {t('forms.delete')}</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {shown.map(row => (
              <tr key={`${row.type}:${row.id}`}>
                <td className="px-2 py-2 tabular-nums whitespace-nowrap text-sm sm:px-3">{row.date}<span className="block max-w-28 whitespace-normal text-sm text-gray-600 sm:hidden">{t(`forms.type.${row.type}`)}</span>{row.store && <span className="block text-sm text-gray-600">{row.store}</span>}</td>
                <td className="px-3 py-2 hidden sm:table-cell">{t(`forms.type.${row.type}`)}</td>
                <td className="px-2 py-2 [overflow-wrap:anywhere] sm:px-3">{row.employee}<span className="block text-sm text-gray-600 sm:hidden">{row.label}</span></td>
                <td className="px-3 py-2 text-gray-700 hidden sm:table-cell [overflow-wrap:anywhere]">{row.label}</td>
                <td className="px-2 py-2 text-right sm:px-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:justify-end">
                  <button type="button" disabled={busy} onClick={() => onOpen(row)}
                    aria-label={t('forms.openNamed', { type: t(`forms.type.${row.type}`), employee: row.employee, date: row.date })}
                    className={secondary}>{t('forms.open')}</button>
                  <button type="button" disabled={busy} onClick={() => onDelete(row)} aria-label={t('forms.deleteNamed', { type: t(`forms.type.${row.type}`), employee: row.employee, date: row.date })} className={`${button} text-red-700 hover:bg-red-50`}>{t('forms.delete')}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </section>
  )
}
