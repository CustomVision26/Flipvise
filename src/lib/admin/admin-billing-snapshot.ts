import { listBillingInvoicesForAdmin } from "@/db/queries/billing";
import type { listStripeSubscriptionsForAdmin } from "@/db/queries/stripe-subscriptions";
import type {
  SerializedAdminInvoice,
  SerializedAdminSubscription,
} from "@/lib/admin-dashboard-types";
import { isStripePaidPlanId } from "@/lib/billing-plan-ids";
import { displayNameForBillingPlanSlug } from "@/lib/plan-slug-display";
import { resolveEffectivePlan } from "@/lib/plan-metadata-billing-resolution";
import { canonicalTeamPlanId, isTeamPlanId } from "@/lib/team-plans";

export type AdminBillingUserMeta = {
  id: string;
  fullName: string;
  email: string | null;
  isPaidPro: boolean;
  planDisplayName: string;
  billingStatus: string | null;
  billingPlanUpdatedAt: string | null;
  billingPlanSlug: string | null;
  effectivePlanSlug: string | null;
  accessFromAdminGrant: boolean;
  stripeAuthoritative: boolean;
};

type StripeSubscriptionRow = Awaited<
  ReturnType<typeof listStripeSubscriptionsForAdmin>
>[number];

type AffiliateRowLike = {
  status: string;
  invitedEmail: string;
  invitedUserId: string | null;
  endsAt: Date | string;
  revokedAt?: Date | string | null;
};

const MANAGEABLE_STRIPE_STATUSES = new Set(["active", "trialing", "past_due"]);

function normalizePlanSlug(slug: string | null | undefined): string | null {
  if (!slug?.trim()) return null;
  return canonicalTeamPlanId(slug.trim()) ?? slug.trim();
}

function planSlugsMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const left = normalizePlanSlug(a);
  const right = normalizePlanSlug(b);
  return left != null && right != null && left === right;
}

function isPaidStripePlanSlug(slug: string | null): boolean {
  if (!slug) return false;
  return (
    slug === "pro" ||
    slug === "pro_plus" ||
    isTeamPlanId(slug) ||
    isStripePaidPlanId(slug)
  );
}

/** Clerk users with Stripe vs admin/affiliate grant resolution for admin billing tables. */
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
    const meta = (u.publicMetadata ?? {}) as Record<string, unknown>;
    const billingStatus =
      typeof meta.billingStatus === "string" ? meta.billingStatus : null;
    const billingPlanSlug = normalizePlanSlug(
      typeof meta.billingPlan === "string" ? meta.billingPlan : null,
    );
    const adminPlanSlug = normalizePlanSlug(
      typeof meta.adminPlan === "string" ? meta.adminPlan : null,
    );
    const effectivePlanSlug = normalizePlanSlug(resolveEffectivePlan(meta));
    const isBillingActive =
      billingStatus === "active" || billingStatus === "trialing";
    const accessFromAdminGrant =
      !!adminPlanSlug &&
      !!effectivePlanSlug &&
      planSlugsMatch(adminPlanSlug, effectivePlanSlug);
    const stripeAuthoritative =
      isBillingActive &&
      !!billingPlanSlug &&
      !!effectivePlanSlug &&
      planSlugsMatch(billingPlanSlug, effectivePlanSlug) &&
      !accessFromAdminGrant &&
      isPaidStripePlanSlug(billingPlanSlug);

    const primaryEmail =
      u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)?.emailAddress ??
      null;
    const fullName =
      [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "—";

    return {
      id: u.id,
      fullName,
      email: primaryEmail,
      isPaidPro: stripeAuthoritative,
      planDisplayName: effectivePlanSlug ?? "Free",
      billingStatus,
      billingPlanUpdatedAt:
        typeof meta.billingPlanUpdatedAt === "string"
          ? meta.billingPlanUpdatedAt
          : null,
      billingPlanSlug,
      effectivePlanSlug,
      accessFromAdminGrant,
      stripeAuthoritative,
    };
  });
}

export function buildActiveAffiliateUserIds(
  affiliates: AffiliateRowLike[],
  users: Pick<AdminBillingUserMeta, "id" | "email">[],
): Set<string> {
  const now = Date.now();
  const emailToUserId = new Map(
    users
      .filter((u) => u.email)
      .map((u) => [u.email!.toLowerCase(), u.id] as const),
  );
  const ids = new Set<string>();

  for (const row of affiliates) {
    if (row.status !== "active") continue;
    if (row.revokedAt) continue;
    const ends =
      row.endsAt instanceof Date ? row.endsAt : new Date(row.endsAt);
    if (Number.isNaN(ends.getTime()) || ends.getTime() <= now) continue;

    if (row.invitedUserId) {
      ids.add(row.invitedUserId);
      continue;
    }
    const linked = emailToUserId.get(row.invitedEmail.toLowerCase());
    if (linked) ids.add(linked);
  }

  return ids;
}

