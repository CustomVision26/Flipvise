"use client";

import { SignInButton, SignUpButton, useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export function HomeInviteEmailAuthButtons({ email }: { email: string }) {
  const { isSignedIn, isLoaded } = useAuth();
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
  if (isSignedIn) return null;
  return (
    <div className="flex w-full flex-wrap justify-center gap-3">
      <SignInButton
        mode="modal"
        initialValues={{ emailAddress: email }}
        fallbackRedirectUrl="/auth/continue"
        signUpFallbackRedirectUrl="/auth/continue"
      >
        <Button variant="outline" size="lg">
          Sign In
        </Button>
      </SignInButton>
      <SignUpButton
        mode="modal"
        initialValues={{ emailAddress: email }}
        fallbackRedirectUrl="/auth/continue"
        signInFallbackRedirectUrl="/auth/continue"
      >
        <Button size="lg">Sign Up</Button>
      </SignUpButton>
    </div>
  );
}
