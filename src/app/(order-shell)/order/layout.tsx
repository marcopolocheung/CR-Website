import { Suspense } from 'react'
import OrderLayoutInner from '@/components/order/OrderLayoutInner'

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-red-800 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 text-sm">Loading menu…</p>
      </div>
    </div>
  )
}

export default function OrderLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <OrderLayoutInner>{children}</OrderLayoutInner>
    </Suspense>
  )
}
