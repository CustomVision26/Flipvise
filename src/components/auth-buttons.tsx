"use client";

import type { ReactNode } from "react";
import { SignInButton, useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { openFlipviseSignUp } from "@/lib/flipvise-sign-up";
import { useKeepClerkAuthButtonsMounted } from "@/lib/use-clerk-modal-teardown";

export function SignInBtn({
  size,
  className,
  children,
}: {
  size?: "default" | "sm" | "lg" | "xs";
  className?: string;
  children?: ReactNode;
}) {
  const { isLoaded } = useAuth();
  const keepMounted = useKeepClerkAuthButtonsMounted();
  const label = children ?? "Sign In";
  if (!isLoaded) {
    return (
      <Button variant="outline" size={size} className={className} disabled>
        {label}
      </Button>
    );
  }
  if (!keepMounted) return null;
  return (
    <SignInButton mode="modal">
      <Button variant="outline" size={size} className={className}>
        {label}
      </Button>
    </SignInButton>
  );
}

export function SignUpBtn({
  size,
  className,
  children,
}: {
  size?: "default" | "sm" | "lg" | "xs";
  className?: string;
  children?: ReactNode;
}) {
  const { isLoaded } = useAuth();
  const keepMounted = useKeepClerkAuthButtonsMounted();
  const label = children ?? "Sign Up";
  if (!isLoaded) {
    return (
      <Button size={size} className={className} disabled>
        {label}
      </Button>
    );
  }
  if (!keepMounted) return null;
  return (
    <Button size={size} className={className} onClick={() => openFlipviseSignUp()}>
      {label}
    </Button>
  );
}
