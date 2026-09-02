/** In-app receipt page for a persisted billing invoice (`externalId` = Stripe invoice id). */
export function flipviseBillingReceiptHref(externalId: string): string {
  return `/dashboard/billing/receipts/${encodeURIComponent(externalId.trim())}`;
}

export function receiptUrlForBillingInvoice(input: {
  externalId: string;
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
}): string | null {
  const id = input.externalId.trim();
  if (id) return flipviseBillingReceiptHref(id);
  return input.hostedInvoiceUrl ?? input.invoicePdfUrl ?? null;
}
