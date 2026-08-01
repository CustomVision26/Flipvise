import { insertBillingNoticeInboxMessage } from "@/db/queries/billing-notice-inbox";
import { displayNameForBillingPlanSlug } from "@/lib/plan-slug-display";
import { notifyNativeInboxPush } from "@/lib/notify-native-inbox-push";

function formatDateTime(d: Date): string {
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** Inbox notice after scheduling add-on renewal cancel (base plan unchanged). */
export async function recordAddonRenewalCanceledInboxMessage(input: {
  recipientUserId: string;
  stripeSubscriptionId: string;
  addonKey: string;
  addonLabel: string;
  planSlug: string | null;
  periodEnd: Date;
}): Promise<void> {
  const planLabel = input.planSlug
    ? displayNameForBillingPlanSlug(input.planSlug)
    : "paid plan";
  const title = `${input.addonLabel} add-on renewal canceled`;
  const description =
    `Your ${input.addonLabel} add-on will not renew. You keep access until ${formatDateTime(input.periodEnd)}. ` +
    `Your ${planLabel} subscription is unchanged and will keep renewing on its normal schedule. ` +
    `No new Stripe charge is created for this cancellation — it only stops the next add-on renewal.`;

  await insertBillingNoticeInboxMessage({
    recipientUserId: input.recipientUserId,
    noticeKind: "addon_renewal_canceled",
    stripeSubscriptionId: input.stripeSubscriptionId,
    planSlug: `addon:${input.addonKey}`.slice(0, 64),
    title,
    description,
    eventAt: input.periodEnd,
    requiresAction: false,
  });

  notifyNativeInboxPush({
    recipientUserId: input.recipientUserId,
    category: "billing_notice",
    body: title,
  });
}

/** Inbox notice after scheduling base-plan renewal cancel. */
export async function recordPlanRenewalCanceledInboxMessage(input: {
  recipientUserId: string;
  stripeSubscriptionId: string;
  planSlug: string | null;
  periodEnd: Date;
  addonsAlsoCanceled: boolean;
}): Promise<void> {
  const planLabel = input.planSlug
    ? displayNameForBillingPlanSlug(input.planSlug)
    : "paid plan";
  const title = `${planLabel} renewal canceled`;
  const addonNote = input.addonsAlsoCanceled
    ? " Active Stripe add-ons will also stop renewing because they require a paid plan."
    : "";
  const description =
    `Your ${planLabel} plan will not renew. You keep access until ${formatDateTime(input.periodEnd)}.` +
    addonNote +
    ` No new Stripe charge is created for this cancellation — check the subscription in Stripe Billing (not Payments) for cancel-at-period-end.`;

  await insertBillingNoticeInboxMessage({
    recipientUserId: input.recipientUserId,
    noticeKind: "plan_renewal_canceled",
    stripeSubscriptionId: input.stripeSubscriptionId,
    planSlug: (input.planSlug ?? "paid").slice(0, 64),
    title,
    description,
    eventAt: input.periodEnd,
    requiresAction: false,
  });

  notifyNativeInboxPush({
    recipientUserId: input.recipientUserId,
    category: "billing_notice",
    body: title,
  });
}
