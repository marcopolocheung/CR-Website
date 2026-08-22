import type { Metadata } from 'next'
import LocationPageContent from '@/components/LocationPageContent'
import { publicPageMetadata } from '@/lib/seo'

export const metadata: Metadata = publicPageMetadata({
  title: 'W Military Dr',
  description: 'China Rose at 7046 W Military Dr, San Antonio TX. Order Pick-Up or Delivery, view our menu.',
  path: '/locations/w-military',
})

export default function WMilitaryPage() {
  return (
    <LocationPageContent
      name="China Rose – W Military Dr"
      addressLines={['7046 W Military Dr', 'San Antonio, TX 78227']}
      phone="(210) 675-3226"
      phoneHref="tel:2106753226"
      toastUrl="https://order.toasttab.com/online/china-rose-w-military-7046-w-military-dr"
      uberUrl="https://www.order.store/store/china-rose-7046-military/FrlPQ762VI6wc3eQe4ThOQ"
      mapUrl="https://www.google.com/maps/search/?api=1&query=7046%20W%20Military%20Dr%2C%20San%20Antonio%2C%20TX%2078227"
      menuNote="Menu images from SW Military Dr location. Items may vary. Prices subject to change."
    />
  )
}
