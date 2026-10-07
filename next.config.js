/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  compress: true,
  poweredByHeader: false,
  transpilePackages: ['firebase'],
  experimental: {
    serverComponentsExternalPackages: ['firebase-admin'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 2592000, // 30 天快取
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      }
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  }
};

module.exports = nextConfig;
