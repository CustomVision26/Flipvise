"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { stripSensitiveUrlSearchParams } from "@/lib/sensitive-url-query";

/**
 * Strips Clerk ids, Stripe session ids, and dashboard `plan=` from the address bar
 * on every route. Invite tokens, pricing `plan=` / `period=`, and Team Admin
 * `teamMemberId` are left intact.
 */
export function SensitiveUrlQueryStripper() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const current = new URLSearchParams(searchParams.toString());
    const cleaned = stripSensitiveUrlSearchParams(current, pathname);
    if (cleaned.toString() === current.toString()) return;
    const qs = cleaned.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [pathname, searchParams, router]);

  return null;
}
