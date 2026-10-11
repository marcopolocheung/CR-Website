import DemoGate from '@/components/scheduler/DemoGate'

// One gate for every station page, so the manager code is typed once per visit.
export default function SchedulerDemoLayout({ children }: { children: React.ReactNode }) {
  return <DemoGate>{children}</DemoGate>
}
