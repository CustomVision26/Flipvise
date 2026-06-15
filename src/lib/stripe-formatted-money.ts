import { roundMajor } from "@/lib/money-math";

/** Parses Stripe Checkout Elements totals like `$108.00` into major currency units. */
export function parseStripeFormattedMoney(formatted: string): number | null {
  const trimmed = formatted.trim();
  if (!trimmed) return null;

  const negative = trimmed.includes("-");
  const digits = trimmed.replace(/[^\d.,]/g, "");
  if (!digits) return null;

  const normalized = digits.includes(",")
    ? digits.replace(/,/g, "")
    : digits;
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value)) return null;

  const major = roundMajor(value);
  return negative ? -major : major;
}

export function stripeCheckoutElementsTotalFormatted(
  total: unknown,
): string | null {
  if (!total || typeof total !== "object") return null;
  const row = total as { total?: { amount?: string } };
  return row.total?.amount?.trim() || null;
}

export function stripeCheckoutElementsTotalMajor(
  total: unknown,
): number | null {
  const formatted = stripeCheckoutElementsTotalFormatted(total);
  return formatted ? parseStripeFormattedMoney(formatted) : null;
}
