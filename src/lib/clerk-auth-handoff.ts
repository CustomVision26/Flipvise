import { CLERK_MODAL_TEARDOWN_MS } from "@/lib/use-clerk-modal-teardown";

export const CLERK_AUTH_HANDOFF_KEY = "flipvise-clerk-auth-handoff";

/** Set when the Clerk session becomes active — read once on the next dashboard mount. */
export function markClerkAuthHandoff(): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(CLERK_AUTH_HANDOFF_KEY, "1");
}

export function hasClerkAuthHandoff(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(CLERK_AUTH_HANDOFF_KEY) === "1";
}

export function clearClerkAuthHandoff(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(CLERK_AUTH_HANDOFF_KEY);
}

/** Milliseconds to wait before mounting authenticated header chrome after sign-in. */
export function clerkAuthHandoffDelayMs(): number {
  if (!hasClerkAuthHandoff()) return 0;
  return CLERK_MODAL_TEARDOWN_MS;
}
