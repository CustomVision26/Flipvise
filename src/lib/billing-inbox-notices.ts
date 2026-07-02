import type { UnifiedInboxItem, BillingNoticePayload } from "@/lib/inbox-item-types";
import type { listBillingNoticeInboxMessagesForUser } from "@/db/queries/billing-notice-inbox";

export type BillingNoticeStripeRow = {
  status: string;
  planSlug: string | null;
  trialEnd: Date | null;
  currentPeriodEnd: Date | null;
  paymentFailedAt: Date | null;
};

type BillingNoticeRow = Awaited<
  ReturnType<typeof listBillingNoticeInboxMessagesForUser>
>[number];

/** Maps persisted billing notice rows to unified inbox items. */
export function billingNoticeRowsToInboxItems(
  rows: BillingNoticeRow[],
  readSet: Set<string>,
): UnifiedInboxItem[] {
  return rows.map((row) => {
    const itemId = String(row.id);
    const key = `billing_notice:${itemId}`;
    return {
      type: "billing_notice",
      key,
      title: row.title,
      description: row.description,
      dateIso: row.eventAt.toISOString(),
      isRead: readSet.has(key),
      requiresAction: row.requiresAction,
      payload: {
        kind: row.noticeKind as BillingNoticePayload["kind"],
        planSlug: row.planSlug,
        eventAtIso: row.eventAt.toISOString(),
      },
    };
  });
}
