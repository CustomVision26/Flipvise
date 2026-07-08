"use client";

import { useEffect, useState } from "react";
import {
  clearClerkAuthHandoff,
  clerkAuthHandoffDelayMs,
} from "@/lib/clerk-auth-handoff";
import { cn } from "@/lib/utils";

/**
 * Defers authenticated header + watermark visibility briefly after sign-in so
 * Clerk modal portals finish teardown before Radix / Clerk header portals mount.
 * Always keeps children in the DOM (hidden via CSS) to avoid hydration mismatches.
 */
export function AuthenticatedShellChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      clearClerkAuthHandoff();
      setHidden(false);
      return;
    }

    const delay = clerkAuthHandoffDelayMs();
    if (delay === 0) {
      clearClerkAuthHandoff();
      setHidden(false);
      return;
    }

    setHidden(true);
    const timer = window.setTimeout(() => {
      clearClerkAuthHandoff();
      setHidden(false);
    }, delay);

    return () => {
      window.clearTimeout(timer);
      setHidden(false);
    };
  }, []);

  return (
    <div className={cn(hidden && "hidden")} suppressHydrationWarning>
      {children}
    </div>
  );
}
