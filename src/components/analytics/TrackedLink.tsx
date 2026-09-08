'use client'

import type { AnchorHTMLAttributes } from 'react'
import { trackEvent, type AnalyticsEvent, type AnalyticsParams } from '@/lib/analytics'

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string
  event: AnalyticsEvent
  params?: AnalyticsParams
}

/**
 * An ordinary anchor that reports the click. Exists so the pages holding these
 * links stay server components — making those client components would ship
 * `menu.json` to the browser.
 *
 * Nothing here can block the navigation: gtag sends over `sendBeacon`, which
 * survives the page being left, and every link this wraps either opens a new
 * tab or hands off to the dialler.
 */
export default function TrackedLink({ href, event, params, children, onClick, ...rest }: Props) {
  return (
    <a
      href={href}
      onClick={(e) => {
        trackEvent(event, params)
        onClick?.(e)
      }}
      {...rest}
    >
      {children}
    </a>
  )
}
