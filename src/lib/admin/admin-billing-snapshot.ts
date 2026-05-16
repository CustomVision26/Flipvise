import { listBillingInvoicesForAdmin } from "@/db/queries/billing";
import type {
  SerializedAdminInvoice,
  SerializedAdminSubscription,
} from "@/lib/admin-dashboard-types";
import { displayNameForBillingPlanSlug } from "@/lib/plan-slug-display";
import { isTeamPlanId } from "@/lib/team-plans";

export type AdminBillingUserMeta = {
  id: string;
  fullName: string;
  email: string | null;
  isPaidPro: boolean;
  planDisplayName: string;
  billingStatus: string | null;
  billingPlanUpdatedAt: string | null;
};

export function clerkUsersToBillingMeta(
  clerkUsers: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
    emailAddresses: { id: string; emailAddress: string }[];
    primaryEmailAddressId: string | null;
    publicMetadata: unknown;
  }[],
): AdminBillingUserMeta[] {
  return clerkUsers.map((u) => {
    const meta = u.publicMetadata as {
      billingPlan?: string;
      billingStatus?: string;
      billingPlanUpdatedAt?: string;
    };
    const stripeActive =
      meta?.billingStatus === "active" || meta?.billingStatus === "trialing";
    const effectiveSlug = stripeActive ? (meta?.billingPlan ?? null) : null;
    const isPaidPro =
      effectiveSlug === "pro" ||
      effectiveSlug === "pro_plus" ||
      isTeamPlanId(effectiveSlug ?? "");
    const primaryEmail =
      u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)?.emailAddress ?? null;
    const fullName =
      [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "—";
    return {
      id: u.id,
      fullName,
      email: primaryEmail,
      isPaidPro,
      planDisplayName: effectiveSlug ?? "Free",
      billingStatus: meta?.billingStatus ?? null,
      billingPlanUpdatedAt: meta?.billingPlanUpdatedAt ?? null,
    };
  });
}

export function countPaidSubscribersFromMeta(users: AdminBillingUserMeta[]): number {
  return users.filter((u) => u.isPaidPro).length;
}

export function buildAdminBillingSnapshot(input: {
  users: AdminBillingUserMeta[];
  persistedBillingInvoices: Awaited<ReturnType<typeof listBillingInvoicesForAdmin>>;
}): {
  paidSubscriberCount: number;
  subscriptions: SerializedAdminSubscription[];
  invoices: SerializedAdminInvoice[];
} {
  const { users, persistedBillingInvoices } = input;
  const paidSubscriberCount = countPaidSubscribersFromMeta(users);
  const userById = new Map(users.map((u) => [u.id, u]));

  const invoices: SerializedAdminInvoice[] = persistedBillingInvoices
    .map((row) => {
      const user = userById.get(row.userId);
      return {
        id: row.externalId,
        userId: row.userId,
        userName: user?.fullName ?? row.userEmail ?? row.userId,
        email: row.userEmail ?? user?.email ?? null,
        invoiceNumber: row.invoiceNumber ?? row.externalId,
        status: row.status,
        amountDue: row.amountCents,
        currency: row.currency,
        createdAt: row.paidAt?.toISOString() ?? row.createdAt.toISOString(),
        periodStart: row.periodStart?.toISOString() ?? null,
        periodEnd: row.periodEnd?.toISOString() ?? null,
        hostedInvoiceUrl: row.hostedInvoiceUrl,
        invoicePdfUrl: row.invoicePdfUrl,
        discount: row.discountLabel ?? null,
      };
    })
    .sort((a, b) => {
      const l = a.createdAt ? Date.parse(a.createdAt) : 0;
      const r = b.createdAt ? Date.parse(b.createdAt) : 0;
      return r - l;
    });

  const latestPaidInvByUser = new Map<
    string,
    (typeof persistedBillingInvoices)[number]
  >();
  const latestInvWithPeriodByUser = new Map<
    string,
    (typeof persistedBillingInvoices)[number]
  >();

  for (const inv of persistedBillingInvoices) {
    const invMs = inv.paidAt?.getTime() ?? inv.createdAt.getTime();
    if (inv.status === "paid") {
      const existing = latestPaidInvByUser.get(inv.userId);
      const existingMs = existing?.paidAt?.getTime() ?? existing?.createdAt.getTime() ?? 0;
      if (!existing || invMs > existingMs) latestPaidInvByUser.set(inv.userId, inv);
    }
    if (inv.periodStart) {
      const existing = latestInvWithPeriodByUser.get(inv.userId);
      const existingMs = existing?.paidAt?.getTime() ?? existing?.createdAt.getTime() ?? 0;
      if (!existing || invMs > existingMs) latestInvWithPeriodByUser.set(inv.userId, inv);
    }
  }

  const paidUserIds = new Set<string>([
    ...users.filter((u) => u.isPaidPro).map((u) => u.id),
    ...Array.from(latestPaidInvByUser.keys()),
  ]);

  const subscriptions: SerializedAdminSubscription[] = Array.from(paidUserIds)
    .map((uid) => {
      const user = userById.get(uid);
      const latestInv = latestPaidInvByUser.get(uid);
      const periodInv = latestInvWithPeriodByUser.get(uid) ?? latestInv;
      const isMetaActive =
        user?.billingStatus === "active" || user?.billingStatus === "trialing";
      const planSlug =
        (isMetaActive ? user?.planDisplayName : null) ??
        latestInv?.planSlug ??
        periodInv?.planSlug ??
        "pro";
      return {
        userId: uid,
        userName: user?.fullName ?? latestInv?.userEmail ?? periodInv?.userEmail ?? uid,
        email: user?.email ?? latestInv?.userEmail ?? periodInv?.userEmail ?? null,
        planSlug,
        status: isMetaActive ? (user?.billingStatus ?? "active") : "active",
        currency: periodInv?.currency ?? latestInv?.currency ?? null,
        currentPeriodStart: periodInv?.periodStart?.toISOString() ?? null,
        currentPeriodEnd: periodInv?.periodEnd?.toISOString() ?? null,
        nextPaymentDate: null,
        cancelAtPeriodEnd: false,
        sourceUpdatedAt:
          user?.billingPlanUpdatedAt ??
          latestInv?.paidAt?.toISOString() ??
          periodInv?.createdAt.toISOString() ??
          null,
      };
    })
    .sort((a, b) => a.userName.localeCompare(b.userName));

  return { paidSubscriberCount, subscriptions, invoices };
}

export function planSlugDisplayName(slug: string): string {
  return displayNameForBillingPlanSlug(slug);
}
