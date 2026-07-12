import {
  insertAccountDeletionProrationLedger,
  type DeletionProrationRefundStatus,
} from "@/db/queries/account-deletion-proration";
import {
  cancelSubscriptionWithProratedRefund,
  type ProratedRefundResult,
} from "@/lib/stripe-account-deletion";

export type DeletedUserSnapshot = {
  email?: string | null;
  displayName?: string | null;
};

export type RecordDeletionProrationInput = {
  clerkUserId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  planSlug?: string | null;
  subscriptionPeriodEnd?: Date | null;
  userSnapshot?: DeletedUserSnapshot;
};

function mapRefundStatus(result: ProratedRefundResult): DeletionProrationRefundStatus {
  if (result.refundCents <= 0) return "not_applicable";
  if (result.refundStatus === "issued") return "auto_issued";
  if (result.refundStatus === "failed") return "auto_failed";
  return "pending_manual";
}

/**
 * Cancels Stripe subscription with prorated refund and writes an admin ledger row.
 * Idempotent per stripeSubscriptionId (duplicate inserts are ignored).
 */
export async function recordDeletionProrationAndCancel(
  input: RecordDeletionProrationInput,
): Promise<ProratedRefundResult> {
  const result = await cancelSubscriptionWithProratedRefund(input.stripeSubscriptionId);
  const refundStatus = mapRefundStatus(result);

  await insertAccountDeletionProrationLedger({
    clerkUserId: input.clerkUserId,
    userEmail: input.userSnapshot?.email ?? null,
    userDisplayName: input.userSnapshot?.displayName ?? null,
    stripeCustomerId: input.stripeCustomerId,
    stripeSubscriptionId: input.stripeSubscriptionId,
    stripeInvoiceId: result.stripeInvoiceId,
    planSlug: input.planSlug ?? result.planSlug,
    subscriptionPeriodEnd: input.subscriptionPeriodEnd ?? null,
    estimatedRefundCents: result.refundCents,
    refundedCents:
      refundStatus === "auto_issued" || refundStatus === "manual_issued"
        ? result.refundCents
        : null,
    currency: result.currency,
    refundStatus,
    stripeRefundId: result.stripeRefundId,
    refundError: result.refundError,
  });

  return result;
}
