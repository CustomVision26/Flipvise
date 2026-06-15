import { buildCheckoutInvoiceCouponName } from "@/lib/affiliate-stripe-coupon";

export type AdminInvoicePromoKind = "general" | "affiliate";

export function normalizeAdminInvoicePromoKind(
  value: string | null | undefined,
): AdminInvoicePromoKind | null {
  return value === "general" || value === "affiliate" ? value : null;
}

/** Parse stamped Stripe coupon names like `SUMMER26 (General Discount 5%)` or legacy formats. */
export function parsePromoFromDiscountLabel(label: string | null | undefined): {
  promoCode: string | null;
  promoKind: AdminInvoicePromoKind | null;
} {
  const trimmed = label?.trim();
  if (!trimmed) return { promoCode: null, promoKind: null };

  const affiliateMatch = trimmed.match(/^(.+?)\s+\(affiliate\s+\d+% off\)/i);
  if (affiliateMatch) {
    return {
      promoCode: affiliateMatch[1]!.trim(),
      promoKind: "affiliate",
    };
  }

  const generalDiscountPctMatch = trimmed.match(
    /^(.+?)\s+\(General Discount (\d+)%\)$/i,
  );
  if (generalDiscountPctMatch) {
    return {
      promoCode: generalDiscountPctMatch[1]!.trim(),
      promoKind: "general",
    };
  }

  const generalDiscountMatch = trimmed.match(/^(.+?)\s+\(General Discount\)$/i);
  if (generalDiscountMatch) {
    return {
      promoCode: generalDiscountMatch[1]!.trim(),
      promoKind: "general",
    };
  }

  const generalMatch = trimmed.match(/^(.+?)\s+\(general\s+\d+% off\)/i);
  if (generalMatch) {
    return {
      promoCode: generalMatch[1]!.trim(),
      promoKind: "general",
    };
  }

  return { promoCode: null, promoKind: null };
}

/** Canonical checkout / receipt label, e.g. `SUMMER26 (General Discount 5%)`. */
export function normalizeBillingInvoiceDiscountLabel(input: {
  promoCode: string | null;
  promoKind: AdminInvoicePromoKind | null;
  discountLabel: string | null;
  percentOff: number | null;
}): string | null {
  const code = input.promoCode?.trim();
  const kind = input.promoKind;
  const pct =
    input.percentOff != null && input.percentOff > 0
      ? Math.round(input.percentOff)
      : null;

  if (code && kind && pct) {
    return buildCheckoutInvoiceCouponName({
      customerPromoCode: code,
      kind,
      percentOff: pct,
    });
  }

  if (code && kind) {
    return kind === "affiliate" ? `${code} (Affiliate)` : `${code} (General)`;
  }

  const label = input.discountLabel?.trim();
  if (!label) return null;

  const legacyGeneral = label.match(/^(.+?)\s+\(general\s+(\d+)% off\)$/i);
  if (legacyGeneral) {
    return buildCheckoutInvoiceCouponName({
      customerPromoCode: legacyGeneral[1]!.trim(),
      kind: "general",
      percentOff: Number(legacyGeneral[2]),
    });
  }

  if (/\(General Discount \d+%\)/i.test(label)) return label;
  if (/\(affiliate \d+% off\)/i.test(label)) return label;

  return label;
}

/** User-facing promo line on receipts, plan history, and billing inbox. */
export function formatUserInvoicePromoDisplay(input: {
  promoCode?: string | null;
  promoKind?: string | null;
  discountLabel?: string | null;
  percentOff?: number | null;
}): string | null {
  return normalizeBillingInvoiceDiscountLabel({
    promoCode: input.promoCode?.trim() || null,
    promoKind: normalizeAdminInvoicePromoKind(input.promoKind),
    discountLabel: input.discountLabel?.trim() || null,
    percentOff: input.percentOff ?? null,
  });
}

export function formatAdminInvoicePromoCell(input: {
  promoCode?: string | null;
  promoKind?: string | null;
  discountLabel?: string | null;
}): {
  code: string | null;
  kindLabel: string | null;
  detail: string | null;
} {
  let code = input.promoCode?.trim() || null;
  let kind = normalizeAdminInvoicePromoKind(input.promoKind);
  const label = input.discountLabel?.trim() || null;

  if (!code && label) {
    const parsed = parsePromoFromDiscountLabel(label);
    code = parsed.promoCode;
    kind = parsed.promoKind ?? kind;
  }

  const kindLabel =
    kind === "affiliate" ? "Affiliate" : kind === "general" ? "General" : null;

  let detail: string | null = label;
  if (code && label?.toLowerCase().startsWith(code.toLowerCase())) {
    detail = null;
  }
  if (code && !detail && label && !label.toLowerCase().includes(code.toLowerCase())) {
    detail = label;
  }

  return { code, kindLabel, detail };
}
