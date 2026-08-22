import type { Metadata } from 'next'

export const SITE_URL = 'https://chinarosesa.com'
export const SITE_NAME = 'China Rose'
export const DEFAULT_DESCRIPTION =
  'China Rose - Authentic Chinese cuisine with two locations in San Antonio, TX. Order pick-up or delivery online.'
export const OG_IMAGE_PATH = '/imgs/crbanner.webp'

export const indexableRoutes = [
  { path: '/', changeFrequency: 'weekly', priority: 1 },
  { path: '/menu', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/locations/w-military', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/locations/sw-military', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/careers', changeFrequency: 'monthly', priority: 0.3 },
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
