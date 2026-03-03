import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'd1w7312wesee68.cloudfront.net',
      },
    ],
  },
}

export default nextConfig
