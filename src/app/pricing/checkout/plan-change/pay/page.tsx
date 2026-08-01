import { redirect } from "next/navigation";
import { auth } from "@/lib/clerk-auth";
import {
  PlanChangeCheckoutPayment,
  type PlanChangeCheckoutSummary,
} from "@/components/plan-change-checkout-payment";
import { createPlanChangeSetupIntentAction } from "@/actions/plan-change-checkout";
import { isStripePaidPlanId } from "@/lib/billing-plan-ids";
import { getClerkUserFieldDisplayById } from "@/lib/clerk-user-display";
import { parsePricingBillingPeriod } from "@/lib/pricing-billing-period";
import {
  EMPTY_PLAN_CHANGE_PRORATION_PREVIEW,
  fetchPlanChangeProrationPreview,
  resolvePlanChangeCheckoutContext,
} from "@/lib/plan-change-proration-preview";
import { resolvePlanChangeSelectedAddonLine } from "@/lib/plan-change-locked-addons";
import { toClientJson } from "@/lib/to-client-json";

export const dynamic = "force-dynamic";

interface PlanChangePayPageProps {
  searchParams: Promise<{ plan?: string; period?: string; addon?: string }>;
}

export default async function PlanChangeCheckoutPayPage({
  searchParams,
}: PlanChangePayPageProps) {
  const {
    plan: planParam,
    period: periodParam,
    addon: addonParam,
  } = await searchParams;

  const { userId } = await auth();
  if (!userId) redirect("/");

  const planId = planParam?.trim() ?? "";
  const period = parsePricingBillingPeriod(periodParam);
  if (!isStripePaidPlanId(planId)) {
    redirect("/pricing/checkout");
  }

  const context = await resolvePlanChangeCheckoutContext(userId, planId);
  if (!context) {
    redirect(
      `/pricing/checkout?plan=${encodeURIComponent(planId)}&period=${period}`,
    );
  }

  const previewResult = await fetchPlanChangeProrationPreview({
    userId,
    planSlug: planId,
    period,
  });
  const previewEstimated = previewResult == null;
  const preview = previewResult ?? EMPTY_PLAN_CHANGE_PRORATION_PREVIEW;

  const pendingAddonKey = addonParam?.trim() || "";

  let setupPayload: { clientSecret: string; returnUrl: string };
  try {
    setupPayload = await createPlanChangeSetupIntentAction({
      plan: planId,
      period,
      ...(pendingAddonKey ? { addonKey: pendingAddonKey } : {}),
    });
  } catch {
    redirect(`/pricing/checkout?plan=${encodeURIComponent(planId)}&period=${period}`);
  }

  const backParams = new URLSearchParams({ plan: planId, period });
  if (pendingAddonKey) backParams.set("addon", pendingAddonKey);
  const backHref = `/pricing/checkout?${backParams.toString()}`;

  const { primaryEmail } = await getClerkUserFieldDisplayById(userId);
  const customerEmail = primaryEmail?.trim().toLowerCase() ?? null;

  const selectedAddon = pendingAddonKey
    ? await resolvePlanChangeSelectedAddonLine({
        userId,
        addonKey: pendingAddonKey,
        period,
      })
    : null;

  const summary: PlanChangeCheckoutSummary = {
    context,
    period,
    customerEmail,
    preview,
    previewEstimated,
    selectedAddon,
  };

  return (
    <PlanChangeCheckoutPayment
      clientSecret={setupPayload.clientSecret}
      returnUrl={setupPayload.returnUrl}
      summary={toClientJson(summary)}
      backHref={backHref}
    />
  );
}
