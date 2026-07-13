"use client";

import * as React from "react";

function isDevOrLocalOrNativeHost(): boolean {
  const host = window.location.hostname;
  const isLocalhost =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "10.0.2.2";
  const isProd = process.env.NODE_ENV === "production";
  const ua = navigator.userAgent;
  const isNativeShell =
    /FlipviseNative\//.test(ua) ||
    Boolean(
      (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
        ?.isNativePlatform?.(),
    );

  return !isProd || isLocalhost || isNativeShell;
}

async function clearControllingServiceWorkersAndCaches(): Promise<boolean> {
  const hadController = Boolean(navigator.serviceWorker.controller);

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));

  if ("caches" in window) {
    // Clear every Cache Storage entry — not only flipvise* — so Turbopack
    // / Next chunk caches cannot leave "module factory is not available".
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }

  return hadController;
}

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
  React.useLayoutEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    if (isDevOrLocalOrNativeHost()) {
      const reloadKey = "flipvise-dev-sw-reset";
      void clearControllingServiceWorkersAndCaches()
        .then((hadController) => {
          if (hadController && !sessionStorage.getItem(reloadKey)) {
            sessionStorage.setItem(reloadKey, "1");
            window.location.reload();
          }
        })
        .catch(() => {});
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
