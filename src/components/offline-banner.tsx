"use client";

import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/lib/use-online-status";

/**
 * Thin global banner shown whenever the device is offline. Lets users know that
 * online-only features (AI generation, billing, sign-in, admin) are unavailable while
 * their downloaded content still works. Renders nothing when online.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-offline-banner
      className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-amber-500/15 px-3 py-1.5 text-center text-xs font-medium text-amber-200 sm:text-sm"
    >
      <WifiOff className="size-3.5 shrink-0" />
      <span>You&apos;re offline — saved decks still work; some features are paused until you reconnect.</span>
    </div>
  );
}
