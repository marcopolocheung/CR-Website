import Image from 'next/image'
import LocationCard from '@/components/LocationCard'
import { formatLocationAddress, locations } from '@/data/locations'

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
    </>
  )
}
