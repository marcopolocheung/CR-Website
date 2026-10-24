'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigationProtection } from './NavigationProtection'
import { useConfirmation } from './Feedback'
import { useInternalLanguage } from './InternalLanguage'
import { emptyDirectory, mapHours, uuid, type ImportDirectory } from '@/lib/converter/employee-mapping'
import { getDirectory, putDirectory, ImportApiError, type DirectoryRecord } from '@/lib/converter/import-api'
import type { StoreId } from '@/lib/internal-tools/contracts'
import type { HoursRow } from '@/lib/converter/validation'
import { sourceTime } from '@/lib/converter/business-date'
import { canonicalJson } from '@/lib/internal-tools/json'
export default function EmployeeMapping({store,rows,fingerprint,token,preparer,onRecord,onDirty}:{onDirty?:(dirty:boolean)=>void;store:StoreId;rows:HoursRow[];fingerprint:string;token:string;preparer:string;onRecord:(record:DirectoryRecord|null)=>void}){
 const {t}=useInternalLanguage(),[record,setRecord]=useState<DirectoryRecord|null>(null),[draft,setDraft]=useState<ImportDirectory>(emptyDirectory),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[name,setName]=useState(''),[sharedId,setSharedId]=useState('')
 const confirmation=useConfirmation()
 useNavigationProtection({dirty:loaded&&canonicalJson(draft)!==canonicalJson(record?.data??emptyDirectory()),deviceSaved:false})
 useEffect(()=>{onDirty?.(loaded&&canonicalJson(draft)!==canonicalJson(record?.data??emptyDirectory()))},[draft,record,loaded,onDirty])
 useEffect(()=>()=>onDirty?.(false),[onDirty])
 const generation=useRef(0),working=useRef(false),operation=useRef<{content:string;id:string}|null>(null)
 const mapped=useMemo(()=>mapHours(rows,draft,store,fingerprint),[rows,draft,store,fingerprint])
 const options=useMemo(()=>mapped.filter((row,i,list)=>row.key&&list.findIndex(r=>r.key===row.key)===i),[mapped])
 useEffect(()=>{generation.current++;setBusy(false);setLoaded(false);setRecord(null);setDraft(emptyDirectory());setStatus('');return()=>{generation.current++}},[store]) // Source-context changes reset the directory editor.
 useEffect(()=>{generation.current++;setBusy(false);return()=>{generation.current++}},[token]) // Locking hides working choices without discarding them.
 async function load(){
  if(working.current||!token)return
  if(loaded&&canonicalJson(draft)!==canonicalJson(record?.data??emptyDirectory())&&!await confirmation.ask({key:'mapping.replace'},true))return
  const version=generation.current;working.current=true;setBusy(true)
  try {const saved=await getDirectory(store,token);if(version!==generation.current)return;setRecord(saved);setDraft(saved?.data??emptyDirectory());setLoaded(true);onRecord(saved);setStatus('mapping.loaded')}
  catch(e){if(version===generation.current)setStatus(`importApi.${e instanceof ImportApiError?e.code:'unavailable'}`)}
  finally{working.current=false;if(version===generation.current)setBusy(false)}
 }
 async function save(){
  if(working.current||!loaded||!token||!preparer.trim())return
  const reviewed={...draft,mappings:draft.mappings.map(mapping=>{const old=record?.data.mappings.find(m=>m.id===mapping.id);return old&&canonicalJson(old)===canonicalJson(mapping)?mapping:{...mapping,reviewedBy:preparer.trim()}})}
  const version=generation.current,content=canonicalJson({data:reviewed,revision:record?.revision??0,preparer})
  if(operation.current?.content!==content)operation.current={content,id:crypto.randomUUID()}
  working.current=true;setBusy(true)
  try{const saved=await putDirectory(store,token,record,reviewed,preparer,operation.current.id);if(version!==generation.current)return;setRecord(saved);setDraft(saved.data);onRecord(saved);setStatus('mapping.saved');operation.current=null}
  catch(e){if(version===generation.current)setStatus(`importApi.${e instanceof ImportApiError?e.code:'unavailable'}`)}
  finally{working.current=false;if(version===generation.current)setBusy(false)}
 }
 function map(key:string,employeeId:string){
  const related=mapped.filter(row=>row.key===key),dates=related.map(r=>sourceTime(r.values['In Date']).date).filter(Boolean).sort()
  if(!dates.length||!preparer.trim()){setStatus('mapping.preparer');return}
  const existing=draft.mappings.find(m=>m.system==='toast'&&m.scope===store&&m.externalId===key&&m.from<=dates[0]&&(!m.until||m.until>=dates[dates.length-1]))
  const mappings=draft.mappings.filter(m=>m!==existing)
  if(employeeId)mappings.push({id:existing?.id??crypto.randomUUID(),system:'toast',scope:store,externalId:key,employeeId,from:dates[0],until:dates[dates.length-1],reviewedBy:preparer.trim()})
  setDraft({...draft,mappings});setStatus('mapping.unsaved')
 }
 function addEmployee(){
  if(!name.trim()||(sharedId&&!uuid(sharedId))||draft.employees.some(e=>e.id===sharedId)){setStatus('mapping.invalidEmployee');return}
  setDraft({...draft,employees:[...draft.employees,{id:sharedId||crypto.randomUUID(),name:name.trim(),active:true}]});setName('');setSharedId('');setStatus('mapping.unsaved')
 }
 return <section className="mt-5 rounded-lg border border-gray-300 p-3" aria-labelledby="mapping-title">
  {confirmation.dialog}
  <h3 id="mapping-title" className="font-semibold">{t('mapping.title')}</h3><p className="mt-2 text-sm">{t('mapping.scope')}</p>
  {!token&&<p className="mt-2 text-sm">{t('mapping.unlock')}</p>}
  <button id="mapping-load" type="button" disabled={!token||busy} onClick={()=>void load()} className="mt-3 min-h-11 rounded border px-3 py-2 text-sm disabled:opacity-50">{t('mapping.load')}</button>
  {loaded&&token&&<button id="mapping-copy" type="button" onClick={()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(draft,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`${store}-working-import-mappings.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}} className="ml-2 mt-3 min-h-11 rounded border px-3 py-2 text-sm">{t('mapping.copy')}</button>}
  {loaded&&<fieldset hidden={!token} disabled={busy} className="min-w-0 space-y-3 pt-3">
   <div><label htmlFor="mapping-new-name" className="block text-sm">{t('mapping.name')}</label><input id="mapping-new-name" value={name} maxLength={120} onChange={e=>setName(e.target.value)} className="w-full rounded border p-2"/></div>
   <div><label htmlFor="mapping-shared-id" className="block text-sm">{t('mapping.sharedId')}</label><input id="mapping-shared-id" value={sharedId} maxLength={36} onChange={e=>setSharedId(e.target.value)} className="w-full rounded border p-2"/></div>
   <button id="mapping-add" type="button" onClick={addEmployee} className="min-h-11 rounded border px-3 py-2 text-sm">{t('mapping.add')}</button>
   <ul className="space-y-4">{options.map(row=><li key={row.key} className="break-words text-sm"><label className="block" htmlFor={`mapping-row-${row.sourceRow}`}>{t('salesReview.row',{row:row.sourceRow})} · {row.values.Employee} · {row.values['Employee External Id']||t('mapping.noExternal')}</label><select id={`mapping-row-${row.sourceRow}`} value={row.mapping?.employeeId??''} onChange={e=>map(row.key!,e.target.value)} className="mt-1 min-h-11 w-full rounded border p-2"><option value="">{t('mapping.unmatched')}</option>{draft.employees.map(employee=><option key={employee.id} value={employee.id}>{employee.name} · {employee.id}{employee.active?'':` · ${t('mapping.inactive')}`}</option>)}</select></li>)}</ul>
   <button id="mapping-save" type="button" disabled={!preparer.trim()||busy} onClick={()=>void save()} className="min-h-11 rounded bg-red-700 px-3 py-2 text-sm text-white disabled:opacity-50">{t('mapping.save')}</button>
   <p className="text-sm">{t('mapping.revision',{revision:record?.revision??0})}</p>
  </fieldset>}
  <p role="status" className="mt-2 text-sm">{status?t(status as 'mapping.saved'):''}</p>
 </section>
}
