import { redirect } from "next/navigation";
import { getAccessContext } from "@/lib/access";
import { getActiveAffiliateForUser } from "@/db/queries/affiliates";
import { readPlansConfig } from "@/lib/admin/read-plans-config";
import {
  buildActiveAffiliateCombinedPromoRows,
  buildExpiredAffiliateCombinedPromoRows,
  groupExpiredAffiliatePromosByLabel,
} from "@/lib/affiliate-portal-combined-codes";
import { displayNameForBillingPlanSlug } from "@/lib/plan-slug-display";
import { AffiliatePortalView } from "@/components/affiliate-portal-view";

function formatPortalDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function AffiliatePortalPage() {
  const ctx = await getAccessContext();
  if (!ctx.userId) redirect("/");

  const affiliate = await getActiveAffiliateForUser(
    ctx.userId,
    ctx.primaryEmail?.toLowerCase() ?? null,
  );
  if (!affiliate) redirect("/dashboard");

  const plans = await readPlansConfig();
  const activePromos = buildActiveAffiliateCombinedPromoRows(
    plans,
    affiliate.promotionalCode,
  );
  const expiredPromoHistory = groupExpiredAffiliatePromosByLabel(
    buildExpiredAffiliateCombinedPromoRows(plans, affiliate.promotionalCode),
  );

  const monthKey = new Date().toISOString().slice(0, 7);
  const paidReferralsThisMonth =
    affiliate.paidReferralsMonthKey === monthKey
      ? (affiliate.paidReferralsMonth ?? 0)
      : 0;
  const monthLabel = new Date().toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const startedAt = affiliate.inviteAcceptedAt ?? affiliate.startedAt;

  return (
    <AffiliatePortalView
      data={{
        affiliateName: affiliate.affiliateName,
        promotionalCodeSuffix: affiliate.promotionalCode,
        planAssignedLabel: displayNameForBillingPlanSlug(affiliate.planAssigned),
        startedAtLabel: formatPortalDate(startedAt),
        endsAtLabel: formatPortalDate(affiliate.endsAt),
        paidReferralsTotal: affiliate.paidReferralsTotal ?? 0,
        paidReferralsThisMonth,
        monthLabel,
        combinedPromos: activePromos,
        expiredPromoHistory,
        referralQuotaEnabled: affiliate.referralQuotaEnabled ?? false,
        periodPaidReferrals: affiliate.periodPaidReferrals ?? 0,
        referralQuotaTarget: affiliate.referralQuotaTarget ?? null,
      }}
    />
  );
}
