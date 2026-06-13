"use client";

import { useAuth } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef } from "react";
import { markClerkAuthHandoff } from "@/lib/clerk-auth-handoff";

/**
 * After modal sign-in on `/`, force a full document navigation instead of App
 * Router soft navigation. Soft nav unmounts SignInButton while Clerk modal
 * portals are still deleting DOM nodes → React `removeChild on null`.
 *
 * useLayoutEffect runs before paint so we beat Clerk's client-side redirect.
 */
export function ClerkPostSignInHardNavigation() {
  const { isLoaded, isSignedIn } = useAuth();
  const pathname = usePathname() ?? "";
  const didNavigate = useRef(false);

  useLayoutEffect(() => {
    if (!isLoaded || !isSignedIn || pathname !== "/" || didNavigate.current) {
      return;
    }
    didNavigate.current = true;
    markClerkAuthHandoff();
    window.location.replace("/auth/continue");
  }, [isLoaded, isSignedIn, pathname]);

  return null;
}
