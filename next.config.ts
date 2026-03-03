import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',
  // basePath is set by the GitHub Actions configure-pages action for project pages
  // (e.g. /chinarose). Leave empty when deploying to a custom domain or user/org page.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? '',
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'd1w7312wesee68.cloudfront.net',
      },
    ],
  },
}

export default nextConfig
