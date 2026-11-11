'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { TranslationKey } from '@/lib/internal-tools/i18n'

export type ShellTask = { context?: string | null; onLock?: () => void; lockLabel?: TranslationKey }
type Tasks = Record<string, ShellTask>
const Context = createContext<{ available: boolean; register: (id: string, task: ShellTask) => () => void }>({ available: false, register: () => () => {} })
const TaskDisplay = createContext<Tasks>({})

/** Read-only display metadata and an existing tool action. Never stores credentials or changes task scope. */
export function ShellTaskProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Tasks>({})
  const register = useCallback((id: string, task: ShellTask) => {
    setTasks(previous => ({ ...previous, [id]: task }))
    return () => setTasks(previous => { const next = { ...previous }; delete next[id]; return next })
  }, [])
  const registration = useMemo(() => ({ available: true, register }), [register])
  return <Context.Provider value={registration}><TaskDisplay.Provider value={tasks}>{children}</TaskDisplay.Provider></Context.Provider>
}
export function useShellAvailable() { return useContext(Context).available }
export function useShellTasks() { return useContext(TaskDisplay) }
export function useShellTask(id: string, task: ShellTask) {
  const { register } = useContext(Context)
  const action = useRef(task.onLock); action.current = task.onLock
  const enabled = !!task.onLock
  useEffect(() => register(id, { context: task.context, lockLabel: task.lockLabel,
    onLock: enabled ? () => action.current?.() : undefined }), [register, id, task.context, task.lockLabel, enabled])
}
