import type { RestaurantLocation } from '@/data/locations'
import {
  absoluteUrl,
  DEFAULT_DESCRIPTION,
  OG_IMAGE_PATH,
  SITE_NAME,
} from '@/lib/seo'

// Every item on the menu is under $15, which is the "$" band Google renders.
const PRICE_RANGE = '$'

function restaurantNode(location: RestaurantLocation) {
  const url = absoluteUrl(location.path)

  return {
    '@type': 'Restaurant',
    '@id': `${url}#restaurant`,
    name: location.schemaName,
    alternateName: location.displayName,
    url,
    telephone: location.phoneE164,
    servesCuisine: 'Chinese',
    acceptsReservations: false,
    address: {
      '@type': 'PostalAddress',
      streetAddress: location.streetAddress,
      addressLocality: 'San Antonio',
      addressRegion: 'TX',
      postalCode: location.postalCode,
      addressCountry: 'US',
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: location.hours.days,
        opens: location.hours.opens,
        closes: location.hours.closes,
      },
    ],
    priceRange: PRICE_RANGE,
    image: absoluteUrl(OG_IMAGE_PATH),
    hasMenu: absoluteUrl('/menu'),
    hasMap: location.mapUrl,
    hasDriveThroughService: location.services.includes('Drive-thru'),
    parentOrganization: {
      '@type': 'Organization',
      '@id': `${absoluteUrl('/')}#organization`,
      name: SITE_NAME,
      url: absoluteUrl('/'),
    },
    potentialAction: [
      {
        '@type': 'OrderAction',
        name: 'Order pick-up on Toast',
        target: location.toastUrl,
      },
      {
        '@type': 'OrderAction',
        name: 'Order delivery',
        target: location.uberUrl,
      },
    ],
  }
}

export function restaurantJsonLd(location: RestaurantLocation) {
  const url = absoluteUrl(location.path)

  return {
    '@context': 'https://schema.org',
    '@graph': [
      restaurantNode(location),
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: absoluteUrl('/'),
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: location.displayName,
            item: url,
          },
        ],
      },
    ],
  }
}

export function homepageJsonLd(locationList: RestaurantLocation[]) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${absoluteUrl('/')}#organization`,
        name: SITE_NAME,
        url: absoluteUrl('/'),
        description: DEFAULT_DESCRIPTION,
        department: locationList.map((location) => ({
          '@id': `${absoluteUrl(location.path)}#restaurant`,
        })),
      },
      ...locationList.map(restaurantNode),
      {
        '@type': 'WebSite',
        '@id': `${absoluteUrl('/')}#website`,
        name: SITE_NAME,
        url: absoluteUrl('/'),
        publisher: {
          '@id': `${absoluteUrl('/')}#organization`,
        },
        inLanguage: 'en-US',
      },
      {
        '@type': 'ItemList',
        '@id': `${absoluteUrl('/')}#locations`,
        name: 'China Rose San Antonio locations',
        itemListElement: locationList.map((location, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          item: {
            '@id': `${absoluteUrl(location.path)}#restaurant`,
            name: location.displayName,
            url: absoluteUrl(location.path),
          },
        })),
      },
    ],
  }
}

export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  )
}
