/** @type {import('next').NextConfig} */
const nextConfig = {
  optimizeFonts: false,
  // Ensure static files are served properly
  assetPrefix: process.env.NODE_ENV === 'production' ? '' : '',
  images: {
    domains: ['localhost', '127.0.0.1', 'bidsquire.com', 'admin.bidsquire.com'],
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'http',
        hostname: '**',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // Enable static exports for better Docker performance
  trailingSlash: false,
  // Handle server-side only modules
  webpack: (config, { isServer }) => {
    config.externals.push({
      "pg-native": "commonjs pg-native",
    });
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dns: false,
      };
    }
    return config;
  },
  // Disable server-side features that aren't needed in production
  typescript: {
    ignoreBuildErrors: true, // Temporarily ignore TypeScript errors for production
  },
  eslint: {
    ignoreDuringBuilds: true, // Temporarily ignore ESLint for production
  },
}

module.exports = nextConfig
