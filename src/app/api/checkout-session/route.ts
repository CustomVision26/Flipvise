import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { writeCheckoutSessionCookie } from "@/lib/checkout-session-cookie";
import { isStripeCheckoutSessionId } from "@/lib/stripe-checkout-session-id";
import { stripSensitiveQueryFromPath } from "@/lib/sensitive-url-query";
import { stripe } from "@/lib/stripe";

function isAllowedCheckoutPayPath(path: string): boolean {
  return (
    path === "/pricing/checkout/pay" ||
    path.startsWith("/pricing/checkout/pay?") ||
    path === "/pricing/add-ons/pay" ||
    path.startsWith("/pricing/add-ons/pay?")
  );
}

function safeNextPath(next: string | null, origin: string): string {
  const fallback = "/pricing/checkout/pay";
  if (!next?.trim()) return fallback;
  const trimmed = stripSensitiveQueryFromPath(next.trim());
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
  try {
    const url = new URL(trimmed, origin);
    if (url.origin !== origin) return fallback;
    const path = `${url.pathname}${url.search}`;
    return isAllowedCheckoutPayPath(path) ? path : fallback;
  } catch {
    return fallback;
  }
}

/** Sets the checkout session cookie, then redirects to a pay path without `session_id`. */
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/", request.nextUrl.origin));
  }

  const sessionId = request.nextUrl.searchParams.get("session_id")?.trim() ?? "";
  const nextPath = safeNextPath(
    request.nextUrl.searchParams.get("next"),
    request.nextUrl.origin,
  );

  if (!isStripeCheckoutSessionId(sessionId)) {
    return NextResponse.redirect(
      new URL("/pricing/checkout", request.nextUrl.origin),
    );
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.metadata?.clerkUserId !== userId) {
      return NextResponse.redirect(new URL("/pricing", request.nextUrl.origin));
    }
  } catch {
    return NextResponse.redirect(
      new URL("/pricing/checkout", request.nextUrl.origin),
    );
  }

  await writeCheckoutSessionCookie(sessionId);
  return NextResponse.redirect(new URL(nextPath, request.nextUrl.origin));
}
