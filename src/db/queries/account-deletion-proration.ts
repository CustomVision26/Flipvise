import { db } from "@/db";
import { accountDeletionProrationLedger } from "@/db/schema";
import { desc, eq, inArray } from "drizzle-orm";

export type DeletionProrationRefundStatus =
  | "auto_issued"
  | "auto_failed"
  | "pending_manual"
  | "manual_issued"
  | "not_applicable";

export type AccountDeletionProrationLedgerRow =
  typeof accountDeletionProrationLedger.$inferSelect;

export type InsertAccountDeletionProrationLedgerInput = {
  clerkUserId: string;
  userEmail?: string | null;
  userDisplayName?: string | null;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripeInvoiceId?: string | null;
  planSlug?: string | null;
  subscriptionPeriodEnd?: Date | null;
  deletedAt?: Date;
  estimatedRefundCents: number;
  refundedCents?: number | null;
  currency: string;
  refundStatus: DeletionProrationRefundStatus;
  stripeRefundId?: string | null;
  refundError?: string | null;
};

export async function insertAccountDeletionProrationLedger(
  input: InsertAccountDeletionProrationLedgerInput,
): Promise<AccountDeletionProrationLedgerRow | null> {
  const rows = await db
    .insert(accountDeletionProrationLedger)
    .values({
      clerkUserId: input.clerkUserId,
      userEmail: input.userEmail ?? null,
      userDisplayName: input.userDisplayName ?? null,
      stripeCustomerId: input.stripeCustomerId,
      stripeSubscriptionId: input.stripeSubscriptionId,
      stripeInvoiceId: input.stripeInvoiceId ?? null,
      planSlug: input.planSlug ?? null,
      subscriptionPeriodEnd: input.subscriptionPeriodEnd ?? null,
      deletedAt: input.deletedAt ?? new Date(),
      estimatedRefundCents: input.estimatedRefundCents,
      refundedCents: input.refundedCents ?? null,
      currency: input.currency,
      refundStatus: input.refundStatus,
      stripeRefundId: input.stripeRefundId ?? null,
      refundError: input.refundError ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoNothing({ target: accountDeletionProrationLedger.stripeSubscriptionId })
    .returning();

  return rows[0] ?? null;
}

export async function listLedgerStripeSubscriptionIds(): Promise<Set<string>> {
  try {
    const rows = await db
      .select({ stripeSubscriptionId: accountDeletionProrationLedger.stripeSubscriptionId })
      .from(accountDeletionProrationLedger);
    return new Set(rows.map((r) => r.stripeSubscriptionId));
  } catch {
    return new Set();
  }
}

export async function listAccountDeletionProrationLedgerForAdmin(): Promise<
  AccountDeletionProrationLedgerRow[]
> {
  try {
    return await db
      .select()
      .from(accountDeletionProrationLedger)
      .orderBy(desc(accountDeletionProrationLedger.deletedAt));
  } catch (error) {
    console.error("[account-deletion-proration] ledger read failed:", error);
    return [];
  }
}

export async function getAccountDeletionProrationLedgerById(
  id: number,
): Promise<AccountDeletionProrationLedgerRow | null> {
  const rows = await db
    .select()
    .from(accountDeletionProrationLedger)
    .where(eq(accountDeletionProrationLedger.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function markDeletionProrationReceiptSent(
  id: number,
  adminUserId: string,
): Promise<void> {
  await db
    .update(accountDeletionProrationLedger)
    .set({
      receiptSentAt: new Date(),
      receiptSentByAdminUserId: adminUserId,
      updatedAt: new Date(),
    })
    .where(eq(accountDeletionProrationLedger.id, id));
}

export async function markDeletionProrationManualRefund(
  id: number,
  input: {
    adminUserId: string;
    stripeRefundId: string;
    refundedCents: number;
  },
): Promise<void> {
  await db
    .update(accountDeletionProrationLedger)
    .set({
      refundStatus: "manual_issued",
      stripeRefundId: input.stripeRefundId,
      refundedCents: input.refundedCents,
      manualRefundByAdminUserId: input.adminUserId,
      refundError: null,
      updatedAt: new Date(),
    })
    .where(eq(accountDeletionProrationLedger.id, id));
}

export async function markDeletionProrationRefundFailed(
  id: number,
  errorMessage: string,
): Promise<void> {
  await db
    .update(accountDeletionProrationLedger)
    .set({
      refundStatus: "auto_failed",
      refundError: errorMessage,
      updatedAt: new Date(),
    })
    .where(eq(accountDeletionProrationLedger.id, id));
}

export function deletionProrationNeedsRefund(
  row: AccountDeletionProrationLedgerRow,
): boolean {
  if (row.estimatedRefundCents <= 0) return false;
  return row.refundStatus === "pending_manual" || row.refundStatus === "auto_failed";
}

export function countDeletionProrationOwed(
  rows: AccountDeletionProrationLedgerRow[],
): number {
  return rows.filter(deletionProrationNeedsRefund).length;
}

export async function getAccountDeletionProrationLedgerBySubscriptionId(
  stripeSubscriptionId: string,
): Promise<AccountDeletionProrationLedgerRow | null> {
  const rows = await db
    .select()
    .from(accountDeletionProrationLedger)
    .where(eq(accountDeletionProrationLedger.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);
  return rows[0] ?? null;
}

export async function listDeletionProrationLedgerByStatuses(
  statuses: DeletionProrationRefundStatus[],
): Promise<AccountDeletionProrationLedgerRow[]> {
  if (statuses.length === 0) return [];
  return db
    .select()
    .from(accountDeletionProrationLedger)
    .where(inArray(accountDeletionProrationLedger.refundStatus, statuses))
    .orderBy(desc(accountDeletionProrationLedger.deletedAt));
}
