'use client'

import { useSearchParams } from 'next/navigation'
import { ReactNode } from 'react'
import { CartProvider } from './CartProvider'
import { LOCATION_CONFIG } from '@/lib/menuUtils'

export default function OrderLayoutInner({ children }: { children: ReactNode }) {
  const params = useSearchParams()
  const location = params.get('location') ?? ''
  const tableRaw = params.get('table') ?? ''
  const table = parseInt(tableRaw, 10)

  if (!LOCATION_CONFIG[location]) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-6">
        <div className="text-center max-w-sm">
          <p className="text-5xl mb-4">🍽️</p>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Location not found</h1>
          <p className="text-gray-600 text-sm">
            We couldn&apos;t identify your location. Please ask a staff member for help.
          </p>
        </div>
      </div>
    )
  }

  if (!tableRaw || isNaN(table) || table <= 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-6">
        <div className="text-center max-w-sm">
          <p className="text-5xl mb-4">🪑</p>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Table not found</h1>
          <p className="text-gray-600 text-sm">
            We couldn&apos;t identify your table. Please ask a staff member for help.
          </p>
        </div>
      </div>
    )
  }

  return (
    <CartProvider initialLocation={location} initialTable={table}>
      {children}
    </CartProvider>
  )
}
