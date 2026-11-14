import type { Metadata } from 'next'
import '../globals.css'
import SiteBackNavigation from '@/components/BackNavigation'

export const metadata: Metadata = {
  title: {
    default: 'China Rose',
    template: '%s | China Rose',
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default function OrderShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900 font-sans">
        <SiteBackNavigation />
        {children}
      </body>
    </html>
  )
}
