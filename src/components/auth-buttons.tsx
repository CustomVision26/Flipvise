"use client";

import { SignInButton, SignUpButton, useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export function SignInBtn({ size }: { size?: "default" | "sm" | "lg" | "xs" }) {
  const { isSignedIn, isLoaded } = useAuth();
  if (!isLoaded) {
    return (
      <Button variant="outline" size={size} disabled>
        Sign In
      </Button>
    );
  }
  if (isSignedIn) return null;
  return (
    <SignInButton
      mode="modal"
      fallbackRedirectUrl="/auth/continue"
      signUpFallbackRedirectUrl="/auth/continue"
    >
      <Button variant="outline" size={size}>Sign In</Button>
    </SignInButton>
  );
}

export function SignUpBtn({ size }: { size?: "default" | "sm" | "lg" | "xs" }) {
  const { isSignedIn, isLoaded } = useAuth();
  if (!isLoaded) {
    return (
      <Button size={size} disabled>
        Sign Up
      </Button>
    );
  }
  if (isSignedIn) return null;
  return (
    <SignUpButton
      mode="modal"
      fallbackRedirectUrl="/auth/continue"
      signInFallbackRedirectUrl="/auth/continue"
    >
      <Button size={size}>Sign Up</Button>
    </SignUpButton>
  );
}
