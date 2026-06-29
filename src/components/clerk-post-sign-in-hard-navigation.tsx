"use client";

import { useAuth } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef } from "react";
import { markClerkAuthHandoff } from "@/lib/clerk-auth-handoff";
import { isFlipviseNativeShell } from "@/lib/offline/is-flipvise-native-app";

/**
 * After modal sign-in on `/`, force a full document navigation instead of App
 * Router soft navigation. Soft nav unmounts SignInButton while Clerk modal
 * portals are still deleting DOM nodes → React `removeChild on null`.
 *
 * useLayoutEffect runs before paint so we beat Clerk's client-side redirect.
 *
 * Skipped inside the Capacitor WebView — native sign-in uses `/native-signin`
 * and bouncing through `/auth/continue` ↔ `/` caused infinite loading loops.
 */
export function ClerkPostSignInHardNavigation() {
  const { isLoaded, isSignedIn } = useAuth();
  const pathname = usePathname() ?? "";
  const didNavigate = useRef(false);

  useLayoutEffect(() => {
    if (
      !isLoaded ||
      !isSignedIn ||
      pathname !== "/" ||
      didNavigate.current ||
      isFlipviseNativeShell()
    ) {
      return;
    }
    didNavigate.current = true;
    markClerkAuthHandoff();
    window.location.replace("/auth/continue");
  }, [isLoaded, isSignedIn, pathname]);

  return null;
}
