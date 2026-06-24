"use client";

import * as React from "react";
import { isFlipviseNativeApp } from "@/lib/offline/is-flipvise-native-app";

/**
 * Persists a native-app marker (Capacitor Preferences) when the live site loads
 * inside the Flipvise WebView, so offline features work after navigation from
 * the bundled offline shell.
 */
export function NativeAppBootstrap() {
  React.useEffect(() => {
    const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } })
      .Capacitor;
    const likelyNative =
      isFlipviseNativeApp() ||
      Boolean(cap?.isNativePlatform?.()) ||
      Boolean(cap);

    if (!likelyNative) return;

    void import("@/lib/offline/session")
      .then((s) => s.setNativeAppFlag())
      .catch(() => {});
  }, []);

  return null;
}
