'use client'

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, useMemo } from 'react'
import { managerSession } from '@/lib/internal-tools/manager-session'
import { useRouter } from 'next/navigation'
import { useWorkspaceVisible } from './WorkspaceVisibility'
import { Icon } from './ui/Icon'
import { Button } from './ui/controls'
import { useConfirmation } from './Feedback'
import { useInternalLanguage } from './InternalLanguage'
import type { Message } from '@/lib/internal-tools/i18n'

import { checkpointWork, type Work } from '@/lib/internal-tools/work-transitions'
const Transitions = createContext({ handoff: async (_done: () => void) => {}, change: async (_done: () => void) => {}, changeScoped: async (_scope: string, _done: () => boolean, _message: Message): Promise<boolean> => false })
export function useWorkTransitions() { return useContext(Transitions) }
const Context = createContext<(id: string, read: () => Work) => () => void>(() => () => {})
export function useNavigationProtection(work: Work) {
  const id = useId()
  const visible = useWorkspaceVisible()
  const current = useRef(work); current.current = { ...work, active: visible }
  const register = useContext(Context)
  useEffect(() => register(id, () => current.current), [id,register,work.dirty,work.deviceSaved])
}
export default function NavigationProtection({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const work = useRef(new Map<string, () => Work>())
  const [hasDirty,setHasDirty] = useState(false)
  const register = useCallback((id: string, read: () => Work) => {
    const refresh = () => setHasDirty([...work.current.values()].some(read => read().dirty))
    work.current.set(id,read); refresh()
    return () => { work.current.delete(id); refresh() }
  }, [])
  const confirmation = useConfirmation()
  const [blocked, setBlocked] = useState(false)
  const running = useRef(false)
  const handoff = useCallback(async (done: () => void) => {
    if (running.current) return
    running.current = true
    try {
      const entries = [...work.current.values()].map(read => read())
      if (!checkpointWork(entries)) { setBlocked(true); return }
      entries.forEach(entry => entry.leave?.())
      setBlocked(false); done()
    } finally { running.current = false }
  }, [])
  const change = useCallback(async (done: () => void) => {
    if (running.current) return
    running.current = true
    try {
      const generation = managerSession.getSnapshot().generation
      let entries = [...work.current.values()].map(read => read()).filter(entry => entry.active !== false)
      if (entries.some(entry => entry.busy)) { setBlocked(true); return }
      if (entries.some(entry => entry.dirty) && !await confirmation.ask({ key: 'session.changeContext' }, true)) return
      if (generation !== managerSession.getSnapshot().generation) return
      entries = [...work.current.values()].map(read => read()).filter(entry => entry.active !== false)
      if (!checkpointWork(entries)) { setBlocked(true); return }
      setBlocked(false); done()
    } finally { running.current = false }
  }, [confirmation.ask])
  // A scoped replacement includes retained editors even when their workspace is hidden.
  const changeScoped = useCallback(async (scope: string, done: () => boolean, message: Message): Promise<boolean> => {
    if (running.current) return false
    running.current = true
    try {
      const generation = managerSession.getSnapshot().generation
      const entries = () => [...work.current.values()].map(read => read()).filter(entry => entry.scope === scope)
      if (entries().some(entry => entry.busy)) { setBlocked(true); return false }
      if (!await confirmation.ask(message, true)) return false
      if (generation !== managerSession.getSnapshot().generation) return false
      if (!checkpointWork(entries())) { setBlocked(true); return false }
      setBlocked(false)
      return done()
    } finally { running.current = false }
  }, [confirmation.ask])
  const transitions = useMemo(() => ({ handoff, change, changeScoped }), [handoff, change, changeScoped])
  const leaving = useRef(false)
  const prompting = useRef(false)
  useEffect(() => {
    const pending = () => [...work.current.values()].map(read => read()).filter(w => w.dirty)
    const unload = (event: BeforeUnloadEvent) => {
      if (leaving.current || !pending().length) return
      event.preventDefault(); event.returnValue = ''
    }
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return
      const target = new URL(anchor.href,location.href)
      if (!['http:','https:'].includes(target.protocol)) return
      if (target.origin === location.origin && target.pathname === location.pathname && target.search === location.search) {
        // Re-selecting the active task must not reload the memory-only session.
        if (target.hash === location.hash) { event.preventDefault(); event.stopImmediatePropagation() }
        return
      }
      const normalized = target.pathname.replace(/\.html$/, '').replace(/\/$/, '')
      const base = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/$/, '')
      if (target.origin === location.origin && (normalized === `${base}/internal` || normalized.startsWith(`${base}/internal/`))) {
        event.preventDefault(); event.stopImmediatePropagation()
        router.push(normalized.slice(base.length) + target.search + target.hash)
        return
      }
      const entries = pending()
      if (!entries.length || leaving.current) return
      event.preventDefault(); event.stopImmediatePropagation()
      if (prompting.current) return
      prompting.current = true
      const message: Message = { key: entries.every(w => w.deviceSaved) ? 'navigation.leaveDraft' : 'navigation.leaveUnsaved' }
      void confirmation.ask(message,true,{key:'navigation.leave'}).then(answer => {
        prompting.current = false
        if (answer) { leaving.current = true; window.location.assign(target.href) }
      })
    }
    if (hasDirty) window.addEventListener('beforeunload',unload)
    document.addEventListener('click',click,true)
    return () => { window.removeEventListener('beforeunload',unload); document.removeEventListener('click',click,true) }
  },[confirmation.ask,hasDirty,router])
  return <Context.Provider value={register}><Transitions.Provider value={transitions}>{children}
    {blocked && <Blocked onClose={() => setBlocked(false)} />}{confirmation.dialog}
  </Transitions.Provider></Context.Provider>
}

function Blocked({ onClose }: { onClose: () => void }) {
  const { t } = useInternalLanguage()
  return <div role="alert" className="fixed bottom-4 left-4 right-4 z-50 border-2 border-red-800 bg-white p-4 text-zinc-900 shadow-lg print:hidden">
    <p className="flex items-start gap-2"><Icon name="warning" /><span>{t('session.checkpointFailed')}</span></p><Button onClick={onClose}>{t('session.dismiss')}</Button>
  </div>
}
