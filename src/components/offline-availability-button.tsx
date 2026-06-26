"use client";

import * as React from "react";
import { useAuth } from "@clerk/nextjs";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { isFlipviseNativeShell } from "@/lib/offline/is-flipvise-native-app";

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

  // Strict native-only: this download relies on the native SQLite plugin, so it
  // must never render in a browser/PWA where it can't work.
  React.useEffect(() => {
    const native = isFlipviseNativeShell();
    setIsNative(native);
    try {
      // Keep the post-navigation heuristic alive for other native-aware features.
      if (native) sessionStorage.setItem("flipvise.native", "1");
    } catch {
      // ignore
    }
  }, []);

  if (!isNative || !isSignedIn || !userId) return null;

  const handleClick = async () => {
    setBusy(true);
    try {
      const [{ seedOfflineLibrary }, session, { createDeviceSyncTokenAction }] =
        await Promise.all([
          import("@/lib/offline/sync"),
          import("@/lib/offline/session"),
          import("@/actions/offline-sync"),
        ]);

      await session.setStoredUserId(userId);

      try {
        const { setNativeAppFlag } = await import("@/lib/offline/session");
        await setNativeAppFlag();
      } catch {
        // non-fatal
      }

      // Mint + persist a device token
      try {
        const { token } = await createDeviceSyncTokenAction({
          label: navigator.userAgent.slice(0, 128),
        });
        await session.setStoredSyncToken(token);
        await session.setStoredApiBaseUrl(window.location.origin);
      } catch {
        // Non-fatal — offline reading still works even if token minting fails.
      }

      // Full pull seeds every accessible deck on the device (not just rows changed since last sync).
      const result = await seedOfflineLibrary({
        userId,
        credentials: "include",
        fullPull: true,
      });
      const parts: string[] = [];
      if (result.deckCount > 0) {
        parts.push(`${result.deckCount} deck${result.deckCount === 1 ? "" : "s"}`);
      }
      if (result.cardCount > 0) {
        parts.push(`${result.cardCount} card${result.cardCount === 1 ? "" : "s"}`);
      }
      if (result.deferredToOfflineShell) {
        toast.success(
          parts.length > 0
            ? `Saved ${parts.join(" and ")} — tap Offline study to load them on this device.`
            : "Saved — tap Offline study to refresh your offline library.",
        );
      } else {
        toast.success(
          parts.length > 0
            ? `Saved for offline — ${parts.join(" and ")} downloaded.`
            : "Saved for offline — your library is up to date (nothing new to download).",
        );
      }
    } catch (err) {
      const { getLastOfflineDbError } = await import("@/lib/offline/db");
      const hint = getLastOfflineDbError();
      toast.error(
        hint
          ? `Couldn't save for offline: ${hint}`
          : err instanceof Error
            ? err.message
            : "Couldn't save your decks for offline use. Please try again.",
      );
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
