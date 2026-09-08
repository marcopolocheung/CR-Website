'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { GA_MEASUREMENT_ID, initAnalytics, trackPageView } from '@/lib/analytics'

/**
 * GA4 for the public site. Static export means there is no request-time hook to
 * inject this from, so it loads client-side after hydration — `afterInteractive`
 * keeps it off the critical path.
 *
 * Init runs from the effect rather than an inline script so that `config` is
 * always queued before the first `page_view`; an event that reaches gtag.js
 * ahead of its config is dropped.
 */
export default function Analytics() {
  const pathname = usePathname()

  useEffect(() => {
    if (!GA_MEASUREMENT_ID) return

    initAnalytics(GA_MEASUREMENT_ID)
    trackPageView(pathname)
  }, [pathname])

  if (!GA_MEASUREMENT_ID) return null

  return (
    <Script
      id="ga-gtag"
      src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      strategy="afterInteractive"
    />
  )
}
