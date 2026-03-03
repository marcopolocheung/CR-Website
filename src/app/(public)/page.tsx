import Image from 'next/image'
import LocationCard from '@/components/LocationCard'

const locations = [
  {
    name: 'China Rose – W Military Dr',
    address: '7046 W Military Dr, San Antonio, TX 78227',
    phone: '(210) 675-3226',
    toastUrl: 'https://order.toasttab.com/online/china-rose-w-military-7046-w-military-dr',
    uberUrl: 'https://www.order.store/store/china-rose-7046-military/FrlPQ762VI6wc3eQe4ThOQ',
    href: '/locations/w-military',
  },
  {
    name: 'China Rose – SW Military Dr',
    address: '2535 SW Military Dr, San Antonio, TX 78224',
    phone: '(210) 927-7339',
    toastUrl: 'https://order.toasttab.com/online/china-rose-sw-military-2535-sw-military-dr',
    uberUrl: 'https://www.order.store/store/china-rose-sw-military/GYiGnH3mQSSS1iKIi2uHjw',
    href: '/locations/sw-military',
  },
]

export default function Home() {
  return (
    <>
      {/* hero section the bigg red banner at the top with the restaurant namme */}
      <section className="relative bg-red-900 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <Image
            src="/imgs/crbanner.webp"
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
          {locations.map((loc) => (
            <LocationCard key={loc.href} {...loc} />
          ))}
        </div>
      </section>
    </>
  )
}
