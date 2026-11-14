'use client'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { newDraft, saveDraft, type Draft } from '@/lib/internal-tools/drafts'
import { isCashoutDraftSheet, type CashoutDraftSheet } from '@/lib/internal-tools/cashout-draft'
import { businessDate } from '@/lib/internal-tools/contracts'
import { cashRecovery, writeCashRecovery } from '@/lib/internal-tools/cashout-save'
import type { SavedCashoutRecord } from '@/lib/cashout-record'
import { useWorkTransitions } from './NavigationProtection'

const Context = createContext({ pending: null as Draft<CashoutDraftSheet> | null, consume: (_id: string) => {}, copy: async (_record: SavedCashoutRecord, _preparer: string): Promise<boolean> => false })
export const useCashCopyTransition = () => useContext(Context)
/** Only the current record travels between retained workspaces, in browser memory. */
export default function CashCopyTransition({ children }: { children: ReactNode }) {
  const [pending,setPending] = useState<Draft<CashoutDraftSheet> | null>(null)
  const transitions = useWorkTransitions()
  const router = useRouter()
  const consume = useCallback((id: string) => setPending(current => current?.id === id ? null : current), [])
  const copy = useCallback(async (record: SavedCashoutRecord, preparer: string) => {
    if (!preparer.trim() || preparer.length > 120) return false
    return transitions.changeScoped('cash', () => {
      const draft = newDraft({ task: 'cash-out', storeId: record.store, businessDate: businessDate(record.date)! },preparer,record.sheet)
      try {
        if (saveDraft(localStorage,draft,isCashoutDraftSheet).state !== 'saved' || !writeCashRecovery(localStorage,draft,cashRecovery(draft,record.fingerprint))) return false
      } catch { return false }
      setPending(draft)
      router.push('/internal/bookkeeping#cash-out')
      return true
    }, { key: 'cash.lookup.copyConfirm', params: { store: record.store, date: record.date } })
  }, [router,transitions])
  const value = useMemo(() => ({pending,consume,copy}), [pending,consume,copy])
  return <Context.Provider value={value}>{children}</Context.Provider>
}
