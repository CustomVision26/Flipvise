"use client";

import * as React from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { useTheme } from "next-themes";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { resolveLogoImageUrl } from "@/lib/branding";
import { ClerkAuthHandoffMarker } from "@/components/clerk-auth-handoff-marker";
import { ClerkChunkLoadRecovery } from "@/components/clerk-chunk-load-recovery";
import { ClerkPostSignInHardNavigation } from "@/components/clerk-post-sign-in-hard-navigation";
import { ClerkSessionRouterSync } from "@/components/clerk-session-router-sync";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { NativeAppBootstrap } from "@/components/native-app-bootstrap";
import { NativeNotificationBootstrap } from "@/components/native-notification-bootstrap";
import { OfflineBanner } from "@/components/offline-banner";
import { useClientMounted } from "@/lib/use-client-mounted";

const clerkAppearance = {
  theme: dark,
  options: {
    logoImageUrl: resolveLogoImageUrl(),
    logoLinkUrl: "/",
    logoPlacement: "inside" as const,
  },
};

/** Drop legacy `system` from localStorage so only light | dark are used. */
function ThemeStorageNormalize({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme();
  const mounted = useClientMounted();

  React.useEffect(() => {
    if (!mounted) return;
    if (theme === "system") setTheme("dark");
  }, [mounted, theme, setTheme]);

  return <>{children}</>;
}

function ClerkWithTheme({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider appearance={clerkAppearance} telemetry={false}>
      <ClerkChunkLoadRecovery />
      <ClerkAuthHandoffMarker />
      <ClerkPostSignInHardNavigation />
      <ClerkSessionRouterSync />
      {children}
    </ClerkProvider>
  );
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <ThemeStorageNormalize>
        <ClerkWithTheme>
          <NativeAppBootstrap />
          <NativeNotificationBootstrap />
          <OfflineBanner />
          {children}
          <Toaster richColors closeButton position="top-right" />
          <ServiceWorkerRegister />
        </ClerkWithTheme>
      </ThemeStorageNormalize>
    </ThemeProvider>
  );
}
