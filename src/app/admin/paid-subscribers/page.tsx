import { createClerkClient } from "@clerk/backend";
import { getAccessContext } from "@/lib/access";
import { isClerkPlatformAdminRole } from "@/lib/clerk-platform-admin-role";
import { isPlatformSuperadminAllowListed } from "@/lib/platform-superadmin";
import { personalDashboardHref } from "@/lib/personal-dashboard-url";
import { redirect } from "next/navigation";
import Link from "next/link";
import { isTeamPlanId } from "@/lib/team-plans";
import { countPaidSubscribersFromDB, listBillingInvoicesForAdmin } from "@/db/queries/billing";
import type { SerializedAdminSubscription, SerializedAdminInvoice } from "@/lib/admin-dashboard-types";
import { PaidSubscribersFilters } from "@/components/paid-subscribers-filters";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  BadgeCheck,
  Users,
  DollarSign,
  TrendingUp,
  Calendar,
  ArrowLeft,
} from "lucide-react";

// ─── helpers ────────────────────────────────────────────────────────────────

const MONTHS = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December",
] as const;

function userInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatPeriod(start: string | null, end: string | null): string {
  if (!start && !end) return "—";
  return `${fmtDate(start)} – ${fmtDate(end)}`;
}

function formatPrice(amountCents: number | null, currency: string | null): string {
  if (amountCents == null) return "—";
  const curr = (currency ?? "usd").toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: curr,
      minimumFractionDigits: 2,
    }).format(amountCents / 100);
  } catch {
    return `${(amountCents / 100).toFixed(2)} ${curr}`;
  }
}

