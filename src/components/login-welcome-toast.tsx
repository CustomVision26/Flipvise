"use client";

import { useLayoutEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import {
  clearClerkAuthHandoff,
  hasClerkAuthHandoff,
} from "@/lib/clerk-auth-handoff";

const NEW_ACCOUNT_WINDOW_MS = 20 * 60 * 1000;

function resolveFirstName(
  firstName: string | null | undefined,
  fullName: string | null | undefined,
): string | null {
  const trimmedFirst = firstName?.trim();
  if (trimmedFirst) return trimmedFirst;
  const trimmedFull = fullName?.trim();
  if (!trimmedFull) return null;
  return trimmedFull.split(/\s+/)[0] ?? null;
}

function isRecentlyCreatedAccount(createdAt: Date | null | undefined): boolean {
  if (!createdAt) return false;
  return Date.now() - createdAt.getTime() <= NEW_ACCOUNT_WINDOW_MS;
}

/**
 * One-shot welcome toast after a fresh sign-in (web modal, PWA, or native in-app sign-in).
 * Skips session restore on ordinary page loads.
 */
export function LoginWelcomeToast() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const handled = useRef(false);

  useLayoutEffect(() => {
    if (!isLoaded || !isSignedIn || handled.current) return;
    if (!hasClerkAuthHandoff()) return;

    handled.current = true;
    clearClerkAuthHandoff();

    const firstName = resolveFirstName(user?.firstName, user?.fullName);
    const nameSuffix = firstName ? `, ${firstName}` : "";
    const isNewAccount = isRecentlyCreatedAccount(user?.createdAt);

    if (isNewAccount) {
      toast.success(`Welcome to Flipvise${nameSuffix}!`, {
        description:
          "Thank you for joining us. Open your Inbox for a welcome message with ways to get started.",
        duration: 12_000,
        action: {
          label: "Open Inbox",
          onClick: () => {
            router.push("/dashboard/inbox");
          },
        },
      });
      return;
    }

    toast.success(`Welcome back${nameSuffix}!`, {
      description: "Good to see you again. Pick up where you left off on your dashboard.",
      duration: 8_000,
    });
  }, [isLoaded, isSignedIn, router, user?.createdAt, user?.firstName, user?.fullName]);

  return null;
}
