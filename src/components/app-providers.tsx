"use client";

import * as React from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/themes";
import { useTheme } from "next-themes";
import { ThemeProvider } from "@/components/theme-provider";
import { LOGO_PUBLIC_URL } from "@/lib/branding";

/** Drop legacy `system` from localStorage so only light | dark are used. */
function ThemeStorageNormalize({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme();

  React.useEffect(() => {
    if (theme === "system") setTheme("dark");
  }, [theme, setTheme]);

  return <>{children}</>;
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
        <ClerkProvider
          appearance={{
            baseTheme: shadcn,
            layout: {
              logoImageUrl: LOGO_PUBLIC_URL,
              logoLinkUrl: "/",
              logoPlacement: "inside",
            },
          }}
        >
          {children}
        </ClerkProvider>
      </ThemeStorageNormalize>
    </ThemeProvider>
  );
}
