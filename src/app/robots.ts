import type { MetadataRoute } from 'next'
import { absoluteUrl, SITE_URL } from '@/lib/seo'

export const dynamic = 'force-static'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/internal/', '/order/'],
      },
      {
        userAgent: ['OAI-SearchBot', 'GPTBot', 'ChatGPT-User'],
        allow: '/',
        disallow: ['/internal/', '/order/'],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: SITE_URL,
  }
}
