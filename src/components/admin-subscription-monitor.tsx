"use client";

import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
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

type CategoryFilter = AdminBillingMonitorRow["category"] | "all";

const CATEGORY_LABELS: Record<AdminBillingMonitorRow["category"], string> = {
  active_trial: "Active trial",
  trial_ending_soon: "Trial ending soon",
  subscription_expiring: "Subscription expiring",
  payment_failed_grace: "Payment failed (grace)",
  payment_failed_lapsed: "Payment grace expired",
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

export function AdminSubscriptionMonitor({
  rows,
}: {
  rows: AdminBillingMonitorRow[];
}) {
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
        {(Object.keys(CATEGORY_LABELS) as AdminBillingMonitorRow["category"][]).map(
          (key) => (
            <div
              key={key}
              className="rounded-lg border border-border/80 bg-card/40 px-4 py-3"
            >
              <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[key]}</p>
              <p className="text-2xl font-semibold tabular-nums">{counts.get(key) ?? 0}</p>
            </div>
          ),
        )}
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
