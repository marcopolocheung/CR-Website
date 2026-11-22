'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { STATION_STORES, type StationId } from '@/lib/internal-tools/contracts'
import { dateForDay } from '@/lib/scheduler/week'
import { fetchSpecialHours, SpecialHoursError } from '@/lib/scheduler/special-hours-store'
import type { HoursReviewRecord, SpecialHoursPage, SpecialHoursRecord } from '@/lib/scheduler/special-hours'
import type { HoursResult } from '@/lib/scheduler/hours-batch'

export function useSpecialHours(station: StationId,week: string,token: string) {
  const store=STATION_STORES[station],end=week?dateForDay(week,'Saturday'):''
  const [state,setState]=useState<{key:string;phase:'loading'|'ready'|'unconfigured'|'failed'|'uncertain';page:SpecialHoursPage|null}>({key:'',phase:'loading',page:null})
  const key=`${store}:${week}`,epoch=useRef(0),current=useRef(key)
  current.current=key
  const reload=useCallback(async()=>{
    if(!week)return null
    const generation=++epoch.current
    setState(old=>({key,phase:'loading',page:old.key===key?old.page:null}))
    try {
      const page=await fetchSpecialHours(store,week,end,token)
      if(generation!==epoch.current||current.current!==key)return null
      setState({key,phase:'ready',page});return page
    }catch(error){
      if(generation===epoch.current&&current.current===key)setState(old=>({key,phase:error instanceof SpecialHoursError&&error.code==='unconfigured'?'unconfigured':'failed',page:old.key===key?old.page:null}))
      return null
    }
  },[store,week,end,token,key])
  useEffect(()=>{
    void reload()
    const focus=()=>{if(document.visibilityState==='visible')void reload()}
    window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus)
    let channel:BroadcastChannel|null=null
    try{channel=new BroadcastChannel('cr-special-hours');channel.onmessage=()=>void reload()}catch{/* Optional refresh signal. */}
    return()=>{epoch.current++;window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus);channel?.close()}
  },[reload])
  function acceptMany(results:readonly HoursResult[]) {
    epoch.current++
    setState(old=>old.key!==key?old:{...old,phase:'ready',page:old.page?{...old.page,
      events:[...old.page.events.filter(e=>!results.some(r=>r.event.id===e.id)),...results.map(r=>r.event)].sort((a,b)=>a.data.date.localeCompare(b.data.date)),
      reviews:[...old.page.reviews.filter(review=>!results.some(r=>r.review.id===review.id)),...results.map(r=>r.review)]}:null})
    try{const channel=new BroadcastChannel('cr-special-hours');channel.postMessage({store,week});channel.close()}catch{/* Reload remains available. */}
  }
  function accept(event:SpecialHoursRecord,review:HoursReviewRecord) { acceptMany([{event,review}]) }
  function uncertain(){epoch.current++;setState(old=>({...old,phase:'uncertain'}))}
  return {store,key,page:state.key===key?state.page:null,phase:state.key===key?state.phase:'loading' as const,reload,accept,acceptMany,uncertain}
}
export type SpecialHoursSource=ReturnType<typeof useSpecialHours>
