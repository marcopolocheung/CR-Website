import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Scheduler',
  description: 'Weekly staff scheduler for China Rose managers.',
  robots: { index: false, follow: false },
}

// The shared retained host owns the station picker and active controllers.
export default function SchedulerDemoPage() { return null }
