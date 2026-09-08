import type { MetadataRoute } from 'next'
import { absoluteUrl, indexableRoutes } from '@/lib/seo'
import { lastModifiedFor } from '@/lib/lastmod'

export const dynamic = 'force-static'

export default function sitemap(): MetadataRoute.Sitemap {
  return indexableRoutes.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: lastModifiedFor(route.sources),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }))
}
