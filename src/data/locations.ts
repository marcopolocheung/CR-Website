import { featuredDishes } from './featuredDishes'

export type LocationSlug = 'w-military' | 'sw-military'

export type RestaurantLocation = {
  slug: LocationSlug
  displayName: string
  schemaName: string
  path: string
  streetAddress: string
  addressLines: string[]
  postalCode: string
  phone: string
  phoneHref: string
  phoneE164: string
  toastUrl: string
  uberUrl: string
  mapUrl: string
  services: string[]
  featuredDishes: string[]
  menuNote?: string
}

export const locations: Record<LocationSlug, RestaurantLocation> = {
  'w-military': {
    slug: 'w-military',
    displayName: 'China Rose - W Military Dr',
    schemaName: 'China Rose',
    path: '/locations/w-military',
    streetAddress: '7046 W Military Dr',
    addressLines: ['7046 W Military Dr', 'San Antonio, TX 78227'],
    postalCode: '78227',
    phone: '(210) 675-3226',
    phoneHref: 'tel:2106753226',
    phoneE164: '+12106753226',
    toastUrl: 'https://order.toasttab.com/online/china-rose-w-military-7046-w-military-dr',
    uberUrl: 'https://www.order.store/store/china-rose-7046-military/FrlPQ762VI6wc3eQe4ThOQ',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=7046%20W%20Military%20Dr%2C%20San%20Antonio%2C%20TX%2078227',
    services: ['Dine-in', 'Pick-up', 'Delivery', 'Drive-thru', 'Curbside pickup', 'Catering', 'Lunch specials'],
    featuredDishes,
    menuNote: 'Menus are the same at both China Rose locations. Prices subject to change.',
  },
  'sw-military': {
    slug: 'sw-military',
    displayName: 'China Rose - SW Military Dr',
    schemaName: 'China Rose',
    path: '/locations/sw-military',
    streetAddress: '2535 SW Military Dr',
    addressLines: ['2535 SW Military Dr', 'San Antonio, TX 78224'],
    postalCode: '78224',
    phone: '(210) 927-7339',
    phoneHref: 'tel:2109277339',
    phoneE164: '+12109277339',
    toastUrl: 'https://order.toasttab.com/online/china-rose-sw-military-2535-sw-military-dr',
    uberUrl: 'https://www.order.store/store/china-rose-sw-military/GYiGnH3mQSSS1iKIi2uHjw',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=2535%20SW%20Military%20Dr%2C%20San%20Antonio%2C%20TX%2078224',
    services: ['Dine-in', 'Pick-up', 'Delivery', 'Curbside pickup', 'Catering', 'Lunch specials'],
    featuredDishes,
    menuNote: 'Menus are the same at both China Rose locations. Prices subject to change.',
  },
}

export function getLocation(slug: LocationSlug) {
  return locations[slug]
}

export function formatLocationAddress(location: RestaurantLocation) {
  return `${location.streetAddress}, San Antonio, TX ${location.postalCode}`
}
