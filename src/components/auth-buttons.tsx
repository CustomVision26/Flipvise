"use client";

import { SignInButton, useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { SignUpDialog } from "@/components/sign-up-dialog";
import { useKeepClerkAuthButtonsMounted } from "@/lib/use-clerk-modal-teardown";

export function SignInBtn({ size }: { size?: "default" | "sm" | "lg" | "xs" }) {
  const { isLoaded } = useAuth();
  const keepMounted = useKeepClerkAuthButtonsMounted();
  if (!isLoaded) {
    return (
      <Button variant="outline" size={size} disabled>
        Sign In
      </Button>
    );
  }
  if (!keepMounted) return null;
  return (
    <SignInButton mode="modal">
      <Button variant="outline" size={size}>Sign In</Button>
    </SignInButton>
  );
}

export function SignUpBtn({ size }: { size?: "default" | "sm" | "lg" | "xs" }) {
  const { isLoaded } = useAuth();
  const keepMounted = useKeepClerkAuthButtonsMounted();
  if (!isLoaded) {
    return (
      <Button size={size} disabled>
        Sign Up
      </Button>
    );
  }
  if (!keepMounted) return null;
  return <SignUpDialog size={size} />;
}
