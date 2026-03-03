'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { OrderPayload } from '@/types/order'
import { LOCATION_CONFIG } from '@/lib/menuUtils'

export default function OrderConfirmation() {
  const params = useSearchParams()
  const location = params.get('location') ?? ''
  const table = params.get('table') ?? ''
  const [order, setOrder] = useState<OrderPayload | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('lastOrder')
      if (raw) setOrder(JSON.parse(raw))
    } catch {
      // no-op
    }
  }, [])

  const menuUrl = `/order?location=${location}&table=${table}`
  const locationInfo = LOCATION_CONFIG[location]

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 max-w-sm w-full p-8 text-center">
        {/* Green checkmark */}
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-9 h-9 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Submitted!</h1>
        <p className="text-gray-600 text-sm mb-6">
          Your order has been received. A server will bring your food to{' '}
          <strong>Table {table || order?.table}</strong>.
        </p>

        {order && (
          <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left space-y-2">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Order ID</p>
              <p className="font-mono text-sm text-gray-900 font-bold">{order.orderId}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Location</p>
              <p className="text-sm text-gray-900">{locationInfo?.display ?? location}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Submitted</p>
              <p className="text-sm text-gray-900">
                {new Date(order.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        )}

        <Link
          href={menuUrl}
          className="block w-full bg-red-800 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-colors text-sm"
        >
          Place Another Order
        </Link>
      </div>
    </div>
  )
}
