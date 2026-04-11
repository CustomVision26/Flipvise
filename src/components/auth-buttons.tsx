"use client";

import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export function SignInBtn({ size }: { size?: "default" | "sm" | "lg" | "xs" }) {
  return (
    <SignInButton mode="modal">
      <Button variant="outline" size={size}>Sign In</Button>
    </SignInButton>
  );
}

export function SignUpBtn({ size }: { size?: "default" | "sm" | "lg" | "xs" }) {
  return (
    <SignUpButton mode="modal">
      <Button size={size}>Sign Up</Button>
    </SignUpButton>
  );
}
