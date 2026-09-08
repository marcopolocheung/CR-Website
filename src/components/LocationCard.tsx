import type { LocationSlug } from '@/data/locations'
import TrackedLink from '@/components/analytics/TrackedLink'
import TrackedNavLink from '@/components/analytics/TrackedNavLink'

interface LocationCardProps {
  slug: LocationSlug
  name: string
  address: string
  phone: string
  toastUrl: string
  uberUrl: string
  href: string
}

export default function LocationCard({ slug, name, address, phone, toastUrl, uberUrl, href }: LocationCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 flex flex-col gap-4">
      <div>
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
        <TrackedLink
          href={toastUrl}
          event="pickup_order_click"
          params={{ location: slug }}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Order Pick-Up on Toast - ${name}`}
          className="block text-center bg-red-700 hover:bg-red-800 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
        >
          Order Pick-Up on Toast
        </TrackedLink>
        <TrackedLink
          href={uberUrl}
          event="delivery_order_click"
          params={{ location: slug }}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Order Delivery on Uber Eats - ${name}`}
          className="block text-center bg-gray-800 hover:bg-gray-900 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
        >
          Order Delivery on Uber Eats
        </TrackedLink>
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
    </div>
  )
}
