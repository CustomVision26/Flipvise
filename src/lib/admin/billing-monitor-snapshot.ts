import {
  formatPaymentGraceRemaining,
  isWithinPaymentGracePeriod,
  paymentGraceExpiresAt,
} from "@/lib/billing-grace-period";
import { displayNameForBillingPlanSlug } from "@/lib/plan-slug-display";
import type { listStripeSubscriptionsForAdmin } from "@/db/queries/stripe-subscriptions";
import type { listUserPlanTrialsForAdmin } from "@/db/queries/user-plan-trials";

type StripeRow = Awaited<ReturnType<typeof listStripeSubscriptionsForAdmin>>[number];
type TrialRow = Awaited<ReturnType<typeof listUserPlanTrialsForAdmin>>[number];

export type AdminBillingMonitorRow = {
  userId: string;
  userName: string;
  email: string | null;
  planLabel: string;
  category:
    | "active_trial"
    | "trial_ending_soon"
    | "trial_expired"
    | "subscription_expiring"
    | "payment_failed_grace"
    | "payment_failed_lapsed";
  status: string;
  eventAt: string;
  detail: string;
};

const TRIAL_ENDING_SOON_MS = 3 * 24 * 60 * 60 * 1000;
const SUBSCRIPTION_EXPIRING_SOON_MS = 7 * 24 * 60 * 60 * 1000;

export function buildAdminBillingMonitorRows(input: {
  stripeRows: StripeRow[];
  trialRows: TrialRow[];
  usersById: Map<
    string,
    { fullName: string; email: string | null }
  >;
  nowMs?: number;
}): AdminBillingMonitorRow[] {
  const { stripeRows, trialRows, usersById, nowMs = Date.now() } = input;
  const out: AdminBillingMonitorRow[] = [];
  const seen = new Set<string>();

  function pushRow(row: AdminBillingMonitorRow) {
    const dedupeKey = `${row.userId}:${row.category}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    out.push(row);
  }

  for (const sub of stripeRows) {
    const user = usersById.get(sub.userId);
    const userName = user?.fullName ?? sub.userId;
    const email = user?.email ?? null;
    const planLabel = displayNameForBillingPlanSlug(sub.planSlug ?? "pro");

    if (sub.status === "trialing") {
      const trialEnd = sub.trialEnd ?? sub.currentPeriodEnd;
      const trialStart = sub.createdAt;
      const detail = trialEnd
        ? `Trial started ${trialStart.toLocaleDateString(undefined, { dateStyle: "long" })} · ends ${trialEnd.toLocaleDateString(undefined, { dateStyle: "long" })} · first charge ${trialEnd.toLocaleDateString(undefined, { dateStyle: "long" })}`
        : "On trial";
      pushRow({
        userId: sub.userId,
        userName,
        email,
        planLabel,
        category: "active_trial",
        status: "trialing",
        eventAt: (trialEnd ?? sub.updatedAt).toISOString(),
        detail,
      });

      if (trialEnd && trialEnd.getTime() - nowMs <= TRIAL_ENDING_SOON_MS && trialEnd.getTime() > nowMs) {
        pushRow({
          userId: sub.userId,
          userName,
          email,
          planLabel,
          category: "trial_ending_soon",
          status: "trialing",
          eventAt: trialEnd.toISOString(),
          detail: `Trial ends in ${Math.ceil((trialEnd.getTime() - nowMs) / (24 * 60 * 60 * 1000))} day(s)`,
        });
      }
    }

    if (
      sub.status === "active" &&
      sub.currentPeriodEnd &&
      sub.currentPeriodEnd.getTime() - nowMs <= SUBSCRIPTION_EXPIRING_SOON_MS &&
      sub.currentPeriodEnd.getTime() > nowMs
    ) {
      pushRow({
        userId: sub.userId,
        userName,
        email,
        planLabel,
        category: "subscription_expiring",
        status: sub.status,
        eventAt: sub.currentPeriodEnd.toISOString(),
        detail: `Period ends ${sub.currentPeriodEnd.toLocaleDateString(undefined, { dateStyle: "long" })}`,
      });
    }

    if (sub.status === "past_due" && sub.paymentFailedAt) {
      if (isWithinPaymentGracePeriod(sub.paymentFailedAt, nowMs)) {
        const graceEnd = paymentGraceExpiresAt(sub.paymentFailedAt);
        pushRow({
          userId: sub.userId,
          userName,
          email,
          planLabel,
          category: "payment_failed_grace",
          status: "past_due",
          eventAt: graceEnd.toISOString(),
          detail: `${formatPaymentGraceRemaining(sub.paymentFailedAt, nowMs)} remaining to fix payment`,
        });
      } else {
        pushRow({
          userId: sub.userId,
          userName,
          email,
          planLabel,
          category: "payment_failed_lapsed",
          status: "past_due",
          eventAt: sub.paymentFailedAt.toISOString(),
          detail: "Grace period expired — account should be on Free",
        });
      }
    }
  }

  for (const trial of trialRows) {
    if (stripeRows.some((s) => s.userId === trial.userId && s.status === "trialing")) {
      continue;
    }
    const user = usersById.get(trial.userId);
    const endsAtMs = trial.trialEndsAt.getTime();
    const ended = endsAtMs <= nowMs;
    const endingSoon =
      !ended && endsAtMs - nowMs <= TRIAL_ENDING_SOON_MS;
    const category = ended
      ? "trial_expired"
      : endingSoon
        ? "trial_ending_soon"
        : "active_trial";
    const startLabel = trial.startedAt.toLocaleDateString(undefined, {
      dateStyle: "long",
    });
    const endLabel = trial.trialEndsAt.toLocaleDateString(undefined, {
      dateStyle: "long",
    });
    pushRow({
      userId: trial.userId,
      userName: user?.fullName ?? trial.userId,
      email: user?.email ?? null,
      planLabel: displayNameForBillingPlanSlug(trial.planSlug),
      category,
      status: "trial_record",
      eventAt: trial.trialEndsAt.toISOString(),
      detail: ended
        ? `Trial started ${startLabel} · ended ${endLabel}`
        : `Trial started ${startLabel} · ends ${endLabel} · first charge ${endLabel}`,
    });
  }

  return out.sort((a, b) => a.eventAt.localeCompare(b.eventAt));
}

export type AdminBillingMonitorUserGroup = {
  userId: string;
  userName: string;
  email: string | null;
  planLabel: string;
  incidents: AdminBillingMonitorRow[];
};

export function groupAdminBillingMonitorRowsByUser(
  rows: AdminBillingMonitorRow[],
): AdminBillingMonitorUserGroup[] {
  const groups = new Map<string, AdminBillingMonitorUserGroup>();
  for (const row of rows) {
    const existing = groups.get(row.userId);
    if (existing) {
      existing.incidents.push(row);
      continue;
    }
    groups.set(row.userId, {
      userId: row.userId,
      userName: row.userName,
      email: row.email,
      planLabel: row.planLabel,
      incidents: [row],
    });
  }
  return [...groups.values()];
}
