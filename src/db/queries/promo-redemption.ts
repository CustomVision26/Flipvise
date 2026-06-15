import { and, eq, isNotNull, or } from "drizzle-orm";
import { db } from "@/db";
import { billingInvoices } from "@/db/schema";
import { getActiveStripeSubscription } from "@/db/queries/stripe-subscriptions";
import { stripe } from "@/lib/stripe";
import { promoCodeFromStoredFields } from "@/lib/promo-redemption";

function isRecoverableReadError(error: unknown): boolean {
  const msg = String(error).toLowerCase();
  return (
    msg.includes("does not exist") ||
    msg.includes("42p01") ||
    msg.includes("billing_invoices")
  );
}

/** Promo codes this user has already redeemed on a paid subscription invoice. */
export async function listPromoCodesUsedByUser(userId: string): Promise<string[]> {
  const codes = new Set<string>();

  try {
    const rows = await db
      .select({
        promoCode: billingInvoices.promoCode,
        discountLabel: billingInvoices.discountLabel,
        status: billingInvoices.status,
      })
      .from(billingInvoices)
      .where(
        and(
          eq(billingInvoices.userId, userId),
          or(
            isNotNull(billingInvoices.promoCode),
            isNotNull(billingInvoices.discountLabel),
          ),
        ),
      );

    for (const row of rows) {
      if (row.status?.toLowerCase() !== "paid") continue;
      const code = promoCodeFromStoredFields({
        promoCode: row.promoCode,
        discountLabel: row.discountLabel,
      });
      if (code) codes.add(code);
    }
  } catch (error) {
    if (!isRecoverableReadError(error)) throw error;
  }

  try {
    const subRow = await getActiveStripeSubscription(userId);
    if (subRow?.stripeSubscriptionId) {
      const sub = await stripe.subscriptions.retrieve(subRow.stripeSubscriptionId);
      const metaCode =
        typeof sub.metadata?.promoCode === "string"
          ? sub.metadata.promoCode.trim()
          : "";
      if (metaCode) codes.add(metaCode);
    }
  } catch {
    // Best-effort — invoice rows are the primary source of truth.
  }

  return [...codes];
}
