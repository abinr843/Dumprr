import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  ...(process.env.NODE_ENV === "development" && process.env.ENABLE_EXPRESS_BACKEND === "true"
    ? {
        async rewrites() {
          return [
            {
              // Proxy /api/* requests to the Express backend when running concurrently in local dev
              source: "/api/:path*",
              destination: `http://localhost:${process.env.BACKEND_PORT || 5000}/api/:path*`,
            },
          ];
        },
      }
    : {}),
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
