"use client";

import { useAuth } from "@clerk/nextjs";
import { useLayoutEffect, useRef } from "react";
import { markClerkAuthHandoff } from "@/lib/clerk-auth-handoff";

/** Flags the next authenticated layout mount so header portals defer after sign-in. */
export function ClerkAuthHandoffMarker() {
  const { isLoaded, isSignedIn } = useAuth();
  const wasSignedIn = useRef(false);

  useLayoutEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn && !wasSignedIn.current) {
      markClerkAuthHandoff();
    }
    wasSignedIn.current = isSignedIn;
  }, [isLoaded, isSignedIn]);

  return null;
}
