import type { StripePaidPlanId } from "@/lib/billing-plan-ids";
import { canonicalTeamPlanId } from "@/lib/team-plans";

/** Stripe PDF / line-item product names (longest match first). */
const LINE_DESCRIPTION_PLAN_TITLES: { pattern: RegExp; title: string }[] = [
  { pattern: /\bPro Plus Team Basic\b/i, title: "Pro Plus Team Basic" },
  { pattern: /\bPro Plus Team Gold\b/i, title: "Pro Plus Team Gold" },
  { pattern: /\bPro Plus Platinum\b/i, title: "Pro Plus Platinum" },
  { pattern: /\bPro Plus Enterprise\b/i, title: "Pro Plus Enterprise" },
  { pattern: /\bPro Team Basic\b/i, title: "Pro Team Basic" },
  { pattern: /\bPro Team Gold\b/i, title: "Pro Team Gold" },
  { pattern: /\bPro Platinum\b/i, title: "Pro Platinum" },
  { pattern: /\bPro Enterprise\b/i, title: "Pro Enterprise" },
  { pattern: /\bPro Plus\b/i, title: "Pro Plus" },
  { pattern: /\bPro\b/i, title: "Pro" },
];

/** Matches Stripe product names on PDF receipts (legacy + current slugs). */
const RECEIPT_TITLE_BY_SLUG: Record<string, string> = {
  pro: "Pro",
  pro_plus: "Pro Plus",
  pro_plus_team_basic: "Pro Plus Team Basic",
  pro_plus_team_gold: "Pro Team Gold",
  pro_plus_platinum_plan: "Pro Platinum",
  pro_plus_enterprise: "Pro Enterprise",
  pro_team_basic: "Pro Team Basic",
  pro_team_gold: "Pro Team Gold",
  pro_platinum_plan: "Pro Platinum",
  pro_enterprise: "Pro Enterprise",
};

const LINE_DESCRIPTION_TO_SLUG: { pattern: RegExp; slug: StripePaidPlanId }[] = [
  { pattern: /\bPro Plus Team Basic\b/i, slug: "pro_plus_team_basic" },
  { pattern: /\bPro Plus Team Gold\b/i, slug: "pro_plus_team_gold" },
  { pattern: /\bPro Plus Platinum\b/i, slug: "pro_plus_platinum_plan" },
  { pattern: /\bPro Plus Enterprise\b/i, slug: "pro_plus_enterprise" },
  { pattern: /\bPro Team Basic\b/i, slug: "pro_plus_team_basic" },
  { pattern: /\bPro Team Gold\b/i, slug: "pro_plus_team_gold" },
  { pattern: /\bPro Platinum\b/i, slug: "pro_plus_platinum_plan" },
  { pattern: /\bPro Enterprise\b/i, slug: "pro_plus_enterprise" },
  { pattern: /\bPro Plus\b/i, slug: "pro_plus" },
  { pattern: /\bPro\b/i, slug: "pro" },
];

export function planTitleFromStripeLineDescription(
  description: string | null | undefined,
): string | null {
  if (!description?.trim()) return null;
  for (const { pattern, title } of LINE_DESCRIPTION_PLAN_TITLES) {
    if (pattern.test(description)) return title;
  }
  return null;
}

export function planTitleFromStripeLineDescriptions(
  descriptions: (string | null | undefined)[],
): string | null {
  for (const desc of descriptions) {
    const title = planTitleFromStripeLineDescription(desc);
    if (title) return title;
  }
  return null;
}

export function planSlugFromStripeLineDescription(
  description: string | null | undefined,
): StripePaidPlanId | null {
  if (!description?.trim()) return null;
  for (const { pattern, slug } of LINE_DESCRIPTION_TO_SLUG) {
    if (pattern.test(description)) return slug;
  }
  return null;
}

/** Title shown on Stripe receipts for a stored billing plan slug. */
export function receiptPlanTitleForSlug(
  planSlug: string | null | undefined,
): string {
  if (!planSlug?.trim() || planSlug === "free") return "Subscription";
  const canonical = canonicalTeamPlanId(planSlug.trim());
  const key = canonical ?? planSlug.trim();
  return RECEIPT_TITLE_BY_SLUG[key] ?? RECEIPT_TITLE_BY_SLUG[planSlug.trim()] ?? planSlug;
}

/** Prefer Stripe line wording (matches PDF), then slug-based receipt title. */
export function receiptPlanTitle(
  planSlug: string | null | undefined,
  lineDescriptions?: (string | null | undefined)[],
): string {
  if (lineDescriptions?.length) {
    const fromLines = planTitleFromStripeLineDescriptions(lineDescriptions);
    if (fromLines) return fromLines;
  }
  return receiptPlanTitleForSlug(planSlug);
}
