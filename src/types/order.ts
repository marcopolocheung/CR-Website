export interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  category: string
  image?: string
}

export interface CartState {
  location: string
  table: number
  items: CartItem[]
  createdAt: string
}

export interface OrderPayload {
  orderId: string
  location: string
  table: number
  items: {
    name: string
    quantity: number
    unitPrice: number
    subtotal: number
  }[]
  total: number
  submittedAt: string
}

export type CartAction =
  | { type: 'ADD_ITEM'; item: CartItem }
  | { type: 'REMOVE_ITEM'; id: string }
  | { type: 'UPDATE_QUANTITY'; id: string; quantity: number }
  | { type: 'CLEAR_CART' }
