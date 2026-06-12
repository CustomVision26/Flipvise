"use client";

import { useAuth } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/** Wait for Clerk modal portals to finish teardown before RSC refresh mounts header portals. */
const LAYOUT_REFRESH_DEFER_MS = 200;

/**
 * After Clerk modal sign-in, App Router can keep server components in a stale
 * state until a full reload (dev overlay shows "Rendering…"). Revalidate when
 * the session appears or when navigating from `/` to `/dashboard` after auth.
 */
export function ClerkSessionRouterSync() {
  const { isLoaded, userId } = useAuth();
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const prevPath = useRef<string | null>(null);
  const prevUserId = useRef<string | null | undefined>(undefined);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current != null) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    function scheduleLayoutRefresh() {
      if (refreshTimerRef.current != null) {
        clearTimeout(refreshTimerRef.current);
      }
      refreshTimerRef.current = setTimeout(() => {
        refreshTimerRef.current = null;
        router.refresh();
      }, LAYOUT_REFRESH_DEFER_MS);
    }

    const prevUid = prevUserId.current;
    if (prevUid === undefined) {
      prevUserId.current = userId ?? null;
    } else if (prevUid === null && userId != null) {
      prevUserId.current = userId;
      // Homepage / auth handoff uses Clerk redirect + server navigation — avoid
      // racing modal portal teardown with authenticated header portals.
      const authHandoffRoute =
        pathname === "/" ||
        pathname.startsWith("/auth/continue") ||
        pathname.startsWith("/invite/");
      if (!authHandoffRoute) {
        scheduleLayoutRefresh();
      }
    } else if (prevUid != null && userId == null) {
      prevUserId.current = null;
      scheduleLayoutRefresh();
    }

    const prevP = prevPath.current;
    if (
      userId != null &&
      pathname.startsWith("/dashboard") &&
      prevP != null &&
      prevP !== pathname &&
      (prevP === "/" ||
        prevP.startsWith("/auth/continue") ||
        prevP.startsWith("/invite/team"))
    ) {
      scheduleLayoutRefresh();
    }
    prevPath.current = pathname;
  }, [isLoaded, userId, pathname, router]);

  return null;
}
