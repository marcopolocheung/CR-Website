import type { Metadata } from 'next'

export const SITE_URL = 'https://chinarosesa.com'
export const SITE_NAME = 'China Rose'
export const DEFAULT_DESCRIPTION =
  'China Rose - Authentic Chinese cuisine with two locations in San Antonio, TX. Order pick-up or delivery online.'
export const OG_IMAGE_PATH = '/imgs/crbanner.webp'
export const LOGO_PATH = '/imgs/china-rose-logo.png'

/**
 * The date each route last genuinely changed is derived from the commit history
 * of the files that render it — see `src/lib/lastmod.ts`. `sources` is that
 * list. Add a file here when it starts affecting what a route *says*; a route
 * whose sitemap date never moves is discounted the same way one that claims to
 * change on every deploy is.
 *
 * Sitewide chrome — the layout, Nav, Footer — is deliberately absent. It renders
 * on every page, so including it would re-date all five routes for a footer
 * tweak and flatten the per-route signal back into a single deploy date.
 */
export const indexableRoutes = [
  {
    path: '/',
    changeFrequency: 'weekly',
    priority: 1,
    sources: [
      'src/app/(public)/page.tsx',
      'src/components/LocationCard.tsx',
      'src/data/locations.ts',
      'src/lib/structuredData.tsx',
    ],
  },
  {
    path: '/menu',
    changeFrequency: 'weekly',
    priority: 0.9,
    sources: [
      'src/app/(public)/menu/page.tsx',
      'src/data/menu.json',
      'src/lib/menuUtils.ts',
      'src/lib/menuStructuredData.ts',
    ],
  },
  {
    path: '/locations/w-military',
    changeFrequency: 'weekly',
    priority: 0.9,
    sources: [
      'src/app/(public)/locations/w-military/page.tsx',
      'src/components/LocationPageContent.tsx',
      'src/components/LocationOpenStatus.tsx',
      'src/data/locations.ts',
      'src/data/featuredDishes.ts',
      'src/data/menu.json',
      'src/lib/structuredData.tsx',
    ],
  },
  {
    path: '/locations/sw-military',
    changeFrequency: 'weekly',
    priority: 0.9,
    sources: [
      'src/app/(public)/locations/sw-military/page.tsx',
      'src/components/LocationPageContent.tsx',
      'src/components/LocationOpenStatus.tsx',
      'src/data/locations.ts',
      'src/data/featuredDishes.ts',
      'src/data/menu.json',
      'src/lib/structuredData.tsx',
    ],
  },
  {
    path: '/careers',
    changeFrequency: 'monthly',
    priority: 0.3,
    sources: ['src/app/(public)/careers/page.tsx'],
  },
] as const

export function absoluteUrl(path = '/') {
  return new URL(path, SITE_URL).toString()
}

export function publicPageMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
}: {
  title: string
  description: string
  path: string
  // Set when `title` is already a complete title and should not receive the
  // `| China Rose` suffix from the layout template.
  absoluteTitle?: boolean
}): Metadata {
  const url = absoluteUrl(path)
  const useAbsoluteTitle = absoluteTitle || path === '/'
  const fullTitle = useAbsoluteTitle ? title : `${title} | ${SITE_NAME}`

  return {
    title: useAbsoluteTitle ? { absolute: title } : title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: SITE_NAME,
      type: 'website',
      locale: 'en_US',
      images: [
        {
          url: absoluteUrl(OG_IMAGE_PATH),
          alt: 'China Rose',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [absoluteUrl(OG_IMAGE_PATH)],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
  }
}
