import type { Metadata } from 'next'
import LocationPageContent from '@/components/LocationPageContent'
import { getLocation, orderUrl } from '@/data/locations'
import { JsonLd, restaurantJsonLd } from '@/lib/structuredData'
import { publicPageMetadata } from '@/lib/seo'

export const metadata: Metadata = publicPageMetadata({
  // The street and ZIP carry the search intent this page exists to win
  // ("chinese food 78227", "chinese drive thru san antonio"). The old title,
  // "Military Location | China Rose", named neither the city nor the cuisine.
  title: 'China Rose W Military Dr | Chinese Restaurant, San Antonio',
  absoluteTitle: true,
  description:
    'China Rose at 7046 W Military Dr, San Antonio, TX 78227. Chinese dine-in, pick-up, delivery and drive-thru, plus catering and lunch specials.',
  path: '/locations/w-military',
})

const location = getLocation('w-military')

export default function WMilitaryPage() {
  return (
    <>
      <JsonLd data={restaurantJsonLd(location)} />
      <LocationPageContent
        slug={location.slug}
        name={location.displayName}
        addressLines={location.addressLines}
        phone={location.phone}
        phoneHref={location.phoneHref}
        toastUrl={orderUrl(location, 'pickup')}
        uberUrl={orderUrl(location, 'delivery')}
        mapUrl={location.mapUrl}
        hours={location.hours}
        services={location.services}
        featuredDishes={location.featuredDishes}
        menuNote={location.menuNote}
      />
    </>
  )
}
