'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { managerSession } from '@/lib/internal-tools/manager-session'
import { useWorkTransitions } from './NavigationProtection'
const server = { token: '', generation: 0 }
const Context = createContext({ token: '', generation: 0, unlock: (_token: string) => {}, expire: () => {}, lock: () => {} })
export function useManagerSession() { return useContext(Context) }
export default function ManagerSession({ children }: { children: ReactNode }) {
  const session = useSyncExternalStore(managerSession.subscribe, managerSession.getSnapshot, () => server)
  const transitions = useWorkTransitions()
  useEffect(() => {
    managerSession.active = true
    // Arriving from the /staff entry page: unlock with the code it already checked.
    const handed = managerSession.takeHandoff()
    if (handed) managerSession.unlock(handed)
    return () => { managerSession.active = false; managerSession.expire() }
  }, [])
  const unlock = useCallback((token: string) => { managerSession.unlock(token) }, [])
  const expire = useCallback(() => managerSession.expire(session.generation), [session.generation])
  const lock = useCallback(() => { void transitions.handoff(() => managerSession.expire(session.generation)) }, [transitions, session.generation])
  const value = useMemo(() => ({ ...session, unlock, expire, lock }), [session, unlock, expire, lock])
  return <Context.Provider value={value}>{children}</Context.Provider>
}
