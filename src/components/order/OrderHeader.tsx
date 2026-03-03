'use client'

import { useCart } from './CartProvider'
import { LOCATION_CONFIG } from '@/lib/menuUtils'

export default function OrderHeader() {
  const { state } = useCart()
  const locationInfo = LOCATION_CONFIG[state.location]

  return (
    <header className="sticky top-0 z-30 bg-red-800 text-white shadow-md">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <span className="text-yellow-300 font-bold text-lg tracking-tight">China Rose</span>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-red-200">{locationInfo?.display}</span>
          <span className="bg-red-700 text-yellow-300 font-semibold px-2 py-0.5 rounded-full text-xs">
            Table {state.table}
          </span>
        </div>
      </div>
    </header>
  )
}
