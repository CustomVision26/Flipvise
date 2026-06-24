"use client";

import * as React from "react";
import { useAuth } from "@clerk/nextjs";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { isFlipviseNativeApp } from "@/lib/offline/is-flipvise-native-app";

/**
 * "Make available offline" — downloads the signed-in user's decks/cards into the
 * shared native SQLite database so the bundled offline Study app can read them with
 * no connection.
 *
 * Renders nothing unless running inside the native (Capacitor) app, so it has no effect
 * on the web experience. Because it runs on the authenticated live site (same origin),
 * the `/api/sync` request carries the Clerk session cookie.
 */
export function OfflineAvailabilityButton() {
  const { userId, isSignedIn } = useAuth();
  const [isNative, setIsNative] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setIsNative(isFlipviseNativeApp());
    try {
      if (isFlipviseNativeApp()) {
        sessionStorage.setItem("flipvise.native", "1");
      }
    } catch {
      // ignore
    }
  }, []);

  if (!isNative || !isSignedIn || !userId) return null;

  const handleClick = async () => {
    setBusy(true);
    try {
      const [{ runSync }, session, { createDeviceSyncTokenAction }] =
        await Promise.all([
          import("@/lib/offline/sync"),
          import("@/lib/offline/session"),
          import("@/actions/offline-sync"),
        ]);

      await session.setStoredUserId(userId);

      // Mint + persist a device token so the bundled offline app can sync on its own later.
      try {
        const { token } = await createDeviceSyncTokenAction({
          label: navigator.userAgent.slice(0, 128),
        });
        await session.setStoredSyncToken(token);
        await session.setStoredApiBaseUrl(window.location.origin);
      } catch {
        // Non-fatal — offline reading still works even if token minting fails.
      }

      // Seed/refresh the shared native SQLite DB using the current (cookie) session.
      const result = await runSync({ userId, credentials: "include" });
      toast.success(
        `Saved for offline — ${result.pulled} item${result.pulled === 1 ? "" : "s"} downloaded.`,
      );
    } catch {
      toast.error("Couldn't save your decks for offline use. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="secondary" onClick={handleClick} disabled={busy}>
      <Download className="size-4" />
      {busy ? "Downloading…" : "Make available offline"}
    </Button>
  );
}
