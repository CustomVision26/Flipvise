"use client";

import { useAuth } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { SignInBtn, SignUpBtn } from "@/components/auth-buttons";
import { HomeInviteEmailAuthButtons } from "@/components/home-invite-email-auth-buttons";
import { NativeAppBackButton } from "@/components/native-app-back-button";
import { useKeepClerkAuthButtonsMounted } from "@/lib/use-clerk-modal-teardown";
import { useOnlineStatus } from "@/lib/use-online-status";
import { cn } from "@/lib/utils";

/**
 * Client-only auth CTAs — avoids Clerk `<Show>` inside the RSC homepage, which
 * can tear down portals out of order and trigger `removeChild on null` crashes.
 */
export function HomeAuthActions({
  inviteEmail,
}: {
  inviteEmail: string | null;
}) {
  const { isLoaded, isSignedIn } = useAuth();
  const pathname = usePathname() ?? "";
  const keepMounted = useKeepClerkAuthButtonsMounted();
  const online = useOnlineStatus();
  const [mounted, setMounted] = useState(false);
  const isHomeRedirecting = isLoaded && isSignedIn && pathname === "/";

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isLoaded || !keepMounted) {
    return null;
  }

  // Clerk can't authenticate without a network round-trip. Offline, show a clear
  // message and a path to the bundled offline shell instead of a dead sign-in modal.
  if (!online) {
    return (
      <div className="flex w-full flex-col items-center gap-3">
        <p className="flex items-center justify-center gap-2 text-center text-sm text-muted-foreground">
          <WifiOff className="size-4 shrink-0" aria-hidden />
          Signing in needs an internet connection. Reconnect to sign in, or keep
          studying your downloaded decks offline.
        </p>
        <NativeAppBackButton />
      </div>
    );
  }

  if (inviteEmail) {
    return <HomeInviteEmailAuthButtons email={inviteEmail} />;
  }

  return (
    <div className="flex w-full flex-col items-center gap-3">
      {isHomeRedirecting ? (
        <p className="text-sm text-muted-foreground">Signing you in…</p>
      ) : null}
      <div
        className={cn(
          "flex w-full flex-wrap justify-center gap-3",
          isHomeRedirecting &&
            "pointer-events-none fixed -left-[9999px] top-0 h-px w-px overflow-hidden opacity-0",
        )}
        aria-hidden={isHomeRedirecting}
      >
        <SignInBtn size="lg" />
        <SignUpBtn size="lg" />
      </div>
    </div>
  );
}
