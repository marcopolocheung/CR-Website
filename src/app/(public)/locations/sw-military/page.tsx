import type { Metadata } from 'next'
import LocationPageContent from '@/components/LocationPageContent'
import { getLocation } from '@/data/locations'
import { JsonLd, restaurantJsonLd } from '@/lib/structuredData'
import { publicPageMetadata } from '@/lib/seo'

export const metadata: Metadata = publicPageMetadata({
  // Same reasoning as the W Military page: street and ZIP over an internal
  // nickname. No drive-thru here, so it is not claimed.
  title: 'China Rose SW Military Dr | Chinese Restaurant, San Antonio',
  absoluteTitle: true,
  description:
    'China Rose at 2535 SW Military Dr, San Antonio, TX 78224. Chinese dine-in, pick-up and delivery on the South Side, plus catering and lunch specials.',
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
        hours={location.hours}
        services={location.services}
        featuredDishes={location.featuredDishes}
        menuNote={location.menuNote}
      />
    </>
  )
}
