import type { Metadata } from 'next'
import Dashboard from '@/components/internal/Dashboard'

export const metadata: Metadata = { title: 'Dashboard' }

export default function InternalDashboard() {
  return <Dashboard />
}
