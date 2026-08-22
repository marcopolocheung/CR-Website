import type { MetadataRoute } from 'next'
import { absoluteUrl, indexableRoutes } from '@/lib/seo'

export const dynamic = 'force-static'

const lastModified = new Date('2026-08-22')

export default function sitemap(): MetadataRoute.Sitemap {
  return indexableRoutes.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }))
}
