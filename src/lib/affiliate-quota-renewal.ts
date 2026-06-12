import { affiliates } from "@/db/schema";
import { db } from "@/db";
import { getAffiliateById } from "@/db/queries/affiliates";
import { eq } from "drizzle-orm";
import {
  affiliatePlanSlugToAssignment,
  applyAffiliatePlanToClerkUser,
} from "@/lib/affiliate-clerk-plan";

export type AffiliateQuotaEvaluationResult =
  | "not_applicable"
  | "unchanged"
  | "renewed"
  | "expired";

type AffiliateRow = NonNullable<Awaited<ReturnType<typeof getAffiliateById>>>;

function quotaPeriodStart(row: AffiliateRow): Date {
  return (
    row.quotaPeriodStartedAt ??
    row.inviteAcceptedAt ??
    row.startedAt
  );
}

function periodDurationMs(row: AffiliateRow, periodEndMs: number): number {
  const startMs = quotaPeriodStart(row).getTime();
  const duration = periodEndMs - startMs;
  if (!Number.isFinite(duration) || duration <= 0) {
    return 30 * 24 * 60 * 60 * 1000;
  }
  return duration;
}

async function clearAffiliateClerkGrant(row: AffiliateRow): Promise<void> {
  if (!row.invitedUserId) return;
  await applyAffiliatePlanToClerkUser(row.invitedUserId, "free");
}

async function restoreAffiliateClerkGrant(row: AffiliateRow): Promise<void> {
  if (!row.invitedUserId) return;
  const plan = affiliatePlanSlugToAssignment(row.planAssigned);
  if (!plan || plan === "free") return;
  await applyAffiliatePlanToClerkUser(row.invitedUserId, plan);
}

/**
 * At period end (`endsAt`): renew arrangement when quota met; otherwise leave expired
 * until an admin extends `endsAt` (Clerk grant cleared).
 */
export async function evaluateAffiliateQuotaRenewal(
  affiliateId: number,
): Promise<AffiliateQuotaEvaluationResult> {
  const row = await getAffiliateById(affiliateId);
  if (!row) return "not_applicable";
  if (row.status !== "active") return "not_applicable";
  if (!row.referralQuotaEnabled) return "not_applicable";

  const target = row.referralQuotaTarget ?? 0;
  if (target < 1) return "not_applicable";

  const now = Date.now();
  const periodEndMs = row.endsAt.getTime();
  if (now < periodEndMs) return "unchanged";

  const referrals = row.periodPaidReferrals ?? 0;

  if (referrals >= target) {
    const durationMs = periodDurationMs(row, periodEndMs);
    const newEndsAt = new Date(periodEndMs + durationMs);
    const newPeriodStart = new Date(periodEndMs);

    await db
      .update(affiliates)
      .set({
        endsAt: newEndsAt,
        periodPaidReferrals: 0,
        quotaPeriodStartedAt: newPeriodStart,
      })
      .where(eq(affiliates.id, affiliateId));

    const refreshed = await getAffiliateById(affiliateId);
    if (refreshed) {
      await restoreAffiliateClerkGrant(refreshed);
    }
    return "renewed";
  }

  await clearAffiliateClerkGrant(row);
  return "expired";
}

export async function evaluateAllActiveAffiliateQuotas(): Promise<void> {
  const rows = await db
    .select({ id: affiliates.id })
    .from(affiliates)
    .where(eq(affiliates.status, "active"));

  for (const { id } of rows) {
    try {
      await evaluateAffiliateQuotaRenewal(id);
    } catch (error) {
      console.error("[affiliate-quota] evaluate failed for", id, error);
    }
  }
}
