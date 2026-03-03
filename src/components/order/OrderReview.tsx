'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCart } from './CartProvider'
import { LOCATION_CONFIG } from '@/lib/menuUtils'
import { OrderPayload } from '@/types/order'

function padStart(n: number, len: number): string {
  return String(n).padStart(len, '0')
}

function generateOrderId(location: string, table: number): string {
  const code = LOCATION_CONFIG[location]?.code ?? 'CR'
  return `${code}-T${padStart(table, 2)}-${Math.floor(Date.now() / 1000)}`
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export default function OrderReview() {
  const { state, dispatch, total } = useCart()
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const locationInfo = LOCATION_CONFIG[state.location]
  const menuUrl = `/order?location=${state.location}&table=${state.table}`

  if (state.items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-6">
        <div className="text-center max-w-sm">
          <p className="text-5xl mb-4">🛒</p>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Nothing in your cart yet</h1>
          <p className="text-gray-600 text-sm mb-6">Go back to the menu and add some items.</p>
          <Link
            href={menuUrl}
            className="inline-block bg-red-800 text-white font-semibold px-6 py-2.5 rounded-full text-sm hover:bg-red-700 transition-colors"
          >
            ← Back to Menu
          </Link>
        </div>
      </div>
    )
  }

  async function handleSubmit() {
    if (submitting) return
    setSubmitting(true)

    const orderId = generateOrderId(state.location, state.table)
    const payload: OrderPayload = {
      orderId,
      location: state.location,
      table: state.table,
      items: state.items.map(i => ({
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.price,
        subtotal: parseFloat((i.price * i.quantity).toFixed(2)),
      })),
      total: parseFloat(total.toFixed(2)),
      submittedAt: new Date().toISOString(),
    }

    console.log('[China Rose Order]', payload)

    try {
      localStorage.setItem(`orders:${orderId}`, JSON.stringify(payload))
      localStorage.setItem('lastOrder', JSON.stringify(payload))
      const countKey = `orderCount:${state.location}`
      const prev = parseInt(localStorage.getItem(countKey) ?? '0', 10)
      localStorage.setItem(countKey, String(prev + 1))
    } catch {
      // private browsing — no-op
    }

    await delay(800)
    dispatch({ type: 'CLEAR_CART' })
    router.push(`/order/confirmation?location=${state.location}&table=${state.table}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-red-800 text-white px-4 py-4 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <span className="text-yellow-300 font-bold text-lg">China Rose</span>
          <span className="text-sm text-red-200">
            {locationInfo?.display} · Table {state.table}
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Review Your Order</h1>

        {/* Item table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <span>Item</span>
            <span className="text-center">Qty</span>
            <span className="text-right">Each</span>
            <span className="text-right">Total</span>
          </div>
          <div className="divide-y divide-gray-100">
            {state.items.map(item => {
              const displayName = item.name.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
              return (
                <div
                  key={item.id}
                  className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 px-4 py-3 items-center"
                >
                  <span className="text-sm text-gray-900 font-medium">{displayName}</span>
                  <span className="text-sm text-gray-600 text-center">{item.quantity}</span>
                  <span className="text-sm text-gray-600 text-right">${item.price.toFixed(2)}</span>
                  <span className="text-sm font-semibold text-gray-900 text-right">
                    ${(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="border-t-2 border-gray-200 px-4 py-3 flex justify-between items-center">
            <span className="font-bold text-gray-900">Grand Total</span>
            <span className="font-bold text-gray-900 text-lg">${total.toFixed(2)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-red-800 hover:bg-red-700 disabled:bg-red-400 text-white font-bold py-4 rounded-xl text-base transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting…
              </>
            ) : (
              'Submit Order'
            )}
          </button>
          <Link
            href={menuUrl}
            className="block text-center text-sm text-gray-600 hover:text-gray-900 transition-colors py-1"
          >
            ← Back to Menu
          </Link>
        </div>
      </main>
    </div>
  )
}
