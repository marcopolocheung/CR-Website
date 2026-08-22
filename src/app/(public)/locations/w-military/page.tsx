import type { Metadata } from 'next'
import LocationPageContent from '@/components/LocationPageContent'
import { getLocation } from '@/data/locations'
import { JsonLd, restaurantJsonLd } from '@/lib/structuredData'

export const metadata: Metadata = {
  title: 'W Military Dr | China Rose',
  description: 'China Rose at 7046 W Military Dr in San Antonio, TX. View hours, menu, pickup, delivery, and directions.',
}

const location = getLocation('w-military')

export default function WMilitaryPage() {
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
