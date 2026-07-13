"use client";

import * as React from "react";
import { useAuth } from "@clerk/nextjs";
import { isFlipviseNativeShell } from "@/lib/offline/is-flipvise-native-app";
import { NativeStoreUpdateDialog } from "@/components/native-store-update-dialog";
import {
  registerNativePushNotifications,
  revokeStoredPushToken,
} from "@/lib/native-notifications/push-registration";
import { attachNativePushHandlers } from "@/lib/native-notifications/push-handlers";
import { startNativeInboxPoller } from "@/lib/native-notifications/inbox-poller";
import {
  runNativeUpdateChecks,
  type StoreUpdatePrompt,
} from "@/lib/native-notifications/update-checker";
import { useClientMounted } from "@/lib/use-client-mounted";

/**
 * Registers push notifications, polls inbox unread count, and checks for
 * native store / live deploy updates when the live site runs in the Capacitor shell.
 */
export function NativeNotificationBootstrap() {
  const { isSignedIn } = useAuth();
  const mounted = useClientMounted();
  const [isNativeShell, setIsNativeShell] = React.useState(false);
  const [storePrompt, setStorePrompt] = React.useState<StoreUpdatePrompt | null>(
    null,
  );
  const wasSignedInRef = React.useRef(false);

  React.useEffect(() => {
    if (!mounted) return;
    setIsNativeShell(isFlipviseNativeShell());
  }, [mounted]);

  React.useEffect(() => {
    if (!mounted || !isNativeShell) return;

    // Auth screens only need Preferences (via NativeAppBootstrap). Push + store
    // probes hit plugins that often reject with empty errors on emulators and
    // spam the Next.js overlay via Capacitor logFromNative.
    const path = window.location.pathname;
    if (path.startsWith("/native-signin") || path.startsWith("/auth/")) {
      return;
    }

    let detachPushHandlers: (() => void) | undefined;
    let stopInboxPoller: (() => void) | undefined;
    let appStateListener: { remove: () => void } | undefined;
    let cancelled = false;

    const runUpdates = () => {
      if (cancelled) return;
      void runNativeUpdateChecks({
        onStoreUpdate: (prompt) => setStorePrompt(prompt),
      });
    };

    void (async () => {
      if (isSignedIn) {
        try {
          detachPushHandlers = await attachNativePushHandlers();
        } catch {
          // Push plugin unavailable — polling still works.
        }

        try {
          await registerNativePushNotifications();
        } catch {
          // Permission denied or Firebase not configured.
        }

        stopInboxPoller = startNativeInboxPoller(() => !cancelled && !!isSignedIn);
      }

      try {
        const { Capacitor } = await import("@capacitor/core");
        if (Capacitor.isNativePlatform()) {
          const { App } = await import("@capacitor/app");
          appStateListener = await App.addListener("appStateChange", ({ isActive }) => {
            if (isActive) runUpdates();
          });
        }
      } catch {
        // Bridge unavailable on live-site WebView — update checks still run once below.
      }

      runUpdates();
    })();

    return () => {
      cancelled = true;
      detachPushHandlers?.();
      stopInboxPoller?.();
      void appStateListener?.remove();
    };
  }, [mounted, isNativeShell, isSignedIn]);

  React.useEffect(() => {
    if (!mounted || !isNativeShell) return;

    if (wasSignedInRef.current && !isSignedIn) {
      void revokeStoredPushToken();
    }
    wasSignedInRef.current = !!isSignedIn;
  }, [mounted, isNativeShell, isSignedIn]);

  if (!mounted || !isNativeShell) {
    return null;
  }

  return (
    <NativeStoreUpdateDialog
      prompt={storePrompt}
      onOpenChange={(open) => {
        if (!open) setStorePrompt(null);
      }}
    />
  );
}
