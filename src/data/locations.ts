import { featuredDishes } from './featuredDishes'

export type LocationSlug = 'w-military' | 'sw-military'

export type OpeningHours = {
  /** schema.org dayOfWeek values the hours apply to. */
  days: string[]
  /** 24-hour HH:MM, the format schema.org expects. */
  opens: string
  closes: string
}

const allDays = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

// Both locations keep the same schedule today, but hours live on the location
// record so one can change without the other, and so the page copy, the visible
// hours block and the JSON-LD all read from the same value.
const standardHours: OpeningHours = {
  days: allDays,
  opens: '11:00',
  closes: '21:00',
}

/** Decimal degrees, taken from the location's own Google Business Profile link. */
export type GeoPoint = {
  latitude: number
  longitude: number
}

export type RestaurantLocation = {
  slug: LocationSlug
  displayName: string
  /**
   * Short side-of-town label, spelled out from the directional prefix already
   * in `streetAddress` (W / SW). Exists so the homepage cards can show a cue
   * that doesn't rely on a customer reading past the word "Military" in both
   * addresses to tell the two locations apart.
   */
  areaLabel: string
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
  /**
   * Owner-supplied Google Business Profile share link, one per location. This is
   * the strongest entity-reconciliation signal we publish: it is what ties this
   * page to the listing Google already ranks. Do not substitute a maps search URL.
   */
  googleBusinessUrl: string
  /** Confirmed listings only — an unverified guess here does real harm. */
  yelpUrl?: string
  geo: GeoPoint
  hours: OpeningHours
  services: string[]
  featuredDishes: string[]
  menuNote?: string
}

export const locations: Record<LocationSlug, RestaurantLocation> = {
  'w-military': {
    slug: 'w-military',
    displayName: 'China Rose - Military Location',
    areaLabel: 'West Side',
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
    googleBusinessUrl: 'https://maps.app.goo.gl/kK1yVv9hXpFeDyT89',
    geo: { latitude: 29.4086111, longitude: -98.6288889 },
    hours: standardHours,
    services: ['Dine-in', 'Pick-up', 'Delivery', 'Drive-thru', 'Catering', 'Lunch specials'],
    featuredDishes,
    menuNote: 'Menus are the same at both China Rose locations. Prices subject to change.',
  },
  'sw-military': {
    slug: 'sw-military',
    displayName: 'China Rose - Zarzamora Location',
    areaLabel: 'Southwest Side',
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
    googleBusinessUrl: 'https://maps.app.goo.gl/q5wycf6qVD7nBrCu7',
    geo: { latitude: 29.3580453, longitude: -98.535154 },
    hours: standardHours,
    services: ['Dine-in', 'Pick-up', 'Delivery', 'Catering', 'Lunch specials'],
    featuredDishes,
    menuNote: 'Menus are the same at both China Rose locations. Prices subject to change.',
  },
}

export type OrderChannel = 'pickup' | 'delivery'

/**
 * The ordering link a customer actually clicks, tagged so Toast and Uber can
 * report how much of their volume this site sends them.
 *
 * The tags are applied here rather than stored on the record so the canonical
 * URLs stay canonical: the JSON-LD `OrderAction` targets and any URL we publish
 * for a machine to read keep no tracking parameters, since a crawler never
 * clicks a button and would only be handed a campaign it did not come from.
 */
export function orderUrl(location: RestaurantLocation, channel: OrderChannel) {
  const url = new URL(channel === 'pickup' ? location.toastUrl : location.uberUrl)

  url.searchParams.set('utm_source', 'site')
  url.searchParams.set('utm_medium', 'referral')
  url.searchParams.set('utm_campaign', location.slug)

  return url.toString()
}

export function getLocation(slug: LocationSlug) {
  return locations[slug]
}

export function formatLocationAddress(location: RestaurantLocation) {
  return `${location.streetAddress}, San Antonio, TX ${location.postalCode}`
}

function to12Hour(time: string) {
  const [hour, minute] = time.split(':').map(Number)
  const period = hour >= 12 ? 'PM' : 'AM'
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${period}`
}

/** "11:00 AM – 9:00 PM" — the visible form of the value the JSON-LD emits. */
export function formatOpeningHours(hours: OpeningHours) {
  return `${to12Hour(hours.opens)} – ${to12Hour(hours.closes)}`
}

/** Day prefix for the hours block, so "Daily" is not assumed by the copy. */
export function formatOpeningDays(hours: OpeningHours) {
  return hours.days.length === allDays.length ? 'Daily' : hours.days.join(', ')
}
