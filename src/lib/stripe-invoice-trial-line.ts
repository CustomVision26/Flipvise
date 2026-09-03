const DAY_SECONDS = 86_400;

function formatLongDate(seconds: number): string {
  return new Date(seconds * 1000).toLocaleDateString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function wholeDaysBetweenUnixSeconds(
  startSeconds: number,
  endSeconds: number,
): number | null {
  if (
    !Number.isFinite(startSeconds) ||
    !Number.isFinite(endSeconds) ||
    endSeconds <= startSeconds
  ) {
    return null;
  }
  return Math.max(1, Math.round((endSeconds - startSeconds) / DAY_SECONDS));
}

/**
 * Stripe $0 trial invoices say "Free trial for 1 × Pro Plus" with no length
 * or end date. Receipts add both when the subscription trial window is known.
 */
export function formatStripeInvoiceLineDescription(input: {
  description: string | null | undefined;
  amountCents: number;
  trialStartSeconds?: number | null;
  trialEndSeconds?: number | null;
}): string {
  const raw = input.description?.trim() || "Item";
  const start =
    typeof input.trialStartSeconds === "number" &&
    Number.isFinite(input.trialStartSeconds)
      ? input.trialStartSeconds
      : null;
  const end =
    typeof input.trialEndSeconds === "number" &&
    Number.isFinite(input.trialEndSeconds)
      ? input.trialEndSeconds
      : null;

  const looksLikeTrial =
    /free trial/i.test(raw) || (input.amountCents === 0 && end != null);
  if (!looksLikeTrial) return raw;

  const days = start != null && end != null ? wholeDaysBetweenUnixSeconds(start, end) : null;
  const productPart = raw.replace(/^Free trial for\s+/i, "").trim() || raw;
  const lead = days != null ? `${days}-day free trial` : "Free trial";
  const forClause = productPart ? ` for ${productPart}` : "";
  const endsClause = end != null ? ` (ends ${formatLongDate(end)})` : "";
  return `${lead}${forClause}${endsClause}`;
}
