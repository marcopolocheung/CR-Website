import type { LocationSlug } from '@/data/locations'

/**
 * GA4 measurement ID, inlined at build time. Absent locally and on any build
 * that does not set it, which is deliberate: no ID means no script, no queue
 * and no network calls, so dev and PR builds never pollute the property.
 */
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID ?? ''

/**
 * The conversions this site exists to produce. Adding a name here is the whole
 * contract — GA4 shows any event it receives, but only these are ones we chose
 * to be able to report on, so keep the list closed and the names stable.
 */
export type AnalyticsEvent =
  | 'pickup_order_click'
  | 'delivery_order_click'
  | 'phone_click'
  | 'directions_click'
  | 'menu_view'
  | 'location_select'

export type AnalyticsParams = {
  /**
   * Which restaurant the interaction belongs to. Omitted for the events that
   * are genuinely sitewide — the menu is shared, so `menu_view` has no location.
   */
  location?: LocationSlug
}

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

/**
 * The queue shim from Google's own snippet, in TypeScript. Calls made before
 * gtag.js finishes loading land on `dataLayer` and are replayed in order once
 * it does, so nothing has to wait for the network before it can be recorded.
 */
function gtag(...args: unknown[]) {
  if (typeof window === 'undefined') return

  window.dataLayer = window.dataLayer ?? []
  if (typeof window.gtag !== 'function') {
    window.gtag = function queueGtagCall() {
      // GA reads the raw `arguments` object back off the queue — pushing an
      // array here would look like a single malformed command.
      window.dataLayer?.push(arguments)
    }
  }

  window.gtag(...args)
}

let initialized = false

/**
 * `send_page_view: false` because this is a single-page app: gtag would only
 * ever count the first page of a visit on its own. Page views are sent from
 * `Analytics` instead, on every route change including the first.
 */
export function initAnalytics(measurementId: string) {
  if (initialized || !measurementId) return
  initialized = true

  gtag('js', new Date())
  gtag('config', measurementId, { send_page_view: false })
}

export function trackPageView(path: string) {
  if (!GA_MEASUREMENT_ID) return

  gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
  })
}

export function trackEvent(event: AnalyticsEvent, params: AnalyticsParams = {}) {
  if (!GA_MEASUREMENT_ID) return

  gtag('event', event, params)
}
