'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useInternalLanguage } from './InternalLanguage'
import { useNavigationProtection } from './NavigationProtection'
import { canonicalJson } from '@/lib/internal-tools/json'
import { putDirectory, ImportApiError, type DirectoryRecord } from '@/lib/converter/import-api'
import { emptyDirectory } from '@/lib/converter/employee-mapping'
import type { ComparisonInput } from '@/lib/converter/scheduled-actual'
export default function ScheduleIdentityMapping({input,token,preparer,onSaved}:{input:ComparisonInput;token:string;preparer:string;onSaved:(record:DirectoryRecord)=>void}){
 const {t}=useInternalLanguage(),[draft,setDraft]=useState(input.directory?.data??emptyDirectory()),[busy,setBusy]=useState(false),[status,setStatus]=useState('')
 const credential=useRef(token);credential.current=token
 const running=useRef(false),alive=useRef(true),operation=useRef<{content:string;id:string}|null>(null)
 useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[])
 const choices=useMemo(()=>input.page.publications.filter(pub=>pub.status==='published').flatMap(pub=>pub.people.map(person=>({pub,person}))),[input.page])
 const dirty=canonicalJson(draft)!==canonicalJson(input.directory?.data??emptyDirectory())
 useNavigationProtection({dirty,deviceSaved:false})
 async function save(){
  if(running.current||!token||!preparer.trim())return
  const reviewed={...draft,mappings:draft.mappings.map(mapping=>{const old=input.directory?.data.mappings.find(m=>m.id===mapping.id);return old&&canonicalJson(old)===canonicalJson(mapping)?mapping:{...mapping,reviewedBy:preparer.trim()}})}
  const content=canonicalJson({draft:reviewed,revision:input.directory?.revision??0,preparer})
  if(operation.current?.content!==content)operation.current={content,id:crypto.randomUUID()}
  const capturedToken=token
  running.current=true;setBusy(true)
  try{const record=await putDirectory(input.storeId,token,input.directory,reviewed,preparer,operation.current.id);if(!alive.current||capturedToken!==credential.current)return;setStatus('mapping.saved');setDraft(record.data);onSaved(record);operation.current=null}
  catch(e){if(alive.current)setStatus(`importApi.${e instanceof ImportApiError?e.code:'unavailable'}`)}
  finally{running.current=false;if(alive.current)setBusy(false)}
 }
 return <section className="mt-4 rounded border p-3" aria-label={`${t('comparison.mapping')} ${input.storeId}`}><h3 className="font-semibold">{t('comparison.mapping')} · {input.storeId}</h3><p className="mt-2 text-sm">{t('comparison.mappingNote')}</p>
  <fieldset disabled={busy} className="min-w-0"><ul className="mt-3 space-y-3">{choices.map(({pub,person},index)=>{
   const existing=draft.mappings.find(m=>m.system==='scheduler'&&m.scope===pub.stationId&&m.externalId===person.key&&m.from<=pub.weekStart&&(!m.until||m.until>=pub.weekStart))
   return <li key={`${pub.stationId}:${person.key}`} className="break-words text-sm"><label htmlFor={`schedule-map-${input.storeId}-${index}`} className="block">{pub.stationId} · {pub.weekStart} · {person.label} · #{person.index+1}</label><select id={`schedule-map-${input.storeId}-${index}`} value={existing?.employeeId??''} onChange={e=>{
    if(!preparer.trim()){setStatus('mapping.preparer');return}
    const mappings=draft.mappings.filter(m=>m!==existing)
    if(e.target.value)mappings.push({id:existing?.id??crypto.randomUUID(),system:'scheduler',scope:pub.stationId,externalId:person.key,employeeId:e.target.value,from:pub.weekStart,until:null,reviewedBy:preparer.trim()})
    setDraft({...draft,mappings});setStatus('mapping.unsaved')
   }} className="mt-1 min-h-11 w-full rounded border p-2"><option value="">{t('mapping.unmatched')}</option>{draft.employees.map(employee=><option key={employee.id} value={employee.id}>{employee.name} · {employee.id}</option>)}</select></li>
  })}</ul>
  <div className="mt-3 flex flex-wrap gap-2"><button data-schedule-mapping="save" type="button" disabled={!dirty||!preparer.trim()||!token||busy} onClick={()=>void save()} className="min-h-11 rounded border px-3 py-2 text-sm disabled:opacity-50">{t('mapping.save')}</button><button type="button" onClick={()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(draft,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`${input.storeId}-working-schedule-mappings.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}} className="min-h-11 rounded border px-3 py-2 text-sm">{t('mapping.copy')}</button></div>
  </fieldset><p role="status" className="mt-2 text-sm">{status?t(status as 'mapping.saved'):''}</p>
 </section>
}
