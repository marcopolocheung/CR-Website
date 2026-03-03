'use client'

import Image from 'next/image'
import { useCart } from './CartProvider'
import { toId, parsePrice } from '@/lib/menuUtils'

type MenuItem = { name: string; image: string; price: string | null; description: string | null }

interface MenuItemCardProps {
  item: MenuItem
  category: string
}

export default function MenuItemCard({ item, category }: MenuItemCardProps) {
  const { state, dispatch } = useCart()
  const itemId = `${toId(category)}-${toId(item.name)}`
  const price = parsePrice(item.price)
  const existing = state.items.find(i => i.id === itemId)
  const quantity = existing?.quantity ?? 0

  const displayName = item.name.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())

  function handleAdd() {
    if (price === null) return
    dispatch({
      type: 'ADD_ITEM',
      item: { id: itemId, name: item.name, price, quantity: 1, category, image: item.image },
    })
  }

  function handleIncrement() {
    dispatch({ type: 'UPDATE_QUANTITY', id: itemId, quantity: quantity + 1 })
  }

  function handleDecrement() {
    dispatch({ type: 'UPDATE_QUANTITY', id: itemId, quantity: quantity - 1 })
  }

  return (
    <div className="flex gap-3 items-start bg-white rounded-xl shadow-sm border border-gray-100 p-3 hover:shadow-md transition-shadow">
      <div className="relative w-24 h-24 shrink-0 rounded-lg overflow-hidden bg-gray-100">
        <Image
          src={item.image}
          alt={item.name}
          fill
          sizes="96px"
          className="object-cover"
          loading="lazy"
        />
      </div>
      <div className="flex-1 min-w-0 py-1 flex flex-col gap-1">
        <p className="font-semibold text-gray-900 text-sm leading-snug">{displayName}</p>
        {item.description && (
          <p className="text-xs text-gray-500 leading-snug">{item.description}</p>
        )}
        {price !== null ? (
          <p className="text-red-700 font-bold text-sm">${price.toFixed(2)}</p>
        ) : (
          <p className="text-gray-500 text-xs italic">Market Price — Ask your server</p>
        )}
        {price !== null && (
          <div className="mt-1">
            {quantity === 0 ? (
              <button
                onClick={handleAdd}
                aria-label={`Add ${displayName} to cart`}
                className="bg-red-800 text-white text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-red-700 transition-colors"
              >
                Add
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDecrement}
                  aria-label={quantity === 1 ? `Remove ${displayName} from cart` : `Decrease ${displayName} quantity`}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm transition-colors"
                >
                  −
                </button>
                <span className="text-sm font-semibold text-gray-900 w-4 text-center">{quantity}</span>
                <button
                  onClick={handleIncrement}
                  aria-label={`Increase ${displayName} quantity`}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-red-800 hover:bg-red-700 text-white font-bold text-sm transition-colors"
                >
                  +
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
