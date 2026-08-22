import type { Metadata } from 'next'
import LocationPageContent from '@/components/LocationPageContent'
import { publicPageMetadata } from '@/lib/seo'

export const metadata: Metadata = publicPageMetadata({
  title: 'SW Military Dr',
  description: 'China Rose at 2535 SW Military Dr, San Antonio TX. Order Pick-Up or Delivery, view our menu.',
  path: '/locations/sw-military',
})

export default function SWMilitaryPage() {
  return (
    <LocationPageContent
      name="China Rose – SW Military Dr"
      addressLines={['2535 SW Military Dr', 'San Antonio, TX 78224']}
      phone="(210) 927-7339"
      phoneHref="tel:2109277339"
      toastUrl="https://order.toasttab.com/online/china-rose-sw-military-2535-sw-military-dr"
      uberUrl="https://www.order.store/store/china-rose-sw-military/GYiGnH3mQSSS1iKIi2uHjw"
      mapUrl="https://www.google.com/maps/search/?api=1&query=2535%20SW%20Military%20Dr%2C%20San%20Antonio%2C%20TX%2078224"
    />
  )
}
