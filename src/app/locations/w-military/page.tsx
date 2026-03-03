import type { Metadata } from 'next'
import LocationPageContent from '@/components/LocationPageContent'

export const metadata: Metadata = {
  title: 'W Military Dr | China Rose',
  description: 'China Rose at 7046 W Military Dr, San Antonio TX. Order Pick-Up or Delivery, view our menu.',
}

export default function WMilitaryPage() {
  return (
    <LocationPageContent
      name="China Rose – W Military Dr"
      addressLines={['7046 W Military Dr', 'San Antonio, TX 78227']}
      phone="(210) 675-3226"
      phoneHref="tel:2106753226"
      toastUrl="https://order.toasttab.com/online/china-rose-w-military-7046-w-military-dr"
      uberUrl="https://www.order.store/store/china-rose-7046-military/FrlPQ762VI6wc3eQe4ThOQ"
      mapImage="/imgs/WMilitaryLocation.png"
      menuNote="Menu images from SW Military Dr location. Items may vary. Prices subject to change."
    />
  )
}
