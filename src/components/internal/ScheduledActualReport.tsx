'use client'
import { useRef, useState } from 'react'
import { useInternalLanguage } from './InternalLanguage'
import { useConfirmation } from './Feedback'
import ScheduleIdentityMapping from './ScheduleIdentityMapping'
import { getDirectory, getHistory, getPublishedHours, ImportApiError } from '@/lib/converter/import-api'
import { weeksInPeriod } from '@/lib/converter/published-hours'
import { compareScheduledActual, defaultImportSelection, type ComparisonInput } from '@/lib/converter/scheduled-actual'
import type { StoreId } from '@/lib/internal-tools/contracts'
export default function ScheduledActualReport({token}:{token:string}){
 const {t}=useInternalLanguage(),confirmation=useConfirmation(),[start,setStart]=useState(''),[end,setEnd]=useState(''),[store,setStore]=useState('both'),[preparer,setPreparer]=useState(''),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[inputs,setInputs]=useState<ComparisonInput[]|null>(null),[scope,setScope]=useState({start:'',end:'',store:''}),[selected,setSelected]=useState<Set<string>>(new Set()),[report,setReport]=useState<ReturnType<typeof compareScheduledActual>|null>(null),[loadVersion,setLoadVersion]=useState(0)
 const running=useRef(false),request=useRef(0),credential=useRef(token);credential.current=token
 const matches=scope.start===start&&scope.end===end&&scope.store===store
 const number=(value:number|null)=>value===null?t('salesReview.missingValue'):String(Math.round(value*1000000)/1000000)
 async function load(){
  if(running.current||!token)return
  try{weeksInPeriod(start,end)}catch{setStatus('comparison.period');return}
  if(inputs&&!await confirmation.ask({key:'comparison.reload'},true))return
  const at=++request.current,capturedToken=token;running.current=true;setBusy(true);setStatus('comparison.loading')
  try{
   const stores:StoreId[]=store==='both'?['CR2','CR3']:[store as StoreId]
   const next=await Promise.all(stores.map(async storeId=>{
    const [directory,page,history]=await Promise.all([getDirectory(storeId,token),getPublishedHours(storeId,start,end,token),getHistory(storeId,'hours',start,end,token)])
    return {storeId,directory,page,imports:history.records,hasMore:!!history.nextCursor,nextCursor:history.nextCursor}
   }))
   if(at!==request.current||capturedToken!==credential.current)return
   setInputs(next);setScope({start,end,store});setSelected(defaultImportSelection(next));setReport(null);setLoadVersion(v=>v+1);setStatus('comparison.loaded')
  }catch(e){if(at===request.current&&capturedToken===credential.current)setStatus(`importApi.${e instanceof ImportApiError?e.code:'unavailable'}`)}
  finally{running.current=false;if(at===request.current)setBusy(false)}
 }
 async function loadMore(input:ComparisonInput){
  if(running.current||!token||!input.nextCursor)return
  const at=request.current,capturedToken=token;running.current=true;setBusy(true)
  try{const page=await getHistory(input.storeId,'hours',input.page.start,input.page.end,token,input.nextCursor);if(at!==request.current||capturedToken!==credential.current)return;setInputs(old=>old?.map(item=>item.storeId===input.storeId?{...item,imports:[...item.imports,...page.records.filter(record=>!item.imports.some(r=>r.id===record.id))],hasMore:!!page.nextCursor,nextCursor:page.nextCursor}:item)??null);setReport(null)}catch(e){setStatus(`importApi.${e instanceof ImportApiError?e.code:'unavailable'}`)}finally{running.current=false;setBusy(false)}
 }
 function compare(){if(inputs&&matches)setReport(compareScheduledActual(inputs,start,end,selected))}
 return <div className="comparison-print max-w-5xl rounded-xl border bg-white p-5">
  {confirmation.dialog}<h2 className="text-xl font-semibold">{t('comparison.title')}</h2><p className="mt-2 text-sm">{t('comparison.scope')}</p>
  <div className="print:hidden">
  {!token&&<p className="mt-2 text-sm">{t('mapping.unlock')}</p>}
  <fieldset disabled={busy} className="mt-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
   <div><label htmlFor="comparison-start" className="block text-sm">{t('imports.startDate')}</label><input id="comparison-start" type="date" value={start} onChange={e=>setStart(e.target.value)} className="w-full rounded border p-2"/></div>
   <div><label htmlFor="comparison-end" className="block text-sm">{t('imports.endDate')}</label><input id="comparison-end" type="date" value={end} onChange={e=>setEnd(e.target.value)} className="w-full rounded border p-2"/></div>
   <div><label htmlFor="comparison-store" className="block text-sm">{t('common.store')}</label><select id="comparison-store" value={store} onChange={e=>setStore(e.target.value)} className="min-h-11 w-full rounded border p-2"><option value="both">{t('comparison.both')}</option><option value="CR2">CR2</option><option value="CR3">CR3</option></select></div>
   <div><label htmlFor="comparison-preparer" className="block text-sm">{t('importRetention.preparer')}</label><input id="comparison-preparer" value={preparer} maxLength={120} onChange={e=>setPreparer(e.target.value)} className="w-full rounded border p-2"/></div>
  </fieldset>
  <button id="comparison-load" type="button" disabled={!token||busy} onClick={()=>void load()} className="mt-3 min-h-11 rounded border px-3 py-2 text-sm disabled:opacity-50">{t('comparison.load')}</button><p role="status" className="mt-2 text-sm">{status?t(status as 'comparison.loaded'):''}</p>
  {inputs&&<div hidden={!token} className="mt-4"><p className="text-sm">{t('comparison.loadedScope',{start:scope.start,end:scope.end,store:scope.store==='both'?t('comparison.both'):scope.store})}</p>{!matches&&<p role="alert" className="mt-2 text-sm text-amber-900">{t('comparison.stale')}</p>}
   {inputs.map(input=><div key={`${input.storeId}:${loadVersion}`}>
    <h3 className="mt-4 font-semibold">{t('comparison.imports')} · {input.storeId}</h3>
    {!input.imports.length&&<p className="mt-2 text-sm">{t('comparison.missing_history')}</p>}
    <ul className="mt-2 space-y-2">{input.imports.map(record=><li key={record.id} className="break-words text-sm"><label className="flex min-h-11 items-start gap-2"><input type="checkbox" data-comparison-import={record.id} checked={selected.has(`${input.storeId}:${record.id}`)} onChange={e=>{setSelected(old=>{const next=new Set(old);if(e.target.checked)next.add(`${input.storeId}:${record.id}`);else next.delete(`${input.storeId}:${record.id}`);return next});setReport(null)}} className="mt-1 size-5 shrink-0"/><span>{record.data.sources.map(s=>s.filename).join(' · ')} · {record.createdAt}<span className="block break-all">{record.id}{record.data.supersedesId?` ← ${record.data.supersedesId}`:''}</span></span></label></li>)}</ul>
    {input.hasMore&&<div><p role="alert" className="mt-2 text-sm">{t('comparison.more_history')}</p><button type="button" disabled={busy||!token} onClick={()=>void loadMore(input)} className="mt-2 min-h-11 rounded border px-3 py-2 text-sm">{t('importHistory.more')}</button></div>}
    <ScheduleIdentityMapping input={input} token={token} preparer={preparer} onSaved={record=>{setInputs(old=>old?.map(item=>item.storeId===input.storeId?{...item,directory:record}:item)??null);setReport(null)}}/>
   </div>)}
   <button id="comparison-run" type="button" disabled={!matches||busy} onClick={compare} className="mt-4 min-h-11 rounded bg-red-700 px-4 py-2 text-sm text-white disabled:opacity-50">{t('comparison.run')}</button>
  </div>}
  </div>
  {report&&<section hidden={!token} className="mt-6 border-t pt-4" aria-labelledby="comparison-result-title">
   <h3 id="comparison-result-title" className="text-lg font-semibold">{t('comparison.result')}</h3><p className="mt-2 text-sm">{report.start} – {report.end} · {report.generatedAt}</p><p className="mt-2 text-sm">{t('comparison.estimate')}</p><p className="mt-2 break-all text-xs">{t('comparison.evidence')}: {report.sources.map(source=>`${source.storeId} ${source.id} rev ${source.revision} / mapping ${source.mappingRevision}`).join(' · ')}</p>
   <ul className="mt-3 space-y-1 text-sm text-amber-950" aria-label={t('comparison.limitations')}>{report.limitations.map((limitation,index)=><li key={index}>{t(`comparison.${limitation.code}`)} {limitation.storeId} {limitation.stationId} {limitation.weekStart} {limitation.count??''}</li>)}</ul>
   <div className="mt-3 max-w-full overflow-auto" tabIndex={0} role="region" aria-label={t('comparison.perStore')}><table className="min-w-[42rem] text-left text-sm"><thead><tr>{['comparison.store','comparison.actual','comparison.regular','comparison.overtime','comparison.scheduled','comparison.unmatched'].map(key=><th className="border-b p-2" key={key}>{t(key as 'comparison.store')}</th>)}</tr></thead><tbody>{report.storeTotals.map(total=><tr key={total.storeId} data-comparison-store={total.storeId}><th scope="row" className="border-b p-2">{total.storeId}</th><td className="border-b p-2">{total.selectedImports?number(total.includedHours):t('salesReview.missingValue')}</td><td className="border-b p-2">{total.selectedImports?number(total.regularHours):t('salesReview.missingValue')}</td><td className="border-b p-2">{total.selectedImports?number(total.overtimeHours):t('salesReview.missingValue')}</td><td className="border-b p-2">{number(total.scheduledMinutes===null?null:total.scheduledMinutes/60)}</td><td className="border-b p-2">{number(total.unmatchedActualHours)}</td></tr>)}</tbody></table></div>
   <p className="mt-3 text-sm" data-comparison="combined">{t('comparison.combined',{actual:number(report.combinedTotals.includedHours),scheduled:number(report.combinedTotals.scheduledMinutes===null?null:report.combinedTotals.scheduledMinutes/60),people:report.combinedTotals.uniqueMappedEmployees})}</p>
   <div className="mt-3 max-w-full overflow-auto" tabIndex={0} role="region" aria-label={t('comparison.employees')}><table className="min-w-[55rem] text-left text-sm"><thead><tr>{['comparison.employee','comparison.store','comparison.actual','comparison.regular','comparison.overtime','comparison.scheduled','comparison.variance'].map(key=><th className="border-b p-2" key={key}>{t(key as 'comparison.store')}</th>)}</tr></thead><tbody>{report.employees.map(row=><tr key={`${row.storeId}:${row.employeeId}`}><th scope="row" className="border-b p-2 font-medium">{row.name}<span className="block text-xs">{row.employeeId}</span><details><summary className="min-h-11 cursor-pointer py-2">{t('comparison.sourceAssignments')}</summary><ul>{row.sourceRefs.map((ref,index)=><li key={index} className="break-all text-xs">{ref}</li>)}</ul></details></th><td className="border-b p-2">{row.storeId}</td><td className="border-b p-2">{number(row.actualHours)}</td><td className="border-b p-2">{number(row.regularHours)}</td><td className="border-b p-2">{number(row.overtimeHours)}</td><td className="border-b p-2">{number(row.scheduledMinutes===null?null:row.scheduledMinutes/60)}</td><td className="border-b p-2">{number(row.actualHours===null||row.scheduledMinutes===null?null:row.actualHours-row.scheduledMinutes/60)}</td></tr>)}</tbody></table></div>
   <h4 className="mt-4 font-semibold">{t('comparison.combinedEmployees')}</h4><ul className="mt-2 grid gap-3 sm:grid-cols-2">{report.combinedEmployees.map(row=><li key={row.employeeId} className="break-words rounded border p-3 text-sm"><p className="font-semibold">{row.name} · {row.stores.join(' + ')}</p><p className="break-all text-xs">{row.employeeId}</p><dl>{([['comparison.actual',row.actualHours],['comparison.regular',row.regularHours],['comparison.overtime',row.overtimeHours],['comparison.scheduled',row.scheduledMinutes===null?null:row.scheduledMinutes/60]] as const).map(([key,value])=><div key={key}><dt className="inline">{t(key)}: </dt><dd className="inline">{number(value)}</dd></div>)}</dl></li>)}</ul>
   <details className="mt-4 text-sm"><summary className="min-h-11 cursor-pointer py-2">{t('comparison.evidence')}</summary><ul>{report.sourceExceptions.map(row=><li key={`${row.storeId}:${row.jobId}:${row.sourceRow}`} className="break-words">{row.storeId} · {t('salesReview.row',{row:row.sourceRow})} · {row.values.Employee} · {row.issues.map(issue=>t(`hoursReview.${issue}` as 'hoursReview.open')).join(' · ')}</li>)}{report.unmatchedActual.map(row=><li key={`${row.storeId}:${row.jobId}:${row.sourceRow}`} className="break-words">{row.storeId} · {row.name} · {row.externalId} · {t('salesReview.row',{row:row.sourceRow})} · {row.hours}</li>)}{report.publications.map(pub=><li key={`${pub.stationId}:${pub.weekStart}`} className="mt-2 break-all">{pub.stationId} · {pub.weekStart} · {pub.status} · rev {pub.revision??'—'} · {pub.fingerprint??'—'}</li>)}</ul></details>
   <div className="mt-4 flex flex-wrap gap-2 print:hidden"><button id="comparison-download" type="button" onClick={()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`scheduled-actual-${report.start}-${report.end}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}} className="min-h-11 rounded border px-3 py-2 text-sm">{t('comparison.download')}</button><button type="button" onClick={()=>window.print()} className="min-h-11 rounded border px-3 py-2 text-sm">{t('common.print')}</button></div>
  </section>}
  <style>{`@media print {
    .comparison-print { padding: 0; border: 0; max-width: none; }
    .comparison-print [role="region"] { overflow: visible; }
    .comparison-print table { min-width: 0 !important; width: 100%; table-layout: fixed; }
    .comparison-print th, .comparison-print td { padding: 3px; font-size: 8.5pt; overflow-wrap: anywhere; vertical-align: top; }
    .comparison-print tr { break-inside: avoid; }
    .comparison-print thead { display: table-header-group; }
    .comparison-print details { display: none; }
  }`}</style>
 </div>
}
