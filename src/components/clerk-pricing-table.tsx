"use client";

import dynamic from "next/dynamic";
import { dark } from "@clerk/themes";
import { Card, CardContent } from "@/components/ui/card";

// Client-only: avoids checkout UI attaching only after navigation (SSR/hydration + Clerk portal).
const PricingTable = dynamic(
  () => import("@clerk/nextjs").then((mod) => mod.PricingTable),
  {
    ssr: false,
    loading: () => (
      <Card>
        <CardContent className="flex min-h-[280px] items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">Loading pricing…</p>
        </CardContent>
      </Card>
    ),
  },
);

/** Above app shell (header z-10) and typical Radix overlays (z-50). */
const pricingAppearance = {
  baseTheme: dark,
  elements: {
    modalBackdrop: { zIndex: 100 },
    modalContent: { zIndex: 101 },
    drawerBackdrop: { zIndex: 100 },
    drawerContent: { zIndex: 101 },
    drawerRoot: { zIndex: 100 },
  },
} as const;

export function ClerkPricingTable({
  newSubscriptionRedirectUrl = "/auth/continue",
}: {
  /** Where Clerk’s checkout “Continue” sends the user — prefer `/dashboard?userid=…&plan=…` or `/auth/continue` to resolve it. */
  newSubscriptionRedirectUrl?: string;
}) {
  return (
    <PricingTable
      newSubscriptionRedirectUrl={newSubscriptionRedirectUrl}
      appearance={pricingAppearance}
    />
  );
}
