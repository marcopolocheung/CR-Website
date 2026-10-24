'use client'

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react'
import { useConfirmation } from './Feedback'
import type { Message } from '@/lib/internal-tools/i18n'

type Work = { dirty: boolean; deviceSaved: boolean }
const Context = createContext<(id: string, read: () => Work) => () => void>(() => () => {})
export function useNavigationProtection(work: Work) {
  const id = useId()
  const current = useRef(work); current.current = work
  const register = useContext(Context)
  useEffect(() => register(id, () => current.current), [id,register,work.dirty,work.deviceSaved])
}
export default function NavigationProtection({ children }: { children: React.ReactNode }) {
  const work = useRef(new Map<string, () => Work>())
  const [hasDirty,setHasDirty] = useState(false)
  const register = useCallback((id: string, read: () => Work) => {
    const refresh = () => setHasDirty([...work.current.values()].some(read => read().dirty))
    work.current.set(id,read); refresh()
    return () => { work.current.delete(id); refresh() }
  }, [])
  const confirmation = useConfirmation()
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
      if (!['http:','https:'].includes(target.protocol) || (target.origin === location.origin && target.pathname === location.pathname && target.search === location.search)) return
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
  },[confirmation.ask,hasDirty])
  return <Context.Provider value={register}>{children}{confirmation.dialog}</Context.Provider>
}
