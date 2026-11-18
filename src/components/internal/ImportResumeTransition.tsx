'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { isImportSnapshot, type ImportSnapshot } from '@/lib/converter/import-snapshot'
import type { ImportHistoryRecord } from '@/lib/converter/import-api'
import { useManagerSession } from './ManagerSession'
import { useWorkTransitions } from './NavigationProtection'

type Handoff = { nonce: string; generation: number; sourceId: string; snapshot: ImportSnapshot }
const Context = createContext({ pending: null as Handoff | null, consume: (_nonce: string) => {}, resume: async (_record: ImportHistoryRecord) => false })
export const useImportResumeTransition = () => useContext(Context)
export function useImportResume(kind: ImportSnapshot['kind'], restore: (snapshot: ImportSnapshot) => void) {
  const { pending, consume } = useImportResumeTransition(), session = useManagerSession()
  const current = useRef(restore); current.current = restore
  const consumed = useRef('')
  useEffect(() => {
    if (!pending || pending.snapshot.kind !== kind || !session.token || pending.generation !== session.generation || consumed.current === pending.nonce) return
    consumed.current = pending.nonce
    current.current(structuredClone(pending.snapshot)); consume(pending.nonce)
  }, [pending, consume, kind, session.token, session.generation])
}
/** Only reviewed values travel between retained workspaces; credentials stay in the session. */
export default function ImportResumeTransition({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Handoff | null>(null)
  const session = useManagerSession(), transitions = useWorkTransitions(), router = useRouter()
  const live = useRef(session); live.current = session
  useEffect(() => { setPending(null) }, [session.generation])
  const consume = useCallback((nonce: string) => setPending(current => current?.nonce === nonce ? null : current), [])
  const resume = useCallback(async (record: ImportHistoryRecord) => {
    const generation = live.current.generation
    if (!live.current.token || !isImportSnapshot(record.data.snapshot)) return false
    const snapshot = structuredClone(record.data.snapshot)
    return transitions.changeScoped(`${snapshot.kind}-import`, () => {
      if (!live.current.token || live.current.generation !== generation) return false
      setPending({ nonce: crypto.randomUUID(), generation, sourceId: record.id, snapshot })
      router.push(`/internal/bookkeeping#${snapshot.kind}`)
      return true
    }, { key: 'historyHub.resumeConfirm' })
  }, [router, transitions])
  const value = useMemo(() => ({ pending, consume, resume }), [pending, consume, resume])
  return <Context.Provider value={value}>{children}</Context.Provider>
}
