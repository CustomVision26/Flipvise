"use client";

import * as React from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { useTheme } from "next-themes";
import { ThemeProvider } from "@/components/theme-provider";
import { LOGO_PUBLIC_URL } from "@/lib/branding";
import { ClerkSessionRouterSync } from "@/components/clerk-session-router-sync";

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
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        layout: {
          logoImageUrl: LOGO_PUBLIC_URL,
          logoLinkUrl: "/",
          logoPlacement: "inside",
        },
      }}
    >
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
        </ClerkWithTheme>
      </ThemeStorageNormalize>
    </ThemeProvider>
  );
}
