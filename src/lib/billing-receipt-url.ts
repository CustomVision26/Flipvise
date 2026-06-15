import { listBillingInvoicesForUser } from "@/db/queries/billing";
import { listProrationLinesWithReceiptForUser } from "@/db/queries/billing-proration";

export type BillingReceiptInfo = {
  receiptUrl: string | null;
  isProration: boolean;
  invoiceNumber: string | null;
};

function receiptUrlFromStoredInvoice(input: {
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
}): string | null {
  return input.hostedInvoiceUrl ?? input.invoicePdfUrl ?? null;
}

/** Latest paid invoice receipt URL for post-checkout / upgrade toasts. */
export async function resolveLatestBillingReceiptForUser(
  userId: string,
  userEmail?: string | null,
): Promise<BillingReceiptInfo> {
  const [invoices, prorationLines] = await Promise.all([
    listBillingInvoicesForUser(userId, userEmail),
    listProrationLinesWithReceiptForUser(userId),
  ]);

  const prorationInvoiceIds = new Set(
    prorationLines.map((line) => line.stripeInvoiceId),
  );

  const paid = invoices
    .filter((inv) => inv.status?.toLowerCase() === "paid")
    .sort((a, b) => {
      const aMs = a.paidAt?.getTime() ?? a.createdAt.getTime();
      const bMs = b.paidAt?.getTime() ?? b.createdAt.getTime();
      return bMs - aMs;
    });

  const latest = paid[0];
  if (!latest) {
    return { receiptUrl: null, isProration: false, invoiceNumber: null };
  }

  return {
    receiptUrl: receiptUrlFromStoredInvoice(latest),
    isProration: prorationInvoiceIds.has(latest.externalId),
    invoiceNumber: latest.invoiceNumber,
  };
}
