import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration for the Flipvise iOS/Android apps.
 *
 * Architecture (offline-first hybrid):
 * - The app LAUNCHES into the bundled Study app (`webDir`), which works fully offline
 *   against the local SQLite database (see `src/lib/offline/`). This is why we do NOT
 *   set `server.url` — a forced remote URL fails to load with no connection.
 * - When ONLINE, the Study app navigates the in-app WebView to the live Render site
 *   (allowed via `server.allowNavigation`), so every server-rendered feature (auth, AI,
 *   billing, admin, deck/card creation) works exactly as on the web. Because both the
 *   bundled app and the live site run inside the same native app, they share ONE native
 *   SQLite database — so "Make available offline" on the live (authenticated) site seeds
 *   the same DB the offline Study app reads.
 *
 * Set CAP_LIVE_HOST / NEXT_PUBLIC_APP_URL to your production host before `npx cap sync`.
 *
 * NOTE: iOS builds require macOS + Xcode. Android builds work on Windows with Android Studio.
 */
const LIVE_HOST = (
  process.env.CAP_LIVE_HOST ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "https://flipvise-sjgw.onrender.com"
)
  .replace(/^https?:\/\//, "")
  .replace(/\/.*$/, "");

const config: CapacitorConfig = {
  appId: "com.flipvise.app",
  appName: "Flipvise",
  // Bundled offline Study app. `npm run mobile:build` populates this folder.
  webDir: "mobile/www",
  server: {
    androidScheme: "https",
    // Keep navigation to the live site inside the app WebView (preserves the Clerk session).
    allowNavigation: [LIVE_HOST],
  },
  plugins: {
    CapacitorSQLite: {
      iosDatabaseLocation: "Library/CapacitorDatabase",
      iosIsEncryption: false,
      androidIsEncryption: false,
    },
  },
};

export default config;
