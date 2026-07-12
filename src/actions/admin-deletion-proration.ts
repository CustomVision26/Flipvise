"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/clerk-auth";
import { createClerkClient } from "@clerk/backend";
import {
  deletionProrationNeedsRefund,
  getAccountDeletionProrationLedgerById,
  markDeletionProrationManualRefund,
  markDeletionProrationReceiptSent,
} from "@/db/queries/account-deletion-proration";
import { issueManualProrationRefundForInvoice } from "@/lib/stripe-account-deletion";
import { sendDeletionProrationReceiptEmail } from "@/lib/loops";
import { formatCentsMoney } from "@/lib/money-math";
import { displayNameForBillingPlanSlug } from "@/lib/plan-slug-display";
import { isClerkPlatformAdminRole } from "@/lib/clerk-platform-admin-role";
import { isPlatformSuperadminAllowListed } from "@/lib/platform-superadmin";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const caller = await clerkClient.users.getUser(userId);
  const role = (caller.publicMetadata as { role?: string })?.role;
  if (!isClerkPlatformAdminRole(role) && !isPlatformSuperadminAllowListed(userId)) {
    throw new Error("Forbidden");
  }
  return { userId };
}

const ledgerIdSchema = z.object({
  ledgerId: z.number().int().positive(),
});

export async function adminIssueDeletionProrationRefundAction(
  data: z.infer<typeof ledgerIdSchema>,
): Promise<{ ok: true; stripeRefundId: string }> {
  const parsed = ledgerIdSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const { userId: adminUserId } = await requireAdmin();
  const row = await getAccountDeletionProrationLedgerById(parsed.data.ledgerId);
  if (!row) throw new Error("Ledger row not found.");
  if (!deletionProrationNeedsRefund(row)) {
    throw new Error("This row does not need a manual refund.");
  }
  if (!row.stripeInvoiceId) {
    throw new Error("No Stripe invoice on file — refund manually in Stripe Dashboard.");
  }

  const refund = await issueManualProrationRefundForInvoice(
    row.stripeInvoiceId,
    row.estimatedRefundCents,
  );

  await markDeletionProrationManualRefund(row.id, {
    adminUserId,
    stripeRefundId: refund.id,
    refundedCents: refund.amount ?? row.estimatedRefundCents,
  });

  revalidatePath("/admin/subscription-monitor");
  revalidatePath("/admin/subscription-deletion-proration");
  revalidatePath("/admin/subscription");

  return { ok: true, stripeRefundId: refund.id };
}

export async function adminSendDeletionProrationReceiptAction(
  data: z.infer<typeof ledgerIdSchema>,
): Promise<{ ok: true; sentVia: "loops" | "stripe_note" }> {
  const parsed = ledgerIdSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const { userId: adminUserId } = await requireAdmin();
  const row = await getAccountDeletionProrationLedgerById(parsed.data.ledgerId);
  if (!row) throw new Error("Ledger row not found.");

  const refundComplete =
    row.refundStatus === "auto_issued" || row.refundStatus === "manual_issued";
  if (!refundComplete) {
    throw new Error("Issue the refund before sending a receipt.");
  }
  if (!row.userEmail) {
    throw new Error("No email on file for this deleted user.");
  }
  if (row.receiptSentAt) {
    throw new Error("Receipt was already sent for this row.");
  }

  const refundCents = row.refundedCents ?? row.estimatedRefundCents;
  const result = await sendDeletionProrationReceiptEmail({
    recipientEmail: row.userEmail,
    userDisplayName: row.userDisplayName?.trim() || "Flipvise customer",
    planLabel: displayNameForBillingPlanSlug(row.planSlug ?? "pro"),
    refundAmount: formatCentsMoney(refundCents, row.currency),
    deletedAt: row.deletedAt.toLocaleDateString(undefined, { dateStyle: "long" }),
    stripeRefundId: row.stripeRefundId,
  });

  if (!result.sent) {
    throw new Error(
      result.reason ??
        "Could not send Flipvise receipt — Stripe may still email the customer if refund emails are enabled in Stripe Dashboard.",
    );
  }

  await markDeletionProrationReceiptSent(row.id, adminUserId);

  revalidatePath("/admin/subscription-monitor");
  revalidatePath("/admin/subscription-deletion-proration");
  revalidatePath("/admin/subscription");

  return { ok: true, sentVia: "loops" };
}
