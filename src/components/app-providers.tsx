"use client";

import "@/lib/early-client-bootstrap";
import * as React from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { useTheme } from "next-themes";
import { GuestSignUpHost } from "@/components/guest-sign-up-host";
import { DocsUiGuideProvider } from "@/components/docs-ui-guide-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { flipviseSignUpUrl } from "@/lib/flipvise-sign-up";
import { Toaster } from "@/components/ui/sonner";
import { resolveLogoImageUrl } from "@/lib/branding";
import { LoginWelcomeToast } from "@/components/login-welcome-toast";
import { SensitiveUrlQueryStripper } from "@/components/sensitive-url-query-stripper";
import { ClerkAuthHandoffMarker } from "@/components/clerk-auth-handoff-marker";
import { ClerkChunkLoadRecovery } from "@/components/clerk-chunk-load-recovery";
import { ClerkPostSignInHardNavigation } from "@/components/clerk-post-sign-in-hard-navigation";
import { ClerkSessionRouterSync } from "@/components/clerk-session-router-sync";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { NativeAppBootstrap } from "@/components/native-app-bootstrap";
import { NativeNotificationBootstrap } from "@/components/native-notification-bootstrap";
import { OfflineBanner } from "@/components/offline-banner";
import { useClientMounted } from "@/lib/use-client-mounted";

const clerkLogo = {
  logoImageUrl: resolveLogoImageUrl(),
  logoLinkUrl: "/",
  logoPlacement: "inside" as const,
};

const clerkLightVariables = {
  colorPrimary: "#7c3aed",
  colorPrimaryForeground: "#ffffff",
  colorBackground: "#fffaf3",
  colorForeground: "#1e1b4b",
  colorMutedForeground: "#5b21b6",
  colorInput: "#ffffff",
  colorInputForeground: "#1e1b4b",
  colorBorder: "#c4b5fd",
  colorRing: "#22d3ee",
  colorNeutral: "#1e1b4b",
  borderRadius: "1rem",
};

const clerkDarkVariables = {
  colorPrimary: "#7c3aed",
  colorPrimaryForeground: "#ffffff",
  colorBackground: "#20124e",
  colorForeground: "#f8fafc",
  colorMutedForeground: "#ddd6fe",
  colorInput: "#140c30",
  colorInputForeground: "#f8fafc",
  colorBorder: "#c4b5fd",
  colorRing: "#22d3ee",
  colorNeutral: "#e9d5ff",
  borderRadius: "1rem",
};

function clerkAppearance(mode: "light" | "dark") {
  return {
    ...(mode === "dark" ? { theme: dark } : {}),
    variables: mode === "dark" ? clerkDarkVariables : clerkLightVariables,
    options: clerkLogo,
  };
}

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
  const { resolvedTheme } = useTheme();
  const mounted = useClientMounted();
  const mode = mounted && resolvedTheme === "light" ? "light" : "dark";

  return (
    <ClerkProvider
      appearance={clerkAppearance(mode)}
      telemetry={false}
      signUpUrl={flipviseSignUpUrl()}
    >
      <ClerkChunkLoadRecovery />
      <ClerkAuthHandoffMarker />
      <LoginWelcomeToast />
      <React.Suspense fallback={null}>
        <SensitiveUrlQueryStripper />
      </React.Suspense>
      <ClerkPostSignInHardNavigation />
      <ClerkSessionRouterSync />
      <GuestSignUpHost />
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
        <DocsUiGuideProvider>
          <ClerkWithTheme>
            <div className="relative z-[1] flex min-h-full w-full flex-1 flex-col">
              <NativeAppBootstrap />
              <NativeNotificationBootstrap />
              <OfflineBanner />
              {children}
              <Toaster
                richColors
                closeButton
                position="top-right"
                visibleToasts={6}
                expand
              />
              <ServiceWorkerRegister />
            </div>
          </ClerkWithTheme>
        </DocsUiGuideProvider>
      </ThemeStorageNormalize>
    </ThemeProvider>
  );
}
