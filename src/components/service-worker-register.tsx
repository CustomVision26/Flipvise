"use client";

import * as React from "react";

/**
 * Registers the PWA service worker (`/sw.js`) on real production hosts only, and renders
 * nothing.
 *
 * Critically, on localhost / in development / inside Capacitor it does the OPPOSITE:
 * it unregisters any previously-installed service worker and clears its caches. A stale
 * worker that registered during an earlier production build would otherwise keep serving
 * cached `/_next/static/` chunks (cache-first), which breaks dev with ChunkLoadError
 * because dev chunk filenames are stable but their contents change.
 */
export function ServiceWorkerRegister() {
  React.useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const host = window.location.hostname;
    const isLocalhost =
      host === "localhost" || host === "127.0.0.1" || host === "::1";
    const isProd = process.env.NODE_ENV === "production";
    const isCapacitor = Boolean((window as { Capacitor?: unknown }).Capacitor);

    // Dev / localhost / native: ensure no service worker is controlling the page.
    if (!isProd || isLocalhost || isCapacitor) {
      navigator.serviceWorker
        .getRegistrations?.()
        .then((registrations) => {
          registrations.forEach((registration) => registration.unregister());
        })
        .catch(() => {});
      if (typeof caches !== "undefined") {
        caches
          .keys?.()
          .then((keys) =>
            keys
              .filter((key) => key.startsWith("flipvise"))
              .forEach((key) => caches.delete(key)),
          )
          .catch(() => {});
      }
      return;
    }

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration failures are non-fatal; the app still works online.
      });
    };

    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
