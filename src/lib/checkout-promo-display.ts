import type { PlanConfig } from "@/lib/plan-config-types";
import { buildCheckoutInvoiceCouponName } from "@/lib/affiliate-stripe-coupon";
import {
  formatUserInvoicePromoDisplay,
  normalizeAdminInvoicePromoKind,
} from "@/lib/admin-invoice-promo-display";
import { isGeneralDiscountEffectivelyActive } from "@/lib/plan-promo-window";
import type { CheckoutPromoDisplay } from "@/lib/checkout-promo-display-types";

export type { CheckoutPromoDisplay };

export function resolveCheckoutPromoDisplay(input: {
  sessionPromoCode: string | null | undefined;
  sessionPromoKind: string | null | undefined;
  plan: PlanConfig | undefined;
}): CheckoutPromoDisplay | null {
  const sessionKind = normalizeAdminInvoicePromoKind(input.sessionPromoKind);
  const sessionCode = input.sessionPromoCode?.trim() || null;

  if (sessionCode && sessionKind) {
    const percentOff =
      sessionKind === "affiliate"
        ? (input.plan?.affiliateDiscount?.active
            ? input.plan.affiliateDiscount.value
            : null)
        : input.plan?.discount?.active
          ? input.plan.discount.value
          : null;

    return {
      kind: sessionKind,
      code: sessionCode,
      percentOff,
      kindLabel:
        sessionKind === "affiliate"
          ? percentOff != null
            ? `Affiliate ${Math.round(percentOff)}% off`
            : "Affiliate discount"
          : percentOff != null
            ? `General Discount ${Math.round(percentOff)}%`
            : "General discount",
      receiptLine: formatUserInvoicePromoDisplay({
        promoCode: sessionCode,
        promoKind: sessionKind,
        percentOff,
      }),
    };
  }

  const plan = input.plan;
  if (
    plan &&
    isGeneralDiscountEffectivelyActive(plan) &&
    plan.discount?.stripeCouponId?.trim()
  ) {
    const code = plan.discount.stripeCouponId.trim();
    const percentOff = plan.discount.value > 0 ? plan.discount.value : null;
    return {
      kind: "general",
      code,
      percentOff,
      kindLabel:
        percentOff != null
          ? `General Discount ${Math.round(percentOff)}%`
          : "General discount",
      receiptLine:
        percentOff != null
          ? buildCheckoutInvoiceCouponName({
              customerPromoCode: code,
              kind: "general",
              percentOff,
            })
          : code,
    };
  }

  return null;
}
