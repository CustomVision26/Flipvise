import { listBillingInvoicesForUser } from "@/db/queries/billing";
import { listProrationLinesWithReceiptForUser } from "@/db/queries/billing-proration";
import {
  addonBillingPlanSlug,
  isAddonBillingPlanSlug,
} from "@/lib/addon-plan-slug";

export type BillingReceiptInfo = {
  receiptUrl: string | null;
  isProration: boolean;
  invoiceNumber: string | null;
};

export type BillingReceiptPair = {
  plan: BillingReceiptInfo;
  addon: BillingReceiptInfo;
};

function receiptUrlFromStoredInvoice(input: {
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
}): string | null {
  return input.hostedInvoiceUrl ?? input.invoicePdfUrl ?? null;
}

function emptyReceipt(): BillingReceiptInfo {
  return { receiptUrl: null, isProration: false, invoiceNumber: null };
}

function toReceiptInfo(
  inv: {
    externalId: string;
    hostedInvoiceUrl: string | null;
    invoicePdfUrl: string | null;
    invoiceNumber: string | null;
  } | null | undefined,
  prorationInvoiceIds: Set<string>,
): BillingReceiptInfo {
  if (!inv) return emptyReceipt();
  return {
    receiptUrl: receiptUrlFromStoredInvoice(inv),
    isProration: prorationInvoiceIds.has(inv.externalId),
    invoiceNumber: inv.invoiceNumber,
  };
}

/**
 * Returns the newest plan receipt and newest add-on receipt separately so a
 * dual checkout (plan change + add-on) does not collapse to a single link.
 */
export async function resolvePlanAndAddonBillingReceiptsForUser(
  userId: string,
  userEmail?: string | null,
  addonKey?: string | null,
): Promise<BillingReceiptPair> {
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

  const addonSlug = addonKey?.trim()
    ? addonBillingPlanSlug(addonKey.trim())
    : null;

  const latestAddon =
    paid.find(
      (inv) =>
        isAddonBillingPlanSlug(inv.planSlug) &&
        (!addonSlug ||
          inv.planSlug?.trim().toLowerCase() === addonSlug.toLowerCase()) &&
        !!receiptUrlFromStoredInvoice(inv),
    ) ??
    paid.find(
      (inv) =>
        isAddonBillingPlanSlug(inv.planSlug) &&
        (!addonSlug ||
          inv.planSlug?.trim().toLowerCase() === addonSlug.toLowerCase()),
    );

  const latestPlan =
    paid.find(
      (inv) =>
        !isAddonBillingPlanSlug(inv.planSlug) &&
        !!receiptUrlFromStoredInvoice(inv),
    ) ??
    paid.find((inv) => !isAddonBillingPlanSlug(inv.planSlug));

  return {
    plan: toReceiptInfo(latestPlan, prorationInvoiceIds),
    addon: toReceiptInfo(latestAddon, prorationInvoiceIds),
  };
}

/** Latest paid invoice receipt URL for post-checkout / upgrade toasts. */
export async function resolveLatestBillingReceiptForUser(
  userId: string,
  userEmail?: string | null,
  options?: { preferAddon?: boolean; addonKey?: string | null },
): Promise<BillingReceiptInfo> {
  const pair = await resolvePlanAndAddonBillingReceiptsForUser(
    userId,
    userEmail,
    options?.addonKey,
  );

  if (options?.preferAddon === true) {
    return pair.addon.receiptUrl ? pair.addon : pair.plan;
  }
  if (options?.preferAddon === false) {
    return pair.plan.receiptUrl ? pair.plan : pair.addon;
  }

  return pair.addon.receiptUrl ? pair.addon : pair.plan;
}
