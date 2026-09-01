"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import { useEffect, useRef } from "react";
import { SignUpDialog } from "@/components/sign-up-dialog";
import {
  FLIPVISE_SIGN_UP_HASH,
  openFlipviseSignUp,
} from "@/lib/flipvise-sign-up";

function isClerkSignUpCta(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const clickable = target.closest(
    "a, button, [role='link'], [role='button']",
  );
  if (!clickable) return false;
  if (!clickable.closest(".cl-rootBox, .cl-modalContent, .cl-card, .cl-component")) {
    return false;
  }
  const href = (clickable.getAttribute("href") ?? "").toLowerCase();
  const text = (clickable.textContent ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  if (href.includes("sign-up") || href.includes("signup")) return true;
  return text === "sign up" || text === "sign-up";
}

function hashRequestsSignUp(hash: string): boolean {
  const normalized = hash.replace(/^#/, "").toLowerCase();
  if (!normalized) return false;
  if (normalized === FLIPVISE_SIGN_UP_HASH) return true;
  return (
    normalized === "sign-up" ||
    normalized === "/sign-up" ||
    normalized.startsWith("/sign-up")
  );
}

function replaceClerkSignUpWithFlipvise(closeClerk: () => void): void {
  closeClerk();
  window.setTimeout(() => openFlipviseSignUp(), 50);
}

/**
 * Single guest Sign Up dialog for the whole app, plus a Clerk intercept so
 * Sign In → Sign up never opens Clerk’s hosted SignUp (Apple/Google) UI.
 */
export function GuestSignUpHost() {
  const { isLoaded, isSignedIn } = useAuth();
  const clerk = useClerk();
  const replacingRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || isSignedIn) return;

    const closeClerk = () => {
      try {
        clerk.close?.();
      } catch {
        // Modal may already be closing.
      }
    };

    function consumeHash() {
      if (!hashRequestsSignUp(window.location.hash)) return;
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
      replaceClerkSignUpWithFlipvise(closeClerk);
    }

    function onClick(event: MouseEvent) {
      if (!isClerkSignUpCta(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      replaceClerkSignUpWithFlipvise(closeClerk);
    }

    const observer = new MutationObserver(() => {
      if (replacingRef.current) return;
      const surface = document.querySelector(".cl-signUp-root, .cl-signUp-start");
      if (!surface) return;
      replacingRef.current = true;
      replaceClerkSignUpWithFlipvise(closeClerk);
      window.setTimeout(() => {
        replacingRef.current = false;
      }, 400);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    consumeHash();
    window.addEventListener("hashchange", consumeHash);
    document.addEventListener("click", onClick, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("hashchange", consumeHash);
      document.removeEventListener("click", onClick, true);
    };
  }, [clerk, isLoaded, isSignedIn]);

  if (!isLoaded || isSignedIn) return null;
  return <SignUpDialog showTrigger={false} />;
}
