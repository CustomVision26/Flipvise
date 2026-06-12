/** Format a Stripe-style amount stored in the smallest currency unit (e.g. cents). */
export function formatCurrencyFromCents(
  amountCents: number | null | undefined,
  currency: string | null | undefined,
): string {
  if (amountCents == null) return "—";
  const curr = (currency ?? "usd").toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: curr,
      minimumFractionDigits: 2,
    }).format(amountCents / 100);
  } catch {
    return `${(amountCents / 100).toFixed(2)} ${curr}`;
  }
}
