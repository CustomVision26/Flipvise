import { db } from "@/db";
import { billingInvoices } from "@/db/schema";
import { countDistinct, desc, eq, or } from "drizzle-orm";

type InvoiceLike = {
  id?: string | null;
  number?: string | null;
  status?: string | null;
  amountDue?: number | string | null;
  total?: number | string | null;
  currency?: string | null;
  createdAt?: number | string | null;
  created_at?: number | string | null;
  periodStart?: number | string | null;
  period_start?: number | string | null;
  periodEnd?: number | string | null;
  period_end?: number | string | null;
  hostedInvoiceUrl?: string | null;
  hosted_invoice_url?: string | null;
  invoicePdf?: string | null;
  invoice_pdf?: string | null;
};

function toDate(value: number | string | null | undefined): Date | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value);
  if (typeof value === "string" && value.trim().length > 0) {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? new Date(ms) : null;
  }
  return null;
}

function toInt(value: number | string | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string" && value.trim().length > 0) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n) : null;
  }
  return null;
}

function isMissingBillingInvoicesTableError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current && typeof current === "object"; depth++) {
    const obj = current as Record<string, unknown>;
    if (obj.code === "42P01") return true;
    const message = typeof obj.message === "string" ? obj.message : "";
    if (
      /billing_invoices/i.test(message) &&
      /(does not exist|undefined table|relation .* does not exist)/i.test(message)
    ) {
      return true;
    }
    current = obj.cause;
  }
  const flat = String(error);
  return (
    /42P01/i.test(flat) &&
    /billing_invoices/i.test(flat)
  );
}

/** Catches a missing-column error (PostgreSQL 42703) for any column on billing_invoices. */
function isMissingColumnError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current && typeof current === "object"; depth++) {
    const obj = current as Record<string, unknown>;
    if (obj.code === "42703") return true;
    const message = typeof obj.message === "string" ? obj.message : "";
    if (/(column .* does not exist|undefined column)/i.test(message)) return true;
    current = obj.cause;
  }
  return /42703/.test(String(error));
}

/** Columns without optional `stripeBillingReason` (safe if that migration is not applied). */
function selectBillingInvoicesWithoutStripeReason() {
  return {
    id: billingInvoices.id,
    externalId: billingInvoices.externalId,
    source: billingInvoices.source,
    userId: billingInvoices.userId,
    userEmail: billingInvoices.userEmail,
    planSlug: billingInvoices.planSlug,
    invoiceNumber: billingInvoices.invoiceNumber,
    status: billingInvoices.status,
    amountCents: billingInvoices.amountCents,
    subtotalCents: billingInvoices.subtotalCents,
    taxAmountCents: billingInvoices.taxAmountCents,
    currency: billingInvoices.currency,
    hostedInvoiceUrl: billingInvoices.hostedInvoiceUrl,
    invoicePdfUrl: billingInvoices.invoicePdfUrl,
    periodStart: billingInvoices.periodStart,
    periodEnd: billingInvoices.periodEnd,
    paidAt: billingInvoices.paidAt,
    discountAmountCents: billingInvoices.discountAmountCents,
    discountLabel: billingInvoices.discountLabel,
    createdAt: billingInvoices.createdAt,
    updatedAt: billingInvoices.updatedAt,
  };
}

/** Core columns if discount* columns are also missing. */
function selectBillingInvoicesLegacyMinimal() {
  return {
    id: billingInvoices.id,
    externalId: billingInvoices.externalId,
    source: billingInvoices.source,
    userId: billingInvoices.userId,
    userEmail: billingInvoices.userEmail,
    planSlug: billingInvoices.planSlug,
    invoiceNumber: billingInvoices.invoiceNumber,
    status: billingInvoices.status,
    amountCents: billingInvoices.amountCents,
    subtotalCents: billingInvoices.subtotalCents,
    taxAmountCents: billingInvoices.taxAmountCents,
    currency: billingInvoices.currency,
    hostedInvoiceUrl: billingInvoices.hostedInvoiceUrl,
    invoicePdfUrl: billingInvoices.invoicePdfUrl,
    periodStart: billingInvoices.periodStart,
    periodEnd: billingInvoices.periodEnd,
    paidAt: billingInvoices.paidAt,
    createdAt: billingInvoices.createdAt,
    updatedAt: billingInvoices.updatedAt,
  };
}

export async function upsertBillingInvoiceRecord(input: {
  externalId: string;
  source: "invoice" | "payment_attempt";
  userId: string;
  userEmail?: string | null;
  planSlug?: string | null;
  invoiceNumber?: string | null;
  status?: string | null;
  amountCents?: number | null;
  subtotalCents?: number | null;
  taxAmountCents?: number | null;
  currency?: string | null;
  hostedInvoiceUrl?: string | null;
  invoicePdfUrl?: string | null;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  paidAt?: Date | null;
  discountAmountCents?: number | null;
  discountLabel?: string | null;
  stripeBillingReason?: string | null;
}) {
  const now = new Date();
  try {
    await db
      .insert(billingInvoices)
      .values({
        externalId: input.externalId,
        source: input.source,
        userId: input.userId,
        userEmail: input.userEmail ?? null,
        planSlug: input.planSlug ?? null,
        invoiceNumber: input.invoiceNumber ?? null,
        status: input.status ?? "unknown",
        amountCents: input.amountCents ?? null,
        subtotalCents: input.subtotalCents ?? null,
        taxAmountCents: input.taxAmountCents ?? null,
        currency: input.currency ?? null,
        hostedInvoiceUrl: input.hostedInvoiceUrl ?? null,
        invoicePdfUrl: input.invoicePdfUrl ?? null,
        periodStart: input.periodStart ?? null,
        periodEnd: input.periodEnd ?? null,
        paidAt: input.paidAt ?? null,
        discountAmountCents: input.discountAmountCents ?? null,
        discountLabel: input.discountLabel ?? null,
        stripeBillingReason: input.stripeBillingReason ?? null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: billingInvoices.externalId,
        set: {
          source: input.source,
          userId: input.userId,
          userEmail: input.userEmail ?? null,
          planSlug: input.planSlug ?? null,
          invoiceNumber: input.invoiceNumber ?? null,
          status: input.status ?? "unknown",
          amountCents: input.amountCents ?? null,
          subtotalCents: input.subtotalCents ?? null,
          taxAmountCents: input.taxAmountCents ?? null,
          currency: input.currency ?? null,
          hostedInvoiceUrl: input.hostedInvoiceUrl ?? null,
          invoicePdfUrl: input.invoicePdfUrl ?? null,
          periodStart: input.periodStart ?? null,
          periodEnd: input.periodEnd ?? null,
          paidAt: input.paidAt ?? null,
          discountAmountCents: input.discountAmountCents ?? null,
          discountLabel: input.discountLabel ?? null,
          stripeBillingReason: input.stripeBillingReason ?? null,
          updatedAt: now,
        },
      });
  } catch (error) {
    if (isMissingBillingInvoicesTableError(error)) return;
    throw error;
  }
}

