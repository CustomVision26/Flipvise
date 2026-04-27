"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Users, DollarSign, TrendingUp, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type {
  SerializedAdminSubscription,
  SerializedAdminInvoice,
} from "@/lib/admin-dashboard-types";

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

function formatPlanLabel(slug: string): string {
  if (!slug || slug.toLowerCase() === "free") return "Free";
  if (slug === "pro") return "Pro";
  return slug
    .split(/[_-]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
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

// ─── component ──────────────────────────────────────────────────────────────

type Props = {
  paidSubscriberCount: number;
  dbPaidSubscriberCount: number;
  subscriptions: SerializedAdminSubscription[];
  invoices: SerializedAdminInvoice[];
};

export function PaidSubscribersCard({
  paidSubscriberCount,
  dbPaidSubscriberCount,
  subscriptions,
  invoices,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentYear = new Date().getFullYear();

  // Single click → navigate to full page; double-click → open dialog
  function handleClick() {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      setOpen(true);
    } else {
      clickTimer.current = setTimeout(() => {
        clickTimer.current = null;
        router.push("/admin/paid-subscribers");
      }, 260);
    }
  }

  // Latest invoice per user (for price lookup)
  const latestInvoiceByUser = useMemo(() => {
    const map = new Map<string, SerializedAdminInvoice>();
    for (const inv of invoices) {
      const existing = map.get(inv.userId);
      const existingMs = existing?.createdAt ? Date.parse(existing.createdAt) : 0;
      const thisMs = inv.createdAt ? Date.parse(inv.createdAt) : 0;
      if (!existing || thisMs > existingMs) map.set(inv.userId, inv);
    }
    return map;
  }, [invoices]);

  // Keep only paid (non-free, non-inactive) Stripe subscriptions
  const paidSubs = useMemo(
    () =>
      subscriptions.filter((s) => {
        const plan = (s.planSlug ?? "").toLowerCase();
        const status = (s.status ?? "").toLowerCase();
        if (!plan || plan === "free" || plan === "inactive") return false;
        if (status === "canceled" || status === "cancelled" || status === "expired") return false;
        return true;
      }),
    [subscriptions],
  );

  // Group by month
  const byMonth = useMemo(() => {
    const groups: (typeof paidSubs)[] = Array.from({ length: 12 }, () => []);
    for (const sub of paidSubs) {
      const dateStr = sub.currentPeriodStart ?? sub.sourceUpdatedAt;
      if (!dateStr) { groups[new Date().getMonth()].push(sub); continue; }
      const d = new Date(dateStr);
      if (d.getFullYear() !== currentYear) continue;
      groups[d.getMonth()].push(sub);
    }
    return groups;
  }, [paidSubs, currentYear]);

  // Summary stats
  const activeCount = paidSubs.filter(
    (s) => s.status === "active" || s.status === "trialing",
  ).length;
  const cancelingCount = paidSubs.filter((s) => s.cancelAtPeriodEnd).length;
  const totalRevenueCents = useMemo(() =>
    invoices
      .filter((inv) => inv.status === "paid" && inv.createdAt &&
        new Date(inv.createdAt).getFullYear() === currentYear)
      .reduce((sum, inv) => sum + (inv.amountDue ?? 0), 0),
    [invoices, currentYear],
  );

  const hasAnyRows = byMonth.some((g) => g.length > 0);

  return (
    <>
      <Card
        className="cursor-pointer select-none transition-all hover:ring-2 hover:ring-green-500/40"
        onClick={handleClick}
        title="Click to open full page · Double-click to preview"
      >
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground leading-tight">
            Paid Subscribers
          </CardTitle>
          <BadgeCheck className="h-3 w-3 sm:h-4 sm:w-4 shrink-0 text-green-500" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl sm:text-3xl font-bold text-green-500">
            {dbPaidSubscriberCount.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Paid via Stripe
            {paidSubscriberCount > 0 && (
              <> · <span className="text-green-500">{paidSubscriberCount} active</span></>
            )}
          </p>
        </CardContent>
      </Card>

      {/* ── Quick-preview dialog (double-click) ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="!max-w-[100vw] !w-screen !h-screen !max-h-screen !rounded-none !p-0 !gap-0 flex flex-col overflow-hidden">

          {/* Fixed header */}
          <div className="flex-none px-8 pt-7 pb-5 border-b bg-background">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-2xl">
                <BadgeCheck className="h-7 w-7 text-green-500" />
                Paid Subscribers — {currentYear}
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm">
                Stripe-paying subscribers grouped by billing period month.
                Double-click a month heading or{" "}
                <button
                  className="underline underline-offset-2 text-foreground hover:text-green-500 transition-colors"
                  onClick={() => { setOpen(false); router.push("/admin/paid-subscribers"); }}
                >
                  open full page
                </button>{" "}
                for the complete view.
              </DialogDescription>
            </DialogHeader>

            {/* Summary chips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
              <div className="rounded-xl border bg-muted/40 px-5 py-4 flex items-center gap-4">
                <Users className="h-7 w-7 text-green-500 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Paid (Stripe DB)</p>
                  <p className="text-2xl font-bold text-green-500">{dbPaidSubscriberCount}</p>
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
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-8 py-6">
            {!hasAnyRows ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                <BadgeCheck className="h-12 w-12 opacity-20" />
                <p className="text-base">No active Stripe subscribers found for {currentYear}.</p>
              </div>
            ) : (
              <div className="space-y-10">
                {MONTHS.map((month, idx) => {
                  const rows = byMonth[idx];
                  if (!rows || rows.length === 0) return null;
                  return (
                    <section key={month}>
                      <div className="flex items-center gap-3 mb-4">
                        <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                          {month} {currentYear}
                        </h3>
                        <span className="rounded-full bg-green-500/10 text-green-500 text-xs font-semibold px-2.5 py-0.5">
                          {rows.length} subscriber{rows.length !== 1 ? "s" : ""}
                        </span>
                        <div className="flex-1 h-px bg-border" />
                      </div>

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
                              const discount = inv
                                ? (inv as SerializedAdminInvoice & { discount?: string | null }).discount ?? null
                                : null;
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
        </DialogContent>
      </Dialog>
    </>
  );
}
