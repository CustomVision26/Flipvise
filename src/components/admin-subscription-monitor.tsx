"use client";

import { useMemo, useState, useTransition } from "react";
import { Download, Mail, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import {
  adminIssueDeletionProrationRefundAction,
  adminSendDeletionProrationReceiptAction,
} from "@/actions/admin-deletion-proration";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminBillingMonitorRow } from "@/lib/admin/billing-monitor-snapshot";
import type { SerializedDeletionProrationRow } from "@/lib/admin/deletion-proration-admin-dto";
import { countDeletionProrationOwedFromSerialized } from "@/lib/admin/deletion-proration-admin-dto";
import { formatCentsMoney } from "@/lib/money-math";

type CategoryFilter = AdminBillingMonitorRow["category"] | "all";
type ProrationFilter = "all" | "owed" | "refunded" | "receipt_pending";

const CATEGORY_LABELS: Record<AdminBillingMonitorRow["category"], string> = {
  active_trial: "Active trial",
  trial_ending_soon: "Trial ending soon",
  subscription_expiring: "Subscription expiring",
  payment_failed_grace: "Payment failed (grace)",
  payment_failed_lapsed: "Payment grace expired",
};

const REFUND_STATUS_LABELS: Record<
  SerializedDeletionProrationRow["refundStatus"],
  string
> = {
  auto_issued: "Refunded (auto)",
  manual_issued: "Refunded (manual)",
  auto_failed: "Refund failed",
  pending_manual: "Refund pending",
  not_applicable: "No refund due",
};

function categoryBadgeVariant(
  category: AdminBillingMonitorRow["category"],
): "default" | "secondary" | "destructive" | "outline" {
  switch (category) {
    case "payment_failed_grace":
    case "trial_ending_soon":
      return "destructive";
    case "payment_failed_lapsed":
      return "outline";
    case "active_trial":
      return "default";
    default:
      return "secondary";
  }
}

function refundStatusBadgeVariant(
  status: SerializedDeletionProrationRow["refundStatus"],
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "auto_failed":
    case "pending_manual":
      return "destructive";
    case "auto_issued":
    case "manual_issued":
      return "default";
    default:
      return "secondary";
  }
}

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatLedgerDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

