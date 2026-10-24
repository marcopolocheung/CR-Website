'use client'

import { useCallback, useEffect, useState } from 'react'
import CashOut from './CashOut'
import { useInternalLanguage } from './InternalLanguage'
import SalesConverter from './SalesConverter'
import ScheduledActualReport from './ScheduledActualReport'
import HoursConverter from './HoursConverter'
import { fetchCashoutSnapshot } from '@/lib/cashout-store'
import { importStore } from '@/lib/converter/import-snapshot'

const TABS = [
  { id: 'cash-out', label: 'cash.title' },
  { id: 'sales', label: 'bookkeeping.sales' },
  { id: 'hours', label: 'bookkeeping.hours' },
  { id: 'comparison', label: 'comparison.title' },
] as const
type TabId = (typeof TABS)[number]['id']

const storeForLocation = importStore

/** Cash out, daily sales report, and employee hours on one page. Only cash out needs the manager code. */
export default function Bookkeeping() {
  const { t: tr } = useInternalLanguage()
  const [tab, setTab] = useState<TabId>('cash-out')
  // Manager token lives in memory only; the converters work without it.
  const [token, setToken] = useState('')
  const lock = useCallback(() => setToken(''), [])

  useEffect(() => {
    const fromHash = () => {
      const id = window.location.hash.slice(1)
      if (TABS.some(t => t.id === id)) setTab(id as TabId)
    }
    fromHash()
    window.addEventListener('hashchange', fromHash)
    return () => window.removeEventListener('hashchange', fromHash)
  }, [])

  const select = (id: TabId) => {
    setTab(id)
    history.replaceState(null, '', `#${id}`)
  }

  const loadCashout = useCallback(
    async (location: string, date: string) => {
      const store = storeForLocation(location)
      if (!store) throw new Error(tr('bookkeeping.pickStore'))
      return fetchCashoutSnapshot(store, date, token)
    },
    [token, tr],
  )

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">{tr('nav.bookkeeping')}</h1>
      <div role="tablist" aria-label={tr('bookkeeping.tools')} className="flex flex-wrap gap-1 border-b border-gray-200 mb-6 print:hidden">
        {TABS.map(t => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => select(t.id)}
            className={`min-h-11 px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t.id ? 'border-red-600 text-red-700' : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {tr(t.label)}
          </button>
        ))}
      </div>

      {/* Panels stay mounted so switching tabs never drops a half-filled form. */}
      <div role="tabpanel" id="panel-cash-out" aria-labelledby="tab-cash-out" hidden={tab !== 'cash-out'}>
        <CashOut token={token} onUnlock={setToken} onLocked={lock} />
      </div>
      <div role="tabpanel" id="panel-sales" aria-labelledby="tab-sales" hidden={tab !== 'sales'}>
        <SalesConverter token={token} loadCashout={token ? loadCashout : null} />
      </div>
      <div role="tabpanel" id="panel-comparison" aria-labelledby="tab-comparison" hidden={tab !== 'comparison'}><ScheduledActualReport token={token} /></div>
      <div role="tabpanel" id="panel-hours" aria-labelledby="tab-hours" hidden={tab !== 'hours'}>
        <HoursConverter token={token} />
      </div>
    </div>
  )
}
