'use client'

import { useEffect, useRef, useState } from 'react'
import type { LocationSlug } from '@/data/locations'
import TrackedLink from '@/components/analytics/TrackedLink'
import TrackedNavLink from '@/components/analytics/TrackedNavLink'
import { trackEvent } from '@/lib/analytics'

interface LocationCardProps {
  slug: LocationSlug
  name: string
  areaLabel: string
  address: string
  phone: string
  toastUrl: string
  uberUrl: string
  href: string
}

/** Per-location accent so the two homepage cards read as visually distinct at a glance, not just by text. */
const accent: Record<LocationSlug, { badge: string; border: string; focusRing: string }> = {
  'w-military': { badge: 'bg-red-700 text-white', border: 'border-t-4 border-t-red-700', focusRing: 'focus-visible:outline-red-700' },
  'sw-military': { badge: 'bg-amber-600 text-white', border: 'border-t-4 border-t-amber-600', focusRing: 'focus-visible:outline-amber-600' },
}

type PendingOrder = {
  channel: 'pickup' | 'delivery'
  url: string
  label: string
}

export default function LocationCard({ slug, name, areaLabel, address, phone, toastUrl, uberUrl, href }: LocationCardProps) {
  const [pending, setPending] = useState<PendingOrder | null>(null)
  const cancelBtnRef = useRef<HTMLButtonElement>(null)
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null)
  const { badge, border } = accent[slug]

  useEffect(() => {
    if (pending) {
      cancelBtnRef.current?.focus()
    } else {
      lastTriggerRef.current?.focus()
    }
  }, [pending])

  useEffect(() => {
    if (!pending) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPending(null)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [pending])

  function openConfirm(channel: PendingOrder['channel'], url: string, label: string, e: React.MouseEvent<HTMLButtonElement>) {
    lastTriggerRef.current = e.currentTarget
    setPending({ channel, url, label })
  }

  function confirmOrder() {
    if (!pending) return
    trackEvent(pending.channel === 'pickup' ? 'pickup_order_click' : 'delivery_order_click', { location: slug })
    window.open(pending.url, '_blank', 'noopener,noreferrer')
    setPending(null)
  }

  return (
    <div className={`bg-white rounded-2xl shadow-lg border border-gray-100 ${border} p-6 flex flex-col gap-4`}>
      <div>
        <span className={`inline-block ${badge} text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-full mb-2`}>
          {areaLabel}
        </span>
        <h3 className="text-xl font-bold text-red-800">{name}</h3>
        <p className="text-gray-600 mt-1">{address}</p>
        <TrackedLink
          href={`tel:${phone.replace(/\D/g, '')}`}
          event="phone_click"
          params={{ location: slug }}
          aria-label={`Call ${name} at ${phone}`}
          className="text-red-700 font-medium hover:underline mt-1 inline-block"
        >
          {phone}
        </TrackedLink>
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={(e) => openConfirm('pickup', toastUrl, 'Toast', e)}
          aria-label={`Order Pick-Up on Toast - ${name}`}
          className="block text-center bg-red-700 hover:bg-red-800 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
        >
          Order Pick-Up on Toast
        </button>
        <button
          type="button"
          onClick={(e) => openConfirm('delivery', uberUrl, 'Uber Eats', e)}
          aria-label={`Order Delivery on Uber Eats - ${name}`}
          className="block text-center bg-gray-800 hover:bg-gray-900 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
        >
          Order Delivery on Uber Eats
        </button>
        <p className="text-xs text-gray-500 text-center">
          Ordering opens through third-party services. Availability and fees may vary.
        </p>
      </div>

      <TrackedNavLink
        href={href}
        event="location_select"
        params={{ location: slug }}
        aria-label={`View Location & Menu - ${name}`}
        className="text-center text-red-700 hover:text-red-900 font-medium underline text-sm"
      >
        View Location & Menu →
      </TrackedNavLink>

      {pending && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" aria-hidden="true" onClick={() => setPending(null)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`confirm-heading-${slug}-${pending.channel}`}
            className="fixed z-50 inset-x-4 bottom-4 md:inset-x-auto md:left-1/2 md:top-1/2 md:bottom-auto md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-sm bg-white rounded-2xl shadow-2xl p-6"
          >
            <span className={`inline-block ${badge} text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-full mb-2`}>
              {areaLabel}
            </span>
            <h4 id={`confirm-heading-${slug}-${pending.channel}`} className="text-lg font-bold text-gray-900">
              Confirm your location
            </h4>
            <p className="text-gray-700 mt-2">
              You&apos;re ordering {pending.channel === 'pickup' ? 'pick-up' : 'delivery'} from <strong>{name}</strong>
              <br />
              {address}
            </p>
            <div className="flex flex-col-reverse sm:flex-row gap-3 mt-5">
              <button
                ref={cancelBtnRef}
                type="button"
                onClick={() => setPending(null)}
                className="flex-1 text-center border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold py-3 px-4 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmOrder}
                className="flex-1 text-center bg-red-700 hover:bg-red-800 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
              >
                Continue to {pending.label}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
