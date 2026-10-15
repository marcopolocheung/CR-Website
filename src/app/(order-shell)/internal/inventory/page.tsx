import type { Metadata } from 'next'
import Inventory from '@/components/internal/Inventory'

export const metadata: Metadata = { title: 'Inventory' }

export default function InventoryPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 print:p-0">
      <h1 className="text-2xl font-bold text-gray-900 mb-4 print:hidden">CR3 Inventory</h1>
      <Inventory />
    </div>
  )
}
