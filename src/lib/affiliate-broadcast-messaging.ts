import type { PlanConfig } from "@/components/pricing-content";
import { formatCombinedPromotionCode } from "@/lib/affiliate-promotional-code";

/** Paid plan with the admin “general discount” switch on and a redeemable coupon id. */
export function planHasGeneralDiscountActive(plan: PlanConfig): boolean {
  if (plan.id === "free") return false;
  const d = plan.discount;
  return !!(d?.active && d.value > 0 && d.stripeCouponId?.trim());
}

export function listPlansWithGeneralDiscount(plans: PlanConfig[]): PlanConfig[] {
  return plans.filter(planHasGeneralDiscountActive);
}

export function formatPlanNameList(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return `the ${names[0]} plan`;
  if (names.length === 2) return `the ${names[0]} and ${names[1]} plans`;
  const allButLast = names.slice(0, -1).join(", ");
  return `the ${allButLast}, and ${names[names.length - 1]} plans`;
}

function formatValidThrough(iso: string | null | undefined): string {
  if (!iso?.trim()) return "No expiry set";
  const d = new Date(`${iso.trim()}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
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
    return "Select at least one plan with an active general discount to generate a message.";
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
    : "No plans were selected for this broadcast.";
}

export function planHasAffiliateCombinedCode(plan: PlanConfig): boolean {
  const base = plan.discount?.stripeCouponId?.trim();
  const aff = plan.affiliateDiscount;
  return !!(base && aff?.active && aff.value > 0);
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
    if (!idSet.has(p.id) || !planHasGeneralDiscountActive(p)) continue;
    if (!planHasAffiliateCombinedCode(p)) {
      sections.push(
        `${p.name}\n  Combined code: not configured — turn on affiliate discount % for this plan.`,
      );
      continue;
    }

    const base = p.discount!.stripeCouponId.trim();
    const combined = formatCombinedPromotionCode(base, suffix);
    const affValue = Math.round(p.affiliateDiscount!.value);

    sections.push(
      [
        p.name,
        `  Combined code: ${combined}`,
        `  Affiliate discount: ${affValue}% off`,
        `  Valid through: ${formatValidThrough(p.discontinueAt)}`,
      ].join("\n"),
    );
  }

  return sections.length > 0
    ? sections.join("\n\n")
    : "No plans were selected for this broadcast.";
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
    if (!idSet.has(p.id) || !planHasGeneralDiscountActive(p)) continue;
    const base = p.discount?.stripeCouponId?.trim();
    const aff = p.affiliateDiscount;
    if (!base || !aff?.active || !(aff.value > 0)) continue;
    const combined = formatCombinedPromotionCode(base, suffix);
    lines.push(
      `${p.name}: combined code «${combined}» — ${aff.value}% off at checkout for this tier (affiliate rate).`,
    );
  }

  return lines.length > 0
    ? lines.join("\n")
    : "No affiliate checkout codes are available for the selected plans. Turn on affiliate discount % on those plans.";
}
