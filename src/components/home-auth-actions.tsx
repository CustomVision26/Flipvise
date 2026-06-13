"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { SignInBtn, SignUpBtn } from "@/components/auth-buttons";
import { HomeInviteEmailAuthButtons } from "@/components/home-invite-email-auth-buttons";
import { useKeepClerkAuthButtonsMounted } from "@/lib/use-clerk-modal-teardown";

/**
 * Client-only auth CTAs — avoids Clerk `<Show>` inside the RSC homepage, which
 * can tear down portals out of order and trigger `removeChild on null` crashes.
 */
export function HomeAuthActions({
  inviteEmail,
}: {
  inviteEmail: string | null;
}) {
  const { isLoaded } = useAuth();
  const keepMounted = useKeepClerkAuthButtonsMounted();
  const [mounted, setMounted] = useState(false);

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
    <div className="flex w-full flex-wrap justify-center gap-3">
      <SignInBtn size="lg" />
      <SignUpBtn size="lg" />
    </div>
  );
}
