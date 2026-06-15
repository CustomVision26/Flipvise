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
    return `The ${trimmedSubject} promotion is now available for ${planPhrase}. To apply your discount, enter the appropriate promotion code on the Pricing page before checkout. Eligible plans, codes, and savings rates are provided below.`;
  }

  return `A limited-time promotion is now available for ${planPhrase}. To apply your discount, enter the appropriate promotion code on the Pricing page before checkout. Eligible plans, codes, and savings rates are provided below.`;
}

export function buildAffiliateCodesAutoMessage(subject: string, selectedPlans: PlanConfig[]): string {
  const names = selectedPlans.map((p) => p.name);
  const planPhrase = formatPlanNameList(names);
  const trimmedSubject = subject.trim();

  if (!planPhrase) {
    return "Select at least one plan with general discount and affiliate discount turned on.";
  }

  if (trimmedSubject) {
    return `${trimmedSubject}: combined checkout codes for ${planPhrase} are listed below. Please share the code that corresponds to the customer's selected plan on the Pricing page prior to checkout. These codes remain available in your Affiliate dashboard at any time.`;
  }

  return `Combined checkout codes for ${planPhrase} are listed below. Please share the code that corresponds to the customer's selected plan on the Pricing page prior to checkout. These codes remain available in your Affiliate dashboard at any time.`;
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
    lines.push(`· ${p.name} — Code: ${base} · ${pct} off`);
  }

  return lines.length > 0 ? lines.join("\n") : "No eligible plans were selected for this broadcast.";
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
        `· ${p.name}`,
        `  Code: ${combined}`,
        `  Discount: ${affValue}% off`,
        `  Valid through: ${formatPromoDateTimeLabel(resolvePlanPromoWindow(p).endsAt)}`,
      ].join("\n"),
    );
  }

  return sections.length > 0 ? sections.join("\n\n") : "No eligible plans were selected for this broadcast.";
}

const LEGACY_GENERAL_MESSAGE_WITH_SUBJECT =
  /^This promotion, "([^"]+)", applies to (.+)\. Enter the promo code on the pricing page before checkout to receive the discount\.?$/i;

const LEGACY_GENERAL_MESSAGE_NO_SUBJECT =
  /^This promotion applies to (.+)\. Enter the promo code on the pricing page before checkout to receive the discount\.?$/i;

const LEGACY_GENERAL_DETAIL_LINE =
  /^(.+?) \([^)]+\): use «([^»]+)» on the pricing page before checkout — ([\d$%]+ off)(?: \([^)]+\))?\.?$/i;

const LEGACY_AFFILIATE_MESSAGE_WITH_SUBJECT =
  /^"([^"]+)" — your combined checkout codes for (.+) are listed below\./i;

/** Refine legacy inbox copy at display time (stored rows are unchanged). */
export function normalizeBroadcastMessageForDisplay(
  messageBody: string,
  variant: "general" | "codes",
): string {
  const body = messageBody.trim();
  if (!body) return body;

  if (variant === "general") {
    const withSubject = body.match(LEGACY_GENERAL_MESSAGE_WITH_SUBJECT);
    if (withSubject) {
      return `The ${withSubject[1]!.trim()} promotion is now available for ${withSubject[2]!.trim()}. To apply your discount, enter the appropriate promotion code on the Pricing page before checkout. Eligible plans, codes, and savings rates are provided below.`;
    }
    const noSubject = body.match(LEGACY_GENERAL_MESSAGE_NO_SUBJECT);
    if (noSubject) {
      return `A limited-time promotion is now available for ${noSubject[1]}. To apply your discount, enter the appropriate promotion code on the Pricing page before checkout. Eligible plans, codes, and savings rates are provided below.`;
    }
  }

  if (variant === "codes" && LEGACY_AFFILIATE_MESSAGE_WITH_SUBJECT.test(body)) {
    return body
      .replace(
        /Share these codes with customers on the pricing page before they subscribe\./i,
        "Please share the code that corresponds to the customer's selected plan on the Pricing page prior to checkout.",
      )
      .replace(
        /You can also copy them anytime from your Affiliate dashboard\./i,
        "These codes remain available in your Affiliate dashboard at any time.",
      );
  }

  return body;
}

/** Neaten legacy reference blocks for inbox display. */
export function normalizeBroadcastDetailsForDisplay(
  detailsBlock: string,
  variant: "general" | "codes",
): string {
  const raw = detailsBlock.trim();
  if (!raw) return raw;

  if (
    raw.includes("Eligible plans and promotion codes") ||
    raw.includes("Eligible plans and codes") ||
    raw.includes("Your promotion codes by plan") ||
    raw.includes("Your promotion codes")
  ) {
    return raw
      .replace(/^Eligible plans and codes$/m, "Eligible plans and promotion codes")
      .replace(/^Your promotion codes$/m, "Your promotion codes by plan");
  }

  if (variant === "general") {
    const converted: string[] = [];
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || /^Public promotions/i.test(trimmed)) continue;

      const legacy = trimmed.match(LEGACY_GENERAL_DETAIL_LINE);
      if (legacy) {
        converted.push(`· ${legacy[1]!.trim()} — Code: ${legacy[2]!.trim()} · ${legacy[3]!.trim()}`);
        continue;
      }

      if (trimmed.startsWith("·")) {
        converted.push(trimmed);
        continue;
      }

      const modern = trimmed.match(/^(.+?) — Code: (.+?) · (.+ off)$/i);
      if (modern) {
        converted.push(`· ${modern[1]!.trim()} — Code: ${modern[2]!.trim()} · ${modern[3]!.trim()}`);
        continue;
      }

      converted.push(trimmed);
    }

    if (converted.length > 0) {
      return converted.join("\n");
    }
  }

  return raw;
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
