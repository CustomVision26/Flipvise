import type { PlanConfig } from "@/components/pricing-content";
import { formatCombinedPromotionCode } from "@/lib/affiliate-promotional-code";
import {
  formatPromoDateTimeLabel,
  isAffiliateDiscountEffectivelyActive,
  isGeneralDiscountEffectivelyActive,
  resolvePlanPromoWindow,
} from "@/lib/plan-promo-window";

/** Paid plan with general discount effectively active (schedule + switch + coupon). */
export function planHasGeneralDiscountActive(plan: PlanConfig): boolean {
  return isGeneralDiscountEffectivelyActive(plan);
}

export function listPlansWithGeneralDiscount(plans: PlanConfig[]): PlanConfig[] {
  return plans.filter(planHasGeneralDiscountActive);
}

/** General discount on + affiliate discount on + Stripe coupon id — required for affiliate code broadcasts. */
export function planHasAffiliateCombinedCode(plan: PlanConfig): boolean {
  return isAffiliateDiscountEffectivelyActive(plan);
}

export function listPlansEligibleForAffiliateCodeBroadcast(plans: PlanConfig[]): PlanConfig[] {
  return plans.filter(planHasAffiliateCombinedCode);
}

export function formatPlanNameList(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return `the ${names[0]} plan`;
  if (names.length === 2) return `the ${names[0]} and ${names[1]} plans`;
  const allButLast = names.slice(0, -1).join(", ");
  return `the ${allButLast}, and ${names[names.length - 1]} plans`;
}

function discountPercentLabel(plan: PlanConfig): string {
  const d = plan.discount!;
  return d.type === "percentage" ? `${d.value}%` : `$${d.value}`;
}

export function buildGeneralPromoAutoMessage(subject: string, selectedPlans: PlanConfig[]): string {
  const names = selectedPlans.map((p) => p.name);
  const planPhrase = formatPlanNameList(names);
  const trimmedSubject = subject.trim();

  if (!planPhrase) {
    return "Select at least one plan with an active general discount to generate a message.";
  }

  if (trimmedSubject) {
    return `This promotion, "${trimmedSubject}", applies to ${planPhrase}. Enter the promo code on the pricing page before checkout to receive the discount.`;
  }

  return `This promotion applies to ${planPhrase}. Enter the promo code on the pricing page before checkout to receive the discount.`;
}

export function buildAffiliateCodesAutoMessage(subject: string, selectedPlans: PlanConfig[]): string {
  const names = selectedPlans.map((p) => p.name);
  const planPhrase = formatPlanNameList(names);
  const trimmedSubject = subject.trim();

  if (!planPhrase) {
    return "Select at least one plan with general discount and affiliate discount turned on.";
  }

  if (trimmedSubject) {
    return `"${trimmedSubject}" — your combined checkout codes for ${planPhrase} are listed below. Share these codes with customers on the pricing page before they subscribe. You can also copy them anytime from your Affiliate dashboard.`;
  }

  return `Your combined checkout codes for ${planPhrase} are listed below. Share these codes with customers on the pricing page before they subscribe. You can also copy them anytime from your Affiliate dashboard.`;
}

export function buildGeneralPromoDetailsBlock(
  plans: PlanConfig[],
  selectedPlanIds: string[],
): string {
  const idSet = new Set(selectedPlanIds);
  const lines: string[] = [];

  for (const p of plans) {
    if (!idSet.has(p.id) || !planHasGeneralDiscountActive(p)) continue;
    const d = p.discount!;
    const base = d.stripeCouponId.trim();
    const pct = discountPercentLabel(p);
    lines.push(
      `${p.name} (${p.id}): use «${base}» on the pricing page before checkout — ${pct} off${d.label?.trim() ? ` (${d.label.trim()})` : ""}.`,
    );
  }

  return lines.length > 0
    ? lines.join("\n")
    : "No eligible plans were selected for this broadcast.";
}

/** Matches the affiliate portal “Promotion codes” table for inbox reference blocks. */
export function buildAffiliateCombinedDetailsBlock(
  plans: PlanConfig[],
  promotionalCode: string,
  selectedPlanIds: string[],
): string {
  const idSet = new Set(selectedPlanIds);
  const suffix = promotionalCode.trim().toLowerCase();
  const sections: string[] = [];

  for (const p of plans) {
    if (!idSet.has(p.id) || !planHasAffiliateCombinedCode(p)) continue;

    const base = p.discount!.stripeCouponId.trim();
    const combined = formatCombinedPromotionCode(base, suffix);
    const affValue = Math.round(p.affiliateDiscount!.value);

    sections.push(
      [
        p.name,
        `  Combined code: ${combined}`,
        `  Affiliate discount: ${affValue}% off`,
        `  Valid through: ${formatPromoDateTimeLabel(resolvePlanPromoWindow(p).endsAt)}`,
      ].join("\n"),
    );
  }

  return sections.length > 0
    ? sections.join("\n\n")
    : "No eligible plans were selected for this broadcast.";
}

/** Legacy single-line hints (kept for any callers that still need compact text). */
export function buildAffiliateCombinedHints(
  plans: PlanConfig[],
  promotionalCode: string,
  selectedPlanIds: string[],
): string {
  const idSet = new Set(selectedPlanIds);
  const suffix = promotionalCode.trim().toLowerCase();
  const lines: string[] = [];

  for (const p of plans) {
    if (!idSet.has(p.id) || !planHasAffiliateCombinedCode(p)) continue;
    const base = p.discount!.stripeCouponId.trim();
    const combined = formatCombinedPromotionCode(base, suffix);
    lines.push(
      `${p.name}: combined code «${combined}» — ${p.affiliateDiscount!.value}% off at checkout for this tier (affiliate rate).`,
    );
  }

  return lines.length > 0
    ? lines.join("\n")
    : "No affiliate checkout codes are available. Turn on general discount and affiliate discount on the selected plans.";
}
