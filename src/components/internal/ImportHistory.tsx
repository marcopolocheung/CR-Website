'use client'
import { useWorkTransitions } from './NavigationProtection'
import { useManagerSession } from './ManagerSession'
import { useImportAccess } from './useImportAccess'
import { useEffect, useRef, useState } from 'react'
import { useInternalLanguage } from './InternalLanguage'
import { useConfirmation } from './Feedback'
import { canonicalJson } from '@/lib/internal-tools/json'
import { historyData, historySources } from '@/lib/converter/import-history'
import { getHistory, putHistory, ImportApiError, type ImportHistoryRecord } from '@/lib/converter/import-api'
import type { DraftContext } from '@/lib/internal-tools/drafts'
import { InternalTheme } from './ui/Theme'
import { Paper } from './ui/controls'
import ImportHistoryRecordCard from './ImportHistoryRecordCard'
import type { ImportSnapshot } from '@/lib/converter/import-snapshot'
export default function ImportHistory({context,snapshot,preparer,token,accepted,busy,hasWork,onRestore}:{context:DraftContext|null;snapshot:ImportSnapshot|null;preparer:string;token:string;accepted:boolean;busy:boolean;hasWork:boolean;onRestore:(snapshot:ImportSnapshot)=>void}){
 const failureKey = useImportAccess(), transitions = useWorkTransitions(), session = useManagerSession()
 const {t}=useInternalLanguage(),confirmation=useConfirmation(),[records,setRecords]=useState<ImportHistoryRecord[]>([]),[next,setNext]=useState<string|null>(null),[pending,setPending]=useState(false),[status,setStatus]=useState(''),[duplicate,setDuplicate]=useState<string|null>(null)
 const version=useRef(0),running=useRef(false),retry=useRef<{content:string;id:string;operationId:string}|null>(null)
 const liveSession=useRef(session);liveSession.current=session
 const key=canonicalJson({context,tokenPresent:!!token,generation:session.generation}),current=useRef(snapshot);current.current=snapshot
 useEffect(()=>{version.current++;running.current=false;setPending(false);setRecords([]);setNext(null);setStatus('');setDuplicate(null);retry.current=null;return()=>{version.current++}},[key,token])
 const period=context?.period??(context?.businessDate?{start:context.businessDate,end:context.businessDate}:null)
 const kind=context?.task==='sales-import'?'sales':'hours'
 const ready=!!(context&&snapshot?.output&&accepted&&preparer.trim()&&token&&historySources(snapshot).every(source=>/^sha256:[a-f0-9]{64}$/.test(source.fingerprint)))
 async function load(cursor=''){
  if(!context||!period||!token||running.current)return
  const at=version.current;running.current=true;setPending(true)
  try{const page=await getHistory(context.storeId,kind,period.start,period.end,token,cursor);if(at!==version.current)return;setRecords(old=>cursor?[...old,...page.records.filter(record=>!old.some(r=>r.id===record.id))]:page.records);setNext(page.nextCursor);setStatus(page.records.length?'importHistory.loaded':'importHistory.empty')}
  catch(e){if(at===version.current)setStatus(failureKey(e))}
  finally{if(at===version.current){running.current=false;setPending(false)}}
 }
 async function save(reprocess=false){
  if(!ready||!context||!snapshot||running.current)return
  const at=version.current,source=snapshot,generation=session.generation
  if(reprocess&&!await confirmation.ask({key:'importHistory.reprocessWarning'},false))return
  if(at!==version.current||generation!==liveSession.current.generation||!liveSession.current.token||current.current!==source)return
  running.current=true;setPending(true)
  try{
   const data=await historyData(source,preparer.trim(),reprocess?duplicate:null),content=canonicalJson(data)
   if(at!==version.current||generation!==liveSession.current.generation||!liveSession.current.token||current.current!==source)return
   if(retry.current?.content!==content)retry.current={content,id:reprocess?crypto.randomUUID():`imp_${data.identity}`,operationId:crypto.randomUUID()}
   const saved=await putHistory(context.storeId,token,retry.current.id,data,retry.current.operationId)
   if(at!==version.current||current.current!==source)return
   setRecords(old=>[saved,...old.filter(r=>r.id!==saved.id)]);setDuplicate(saved.id);setStatus('importHistory.saved');retry.current=null
  }catch(e){
   if(at===version.current&&current.current===source){if(e instanceof ImportApiError&&e.code==='conflict'){setDuplicate(retry.current?.id??null);setStatus('importHistory.duplicate')}else setStatus(failureKey(e))}
  }finally{if(at===version.current){running.current=false;setPending(false)}}
 }
 async function restore(record:ImportHistoryRecord){
  const at=version.current,source=current.current
  if(busy||running.current)return
  await transitions.changeScoped(`${kind}-import`,()=>{
   if(at!==version.current||source!==current.current)return false
   onRestore(structuredClone(record.data.snapshot));setStatus('importHistory.resumed');return true
  },{key:'historyHub.resumeConfirm'})
 }
 return <InternalTheme><Paper className="mt-5" aria-label={t('importHistory.title')}>
  {confirmation.dialog}<h3 className="font-semibold">{t('importHistory.title')}</h3><p className="mt-2 text-sm">{t('importHistory.policy')}</p>
  <a className="mt-2 inline-block min-h-11 py-2 underline" href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/internal/import-history${context && period ? '?' + new URLSearchParams({store:context.storeId,kind,start:period.start,end:period.end}) : ''}`}>{t('historyHub.open')}</a>
  {!token&&<p className="mt-2 text-sm">{t('mapping.unlock')}</p>}
  <div className="mt-3 flex flex-wrap gap-2"><button data-history="load" type="button" disabled={!token||!context||pending||busy} onClick={()=>void load()} className="min-h-11 rounded border px-3 py-2 text-sm disabled:opacity-50">{t('importHistory.load')}</button>
   <button data-history="save" type="button" disabled={!ready||pending||busy} onClick={()=>void save()} className="min-h-11 rounded bg-red-700 px-3 py-2 text-sm text-white disabled:opacity-50">{t('importHistory.save')}</button>
   {duplicate&&<button data-history="reprocess" type="button" disabled={!ready||pending||busy} onClick={()=>void save(true)} className="min-h-11 rounded border px-3 py-2 text-sm disabled:opacity-50">{t('importHistory.reprocess')}</button>}
  </div><p role="status" className="mt-2 text-sm">{status?t(status as 'importHistory.saved'):''}</p>
  <ul hidden={!token} className="mt-3 space-y-3">{records.map(record=><ImportHistoryRecordCard key={record.id} record={record} busy={pending||busy} onResume={()=>void restore(record)}/>)}</ul>
  {next&&<button type="button" disabled={pending||busy} onClick={()=>void load(next)} className="mt-3 min-h-11 rounded border px-3 py-2 text-sm">{t('importHistory.more')}</button>}
 </Paper></InternalTheme>
}
