import type { Metadata } from 'next'
import LocationPageContent from '@/components/LocationPageContent'

export const metadata: Metadata = {
  title: 'SW Military Dr | China Rose',
  description: 'China Rose at 2535 SW Military Dr, San Antonio TX. Order Pick-Up or Delivery, view our menu.',
}

export default function SWMilitaryPage() {
  return (
    <LocationPageContent
      name="China Rose – SW Military Dr"
      addressLines={['2535 SW Military Dr', 'San Antonio, TX 78224']}
      phone="(210) 927-7339"
      phoneHref="tel:2109277339"
      toastUrl="https://order.toasttab.com/online/china-rose-sw-military-2535-sw-military-dr"
      uberUrl="https://www.order.store/store/china-rose-sw-military/GYiGnH3mQSSS1iKIi2uHjw"
      mapImage="/imgs/SWMilitaryLocation.png"
    />
  )
}
