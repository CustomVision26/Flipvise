import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Android emulator reaches the Next dev server via 10.0.2.2. Without this,
  // Next 16 blocks cross-origin /_next assets and Clerk never finishes loading.
  // Include host and full origin forms — Next 16 matching varies by version.
  allowedDevOrigins: [
    "10.0.2.2",
    "127.0.0.1",
    "localhost",
    "http://10.0.2.2:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3000",
  ],

  // pdf-parse / pdfjs must run natively on the server (not bundled for edge).
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],

  // Tree-shake large icon / UI libraries at build time — reduces JS sent to the browser
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-icons",
      "recharts",
    ],
  },

  ...(process.env.NODE_ENV === "development"
    ? {
        headers: async () => [
          {
            source: "/_next/:path*",
            headers: [
              {
                key: "Cache-Control",
                value: "no-store, must-revalidate",
              },
            ],
          },
        ],
      }
    : {}),

  images: {
    // Serve AVIF first (smaller), fall back to WebP — both are smaller than PNG/JPEG
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
      {
        protocol: "https",
        hostname: "d3867h453fl05i.cloudfront.net",
      },
      {
        protocol: "https",
        hostname: "*.s3.*.amazonaws.com",
      },
    ],
  },
};

export default nextConfig;
