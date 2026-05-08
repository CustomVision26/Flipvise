import type { AccessContext } from "@/lib/access";
import { isStripePaidPlanId, type StripePaidPlanId } from "@/lib/billing-plan-ids";

export type PricingPageHighlightId = "free" | StripePaidPlanId | null;

/**
 * Which plan card should show “Current plan” on `/pricing`.
 *
 * - `null`: signed-out visitor, or admin / complimentary unlock where we avoid a misleading badge.
 * - `"free"`: authenticated user on the free tier.
 * - Paid slug: team tier or personal `pro` / `pro_plus` from Stripe DB + JWT fallbacks.
 */
export function resolvePricingPageHighlightId(
  ctx: AccessContext,
  activeStripeSubscriptionPlanSlug: string | null | undefined,
): PricingPageHighlightId {
  if (!ctx.userId) return null;

  const unlocked = ctx.isAdmin || ctx.adminGranted;
  if (unlocked) return null;

  if (ctx.activeTeamPlan !== null) return ctx.activeTeamPlan;

  const fromStripeRow =
    typeof activeStripeSubscriptionPlanSlug === "string"
      ? activeStripeSubscriptionPlanSlug.trim()
      : "";
  if (fromStripeRow && isStripePaidPlanId(fromStripeRow)) return fromStripeRow;

  if (!ctx.isPro) return "free";

  if (ctx.hasClerkPersonalProPlus) return "pro_plus";
  if (ctx.hasClerkPersonalPro) return "pro";

  return "pro";
}
