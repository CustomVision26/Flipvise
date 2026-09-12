import { stripSensitiveQueryFromPath } from "@/lib/sensitive-url-query";

/** Bounce a leftover `session_id` query through a cookie-setting API, then a clean pay path. */
export function checkoutSessionCookieApiPath(input: {
  sessionId: string;
  nextPath: string;
}): string {
  const params = new URLSearchParams({
    session_id: input.sessionId,
    next: stripSensitiveQueryFromPath(input.nextPath),
  });
  return `/api/checkout-session?${params.toString()}`;
}

export function planCheckoutPayHref(): string {
  return "/pricing/checkout/pay";
}

export function addonCheckoutPayHref(fromPlanChange = false): string {
  return fromPlanChange
    ? "/pricing/add-ons/pay?from_plan_change=1"
    : "/pricing/add-ons/pay";
}
