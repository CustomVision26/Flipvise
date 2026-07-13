"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { NATIVE_SIGNING_OUT_KEY } from "@/components/native-home-sign-out-guard";
import { navigateToOfflineShellFast } from "@/lib/offline/is-flipvise-native-app";

/**
 * Minimal post–Clerk-sign-out surface: mark manual sign-in, then open the
 * bundled offline shell without painting the marketing homepage.
 */
export function NativeSignOutHandoff() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void (async () => {
      try {
        sessionStorage.removeItem(NATIVE_SIGNING_OUT_KEY);
      } catch {
        // ignore
      }
      try {
        const session = await import("@/lib/offline/session");
        await session.setRequireManualSignIn(true);
        const token = await session.getStoredSyncToken().catch(() => null);
        if (token) {
          void fetch(`${window.location.origin}/api/native/revoke-sync-token`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => {});
        }
        await session.clearStoredSyncCredentials().catch(() => {});
      } catch {
        // Still leave the live site — offline study is the native home after logout.
      }
      navigateToOfflineShellFast({ immediate: true });
    })();
  }, []);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background p-6 text-center">
      <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
      <p className="text-sm text-muted-foreground">Returning to offline study…</p>
    </main>
  );
}
