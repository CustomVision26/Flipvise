import type { AccountDeletionProrationLedgerRow } from "@/db/queries/account-deletion-proration";
import { displayNameForBillingPlanSlug } from "@/lib/plan-slug-display";

export type SerializedDeletionProrationRow = {
  id: number;
  clerkUserId: string;
  userName: string;
  email: string | null;
  planLabel: string;
  deletedAt: string;
  subscriptionPeriodEnd: string | null;
  estimatedRefundCents: number;
  refundedCents: number | null;
  currency: string;
  refundStatus:
    | "auto_issued"
    | "auto_failed"
    | "pending_manual"
    | "manual_issued"
    | "not_applicable";
  stripeRefundId: string | null;
  receiptSentAt: string | null;
  refundError: string | null;
  needsRefund: boolean;
  needsReceipt: boolean;
};

export function serializeDeletionProrationRow(
  row: AccountDeletionProrationLedgerRow,
): SerializedDeletionProrationRow {
  const needsRefund =
    row.estimatedRefundCents > 0 &&
    (row.refundStatus === "pending_manual" || row.refundStatus === "auto_failed");
  const refundComplete =
    row.refundStatus === "auto_issued" || row.refundStatus === "manual_issued";

  return {
    id: row.id,
    clerkUserId: row.clerkUserId,
    userName: row.userDisplayName?.trim() || row.clerkUserId,
    email: row.userEmail,
    planLabel: displayNameForBillingPlanSlug(row.planSlug ?? "pro"),
    deletedAt: row.deletedAt.toISOString(),
    subscriptionPeriodEnd: row.subscriptionPeriodEnd?.toISOString() ?? null,
    estimatedRefundCents: row.estimatedRefundCents,
    refundedCents: row.refundedCents,
    currency: row.currency,
    refundStatus: row.refundStatus as SerializedDeletionProrationRow["refundStatus"],
    stripeRefundId: row.stripeRefundId,
    receiptSentAt: row.receiptSentAt?.toISOString() ?? null,
    refundError: row.refundError,
    needsRefund,
    needsReceipt: refundComplete && !row.receiptSentAt && Boolean(row.userEmail),
  };
}

export function serializeDeletionProrationRows(
  rows: AccountDeletionProrationLedgerRow[] | null | undefined,
): SerializedDeletionProrationRow[] {
  return (rows ?? []).map(serializeDeletionProrationRow);
}

export function countDeletionProrationOwedFromSerialized(
  rows: SerializedDeletionProrationRow[] | null | undefined,
): number {
  return (rows ?? []).filter((r) => r.needsRefund).length;
}
