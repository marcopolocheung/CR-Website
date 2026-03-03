'use client'

import { createContext, useContext, useReducer, useEffect, ReactNode } from 'react'
import { CartState, CartAction } from '@/types/order'
import { cartReducer, makeInitialState } from '@/lib/cartReducer'

const STORAGE_KEY = 'cr-cart'

interface CartContextValue {
  state: CartState
  dispatch: React.Dispatch<CartAction>
  itemCount: number
  total: number
}

const CartContext = createContext<CartContextValue | null>(null)

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside CartProvider')
  return ctx
}

interface CartProviderProps {
  children: ReactNode
  initialLocation: string
  initialTable: number
}

export function CartProvider({ children, initialLocation, initialTable }: CartProviderProps) {
  function lazyInit(): CartState {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (raw) {
        const stored: CartState = JSON.parse(raw)
        if (stored.location === initialLocation && stored.table === initialTable) {
          return stored
        }
      }
    } catch {
      // private browsing or parse error — fall through
    }
    return makeInitialState(initialLocation, initialTable)
  }

  const [state, dispatch] = useReducer(cartReducer, undefined, lazyInit)

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // private browsing — no-op
    }
  }, [state])

  const itemCount = state.items.reduce((sum, i) => sum + i.quantity, 0)
  const total = state.items.reduce((sum, i) => sum + i.price * i.quantity, 0)

  return (
    <CartContext.Provider value={{ state, dispatch, itemCount, total }}>
      {children}
    </CartContext.Provider>
  )
}
