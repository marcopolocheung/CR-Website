import Image from 'next/image'
import type { Metadata } from 'next'
import LocationCard from '@/components/LocationCard'
import {
  formatLocationAddress,
  formatOpeningDays,
  formatOpeningHours,
  locations,
} from '@/data/locations'
import { DEFAULT_DESCRIPTION, publicPageMetadata } from '@/lib/seo'
import { homepageJsonLd, JsonLd } from '@/lib/structuredData'

export const metadata: Metadata = publicPageMetadata({
  title: 'China Rose | Authentic Chinese Cuisine in San Antonio',
  description: DEFAULT_DESCRIPTION,
  path: '/',
})

const allLocations = Object.values(locations)

// The "both restaurants" sentence may only state one schedule while the two
// locations actually share one. If they ever diverge, drop the claim rather
// than publishing hours that contradict a location page's JSON-LD.
const sharedHours = allLocations.every(
  (location) =>
    formatOpeningDays(location.hours) === formatOpeningDays(allLocations[0].hours) &&
    formatOpeningHours(location.hours) === formatOpeningHours(allLocations[0].hours),
)
  ? allLocations[0].hours
  : null

const driveThruLocations = Object.values(locations)
  .filter((location) => location.services.includes('Drive-thru'))
  .map((location) => location.displayName.replace('China Rose - ', ''))

const homepageLocations = Object.values(locations).map((location) => ({
  name: location.displayName,
  address: formatLocationAddress(location),
  phone: location.phone,
  toastUrl: location.toastUrl,
  uberUrl: location.uberUrl,
  href: location.path,
}))

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

export default function Home() {
  return (
    <>
      <JsonLd data={homepageJsonLd(Object.values(locations))} />
      {/* hero section the bigg red banner at the top with the restaurant namme */}
      <section className="relative bg-red-900 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <Image
            src={`${BASE}/imgs/crbanner.webp`}
            alt="China Rose banner"
            fill
            className="object-cover"
            priority
          />
        </div>
        <div className="relative max-w-5xl mx-auto px-4 py-20 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-4 tracking-tight">China Rose</h1>
          <p className="text-lg md:text-2xl text-red-200">Authentic Chinese Cuisine in San Antonio</p>
          <p className="mt-3 text-sm text-red-300">Two convenient locations · Pick-Up &amp; Delivery available</p>
        </div>
      </section>

      {/* location cardds both restaurants shown here */}
      <section className="max-w-5xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-8">Choose a Location</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {homepageLocations.map((loc) => (
            <LocationCard key={loc.href} {...loc} />
          ))}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 pb-12">
        <div className="space-y-3 text-center text-gray-700">
          <h2 className="text-2xl font-bold text-gray-800">Chinese Restaurant with Two San Antonio Locations</h2>
          <p className="mx-auto max-w-3xl">
            China Rose serves authentic Chinese cuisine from locations on W Military Dr and SW Military Dr.
            {sharedHours
              ? ` Both restaurants are open ${formatOpeningDays(sharedHours).toLowerCase()}, ${formatOpeningHours(sharedHours)},`
              : ' Each restaurant lists its own hours on its location page'}
            {' '}with dine-in, pick-up, delivery, curbside pickup, catering, and lunch specials.
          </p>
          <p className="mx-auto max-w-3xl text-sm text-gray-600">
            The same menu is available at both locations.{driveThruLocations.length > 0 && ` The ${driveThruLocations.join(' and ')} location also has a drive-thru.`}
          </p>
        </div>
      </section>
    </>
  )
}
