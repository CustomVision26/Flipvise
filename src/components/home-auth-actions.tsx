"use client";

import { useAuth } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SignInBtn, SignUpBtn } from "@/components/auth-buttons";
import { HomeInviteEmailAuthButtons } from "@/components/home-invite-email-auth-buttons";
import { useKeepClerkAuthButtonsMounted } from "@/lib/use-clerk-modal-teardown";
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
  const [mounted, setMounted] = useState(false);
  const isHomeRedirecting = isLoaded && isSignedIn && pathname === "/";

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isLoaded || !keepMounted) {
    return null;
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
