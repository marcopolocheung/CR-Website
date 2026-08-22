import type { Metadata } from 'next'
import LocationPageContent from '@/components/LocationPageContent'
import { getLocation } from '@/data/locations'
import { JsonLd, restaurantJsonLd } from '@/lib/structuredData'
import { publicPageMetadata } from '@/lib/seo'

export const metadata: Metadata = publicPageMetadata({
  title: 'SW Military Dr',
  description: 'China Rose at 2535 SW Military Dr in San Antonio, TX. View hours, menu, pickup, delivery, and directions.',
  path: '/locations/sw-military',
})

const location = getLocation('sw-military')

export default function SWMilitaryPage() {
  return (
    <>
      <JsonLd data={restaurantJsonLd(location)} />
      <LocationPageContent
        name={location.displayName}
        addressLines={location.addressLines}
        phone={location.phone}
        phoneHref={location.phoneHref}
        toastUrl={location.toastUrl}
        uberUrl={location.uberUrl}
        mapUrl={location.mapUrl}
        services={location.services}
        featuredDishes={location.featuredDishes}
        menuNote={location.menuNote}
      />
    </>
  )
}
