'use client'

import { Suspense } from 'react'
import OrderConfirmation from '@/components/order/OrderConfirmation'

export default function ConfirmationPage() {
  return (
    <Suspense>
      <OrderConfirmation />
    </Suspense>
  )
}
