import { billingActivePlanSlug, billingReferenceTimestampMs } from "@/lib/plan-metadata-billing-resolution";
import type { SerializedUser } from "@/lib/admin-dashboard-types";

type BillingSubscriptionLike = {
  status?: string;
  currency?: string;
  nextPaymentDate?: number | string | null;
  next_payment_date?: number | string | null;
  cancelAtPeriodEnd?: boolean | null;
  cancel_at_period_end?: boolean | null;
  currentPeriodStart?: number | string | null;
  current_period_start?: number | string | null;
  currentPeriodEnd?: number | string | null;
  current_period_end?: number | string | null;
  periodStart?: number | string | null;
  period_start?: number | string | null;
  periodEnd?: number | string | null;
  period_end?: number | string | null;
  createdAt?: number;
  created_at?: number;
  updatedAt?: number;
  updated_at?: number;
  invoices?: BillingInvoiceLike[] | null;
  subscriptionItems?: BillingSubscriptionItemLike[] | null;
  subscription_items?: BillingSubscriptionItemLike[] | null;
};

type BillingSubscriptionItemLike = {
  status?: string;
  currentPeriodStart?: number | string | null;
  current_period_start?: number | string | null;
  currentPeriodEnd?: number | string | null;
  current_period_end?: number | string | null;
  periodStart?: number | string | null;
  period_start?: number | string | null;
  periodEnd?: number | string | null;
  period_end?: number | string | null;
  nextPaymentDate?: number | string | null;
  next_payment_date?: number | string | null;
};

type BillingInvoiceLike = {
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

export type AdminSubscriptionRow = {
  userId: string;
  userName: string;
  email: string | null;
  planSlug: string;
  status: string;
  currency: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  nextPaymentDate: string | null;
  cancelAtPeriodEnd: boolean;
  sourceUpdatedAt: string | null;
};

export type AdminInvoiceRow = {
  id: string;
  userId: string;
  userName: string;
  email: string | null;
  invoiceNumber: string;
  status: string;
  amountDue: number | null;
  currency: string | null;
  createdAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
  discount: string | null;
};

function toIso(value: number | string | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
  }
  return null;
}

function toNumber(value: number | string | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readSubscriptionStatus(
  user: SerializedUser,
  subscription: BillingSubscriptionLike | null,
): string {
  if (subscription?.status && subscription.status.trim().length > 0) {
    return subscription.status;
  }
  return user.isPaidPro ? "active" : "inactive";
}

function readPeriodDates(subscription: BillingSubscriptionLike | null): {
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  nextPaymentDate: string | null;
} {
  if (!subscription) {
    return {
      currentPeriodStart: null,
      currentPeriodEnd: null,
      nextPaymentDate: null,
    };
  }

  const fromTopLevel = {
    currentPeriodStart: toIso(
      subscription.currentPeriodStart ??
        subscription.current_period_start ??
        subscription.periodStart ??
        subscription.period_start,
    ),
    currentPeriodEnd: toIso(
      subscription.currentPeriodEnd ??
        subscription.current_period_end ??
        subscription.periodEnd ??
        subscription.period_end,
    ),
    nextPaymentDate: toIso(
      subscription.nextPaymentDate ?? subscription.next_payment_date,
    ),
  };

  const items =
    subscription.subscriptionItems ?? subscription.subscription_items ?? [];
  const activeItem =
    items.find((item) => {
      const status = (item.status ?? "").toLowerCase();
      return status === "active" || status === "trialing";
    }) ?? items[0];

  const fromItem = activeItem
    ? {
        currentPeriodStart: toIso(
          activeItem.currentPeriodStart ??
            activeItem.current_period_start ??
            activeItem.periodStart ??
            activeItem.period_start,
        ),
        currentPeriodEnd: toIso(
          activeItem.currentPeriodEnd ??
            activeItem.current_period_end ??
            activeItem.periodEnd ??
            activeItem.period_end,
        ),
        nextPaymentDate: toIso(
          activeItem.nextPaymentDate ?? activeItem.next_payment_date,
        ),
      }
    : {
        currentPeriodStart: null,
        currentPeriodEnd: null,
        nextPaymentDate: null,
      };

  return {
    currentPeriodStart:
      fromTopLevel.currentPeriodStart ?? fromItem.currentPeriodStart,
    currentPeriodEnd: fromTopLevel.currentPeriodEnd ?? fromItem.currentPeriodEnd,
    nextPaymentDate: fromTopLevel.nextPaymentDate ?? fromItem.nextPaymentDate,
  };
}

export function buildAdminSubscriptionRows(
  users: SerializedUser[],
  subscriptionsByUserId: Map<string, BillingSubscriptionLike | null>,
): AdminSubscriptionRow[] {
  const rows: AdminSubscriptionRow[] = [];
  for (const user of users) {
    const sub = subscriptionsByUserId.get(user.id) ?? null;
    type SubShape = Parameters<typeof billingActivePlanSlug>[0];
    const planSlug = billingActivePlanSlug((sub ?? undefined) as SubShape) ?? user.planDisplayName;
    const sourceMs = sub ? billingReferenceTimestampMs(sub as SubShape) : 0;
    const periodDates = readPeriodDates(sub);
    rows.push({
      userId: user.id,
      userName: user.fullName,
      email: user.email,
      planSlug,
      status: readSubscriptionStatus(user, sub),
      currency: sub?.currency ?? null,
      currentPeriodStart: periodDates.currentPeriodStart,
      currentPeriodEnd: periodDates.currentPeriodEnd,
      nextPaymentDate: periodDates.nextPaymentDate,
      cancelAtPeriodEnd:
        sub?.cancelAtPeriodEnd === true || sub?.cancel_at_period_end === true,
      sourceUpdatedAt: sourceMs > 0 ? new Date(sourceMs).toISOString() : null,
    });
  }
  return rows.sort((a, b) => a.userName.localeCompare(b.userName));
}

export function buildAdminInvoiceRows(
  users: SerializedUser[],
  subscriptionsByUserId: Map<string, BillingSubscriptionLike | null>,
): AdminInvoiceRow[] {
  const byUserId = new Map(users.map((user) => [user.id, user]));
  const rows: AdminInvoiceRow[] = [];

  for (const [userId, subscription] of subscriptionsByUserId.entries()) {
    const user = byUserId.get(userId);
    if (!user || !subscription?.invoices?.length) continue;

    for (const invoice of subscription.invoices) {
      rows.push({
        id: invoice.id ?? `${userId}-${invoice.number ?? "invoice"}`,
        userId,
        userName: user.fullName,
        email: user.email,
        invoiceNumber: invoice.number ?? "—",
        status: invoice.status ?? "unknown",
        amountDue: toNumber(invoice.amountDue ?? invoice.total),
        currency: invoice.currency ?? subscription.currency ?? null,
        createdAt: toIso(invoice.createdAt ?? invoice.created_at),
        periodStart: toIso(invoice.periodStart ?? invoice.period_start),
        periodEnd: toIso(invoice.periodEnd ?? invoice.period_end),
        hostedInvoiceUrl: invoice.hostedInvoiceUrl ?? invoice.hosted_invoice_url ?? null,
        invoicePdfUrl: invoice.invoicePdf ?? invoice.invoice_pdf ?? null,
        discount: null,
      });
    }
  }

  return rows.sort((a, b) => {
    const left = a.createdAt ? Date.parse(a.createdAt) : 0;
    const right = b.createdAt ? Date.parse(b.createdAt) : 0;
    return right - left;
  });
}
