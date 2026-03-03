'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { useCart } from './CartProvider'

interface CartDrawerProps {
  open: boolean
  onClose: () => void
  triggerRef: React.RefObject<HTMLButtonElement | null>
}

export default function CartDrawer({ open, onClose, triggerRef }: CartDrawerProps) {
  const { state, dispatch, itemCount, total } = useCart()
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) {
      closeBtnRef.current?.focus()
    } else {
      triggerRef.current?.focus()
    }
  }, [open, triggerRef])

  const reviewUrl = `/order/review?location=${state.location}&table=${state.table}`

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          aria-hidden="true"
          onClick={onClose}
        />
      )}

      {/* Panel — mobile: bottom sheet, desktop: right sidebar */}
      <div
        role="dialog"
        aria-label="Cart"
        aria-modal="true"
        className={[
          'fixed z-50 bg-white shadow-2xl flex flex-col transition-transform duration-300',
          // Mobile: bottom sheet
          'bottom-0 left-0 right-0 max-h-[80vh] rounded-t-2xl',
          // Desktop: right panel
          'md:top-0 md:bottom-auto md:left-auto md:right-0 md:h-full md:w-96 md:rounded-none',
          open
            ? 'translate-y-0 md:translate-x-0'
            : 'translate-y-full md:translate-y-0 md:translate-x-full',
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <h2 className="font-bold text-gray-900 text-base">
            Your Cart
            {itemCount > 0 && (
              <span className="ml-2 text-sm text-gray-500 font-normal">({itemCount} item{itemCount !== 1 ? 's' : ''})</span>
            )}
          </h2>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            aria-label="Close cart"
            className="text-gray-500 hover:text-gray-700 p-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {state.items.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">Your cart is empty.</p>
          ) : (
            state.items.map(item => {
              const displayName = item.name.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
              return (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 leading-snug">{displayName}</p>
                    <p className="text-xs text-gray-500">${item.price.toFixed(2)} each</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => dispatch({ type: 'UPDATE_QUANTITY', id: item.id, quantity: item.quantity - 1 })}
                      aria-label={item.quantity === 1 ? `Remove ${displayName}` : `Decrease ${displayName} quantity`}
                      className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold transition-colors"
                    >
                      −
                    </button>
                    <span className="text-sm font-semibold text-gray-900 w-5 text-center">{item.quantity}</span>
                    <button
                      onClick={() => dispatch({ type: 'UPDATE_QUANTITY', id: item.id, quantity: item.quantity + 1 })}
                      aria-label={`Increase ${displayName} quantity`}
                      className="w-6 h-6 flex items-center justify-center rounded-full bg-red-800 hover:bg-red-700 text-white text-sm font-bold transition-colors"
                    >
                      +
                    </button>
                  </div>
                  <div className="w-14 text-right shrink-0">
                    <p className="text-sm font-semibold text-gray-900">${(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                  <button
                    onClick={() => dispatch({ type: 'REMOVE_ITEM', id: item.id })}
                    aria-label={`Remove ${displayName} from cart`}
                    className="text-gray-400 hover:text-red-600 transition-colors p-0.5"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-4 py-4 space-y-3 shrink-0">
          <div className="flex justify-between items-center font-bold text-gray-900">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
          {itemCount === 0 ? (
            <button
              disabled
              title="Add items to your cart first"
              className="w-full bg-gray-300 text-gray-500 font-semibold py-3 rounded-xl cursor-not-allowed text-sm"
            >
              Review Order
            </button>
          ) : (
            <Link
              href={reviewUrl}
              onClick={onClose}
              className="block w-full bg-red-800 hover:bg-red-700 text-white text-center font-semibold py-3 rounded-xl transition-colors text-sm"
            >
              Review Order
            </Link>
          )}
          <button
            onClick={onClose}
            className="w-full text-center text-sm text-gray-600 hover:text-gray-900 transition-colors py-1"
          >
            Continue Browsing
          </button>
        </div>
      </div>
    </>
  )
}
