import type { Metadata } from 'next'
import ScheduleViewer from '@/components/schedule/ScheduleViewer'

export const metadata: Metadata = {
  title: 'Staff Schedule',
  description: 'Private weekly schedule for China Rose staff.',
  robots: {
    index: false,
    follow: false,
  },
}

export default function SchedulePage() {
  return <ScheduleViewer />
}
