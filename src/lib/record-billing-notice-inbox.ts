import {
  insertBillingNoticeInboxMessage,
  type BillingNoticeKind,
} from "@/db/queries/billing-notice-inbox";
import { displayNameForBillingPlanSlug } from "@/lib/plan-slug-display";

function formatLongDate(d: Date): string {
  return d.toLocaleDateString(undefined, { dateStyle: "long" });
}

function formatDateTime(d: Date): string {
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function noticeCopy(input: {
  noticeKind: BillingNoticeKind;
  planSlug: string;
  eventAt: Date;
}): { title: string; description: string; requiresAction: boolean } {
  const planLabel = displayNameForBillingPlanSlug(input.planSlug);
  const { noticeKind, eventAt } = input;

  switch (noticeKind) {
    case "trial_ending":
      return {
        title: `${planLabel} trial ending soon`,
        description:
          `Your free ${planLabel} trial ends on ${formatLongDate(eventAt)}. ` +
          `Subscribe before then to keep your features — otherwise your account returns to the Free plan. ` +
          `Open Pricing to compare plans or subscribe now.`,
        requiresAction: true,
      };
    case "trial_expired":
      return {
        title: `${planLabel} trial ended`,
        description:
          `Your free ${planLabel} trial has ended and your Flipvise account is now on the Free plan. ` +
          `You can subscribe at any time on the Pricing page to restore higher limits, AI features, and team workspaces.`,
        requiresAction: true,
      };
    case "payment_grace":
      return {
        title: "Payment failed — action required",
        description:
          `We could not renew your ${planLabel} subscription. ` +
          `You have until ${formatDateTime(eventAt)} to complete a successful payment before your account reverts to the Free plan. ` +
          `Open Pricing to update your billing or manage your subscription.`,
        requiresAction: true,
      };
    case "payment_grace_expired":
      return {
        title: "Subscription lapsed — choose a plan",
        description:
          `Your ${planLabel} renewal was not completed in time. Your account is on the Free plan. ` +
          `Open Pricing to subscribe again and restore paid features.`,
        requiresAction: true,
      };
  }
}

/** Persists a billing lifecycle notice to the user's dashboard inbox (idempotent per sub + kind). */
export async function recordBillingNoticeInboxMessage(input: {
  recipientUserId: string;
  noticeKind: BillingNoticeKind;
  stripeSubscriptionId: string;
  planSlug: string;
  eventAt: Date;
}): Promise<void> {
  const copy = noticeCopy({
    noticeKind: input.noticeKind,
    planSlug: input.planSlug,
    eventAt: input.eventAt,
  });

  await insertBillingNoticeInboxMessage({
    recipientUserId: input.recipientUserId,
    noticeKind: input.noticeKind,
    stripeSubscriptionId: input.stripeSubscriptionId,
    planSlug: input.planSlug,
    title: copy.title,
    description: copy.description,
    eventAt: input.eventAt,
    requiresAction: copy.requiresAction,
  });
}
