import type { MetadataRoute } from "next";
import { PWA_ICON_URL, PWA_ICON_192_URL } from "@/lib/branding";

/**
 * Web App Manifest — makes Flipvise installable as a PWA on Android (and iOS via
 * "Add to Home Screen"). Served at /manifest.webmanifest.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Flipvise — Smart Flashcards & Learning",
    short_name: "Flipvise",
    description:
      "Create AI-powered flashcard decks, study with flashcards or quizzes, and collaborate with your team.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0b",
    theme_color: "#0a0a0b",
    icons: [
      {
        src: PWA_ICON_URL,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: PWA_ICON_URL,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: PWA_ICON_192_URL,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
