import type { RestaurantLocation } from '@/data/locations'

const SITE_URL = 'https://chinarosesa.com'

const days = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

function absoluteUrl(path: string) {
  return new URL(path, SITE_URL).toString()
}

export function restaurantJsonLd(location: RestaurantLocation) {
  const url = absoluteUrl(location.path)

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Restaurant',
        '@id': `${url}#restaurant`,
        name: location.schemaName,
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
            dayOfWeek: days,
            opens: '11:00',
            closes: '21:00',
          },
        ],
        hasMenu: absoluteUrl('/menu'),
        hasMap: location.mapUrl,
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
      },
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