function formatPlanLabel(slug: string): string {
  if (!slug || slug.toLowerCase() === "free") return "Free";
  if (slug === "pro") return "Pro";
  return slug
    .split(/[_-]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

type StatusVariant = "default" | "destructive" | "secondary" | "outline";

function statusVariant(status: string, cancelAtPeriodEnd: boolean): StatusVariant {
  if (cancelAtPeriodEnd) return "secondary";
  switch (status.toLowerCase()) {
    case "active":
    case "trialing":
      return "default";
    case "canceled":
    case "cancelled":
    case "expired":
      return "destructive";
    default:
      return "outline";
  }
}

function statusLabel(status: string, cancelAtPeriodEnd: boolean): string {
  if (cancelAtPeriodEnd) return "Canceling";
  switch (status.toLowerCase()) {
    case "active":    return "Active";
    case "trialing":  return "Trial";
    case "canceled":
    case "cancelled": return "Canceled";
    case "expired":   return "Expired";
    case "past_due":  return "Past Due";
    default:          return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

// ─── page ────────────────────────────────────────────────────────────────────

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

export default async function PaidSubscribersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { userId, isPro, activeTeamPlan } = await getAccessContext();
  if (!userId) redirect("/");

  const personalDashboardLink = personalDashboardHref(userId, activeTeamPlan, isPro);

  // Auth: must be a platform admin
  const { data: clerkUsers } = await clerkClient.users.getUserList({
    limit: 500,
    orderBy: "-created_at",
  });
  const currentUser = clerkUsers.find((u) => u.id === userId);
  const liveRole = (currentUser?.publicMetadata as { role?: string })?.role;
  const canAccessAdmin =
    isClerkPlatformAdminRole(liveRole) || isPlatformSuperadminAllowListed(userId);
  if (!canAccessAdmin) redirect(personalDashboardLink);

  // ── Parse filter / sort params ──────────────────────────────────────────────
  const currentYear = new Date().getFullYear();
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");
  const searchQuery = str("q").toLowerCase();
  const planFilter  = str("plan");
  const sortBy      = str("sort") || "date";
  const sortOrder   = str("order") || "desc";
  const selectedYear =
    str("year") ? parseInt(str("year"), 10) || currentYear : currentYear;
  const selectedMonth =
    str("month") ? parseInt(str("month"), 10) || null : null;

  // Build user shapes from Clerk publicMetadata only — Stripe writes billingPlan /
  // billingStatus / billingPlanUpdatedAt here via webhooks. No Clerk Billing API call needed.
  const minimalUsers = clerkUsers.map((u) => {
    const meta = u.publicMetadata as {
      billingPlan?: string;
      billingStatus?: string;
      billingPlanUpdatedAt?: string;
    };
    const stripeActive =
      meta?.billingStatus === "active" || meta?.billingStatus === "trialing";
    const effectiveSlug = stripeActive ? (meta?.billingPlan ?? null) : null;
    const isPaidPro = effectiveSlug === "pro" || isTeamPlanId(effectiveSlug ?? "");
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

  // Paid subscriber count (live Stripe metadata)
  const paidSubscriberCount = minimalUsers.filter((u) => u.isPaidPro).length;

  const [dbPaidSubscriberCount, persistedBillingInvoices] = await Promise.all([
    countPaidSubscribersFromDB(),
    listBillingInvoicesForAdmin(2000),
  ]);

  const userById = new Map(minimalUsers.map((u) => [u.id, u]));

  // Serialize all DB invoices — these are the source of truth for Stripe billing history
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

  // Build two maps per user:
  // 1. latestPaidInvByUser  — determines who counts as a paid subscriber (status="paid" only)
  // 2. latestInvWithPeriodByUser — best invoice that has periodStart set (any status),
  //    used for the Billing Period column. invoice.finalized fires before invoice.paid and
  //    both carry period data; the paid record may land with periodStart=null if the
  //    webhook received it before line items were attached.
  const latestPaidInvByUser = new Map<string, (typeof persistedBillingInvoices)[number]>();
  const latestInvWithPeriodByUser = new Map<string, (typeof persistedBillingInvoices)[number]>();

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
    ...minimalUsers.filter((u) => u.isPaidPro).map((u) => u.id),
    ...Array.from(latestPaidInvByUser.keys()),
  ]);

  const subscriptions: SerializedAdminSubscription[] = Array.from(paidUserIds)
    .map((uid) => {
      const user = userById.get(uid);
      const latestInv = latestPaidInvByUser.get(uid);
      // Use any invoice with period data as the source for billing period columns
      const periodInv = latestInvWithPeriodByUser.get(uid) ?? latestInv;
      const isMetaActive =
        user?.billingStatus === "active" || user?.billingStatus === "trialing";
      return {
        userId: uid,
        userName: user?.fullName ?? latestInv?.userEmail ?? periodInv?.userEmail ?? uid,
        email: user?.email ?? latestInv?.userEmail ?? periodInv?.userEmail ?? null,
        planSlug:
          (isMetaActive ? user?.planDisplayName : null) ??
          latestInv?.planSlug ??
          periodInv?.planSlug ??
          "pro",
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

  // Latest invoice per user (for price column)
  const latestInvoiceByUser = new Map<string, SerializedAdminInvoice>();
  for (const inv of invoices) {
    const existing = latestInvoiceByUser.get(inv.userId);
    const existingMs = existing?.createdAt ? Date.parse(existing.createdAt) : 0;
    const thisMs = inv.createdAt ? Date.parse(inv.createdAt) : 0;
    if (!existing || thisMs > existingMs) latestInvoiceByUser.set(inv.userId, inv);
  }

  // ── Derive available filter options ─────────────────────────────────────────
  const availablePlans = [
    ...new Set(subscriptions.map((s) => s.planSlug).filter(Boolean)),
  ].sort() as string[];

  const yearSet = new Set<number>([currentYear]);
  for (const inv of persistedBillingInvoices) {
    const y =
      inv.periodStart?.getFullYear() ??
      inv.paidAt?.getFullYear() ??
      inv.createdAt.getFullYear();
    yearSet.add(y);
  }
  const availableYears = Array.from(yearSet).sort((a, b) => a - b);

  // ── Apply search + plan filter ───────────────────────────────────────────────
  let filteredSubs = subscriptions;

  if (searchQuery) {
    filteredSubs = filteredSubs.filter(
      (s) =>
        s.userName.toLowerCase().includes(searchQuery) ||
        (s.email?.toLowerCase().includes(searchQuery) ?? false),
    );
  }

  if (planFilter) {
    filteredSubs = filteredSubs.filter((s) => s.planSlug === planFilter);
  }

  // ── Apply sort ───────────────────────────────────────────────────────────────
  filteredSubs = [...filteredSubs].sort((a, b) => {
    let cmp = 0;
    if (sortBy === "name") {
      cmp = a.userName.localeCompare(b.userName);
    } else if (sortBy === "plan") {
      cmp = (a.planSlug ?? "").localeCompare(b.planSlug ?? "");
    } else if (sortBy === "price") {
      const aAmt = latestInvoiceByUser.get(a.userId)?.amountDue ?? 0;
      const bAmt = latestInvoiceByUser.get(b.userId)?.amountDue ?? 0;
      cmp = aAmt - bAmt;
    } else {
      // date (default)
      const aMs = a.currentPeriodStart
        ? Date.parse(a.currentPeriodStart)
        : a.sourceUpdatedAt
          ? Date.parse(a.sourceUpdatedAt)
          : 0;
      const bMs = b.currentPeriodStart
        ? Date.parse(b.currentPeriodStart)
        : b.sourceUpdatedAt
          ? Date.parse(b.sourceUpdatedAt)
          : 0;
      cmp = aMs - bMs;
    }
    return sortOrder === "asc" ? cmp : -cmp;
  });

  // ── Group into months (respecting year + month filters) ─────────────────────
  const byMonth: (typeof filteredSubs)[] = Array.from({ length: 12 }, () => []);
  for (const sub of filteredSubs) {
    const dateStr = sub.currentPeriodStart ?? sub.sourceUpdatedAt;
    if (!dateStr) {
      const nowMonth = new Date().getMonth();
      if (!selectedMonth || selectedMonth === nowMonth + 1) {
        byMonth[nowMonth].push(sub);
      }
      continue;
    }
    const d = new Date(dateStr);
    if (d.getFullYear() !== selectedYear) continue;
    if (selectedMonth && d.getMonth() + 1 !== selectedMonth) continue;
    byMonth[d.getMonth()].push(sub);
  }

  // ── Summary stats (always over ALL subscriptions, not filtered view) ─────────
  const activeCount = subscriptions.filter(
    (s) => s.status === "active" || s.status === "trialing",
  ).length;
  const cancelingCount = subscriptions.filter((s) => s.cancelAtPeriodEnd).length;
  const totalRevenueCents = invoices
    .filter(
      (inv) =>
        inv.status === "paid" &&
        inv.createdAt &&
        new Date(inv.createdAt).getFullYear() === currentYear,
    )
    .reduce((sum, inv) => sum + (inv.amountDue ?? 0), 0);

  const hasAnyRows = byMonth.some((g) => g.length > 0);

  return (
    <div className="flex flex-col min-h-screen bg-background">

      {/* ── Page header ── */}
      <div className="sticky top-0 z-10 border-b bg-background px-6 sm:px-10 py-5">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <BadgeCheck className="h-7 w-7 text-green-500 shrink-0" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Paid Subscribers — {selectedYear}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Monthly breakdown of paying customers. Period shows the active billing window.
                Price is taken from the most recent invoice.
              </p>
            </div>
          </div>
          <Link
            href="/admin"
            className={buttonVariants({ variant: "outline", size: "sm" }) + " shrink-0"}
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to Admin
          </Link>
        </div>

        {/* Summary stat chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-xl border bg-muted/40 px-5 py-4 flex items-center gap-4">
            <Users className="h-7 w-7 text-green-500 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Paid (Stripe DB)</p>
              <p className="text-2xl font-bold text-green-500">{dbPaidSubscriberCount}</p>
              {paidSubscriberCount > 0 && (
                <p className="text-xs text-green-500 mt-0.5">{paidSubscriberCount} active via metadata</p>
              )}
            </div>
          </div>
          <div className="rounded-xl border bg-muted/40 px-5 py-4 flex items-center gap-4">
            <TrendingUp className="h-7 w-7 text-blue-500 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Active Subs</p>
              <p className="text-2xl font-bold">{activeCount}</p>
            </div>
          </div>
          <div className="rounded-xl border bg-muted/40 px-5 py-4 flex items-center gap-4">
            <Calendar className="h-7 w-7 text-orange-400 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Canceling</p>
              <p className="text-2xl font-bold">{cancelingCount}</p>
            </div>
          </div>
          <div className="rounded-xl border bg-muted/40 px-5 py-4 flex items-center gap-4">
            <DollarSign className="h-7 w-7 text-emerald-500 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Revenue {currentYear}</p>
              <p className="text-2xl font-bold">
                {totalRevenueCents > 0
                  ? new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                      maximumFractionDigits: 0,
                    }).format(totalRevenueCents / 100)
                  : "—"}
              </p>
            </div>
          </div>
        </div>

        {paidSubscriberCount !== dbPaidSubscriberCount && (
          <p className="text-xs text-muted-foreground mt-3">
            Metadata reports{" "}
            <span className="font-semibold">{paidSubscriberCount}</span> active via Clerk — may differ from DB if a webhook was delayed or a subscription was canceled.
          </p>
        )}

        {/* ── Filter / sort bar ── */}
        <div className="mt-5 pt-5 border-t">
          <PaidSubscribersFilters
            availablePlans={availablePlans}
            availableYears={availableYears}
            currentYear={currentYear}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            currentSort={sortBy}
            currentOrder={sortOrder}
            currentSearch={searchQuery}
            currentPlan={planFilter}
          />
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 px-6 sm:px-10 py-8">
        {!hasAnyRows ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground">
            <BadgeCheck className="h-14 w-14 opacity-20" />
            <p className="text-base">
              No paid subscriber records found
              {searchQuery || planFilter
                ? " matching the current filters"
                : ` for ${selectedYear}`}
              .
            </p>
          </div>
        ) : (
          <div className="space-y-12">
            {MONTHS.map((month, idx) => {
              const rows = byMonth[idx];
              if (!rows || rows.length === 0) return null;
              return (
                <section key={month}>
                  {/* Month heading */}
                  <div className="flex items-center gap-3 mb-5">
                    <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                      {month} {selectedYear}
                    </h2>
                    <span className="rounded-full bg-green-500/10 text-green-500 text-xs font-semibold px-2.5 py-0.5">
                      {rows.length} subscriber{rows.length !== 1 ? "s" : ""}
                    </span>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  {/* Table */}
                  <div className="rounded-xl border overflow-hidden">
                    <Table className="w-full table-fixed">
                      <colgroup>
                        <col style={{ width: "24%" }} />
                        <col style={{ width: "13%" }} />
                        <col style={{ width: "24%" }} />
                        <col style={{ width: "14%" }} />
                        <col style={{ width: "13%" }} />
                        <col style={{ width: "12%" }} />
                      </colgroup>
                      <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableHead className="py-4 text-sm font-semibold uppercase tracking-wide">User</TableHead>
                          <TableHead className="py-4 text-sm font-semibold uppercase tracking-wide">Plan</TableHead>
                          <TableHead className="py-4 text-sm font-semibold uppercase tracking-wide">Billing Period</TableHead>
                          <TableHead className="py-4 text-sm font-semibold uppercase tracking-wide">Discount</TableHead>
                          <TableHead className="py-4 text-sm font-semibold uppercase tracking-wide text-right">Price</TableHead>
                          <TableHead className="py-4 text-sm font-semibold uppercase tracking-wide">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((sub) => {
                          const inv = latestInvoiceByUser.get(sub.userId);
                          const discount = inv?.discount ?? null;
                          return (
                            <TableRow key={sub.userId} className="hover:bg-muted/30 transition-colors">
                              {/* User */}
                              <TableCell className="py-5">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="h-10 w-10 rounded-full bg-green-500/10 text-green-600 flex items-center justify-center text-sm font-bold shrink-0 select-none">
                                    {userInitials(sub.userName || "?")}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-semibold text-base leading-tight truncate">
                                      {sub.userName}
                                    </div>
                                    {sub.email && (
                                      <div className="text-sm text-muted-foreground truncate mt-0.5">
                                        {sub.email}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </TableCell>

                              {/* Plan */}
                              <TableCell className="py-5">
                                <Badge variant="secondary" className="font-mono text-sm px-3 py-1">
                                  {formatPlanLabel(sub.planSlug)}
                                </Badge>
                              </TableCell>

                              {/* Billing Period */}
                              <TableCell className="py-5 text-sm text-muted-foreground">
                                {formatPeriod(sub.currentPeriodStart, sub.currentPeriodEnd)}
                                {sub.cancelAtPeriodEnd && (
                                  <div className="text-orange-400 text-xs mt-1">
                                    Cancels at period end
                                  </div>
                                )}
                              </TableCell>

                              {/* Discount */}
                              <TableCell className="py-5 text-sm text-muted-foreground">
                                {discount ? (
                                  <span className="text-emerald-500 font-semibold">{discount}</span>
                                ) : "—"}
                              </TableCell>

                              {/* Price */}
                              <TableCell className="py-5 text-right font-bold tabular-nums text-base">
                                {formatPrice(inv?.amountDue ?? null, inv?.currency ?? sub.currency)}
                              </TableCell>

                              {/* Status */}
                              <TableCell className="py-5">
                                <Badge
                                  variant={statusVariant(sub.status, sub.cancelAtPeriodEnd)}
                                  className="text-sm px-3 py-1"
                                >
                                  {statusLabel(sub.status, sub.cancelAtPeriodEnd)}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
