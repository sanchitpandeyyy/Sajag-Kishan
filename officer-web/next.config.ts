import type { NextConfig } from "next";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

const nextConfig: NextConfig = {
  // Hide the floating Next.js dev badge; errors still show in the terminal and browser console.
  devIndicators: false,
  // Landing photos are hotlinked from Unsplash's CDN (Unsplash License) and optimised by next/image.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
  // Same-origin proxy so the httpOnly session cookie works without CORS issues.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/:path*` }];
  },
};

export default nextConfig;