function DeletionProrationRefundStatus({
  row,
}: {
  row: SerializedDeletionProrationRow;
}) {
  const [open, setOpen] = useState(false);
  const isRefunded =
    row.refundStatus === "auto_issued" || row.refundStatus === "manual_issued";
  const refundedAmount =
    row.refundedCents != null
      ? formatCentsMoney(row.refundedCents, row.currency)
      : formatCentsMoney(row.estimatedRefundCents, row.currency);

  return (
    <>
      <div className="space-y-1">
        {isRefunded ? (
          <button
            type="button"
            className="inline-flex rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={() => setOpen(true)}
            aria-label={`View refund details for ${row.userName}`}
          >
            <Badge variant={refundStatusBadgeVariant(row.refundStatus)}>
              {REFUND_STATUS_LABELS[row.refundStatus]}
            </Badge>
          </button>
        ) : (
          <Badge variant={refundStatusBadgeVariant(row.refundStatus)}>
            {REFUND_STATUS_LABELS[row.refundStatus]}
          </Badge>
        )}
        {row.refundError ? (
          <p className="text-xs text-muted-foreground max-w-[14rem]">{row.refundError}</p>
        ) : null}
      </div>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Refund details</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">{row.userName}</span>
                  {row.email ? (
                    <>
                      {" "}
                      (<span className="text-foreground">{row.email}</span>)
                    </>
                  ) : null}{" "}
                  received a prorated refund when their account was deleted.
                </p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
                  <dt>Status</dt>
                  <dd className="text-foreground">{REFUND_STATUS_LABELS[row.refundStatus]}</dd>
                  <dt>Amount</dt>
                  <dd className="text-foreground tabular-nums">{refundedAmount}</dd>
                  <dt>Deleted</dt>
                  <dd className="text-foreground">{formatLedgerDateTime(row.deletedAt)}</dd>
                  <dt>Stripe refund</dt>
                  <dd className="text-foreground font-mono text-xs break-all">
                    {row.stripeRefundId ?? "—"}
                  </dd>
                </dl>
                <p>
                  {row.refundStatus === "auto_issued"
                    ? "This refund was issued automatically when the user deleted their account."
                    : "This refund was issued manually from Subscription monitor."}{" "}
                  Stripe may also send its own refund email if Refunds is enabled under
                  Settings → Business → Customer emails.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Close</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ProrationActions({
  row,
}: {
  row: SerializedDeletionProrationRow;
}) {
  const [pending, startTransition] = useTransition();
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const refundedAmount =
    row.refundedCents != null
      ? formatCentsMoney(row.refundedCents, row.currency)
      : formatCentsMoney(row.estimatedRefundCents, row.currency);

  const issueRefund = () => {
    startTransition(async () => {
      try {
        const result = await adminIssueDeletionProrationRefundAction({
          ledgerId: row.id,
        });
        toast.success(`Stripe refund issued (${result.stripeRefundId}).`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Refund failed.");
      }
    });
  };

  const sendReceipt = () => {
    startTransition(async () => {
      try {
        await adminSendDeletionProrationReceiptAction({ ledgerId: row.id });
        toast.success("Proration receipt email sent.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not send receipt.");
      }
    });
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {row.needsRefund ? (
        <Button type="button" size="xs" variant="destructive" disabled={pending} onClick={issueRefund}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" />
          Refund via Stripe
        </Button>
      ) : null}
      {row.needsReceipt ? (
        <Button type="button" size="xs" variant="outline" disabled={pending} onClick={sendReceipt}>
          <Mail className="mr-1 h-3.5 w-3.5" />
          Send receipt
        </Button>
      ) : null}
      {row.receiptSentAt ? (
        <>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            className="h-auto px-0 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setReceiptDialogOpen(true)}
          >
            Receipt sent
          </Button>
          <AlertDialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
            <AlertDialogContent className="sm:max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle>Receipt sent</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <p>
                      A Flipvise-branded proration receipt was emailed via Loops to{" "}
                      <span className="font-medium text-foreground">
                        {row.email ?? "the address on file"}
                      </span>
                      .
                    </p>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
                      <dt>Sent</dt>
                      <dd className="text-foreground">
                        {formatLedgerDateTime(row.receiptSentAt)}
                      </dd>
                      <dt>Recipient</dt>
                      <dd className="text-foreground break-all">{row.email ?? "—"}</dd>
                      <dt>Refund amount</dt>
                      <dd className="text-foreground tabular-nums">{refundedAmount}</dd>
                      <dt>Stripe refund</dt>
                      <dd className="text-foreground font-mono text-xs break-all">
                        {row.stripeRefundId ?? "—"}
                      </dd>
                    </dl>
                    <p>
                      This is separate from Stripe&apos;s own refund notification email. Check
                      Stripe Customer email logs if you need to confirm whether Stripe also
                      notified the customer.
                    </p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogAction>Close</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : null}
    </div>
  );
}

export function AdminBillingMonitor({ rows }: { rows: AdminBillingMonitorRow[] }) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (categoryFilter !== "all" && row.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        row.userName.toLowerCase().includes(q) ||
        (row.email?.toLowerCase().includes(q) ?? false) ||
        row.planLabel.toLowerCase().includes(q) ||
        row.detail.toLowerCase().includes(q)
      );
    });
  }, [rows, search, categoryFilter]);

  const counts = useMemo(() => {
    const map = new Map<AdminBillingMonitorRow["category"], number>();
    for (const row of rows) {
      map.set(row.category, (map.get(row.category) ?? 0) + 1);
    }
    return map;
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {(Object.keys(CATEGORY_LABELS) as AdminBillingMonitorRow["category"][]).map((key) => (
          <div key={key} className="rounded-lg border border-border/80 bg-card/40 px-4 py-3">
            <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[key]}</p>
            <p className="text-2xl font-semibold tabular-nums">{counts.get(key) ?? 0}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search user, email, plan…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select
            value={categoryFilter}
            onValueChange={(v) => setCategoryFilter(v as CategoryFilter)}
          >
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {(Object.keys(CATEGORY_LABELS) as AdminBillingMonitorRow["category"][]).map(
                (key) => (
                  <SelectItem key={key} value={key}>
                    {CATEGORY_LABELS[key]}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            downloadCsv(
              "billing-monitor.csv",
              ["User", "Email", "Plan", "Category", "Status", "Event", "Detail"],
              filtered.map((row) => [
                row.userName,
                row.email ?? "",
                row.planLabel,
                CATEGORY_LABELS[row.category],
                row.status,
                new Date(row.eventAt).toLocaleString(),
                row.detail,
              ]),
            )
          }
        >
          <Download className="mr-1.5 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border/80">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Detail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No matching billing alerts.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow key={`${row.userId}-${row.category}`}>
                  <TableCell className="font-medium">{row.userName}</TableCell>
                  <TableCell className="text-muted-foreground">{row.email ?? "—"}</TableCell>
                  <TableCell>{row.planLabel}</TableCell>
                  <TableCell>
                    <Badge variant={categoryBadgeVariant(row.category)}>
                      {CATEGORY_LABELS[row.category]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {new Date(row.eventAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm">{row.detail}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function AdminDeletionProrationMonitor({
  rows,
}: {
  rows: SerializedDeletionProrationRow[];
}) {
  const [prorationSearch, setProrationSearch] = useState("");
  const [prorationFilter, setProrationFilter] = useState<ProrationFilter>("all");

  const prorationOwedCount = useMemo(
    () => countDeletionProrationOwedFromSerialized(rows),
    [rows],
  );

  const filteredProration = useMemo(() => {
    const q = prorationSearch.trim().toLowerCase();
    return rows.filter((row) => {
      if (prorationFilter === "owed" && !row.needsRefund) return false;
      if (prorationFilter === "refunded" && row.needsRefund) return false;
      if (prorationFilter === "receipt_pending" && !row.needsReceipt) return false;
      if (!q) return true;
      return (
        row.userName.toLowerCase().includes(q) ||
        (row.email?.toLowerCase().includes(q) ?? false) ||
        row.planLabel.toLowerCase().includes(q) ||
        row.clerkUserId.toLowerCase().includes(q)
      );
    });
  }, [rows, prorationSearch, prorationFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-base font-semibold">Account deletion proration</h3>
          <p className="text-sm text-muted-foreground">
            Paid users who deleted their account before the billing period ended. Issue manual
            Stripe refunds and send receipts when automation did not complete.
          </p>
        </div>
        <div className="rounded-lg border border-border/80 bg-card/40 px-4 py-3 min-w-[10rem]">
          <p className="text-xs text-muted-foreground">Proration still owed</p>
          <p className="text-2xl font-semibold tabular-nums text-destructive">
            {prorationOwedCount}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search deleted user, email…"
              value={prorationSearch}
              onChange={(e) => setProrationSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select
            value={prorationFilter}
            onValueChange={(v) => setProrationFilter(v as ProrationFilter)}
          >
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All deletions</SelectItem>
              <SelectItem value="owed">Refund still owed</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
              <SelectItem value="receipt_pending">Receipt not sent</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            downloadCsv(
              "deletion-proration-ledger.csv",
              [
                "User",
                "Email",
                "Plan",
                "Deleted",
                "Period end",
                "Owed",
                "Refunded",
                "Status",
                "Stripe refund",
                "Receipt sent",
              ],
              filteredProration.map((row) => [
                row.userName,
                row.email ?? "",
                row.planLabel,
                new Date(row.deletedAt).toLocaleString(),
                row.subscriptionPeriodEnd
                  ? new Date(row.subscriptionPeriodEnd).toLocaleDateString()
                  : "",
                formatCentsMoney(row.estimatedRefundCents, row.currency),
                row.refundedCents != null
                  ? formatCentsMoney(row.refundedCents, row.currency)
                  : "",
                REFUND_STATUS_LABELS[row.refundStatus],
                row.stripeRefundId ?? "",
                row.receiptSentAt ? new Date(row.receiptSentAt).toLocaleString() : "",
              ]),
            )
          }
        >
          <Download className="mr-1.5 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border/80">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Deleted</TableHead>
              <TableHead>Period end</TableHead>
              <TableHead>Owed</TableHead>
              <TableHead>Refund status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProration.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No account-deletion proration records yet.
                </TableCell>
              </TableRow>
            ) : (
              filteredProration.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.userName}</TableCell>
                  <TableCell className="text-muted-foreground">{row.email ?? "—"}</TableCell>
                  <TableCell>{row.planLabel}</TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {new Date(row.deletedAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {row.subscriptionPeriodEnd
                      ? new Date(row.subscriptionPeriodEnd).toLocaleDateString()
                      : "—"}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums whitespace-nowrap">
                    {formatCentsMoney(row.estimatedRefundCents, row.currency)}
                  </TableCell>
                  <TableCell>
                    <DeletionProrationRefundStatus row={row} />
                  </TableCell>
                  <TableCell>
                    <ProrationActions row={row} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
