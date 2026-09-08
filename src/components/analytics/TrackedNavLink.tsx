'use client'

import Link from 'next/link'
import type { ComponentProps } from 'react'
import { trackEvent, type AnalyticsEvent, type AnalyticsParams } from '@/lib/analytics'

type Props = ComponentProps<typeof Link> & {
  event: AnalyticsEvent
  params?: AnalyticsParams
}

/** `TrackedLink` for internal routes, so client-side navigation is preserved. */
export default function TrackedNavLink({ event, params, children, onClick, ...rest }: Props) {
  return (
    <Link
      onClick={(e) => {
        trackEvent(event, params)
        onClick?.(e)
      }}
      {...rest}
    >
      {children}
    </Link>
  )
}
