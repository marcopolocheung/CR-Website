import DemoGate from '@/components/scheduler/DemoGate'
import Link from 'next/link'

// One gate for every station page, so the manager code is typed once per visit.
export default function SchedulerDemoLayout({ children }: { children: React.ReactNode }) {
  return <>
    <div className="mx-auto max-w-7xl px-4 pt-4 print:hidden">
      <Link href="/internal" className="inline-flex min-h-11 items-center text-red-800 underline">Internal tools / Herramientas internas</Link>
    </div>
    <DemoGate>{children}</DemoGate>
  </>
}
