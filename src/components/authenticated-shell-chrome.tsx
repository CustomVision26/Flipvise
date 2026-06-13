"use client";

import { useEffect, useState } from "react";
import {
  clearClerkAuthHandoff,
  clerkAuthHandoffDelayMs,
} from "@/lib/clerk-auth-handoff";

/**
 * Defers authenticated header + watermark on the first paint after sign-in so
 * Clerk modal portals finish teardown before Radix / Clerk header portals mount.
 */
export function AuthenticatedShellChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  const [showChrome, setShowChrome] = useState(false);

  useEffect(() => {
    const delay = clerkAuthHandoffDelayMs();
    const timer = window.setTimeout(() => {
      clearClerkAuthHandoff();
      setShowChrome(true);
    }, delay);
    return () => window.clearTimeout(timer);
  }, []);

  if (!showChrome) {
    return null;
  }

  return <>{children}</>;
}
