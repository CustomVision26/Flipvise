import { db } from "@/db";
import { billingInvoices, billingProrationLines } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export type ProrationLineWithReceipt = {
  id: number;
  userId: string;
  stripeInvoiceId: string;
  stripeLineId: string;
  amountCents: number | null;
  currency: string | null;
  description: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  createdAt: Date;
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
  invoiceStatus: string | null;
};

function isMissingProrationTableError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current && typeof current === "object"; depth++) {
    const obj = current as Record<string, unknown>;
    if (obj.code === "42P01") return true;
    const message = typeof obj.message === "string" ? obj.message : "";
    if (
      /billing_proration_lines/i.test(message) &&
      /(does not exist|undefined table|relation .* does not exist)/i.test(message)
    ) {
      return true;
    }
    current = obj.cause;
  }
  const flat = String(error);
  return /42P01/i.test(flat) && /billing_proration_lines/i.test(flat);
}

/**
 * Replaces proration line rows for one Stripe invoice (webhook sync).
 * Deletes previous rows for the invoice, then inserts the current snapshot.
 */
export async function replaceProrationLinesForStripeInvoice(input: {
  userId: string;
  stripeInvoiceId: string;
  lines: Array<{
    stripeLineId: string;
    amountCents: number | null;
    currency: string | null;
    description: string | null;
    periodStart: Date | null;
    periodEnd: Date | null;
  }>;
}) {
  try {
    await db
      .delete(billingProrationLines)
      .where(eq(billingProrationLines.stripeInvoiceId, input.stripeInvoiceId));

    for (const line of input.lines) {
      await db.insert(billingProrationLines).values({
        userId: input.userId,
        stripeInvoiceId: input.stripeInvoiceId,
        stripeLineId: line.stripeLineId,
        amountCents: line.amountCents ?? null,
        currency: line.currency ?? null,
        description: line.description ?? null,
        periodStart: line.periodStart ?? null,
        periodEnd: line.periodEnd ?? null,
      });
    }
  } catch (error) {
    if (isMissingProrationTableError(error)) return;
    throw error;
  }
}

/**
 * Proration lines for plan history, with joined Stripe invoice receipt URLs.
 */
export async function listProrationLinesWithReceiptForUser(
  userId: string,
): Promise<ProrationLineWithReceipt[]> {
  try {
    const rows = await db
      .select({
        id: billingProrationLines.id,
        userId: billingProrationLines.userId,
        stripeInvoiceId: billingProrationLines.stripeInvoiceId,
        stripeLineId: billingProrationLines.stripeLineId,
        amountCents: billingProrationLines.amountCents,
        currency: billingProrationLines.currency,
        description: billingProrationLines.description,
        periodStart: billingProrationLines.periodStart,
        periodEnd: billingProrationLines.periodEnd,
        createdAt: billingProrationLines.createdAt,
        hostedInvoiceUrl: billingInvoices.hostedInvoiceUrl,
        invoicePdfUrl: billingInvoices.invoicePdfUrl,
        invoiceStatus: billingInvoices.status,
      })
      .from(billingProrationLines)
      .leftJoin(
        billingInvoices,
        eq(billingInvoices.externalId, billingProrationLines.stripeInvoiceId),
      )
      .where(eq(billingProrationLines.userId, userId))
      .orderBy(desc(billingProrationLines.createdAt));

    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      stripeInvoiceId: r.stripeInvoiceId,
      stripeLineId: r.stripeLineId,
      amountCents: r.amountCents,
      currency: r.currency,
      description: r.description,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      createdAt: r.createdAt,
      hostedInvoiceUrl: r.hostedInvoiceUrl,
      invoicePdfUrl: r.invoicePdfUrl,
      invoiceStatus: r.invoiceStatus,
    }));
  } catch (error) {
    if (isMissingProrationTableError(error)) return [];
    throw error;
  }
}
