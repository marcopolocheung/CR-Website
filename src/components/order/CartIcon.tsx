'use client'

import { forwardRef } from 'react'
import { useCart } from './CartProvider'

interface CartIconProps {
  onOpen: () => void
}

const CartIcon = forwardRef<HTMLButtonElement, CartIconProps>(function CartIcon({ onOpen }, ref) {
  const { itemCount } = useCart()

  return (
    <button
      ref={ref}
      onClick={onOpen}
      aria-label={`Open cart, ${itemCount} item${itemCount !== 1 ? 's' : ''}`}
      className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-red-800 hover:bg-red-700 text-white shadow-lg flex items-center justify-center transition-colors"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.5 6h13M7 13L5.4 5M17 21a1 1 0 100-2 1 1 0 000 2zm-8 0a1 1 0 100-2 1 1 0 000 2z"
        />
      </svg>
      {itemCount > 0 && (
        <span
          aria-live="polite"
          className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-yellow-300 text-gray-900 text-xs font-bold rounded-full flex items-center justify-center px-1"
        >
          {itemCount}
        </span>
      )}
    </button>
  )
})

export default CartIcon
