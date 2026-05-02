"use client";

import { SignInButton, SignUpButton, useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export function HomeInviteEmailAuthButtons({ email }: { email: string }) {
  const { isSignedIn, isLoaded } = useAuth();
  if (!isLoaded) {
    return (
      <div className="flex w-full justify-center gap-2 sm:gap-3 flex-wrap">
        <Button variant="outline" disabled>
          Sign In
        </Button>
        <Button disabled>Sign Up</Button>
      </div>
    );
  }
  if (isSignedIn) return null;
  return (
    <div className="flex w-full justify-center gap-2 sm:gap-3 flex-wrap">
      <SignInButton
        mode="modal"
        initialValues={{ emailAddress: email }}
        fallbackRedirectUrl="/auth/continue"
        signUpFallbackRedirectUrl="/auth/continue"
      >
        <Button variant="outline">Sign In</Button>
      </SignInButton>
      <SignUpButton
        mode="modal"
        initialValues={{ emailAddress: email }}
        fallbackRedirectUrl="/auth/continue"
        signInFallbackRedirectUrl="/auth/continue"
      >
        <Button>Sign Up</Button>
      </SignUpButton>
    </div>
  );
}
