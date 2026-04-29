import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tree-shake large icon / UI libraries at build time — reduces JS sent to the browser
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-icons",
      "recharts",
    ],
  },

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
