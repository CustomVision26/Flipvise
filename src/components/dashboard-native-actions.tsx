"use client";

import { NativeAppBackButton } from "@/components/native-app-back-button";
import { OfflineAvailabilityButton } from "@/components/offline-availability-button";

/** Native-only dashboard header actions (Capacitor shell). */
export function DashboardNativeActions() {
  return (
    <>
      <NativeAppBackButton />
      <OfflineAvailabilityButton />
    </>
  );
}
