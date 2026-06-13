"use client";

import * as React from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { useTheme } from "next-themes";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { resolveLogoImageUrl } from "@/lib/branding";
import { ClerkAuthHandoffMarker } from "@/components/clerk-auth-handoff-marker";
import { ClerkPostSignInHardNavigation } from "@/components/clerk-post-sign-in-hard-navigation";
import { ClerkSessionRouterSync } from "@/components/clerk-session-router-sync";

const clerkAppearance = {
  baseTheme: dark,
  layout: {
    logoImageUrl: resolveLogoImageUrl(),
    logoLinkUrl: "/",
    logoPlacement: "inside" as const,
  },
};

/** Drop legacy `system` from localStorage so only light | dark are used. */
function ThemeStorageNormalize({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme();

  React.useEffect(() => {
    if (theme === "system") setTheme("dark");
  }, [theme, setTheme]);

  return <>{children}</>;
}

function ClerkWithTheme({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider appearance={clerkAppearance}>
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
          {children}
          <Toaster richColors closeButton position="top-right" />
        </ClerkWithTheme>
      </ThemeStorageNormalize>
    </ThemeProvider>
  );
}
