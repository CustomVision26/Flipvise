import type { MetadataRoute } from "next";
import { resolveAppUrl } from "@/lib/stripe";

const PUBLIC_PATHS = [
  "/",
  "/about",
  "/privacy",
  "/terms",
  "/ai",
  "/docs",
  "/contact",
  "/pricing",
  "/account-deletion",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const base = resolveAppUrl();
  return PUBLIC_PATHS.map((path) => ({
    url: path === "/" ? `${base}/` : `${base}${path}`,
    changeFrequency: "monthly",
    priority: path === "/" ? 1 : path === "/about" ? 0.8 : 0.6,
  }));
}
