"use client";

import { SignInButton, SignUpButton, useAuth } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useKeepClerkAuthButtonsMounted } from "@/lib/use-clerk-modal-teardown";
import { cn } from "@/lib/utils";

export function HomeInviteEmailAuthButtons({ email }: { email: string }) {
  const { isLoaded, isSignedIn } = useAuth();
  const pathname = usePathname() ?? "";
  const keepMounted = useKeepClerkAuthButtonsMounted();
  const isHomeRedirecting = isLoaded && isSignedIn && pathname === "/";
  if (!isLoaded) {
    return (
      <div className="flex w-full flex-wrap justify-center gap-3">
        <Button variant="outline" size="lg" disabled>
          Sign In
        </Button>
        <Button size="lg" disabled>
          Sign Up
        </Button>
      </div>
    );
  }
  if (!keepMounted) return null;
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
      <SignInButton mode="modal" initialValues={{ emailAddress: email }}>
        <Button variant="outline" size="lg">
          Sign In
        </Button>
      </SignInButton>
      <SignUpButton mode="modal" initialValues={{ emailAddress: email }}>
        <Button size="lg">Sign Up</Button>
      </SignUpButton>
      </div>
    </div>
  );
}
