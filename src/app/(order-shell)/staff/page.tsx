import type { Metadata } from 'next'
import StaffEntry from '@/components/internal/StaffEntry'

export const metadata: Metadata = { title: 'Staff' }

export default function Page() {
  return <StaffEntry />
}
