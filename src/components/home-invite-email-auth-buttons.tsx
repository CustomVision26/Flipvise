"use client";

import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export function HomeInviteEmailAuthButtons({ email }: { email: string }) {
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
