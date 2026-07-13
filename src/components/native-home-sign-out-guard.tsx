"use client";

import { useLayoutEffect } from "react";
import {
  isFlipviseNativeShell,
  navigateToOfflineShellFast,
} from "@/lib/offline/is-flipvise-native-app";

export const NATIVE_SIGNING_OUT_KEY = "flipvise-native-signing-out";

/**
 * If Clerk still redirects to `/` after sign-out, bounce to the offline shell
 * before the marketing homepage paints.
 */
export function NativeHomeSignOutGuard() {
  useLayoutEffect(() => {
    if (!isFlipviseNativeShell()) return;
    try {
      if (sessionStorage.getItem(NATIVE_SIGNING_OUT_KEY) !== "1") return;
      sessionStorage.removeItem(NATIVE_SIGNING_OUT_KEY);
    } catch {
      return;
    }
    navigateToOfflineShellFast({ immediate: true });
  }, []);

  return null;
}