export function countPaidSubscribersFromMeta(users: AdminBillingUserMeta[]): number {
  return users.filter((u) => u.isPaidPro).length;
}

export function buildAdminBillingSnapshot(input: {
  users: AdminBillingUserMeta[];
  persistedBillingInvoices: Awaited<ReturnType<typeof listBillingInvoicesForAdmin>>;
  stripeSubscriptions?: StripeSubscriptionRow[];
  activeAffiliateUserIds?: Set<string>;
}): {
  paidSubscriberCount: number;
  subscriptions: SerializedAdminSubscription[];
  invoices: SerializedAdminInvoice[];
} {
  const { users, persistedBillingInvoices } = input;
  const affiliateIds = input.activeAffiliateUserIds ?? new Set<string>();
  const stripeByUser = new Map(
    (input.stripeSubscriptions ?? []).map((row) => [row.userId, row]),
  );
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
      const existingMs =
        existing?.paidAt?.getTime() ?? existing?.createdAt.getTime() ?? 0;
      if (!existing || invMs > existingMs) latestPaidInvByUser.set(inv.userId, inv);
    }
    if (inv.periodStart) {
      const existing = latestInvWithPeriodByUser.get(inv.userId);
      const existingMs =
        existing?.paidAt?.getTime() ?? existing?.createdAt.getTime() ?? 0;
      if (!existing || invMs > existingMs) {
        latestInvWithPeriodByUser.set(inv.userId, inv);
      }
    }
  }

  function shouldIncludeStripeSubscriber(userId: string): boolean {
    if (affiliateIds.has(userId)) return false;
    const user = userById.get(userId);
    if (!user || user.accessFromAdminGrant) return false;

    if (user.stripeAuthoritative) return true;

    const stripeRow = stripeByUser.get(userId);
    if (!stripeRow || !MANAGEABLE_STRIPE_STATUSES.has(stripeRow.status)) {
      return false;
    }

    const stripePlan = normalizePlanSlug(stripeRow.planSlug);
    if (!stripePlan || !isPaidStripePlanSlug(stripePlan)) return false;

    return (
      !!user.effectivePlanSlug && planSlugsMatch(stripePlan, user.effectivePlanSlug)
    );
  }

  const paidUserIds = new Set<string>();
  for (const user of users) {
    if (shouldIncludeStripeSubscriber(user.id)) paidUserIds.add(user.id);
  }
  for (const row of input.stripeSubscriptions ?? []) {
    if (shouldIncludeStripeSubscriber(row.userId)) paidUserIds.add(row.userId);
  }

  const subscriptions: SerializedAdminSubscription[] = Array.from(paidUserIds)
    .map((uid) => {
      const user = userById.get(uid);
      const stripeRow = stripeByUser.get(uid);
      const latestInv = latestPaidInvByUser.get(uid);
      const periodInv =
        latestInvWithPeriodByUser.get(uid) ??
        latestInv ??
        null;

      const rawPlanSlug =
        stripeRow?.planSlug?.trim() ||
        user?.billingPlanSlug ||
        periodInv?.planSlug?.trim() ||
        latestInv?.planSlug?.trim() ||
        user?.effectivePlanSlug ||
        "pro";
      const planSlug = normalizePlanSlug(rawPlanSlug) ?? rawPlanSlug;

      const periodStart =
        periodInv?.periodStart?.toISOString() ??
        latestInv?.periodStart?.toISOString() ??
        null;
      const periodEnd =
        stripeRow?.currentPeriodEnd?.toISOString() ??
        periodInv?.periodEnd?.toISOString() ??
        latestInv?.periodEnd?.toISOString() ??
        null;

      return {
        userId: uid,
        userName:
          user?.fullName ??
          latestInv?.userEmail ??
          periodInv?.userEmail ??
          uid,
        email:
          user?.email ??
          latestInv?.userEmail ??
          periodInv?.userEmail ??
          null,
        planSlug,
        planLabel: displayNameForBillingPlanSlug(planSlug),
        status:
          stripeRow?.status ??
          (user?.stripeAuthoritative ? (user.billingStatus ?? "active") : "active"),
        currency: periodInv?.currency ?? latestInv?.currency ?? null,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        nextPaymentDate: stripeRow?.currentPeriodEnd?.toISOString() ?? null,
        cancelAtPeriodEnd: false,
        sourceUpdatedAt:
          stripeRow?.updatedAt?.toISOString() ??
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
