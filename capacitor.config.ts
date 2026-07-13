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
function parseLiveHost(raw: string): string {
  return raw.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}

const PROD_HOST = "flipvise-sjgw.onrender.com";

const LIVE_HOST = parseLiveHost(
  process.env.CAP_LIVE_HOST ??
    process.env.NEXT_PUBLIC_APP_URL ??
    `https://${PROD_HOST}`,
);

/** Hostnames the in-app WebView may navigate to (live site + Clerk auth + optional dev). */
const allowNavigation = new Set([
  // Bundled offline shell (`server.hostname`); without this iOS opens Safari for
  // "Offline study" / sign-out navigation to https://localhost/.
  "localhost",
  // Android emulator → host via adb reverse (preferred; Clerk allows 127.0.0.1).
  "127.0.0.1",
  // Android emulator host alias (fallback without adb reverse; needs Clerk origin allowlist).
  "10.0.2.2",
  LIVE_HOST,
  PROD_HOST,
  "*.onrender.com",
  "accounts.clerk.dev",
  "*.clerk.accounts.dev",
  "clerk.com",
  "*.clerk.com",
]);
if (process.env.CAP_ANDROID_DEV_HOST) {
  const devHostRaw = process.env.CAP_ANDROID_DEV_HOST.replace(/\/$/, "");
  allowNavigation.add(parseLiveHost(devHostRaw));
  // Capacitor bridge JS injection matches full http(s) origins — dev uses cleartext.
  if (devHostRaw.startsWith("http://") || devHostRaw.startsWith("https://")) {
    allowNavigation.add(devHostRaw);
  } else {
    allowNavigation.add(`http://${parseLiveHost(devHostRaw)}`);
    allowNavigation.add(`https://${parseLiveHost(devHostRaw)}`);
  }
}

const config: CapacitorConfig = {
  appId: "com.flipvise.app",
  appName: "Flipvise",
  // Bundled offline Study app. `npm run mobile:build` populates this folder.
  webDir: "mobile/www",
  // Quiet empty plugin rejects (`console.error({})`) in the live WebView overlay.
  // Native Logcat still shows app logs; set to "debug" when diagnosing bridge calls.
  loggingBehavior: "none",
  android: {
    // Detectable on the live site when Capacitor bridge is not injected after navigation.
    appendUserAgent: "FlipviseNative/1",
  },
  ios: {
    // Same marker as Android so native-only UI survives in-app navigation on iOS.
    appendUserAgent: "FlipviseNative/1",
  },
  server: {
    androidScheme: "https",
    // iOS cannot use https for the bundled origin — default is `capacitor://localhost`.
    iosScheme: "capacitor",
    hostname: "localhost",
    // Custom page when a main-frame load fails (replaces the system "Webpage not available" screen).
    errorPath: "error.html",
    // Keep navigation to the live site inside the app WebView (preserves the Clerk session).
    allowNavigation: [...allowNavigation],
  },
  plugins: {
    CapacitorSQLite: {
      iosDatabaseLocation: "Library/CapacitorDatabase",
      iosIsEncryption: false,
      androidIsEncryption: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    StatusBar: {
      // Keep web content below the status bar on all pages (deck back links, headers, etc.).
      overlaysWebView: false,
      style: "DARK",
      backgroundColor: "#0a0a0a",
    },
  },
};

export default config;