export async function upsertBillingInvoicesFromSubscription(
  userId: string,
  userEmail: string | null,
  planSlug: string | null,
  invoices: InvoiceLike[],
) {
  for (const invoice of invoices) {
    const externalId = invoice.id ?? null;
    if (!externalId) continue;
    await upsertBillingInvoiceRecord({
      externalId,
      source: "invoice",
      userId,
      userEmail,
      planSlug,
      invoiceNumber: invoice.number ?? null,
      status: invoice.status ?? "unknown",
      amountCents: toInt(invoice.amountDue ?? invoice.total),
      currency: invoice.currency ?? null,
      hostedInvoiceUrl: invoice.hostedInvoiceUrl ?? invoice.hosted_invoice_url ?? null,
      invoicePdfUrl: invoice.invoicePdf ?? invoice.invoice_pdf ?? null,
      periodStart: toDate(invoice.periodStart ?? invoice.period_start),
      periodEnd: toDate(invoice.periodEnd ?? invoice.period_end),
      paidAt: toDate(invoice.createdAt ?? invoice.created_at),
    });
  }
}

export async function listBillingInvoicesForAdmin(limit = 1000) {
  try {
    return await db
      .select()
      .from(billingInvoices)
      .orderBy(desc(billingInvoices.createdAt))
      .limit(limit);
  } catch (error) {
    if (isMissingBillingInvoicesTableError(error)) return [];
    if (!isMissingColumnError(error)) throw error;
  }

  try {
    const rows = await db
      .select(selectBillingInvoicesWithoutStripeReason())
      .from(billingInvoices)
      .orderBy(desc(billingInvoices.createdAt))
      .limit(limit);
    return rows.map((row) => ({
      ...row,
      stripeBillingReason: null as string | null,
    }));
  } catch (error2) {
    if (isMissingBillingInvoicesTableError(error2)) return [];
    if (!isMissingColumnError(error2)) throw error2;
  }

  try {
    const rows = await db
      .select(selectBillingInvoicesLegacyMinimal())
      .from(billingInvoices)
      .orderBy(desc(billingInvoices.createdAt))
      .limit(limit);

    return rows.map((row) => ({
      ...row,
      discountAmountCents: null as number | null,
      discountLabel: null as string | null,
      stripeBillingReason: null as string | null,
    }));
  } catch {
    return [];
  }
}

/**
 * Count of distinct users who have at least one invoice with status 'paid' in the DB.
 * This is a DB-level cross-check against the Clerk Billing subscriber count.
 */
export async function countPaidSubscribersFromDB(): Promise<number> {
  try {
    const [result] = await db
      .select({ count: countDistinct(billingInvoices.userId) })
      .from(billingInvoices)
      .where(eq(billingInvoices.status, "paid"));
    return result?.count ?? 0;
  } catch (error) {
    if (isMissingBillingInvoicesTableError(error)) return 0;
    throw error;
  }
}

export async function listBillingInvoicesForUser(userId: string, userEmail?: string | null) {
  const email = userEmail?.toLowerCase() ?? null;
  const whereClause = email
    ? or(eq(billingInvoices.userId, userId), eq(billingInvoices.userEmail, email))
    : eq(billingInvoices.userId, userId);

  try {
    return await db
      .select()
      .from(billingInvoices)
      .where(whereClause)
      .orderBy(desc(billingInvoices.createdAt));
  } catch (error) {
    if (isMissingBillingInvoicesTableError(error)) return [];
    if (!isMissingColumnError(error)) throw error;
  }

  try {
    const rows = await db
      .select(selectBillingInvoicesWithoutStripeReason())
      .from(billingInvoices)
      .where(whereClause)
      .orderBy(desc(billingInvoices.createdAt));
    return rows.map((row) => ({
      ...row,
      stripeBillingReason: null as string | null,
    }));
  } catch (error2) {
    if (isMissingBillingInvoicesTableError(error2)) return [];
    if (!isMissingColumnError(error2)) throw error2;
  }

  try {
    const rows = await db
      .select(selectBillingInvoicesLegacyMinimal())
      .from(billingInvoices)
      .where(whereClause)
      .orderBy(desc(billingInvoices.createdAt));

    return rows.map((row) => ({
      ...row,
      discountAmountCents: null as number | null,
      discountLabel: null as string | null,
      stripeBillingReason: null as string | null,
    }));
  } catch {
    return [];
  }
}
