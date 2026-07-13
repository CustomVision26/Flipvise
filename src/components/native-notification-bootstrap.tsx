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

/**
 * Registers push notifications, polls inbox unread count, and checks for
 * native store / live deploy updates when the live site runs in the Capacitor shell.
 */
export function NativeNotificationBootstrap() {
  const { isSignedIn } = useAuth();
  const [storePrompt, setStorePrompt] = React.useState<StoreUpdatePrompt | null>(
    null,
  );
  const wasSignedInRef = React.useRef(false);

  React.useEffect(() => {
    if (!isFlipviseNativeShell()) return;

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
      try {
        detachPushHandlers = await attachNativePushHandlers();
      } catch {
        // Push plugin unavailable — polling still works.
      }

      if (isSignedIn) {
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
  }, [isSignedIn]);

  React.useEffect(() => {
    if (!isFlipviseNativeShell()) return;

    if (wasSignedInRef.current && !isSignedIn) {
      void revokeStoredPushToken();
    }
    wasSignedInRef.current = !!isSignedIn;
  }, [isSignedIn]);

  if (!isFlipviseNativeShell()) {
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
