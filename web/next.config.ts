import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '5000' },
      { protocol: 'http', hostname: '192.168.1.160', port: '5000' },
      { protocol: 'https', hostname: '*.railway.app' },
    ],
  },
};

export default nextConfig;
