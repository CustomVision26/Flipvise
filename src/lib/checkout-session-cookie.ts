import { cookies } from "next/headers";
import { isStripeCheckoutSessionId } from "@/lib/stripe-checkout-session-id";

export const CHECKOUT_SESSION_COOKIE = "flipvise_checkout_session";

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24,
  secure: process.env.NODE_ENV === "production",
};

export async function readCheckoutSessionCookie(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(CHECKOUT_SESSION_COOKIE)?.value?.trim() ?? "";
  return isStripeCheckoutSessionId(value) ? value : null;
}

/** Server Actions and Route Handlers only. */
export async function writeCheckoutSessionCookie(sessionId: string): Promise<void> {
  const id = sessionId.trim();
  if (!isStripeCheckoutSessionId(id)) return;
  const store = await cookies();
  store.set(CHECKOUT_SESSION_COOKIE, id, COOKIE_OPTIONS);
}

/** Server Actions and Route Handlers only. */
export async function clearCheckoutSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(CHECKOUT_SESSION_COOKIE);
}
