"use client";

import * as React from "react";

/**
 * Registers the PWA service worker (`/sw.js`) in production only. Renders nothing.
 *
 * Disabled in development to avoid stale-cache confusion during local work, and on
 * native Capacitor builds (which use the bundled offline shell + SQLite instead).
 */
export function ServiceWorkerRegister() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    // Capacitor exposes a global; skip SW there.
    if (typeof window !== "undefined" && (window as { Capacitor?: unknown }).Capacitor) {
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
