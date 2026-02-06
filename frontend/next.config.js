/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Enable standalone output for Docker deployment
  output: 'standalone',

  // 图片优化
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },

  // lucide-react / recharts tree-shaking 优化
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts'],
    // 代理超时：AI 处理含多阶段+自动重试，默认 30s 远远不够
    proxyTimeout: 180_000, // 180 秒
  },

  // 生产环境不暴露 source map
  productionBrowserSourceMaps: false,

  // 安全响应头
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },

  async rewrites() {
    // 服务端代理：使用 INTERNAL_API_URL（不暴露到客户端）
    // Docker 内部用 http://backend:8000，本地开发 fallback 到 localhost
    const apiUrl = process.env.INTERNAL_API_URL || 'http://localhost:8000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
