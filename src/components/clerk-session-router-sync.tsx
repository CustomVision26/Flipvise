"use client";

import { useAuth } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

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

  useEffect(() => {
    if (!isLoaded) return;

    const prevUid = prevUserId.current;
    if (prevUid === undefined) {
      prevUserId.current = userId ?? null;
    } else if (prevUid === null && userId != null) {
      prevUserId.current = userId;
      router.refresh();
    } else if (prevUid != null && userId == null) {
      prevUserId.current = null;
      router.refresh();
    }

    const prevP = prevPath.current;
    if (
      userId != null &&
      pathname.startsWith("/dashboard") &&
      (prevP === "/" || (prevP != null && prevP.startsWith("/invite/team")))
    ) {
      router.refresh();
    }
    prevPath.current = pathname;
  }, [isLoaded, userId, pathname, router]);

  return null;
}
