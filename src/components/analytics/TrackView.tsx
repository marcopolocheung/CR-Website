'use client'

import { useEffect, useRef } from 'react'
import { trackEvent, type AnalyticsEvent, type AnalyticsParams } from '@/lib/analytics'

/**
 * Reports that a page was reached, once per mount — which is once per arrival,
 * whether the visitor landed on the route or navigated to it client-side.
 * Renders nothing.
 */
export default function TrackView({ event, params }: { event: AnalyticsEvent; params?: AnalyticsParams }) {
  const sent = useRef(false)

  useEffect(() => {
    if (sent.current) return
    sent.current = true

    trackEvent(event, params)
  }, [event, params])

  return null
}
