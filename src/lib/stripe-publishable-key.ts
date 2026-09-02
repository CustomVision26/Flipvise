/**
 * Publishable Stripe key (`pk_test_` / `pk_live_`).
 *
 * Client bundles only see `NEXT_PUBLIC_*`. Some deployments (Render copied from
 * `.env.old`) store the same value as `STRIPE_PUBLIC_KEY` — read that on the
 * server and pass it into Checkout so payment pages do not crash.
 */
export function sanitizeStripePublishableKey(
  raw: string | null | undefined,
): string | null {
  const value = raw?.trim().replace(/^['"`]+|['"`]+$/g, "").trim();
  if (!value) return null;
  if (value.startsWith("pk_test_") || value.startsWith("pk_live_")) return value;
  return null;
}

export function resolveStripePublishableKey(): string | null {
  return (
    sanitizeStripePublishableKey(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) ??
    sanitizeStripePublishableKey(process.env.STRIPE_PUBLIC_KEY)
  );
}
