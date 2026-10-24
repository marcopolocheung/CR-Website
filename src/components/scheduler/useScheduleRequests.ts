'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchRequests, RequestApiError } from '@/lib/scheduler/request-store'
import type { RequestRecord } from '@/lib/scheduler/requests'
import type { StationId } from '@/lib/internal-tools/contracts'

export type RequestPhase = 'loading' | 'ready' | 'unconfigured' | 'failed' | 'uncertain'
export function useScheduleRequests(station: StationId, token: string) {
  const [record, setRecord] = useState<RequestRecord | null>(null)
  const [phase, setPhase] = useState<RequestPhase>('loading')
  const [checkedAt, setCheckedAt] = useState(0)
  const epoch = useRef(0)
  const reload = useCallback(async () => {
    const generation = ++epoch.current
    setPhase('loading')
    try {
      const next = await fetchRequests(station, token)
      if (generation !== epoch.current) return null
      setRecord(next); setPhase('ready'); setCheckedAt(Date.now())
      return { record: next }
    } catch (error) {
      if (generation === epoch.current) setPhase(error instanceof RequestApiError && error.code === 'unconfigured' ? 'unconfigured' : 'failed')
      return null
    }
  }, [station, token])
  useEffect(() => { setRecord(null); setCheckedAt(0); void reload(); return () => { epoch.current++ } }, [reload])
  const accept = useCallback((next: RequestRecord) => {
    epoch.current++
    setRecord(current => current && current.revision > next.revision ? current : next)
    setPhase('ready'); setCheckedAt(Date.now())
  }, [])
  const invalidate = useCallback(() => { epoch.current++; setPhase('uncertain') }, [])
  return { station, record, phase, checkedAt, reload, accept, invalidate }
}
export type ScheduleRequestsSource = ReturnType<typeof useScheduleRequests>
