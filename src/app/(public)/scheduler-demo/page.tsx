import type { Metadata } from 'next'
import SchedulerDemo from '@/components/scheduler/SchedulerDemo'

export const metadata: Metadata = {
  title: 'Scheduler Demo',
  description: 'Internal deterministic employee scheduling demo for China Rose.',
  robots: {
    index: false,
    follow: false,
  },
}

export default function SchedulerDemoPage() {
  return <SchedulerDemo />
}
