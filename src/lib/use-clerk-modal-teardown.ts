"use client";

import { useAuth } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { hasClerkAuthHandoff } from "@/lib/clerk-auth-handoff";

/** Keep Clerk modal trigger trees mounted until portal DOM finishes teardown. */
export const CLERK_MODAL_TEARDOWN_MS = 1000;

/**
 * Stay `true` while signed out, on `/` after sign-in (Clerk redirect pending), or
 * briefly after sign-in elsewhere so SignInButton / SignUpButton are not
 * unmounted while Clerk modal portals are still deleting DOM nodes.
 */
export function useKeepClerkAuthButtonsMounted(): boolean {
  const { isLoaded, isSignedIn } = useAuth();
  const pathname = usePathname() ?? "";
  const [keepMounted, setKeepMounted] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setKeepMounted(true);
      return;
    }
    // Homepage: keep triggers mounted until Clerk navigates to /auth/continue.
    if (pathname === "/") {
      setKeepMounted(true);
      return;
    }
    const timer = window.setTimeout(
      () => setKeepMounted(false),
      CLERK_MODAL_TEARDOWN_MS,
    );
    return () => window.clearTimeout(timer);
  }, [isLoaded, isSignedIn, pathname]);

  if (!isLoaded) return true;
  if (!isSignedIn) return true;
  if (pathname === "/" || hasClerkAuthHandoff()) return true;
  return keepMounted;
}
