"use client";

import { Fragment, useState, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AssignUserPlanButton } from "@/components/assign-user-plan-button";
import { ToggleAdminRoleButton } from "@/components/toggle-admin-role-button";
import { BanUserButton } from "@/components/ban-user-button";
import {
  Search,
  Users,
  ShieldCheck,
  ShieldOff,
  ClipboardList,
  LifeBuoy,
  Building2,
  ReceiptText,
  WalletCards,
  Download,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutList,
  Megaphone,
} from "lucide-react";
import {
  AdminSupportPanel,
  type SerializedTicket,
  type SupportStats,
} from "@/components/admin-support-panel";
import { AdminPlansEditor } from "@/components/admin-plans-editor";
import { AdminAffiliatesPanel } from "@/components/admin-affiliates-panel";
import type {
  SerializedAdminInvoice,
  SerializedAdminSubscription,
  SerializedAdminWorkspace,
  SerializedAffiliate,
  SerializedLog,
  SerializedPlanAssignmentLog,
  SerializedUser,
} from "@/lib/admin-dashboard-types";
import { TEAM_PLAN_LABELS } from "@/lib/team-plans";
import type { PlanConfig } from "@/components/pricing-content";

export type { SerializedUser, SerializedLog } from "@/lib/admin-dashboard-types";

export interface AdminTabsProps {
  currentUserId: string;
  callerIsSuperadmin: boolean;
  users: SerializedUser[];
  logs: SerializedLog[];
  planAssignmentLogs: SerializedPlanAssignmentLog[];
  subscriptions: SerializedAdminSubscription[];
  invoices: SerializedAdminInvoice[];
  supportTickets: SerializedTicket[];
  supportStats: SupportStats;
  plansConfig: PlanConfig[];
  affiliates: SerializedAffiliate[];
  /** Server default (env) — used as the initial value for “accept link” days in the invite form. */
  affiliateInviteDefaultExpiresInDays: number;
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type PlanFilter = "all" | "pro" | "free";
type RoleFilter = "all" | "admin" | "user";
type StatusFilter = "all" | "online" | "offline" | "banned";
type BillingSubscriptionStatusFilter =
  | "all"
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "inactive";
type BillingInvoiceStatusFilter =
  | "all"
  | "paid"
  | "open"
  | "draft"
  | "void"
  | "uncollectible"
  | "unknown";
type PaidOnlyFilter = "all" | "paid-only";

function csvValue(value: string | number | boolean | null | undefined): string {
  if (value == null) return "";
  const text = String(value);
  if (!text.includes(",") && !text.includes('"') && !text.includes("\n")) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv(filename: string, headers: string[], rows: (string | number | boolean | null | undefined)[][]) {
  const csv = [headers.map(csvValue).join(",")]
    .concat(rows.map((row) => row.map(csvValue).join(",")))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function AdminTabs({
  currentUserId,
  callerIsSuperadmin,
  users,
  logs,
  planAssignmentLogs,
  subscriptions,
  invoices,
  supportTickets,
  supportStats,
  plansConfig,
  affiliates,
  affiliateInviteDefaultExpiresInDays,
}: AdminTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<PlanFilter>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [paidOnlyFilter, setPaidOnlyFilter] = useState<PaidOnlyFilter>("all");
  const [subscriptionStatusFilter, setSubscriptionStatusFilter] =
    useState<BillingSubscriptionStatusFilter>("all");
  const [invoiceStatusFilter, setInvoiceStatusFilter] =
    useState<BillingInvoiceStatusFilter>("all");
  const [invoiceDateFrom, setInvoiceDateFrom] = useState("");
  const [invoiceDateTo, setInvoiceDateTo] = useState("");
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [expandedAllUsersUserId, setExpandedAllUsersUserId] = useState<string | null>(null);
  const [expandedWorkspaceUserId, setExpandedWorkspaceUserId] = useState<string | null>(null);
  const [workspaceDialog, setWorkspaceDialog] = useState<SerializedAdminWorkspace | null>(null);
  const activeSection:
    | "all-users"
    | "workspace-admin"
    | "subscription"
    | "invoices"
    | "admin-roles"
    | "audit-log"
    | "support-center"
    | "plans"
    | "marketing-affiliates"
    | "plan-history" =
    pathname === "/admin/team-workspaces"
      ? "workspace-admin"
      : pathname === "/admin/subscription"
        ? "subscription"
        : pathname === "/admin/invoices"
          ? "invoices"
      : pathname === "/admin/admin-roles"
        ? "admin-roles"
        : pathname === "/admin/audit-log"
          ? "audit-log"
          : pathname === "/admin/support-center"
            ? "support-center"
            : pathname === "/admin/plans"
              ? "plans"
              : pathname === "/admin/marketing-affiliates"
                ? "marketing-affiliates"
                : pathname === "/admin/plan-history"
                  ? "plan-history"
                  : "all-users";

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (q) {
        const nameMatch = u.fullName.toLowerCase().includes(q);
        const emailMatch = (u.email ?? "").toLowerCase().includes(q);
        if (!nameMatch && !emailMatch) return false;
      }
      if (planFilter === "pro" && u.planDisplayName === "Free") return false;
      if (planFilter === "free" && u.planDisplayName !== "Free") return false;
      if (roleFilter === "admin" && !u.isAdmin) return false;
      if (roleFilter === "user" && u.isAdmin) return false;
      if (statusFilter === "online" && !u.isOnline) return false;
      if (statusFilter === "offline" && (u.isOnline || u.isBanned)) return false;
      if (statusFilter === "banned" && !u.isBanned) return false;
      return true;
    });
  }, [users, search, planFilter, roleFilter, statusFilter]);

  const bannedCount = users.filter((u) => u.isBanned).length;
  const subscriptionRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return subscriptions.filter((row) => {
      if (q) {
        const nameMatch = row.userName.toLowerCase().includes(q);
        const emailMatch = (row.email ?? "").toLowerCase().includes(q);
        const planMatch = row.planSlug.toLowerCase().includes(q);
        if (!nameMatch && !emailMatch && !planMatch) return false;
      }
      if (paidOnlyFilter === "paid-only") {
        const status = row.status.toLowerCase();
        const looksPaid = status === "active" || status === "trialing";
        if (!looksPaid) return false;
      }
      if (
        subscriptionStatusFilter !== "all" &&
        row.status.toLowerCase() !== subscriptionStatusFilter
      ) {
        return false;
      }
      return true;
    });
  }, [search, subscriptions, paidOnlyFilter, subscriptionStatusFilter]);

  const invoiceRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromMs = invoiceDateFrom ? Date.parse(invoiceDateFrom) : null;
    const toMs = invoiceDateTo ? Date.parse(invoiceDateTo) + 24 * 60 * 60 * 1000 - 1 : null;

    return invoices.filter((row) => {
      if (q) {
        const invoiceMatch = row.invoiceNumber.toLowerCase().includes(q);
        const nameMatch = row.userName.toLowerCase().includes(q);
        const emailMatch = (row.email ?? "").toLowerCase().includes(q);
        if (!invoiceMatch && !nameMatch && !emailMatch) return false;
      }
      if (invoiceStatusFilter !== "all" && row.status.toLowerCase() !== invoiceStatusFilter) {
        return false;
      }
      if ((fromMs != null || toMs != null) && row.createdAt) {
        const rowMs = Date.parse(row.createdAt);
        if (fromMs != null && rowMs < fromMs) return false;
        if (toMs != null && rowMs > toMs) return false;
      } else if ((fromMs != null || toMs != null) && !row.createdAt) {
        return false;
      }
      return true;
    });
  }, [search, invoices, invoiceStatusFilter, invoiceDateFrom, invoiceDateTo]);

  const teamTierLabelValues = Object.values(TEAM_PLAN_LABELS);
  const teamWorkspaceUsers = users.filter((u) => {
    const q = search.trim().toLowerCase();
    if (q) {
      const nameMatch = u.fullName.toLowerCase().includes(q);
      const emailMatch = (u.email ?? "").toLowerCase().includes(q);
      if (!nameMatch && !emailMatch) return false;
    }
    if (roleFilter === "admin" && !u.isAdmin) return false;
    if (roleFilter === "user" && u.isAdmin) return false;
    if (statusFilter === "online" && !u.isOnline) return false;
    if (statusFilter === "offline" && (u.isOnline || u.isBanned)) return false;
    if (statusFilter === "banned" && !u.isBanned) return false;
    if (u.teamTierPlanSlug !== null) return true;
    return teamTierLabelValues.some((label) =>
      u.planDisplayName.toLowerCase().includes(label.toLowerCase()),
    );
  });

  return (
    <div className={`grid gap-4 ${sidebarHidden ? "grid-cols-1" : "lg:grid-cols-[15rem_minmax(0,1fr)]"}`}>
      {sidebarHidden ? null : (
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Admin Menu</CardTitle>
              <button
                type="button"
                onClick={() => setSidebarHidden(true)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-accent/50"
                aria-label="Hide admin menu"
                title="Hide admin menu"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <button
              type="button"
              onClick={() => router.push("/admin/all-users")}
              className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${activeSection === "all-users" ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"}`}
            >
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                All Users
                {bannedCount > 0 ? (
                  <Badge variant="destructive" className="ml-auto text-xs">
                    {bannedCount}
                  </Badge>
                ) : null}
              </span>
            </button>
            <button
              type="button"
              onClick={() => router.push("/admin/team-workspaces")}
              className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${activeSection === "workspace-admin" ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"}`}
            >
              <span className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Team Workspaces
              </span>
            </button>
            <button
              type="button"
              onClick={() => router.push("/admin/subscription")}
              className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${activeSection === "subscription" ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"}`}
            >
              <span className="flex items-center gap-2">
                <WalletCards className="h-4 w-4" />
                Subscription
              </span>
            </button>
            <button
              type="button"
              onClick={() => router.push("/admin/invoices")}
              className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${activeSection === "invoices" ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"}`}
            >
              <span className="flex items-center gap-2">
                <ReceiptText className="h-4 w-4" />
                Invoices
              </span>
            </button>
            <button
              type="button"
              onClick={() => router.push("/admin/admin-roles")}
              className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${activeSection === "admin-roles" ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"}`}
            >
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Admin Roles
              </span>
            </button>
            <button
              type="button"
              onClick={() => router.push("/admin/audit-log")}
              className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${activeSection === "audit-log" ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"}`}
            >
              <span className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Audit Log
                {logs.length > 0 ? (
                  <Badge className="ml-auto text-xs" variant="secondary">
                    {logs.length}
                  </Badge>
                ) : null}
              </span>
            </button>
            <button
              type="button"
              onClick={() => router.push("/admin/support-center")}
              className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${activeSection === "support-center" ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"}`}
            >
              <span className="flex items-center gap-2">
                <LifeBuoy className="h-4 w-4" />
                Support Center
                {supportStats.totals.openCount > 0 ? (
                  <Badge className="ml-auto text-xs" variant="destructive">
                    {supportStats.totals.openCount}
                  </Badge>
                ) : null}
              </span>
            </button>
            <button
              type="button"
              onClick={() => router.push("/admin/plans")}
              className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${activeSection === "plans" ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"}`}
            >
              <span className="flex items-center gap-2">
                <LayoutList className="h-4 w-4" />
                Plans
              </span>
            </button>
            <button
              type="button"
              onClick={() => router.push("/admin/marketing-affiliates")}
              className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${activeSection === "marketing-affiliates" ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"}`}
            >
              <span className="flex items-center gap-2">
                <Megaphone className="h-4 w-4" />
                Marketing Affiliates
                {(() => {
                  const active = affiliates.filter((a) => a.status === "active").length;
                  const pending = affiliates.filter((a) => a.status === "pending").length;
                  const total = active + pending;
                  return total > 0 ? (
                    <span className="ml-auto flex items-center gap-1">
                      {active > 0 && (
                        <Badge className="text-xs" variant="secondary">{active}</Badge>
                      )}
                      {pending > 0 && (
                        <Badge className="text-xs border-amber-500 text-amber-500" variant="outline">{pending} pending</Badge>
                      )}
                    </span>
                  ) : null;
                })()}
              </span>
            </button>
            <button
              type="button"
              onClick={() => router.push("/admin/plan-history")}
              className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${activeSection === "plan-history" ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"}`}
            >
              <span className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Plan History
                {planAssignmentLogs.length > 0 ? (
                  <Badge className="ml-auto text-xs" variant="secondary">
                    {planAssignmentLogs.length}
                  </Badge>
                ) : null}
              </span>
            </button>
          </CardContent>
        </Card>
      )}

      <div>
      {sidebarHidden ? (
        <div className="mb-3">
          <button
            type="button"
            onClick={() => setSidebarHidden(false)}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent/50"
            aria-label="Show admin menu"
          >
            <PanelLeftOpen className="h-4 w-4" />
            Show Admin Menu
          </button>
        </div>
      ) : null}
      {activeSection === "all-users" ? (
        <Card className="rounded-tl-none border-t-0">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>All Users</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {filteredUsers.length} of {users.length} users
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Double-click a user row to expand personal plan details.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {/* Search */}
                <div className="relative w-full sm:w-auto sm:min-w-[220px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search by name or email…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 w-full"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {/* Plan filter */}
                  <Select
                    value={planFilter}
                    onValueChange={(v) => setPlanFilter(v as PlanFilter)}
                  >
                    <SelectTrigger className="w-[calc(50%-4px)] sm:w-[130px]">
                      <SelectValue placeholder="Plan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Plans</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="free">Free</SelectItem>
                    </SelectContent>
                  </Select>
                  {/* Role filter */}
                  <Select
                    value={roleFilter}
                    onValueChange={(v) => setRoleFilter(v as RoleFilter)}
                  >
                    <SelectTrigger className="w-[calc(50%-4px)] sm:w-[130px]">
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                    </SelectContent>
                  </Select>
                  {/* Status filter */}
                  <Select
                    value={statusFilter}
                    onValueChange={(v) => setStatusFilter(v as StatusFilter)}
                  >
                    <SelectTrigger className="w-full sm:w-[130px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="offline">Offline</SelectItem>
                      <SelectItem value="banned">Banned</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Associate plan</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Last Sign-in</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-muted-foreground py-10"
                    >
                      No users match your search or filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => {
                    const isExpanded = expandedAllUsersUserId === user.id;
                    return (
                      <Fragment key={user.id}>
                        <TableRow
                          onDoubleClick={() =>
                            setExpandedAllUsersUserId((current) =>
                              current === user.id ? null : user.id,
                            )
                          }
                          className={`cursor-pointer ${
                            isExpanded ? "bg-accent/60 hover:bg-accent/60" : ""
                          } ${user.isBanned ? "opacity-60" : ""}`}
                        >
                          <TableCell className="font-medium whitespace-nowrap">
                            <span className="flex items-center gap-2">
                              {user.fullName}
                              {user.isSuperadmin && (
                                <Badge variant="default" className="text-xs py-0">
                                  Owner/Superadmin
                                </Badge>
                              )}
                              {user.isAdmin && !user.isSuperadmin && (
                                <Badge variant="destructive" className="text-xs py-0">
                                  Admin
                                </Badge>
                              )}
                              {user.isBanned && (
                                <Badge variant="outline" className="text-xs py-0 border-destructive text-destructive">
                                  Banned
                                </Badge>
                              )}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                            {user.email ?? "—"}
                          </TableCell>
                          <TableCell className="max-w-[11rem]">
                            <Badge
                              className="text-xs font-normal whitespace-normal text-left h-auto min-h-7 max-w-full py-1 leading-snug"
                              variant={user.planDisplayName === "Free" ? "secondary" : "default"}
                            >
                              {user.planDisplayName}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[12rem]">
                            {user.associatePlan ? (
                              <span className="line-clamp-2">{user.associatePlan}</span>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                            {formatDate(user.planSetAt)}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                            {formatDate(user.createdAt)}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                            {user.lastSignInAt ? formatDate(user.lastSignInAt) : "Never"}
                          </TableCell>
                          <TableCell>
                            <div
                              className="flex items-center gap-1.5"
                              onDoubleClick={(event) => event.stopPropagation()}
                            >
                              <AssignUserPlanButton
                                targetUserId={user.id}
                                targetUserName={user.fullName}
                                targetUserEmail={user.email}
                                isSelf={user.id === currentUserId}
                                targetIsPlatformOwner={user.isSuperadmin}
                                currentResolvedPlan={user.currentPersonalPlan}
                                billingPlan={user.billingPlan}
                                billingStatus={user.billingStatus}
                                billingPlanUpdatedAt={user.billingPlanUpdatedAt}
                                adminPlan={user.adminPlan}
                                adminPlanUpdatedAt={user.adminPlanUpdatedAt}
                              />
                              <BanUserButton
                                targetUserId={user.id}
                                targetUserName={user.fullName}
                                targetUserEmail={user.email}
                                isBanned={user.isBanned}
                                isSelf={user.id === currentUserId}
                                callerIsSuperadmin={callerIsSuperadmin}
                                targetIsSuperadmin={user.isSuperadmin}
                                targetIsCoAdmin={user.isAdmin && !user.isSuperadmin}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                        {isExpanded ? (
                          <TableRow>
                            <TableCell colSpan={8} className="bg-muted/20 py-3">
                              <div className="overflow-x-auto">
                                <div className="grid min-w-[52rem] gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                  <div className="rounded-md border bg-background p-3">
                                    <p className="text-xs text-muted-foreground">Clerk Plan</p>
                                    <p className="mt-1 text-sm font-medium">{user.clerkPlan}</p>
                                  </div>
                                  <div className="rounded-md border bg-background p-3">
                                    <p className="text-xs text-muted-foreground">Admin Assigned Plan</p>
                                    <p className="mt-1 text-sm font-medium">{user.adminAssignedPlan}</p>
                                  </div>
                                  <div className="rounded-md border bg-background p-3">
                                    <p className="text-xs text-muted-foreground">Current Personal Plan</p>
                                    <p className="mt-1 text-sm font-medium">{user.currentPersonalPlan}</p>
                                  </div>
                                  <div className="rounded-md border bg-background p-3">
                                    <p className="text-xs text-muted-foreground">
                                      Personal Plan Start Time
                                    </p>
                                    <p className="mt-1 text-sm font-medium">
                                      {formatDateTime(user.currentPersonalPlanDateTime)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {activeSection === "workspace-admin" ? (
        <Card className="rounded-tl-none border-t-0">
          <CardHeader>
            <CardTitle>Team Workspace Management</CardTitle>
            <p className="text-sm text-muted-foreground">
              Assign a team-tier plan first, then create a workspace for that user directly from
              this table.
            </p>
            <p className="text-xs text-muted-foreground">
              Double-click a user row to view workspace-level details. Only one user can be expanded
              at a time.
            </p>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Workspaces</TableHead>
                  <TableHead>Total Workspace</TableHead>
                  <TableHead>Total Invitees</TableHead>
                  <TableHead>Workspace action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamWorkspaceUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                      No team-tier users match your search or filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  teamWorkspaceUsers.map((user) => {
                    const isExpanded = expandedWorkspaceUserId === user.id;
                    return (
                      <Fragment key={user.id}>
                        {/* Tooltips use the root layout TooltipProvider only — avoid a Provider per row
                            (many Base UI portals/providers caused removeChild DOM crashes). */}
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <TableRow
                                onDoubleClick={() =>
                                  setExpandedWorkspaceUserId((current) =>
                                    current === user.id ? null : user.id,
                                  )
                                }
                                className="cursor-pointer"
                              />
                            }
                          >
                            <TableCell className="font-medium whitespace-nowrap">{user.fullName}</TableCell>
                            <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                              {user.email ?? "—"}
                            </TableCell>
                            <TableCell className="max-w-[12rem]">
                              <Badge
                                className="text-xs font-normal whitespace-normal text-left h-auto min-h-7 max-w-full py-1 leading-snug"
                                variant={user.planDisplayName === "Free" ? "secondary" : "default"}
                              >
                                {user.planDisplayName}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {user.workspaceCreatedCount}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {user.workspaceTotalCount ?? "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {user.totalInviteesCount}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <AssignUserPlanButton
                                  targetUserId={user.id}
                                  targetUserName={user.fullName}
                                  targetUserEmail={user.email}
                                  isSelf={user.id === currentUserId}
                                  targetIsPlatformOwner={user.isSuperadmin}
                                  currentResolvedPlan={user.currentPersonalPlan}
                                  billingPlan={user.billingPlan}
                                  billingStatus={user.billingStatus}
                                  billingPlanUpdatedAt={user.billingPlanUpdatedAt}
                                  adminPlan={user.adminPlan}
                                  adminPlanUpdatedAt={user.adminPlanUpdatedAt}
                                />
                              </div>
                            </TableCell>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            Double-click to view workspaces created by this user.
                          </TooltipContent>
                        </Tooltip>
                        {isExpanded ? (
                          <TableRow>
                            <TableCell colSpan={7} className="bg-muted/20">
                              {user.workspaces.length === 0 ? (
                                <p className="py-3 text-sm text-muted-foreground">
                                  No workspaces found for this user.
                                </p>
                              ) : (
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Workspace</TableHead>
                                      <TableHead>Open</TableHead>
                                      <TableHead>Invitee total</TableHead>
                                      <TableHead>Invitee role split</TableHead>
                                      <TableHead>Decks total</TableHead>
                                      <TableHead>Cards total</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {user.workspaces.map((workspace) => (
                                      <TableRow key={workspace.id}>
                                        <TableCell className="font-medium">{workspace.name}</TableCell>
                                        <TableCell>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              setWorkspaceDialog(workspace);
                                            }}
                                          >
                                            Open workspace
                                          </Button>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                          {workspace.inviteeTotal}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                          admin: {workspace.inviteeAdminTotal}, member: {workspace.inviteeMemberTotal}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                          {workspace.deckTotal}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                          {workspace.cardTotal}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              )}
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
            <Dialog
              open={workspaceDialog !== null}
              onOpenChange={(open) => {
                if (!open) setWorkspaceDialog(null);
              }}
            >
              <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-[95vw] lg:max-w-6xl xl:max-w-7xl">
                {workspaceDialog ? (
                  <>
                    <DialogHeader>
                      <DialogTitle>Workspace Details</DialogTitle>
                      <DialogDescription>
                        Owner: {workspaceDialog.ownerName} | Workspace: {workspaceDialog.name}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs text-muted-foreground">
                            Invitees
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 text-xl font-semibold">
                          {workspaceDialog.inviteeTotal}
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs text-muted-foreground">
                            Invitee Admins
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 text-xl font-semibold">
                          {workspaceDialog.inviteeAdminTotal}
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs text-muted-foreground">
                            Decks
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 text-xl font-semibold">
                          {workspaceDialog.deckTotal}
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs text-muted-foreground">
                            Cards
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 text-xl font-semibold">
                          {workspaceDialog.cardTotal}
                        </CardContent>
                      </Card>
                    </div>
                    <div className="max-h-[60vh] overflow-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Invitee Name</TableHead>
                            <TableHead>Invitee Email</TableHead>
                            <TableHead>Invitee Role</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Decks Assigned to Invitee</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {workspaceDialog.invitees.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={5}
                                className="py-8 text-center text-sm text-muted-foreground"
                              >
                                No invitees found for this workspace.
                              </TableCell>
                            </TableRow>
                          ) : (
                            workspaceDialog.invitees.map((invitee, index) => (
                              <TableRow key={`${invitee.userId ?? invitee.email ?? "invitee"}-${index}`}>
                                <TableCell className="font-medium">
                                  {invitee.name ??
                                    (invitee.membershipStatus === "pending"
                                      ? "Pending invite"
                                      : "Active member")}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {invitee.email ?? "—"}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={invitee.role === "admin" ? "default" : "secondary"}>
                                    {invitee.role === "admin" ? "Admin" : "Member"}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant={
                                      invitee.membershipStatus === "active"
                                        ? "secondary"
                                        : "outline"
                                    }
                                  >
                                    {invitee.membershipStatus === "active" ? "Active" : "Pending"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {invitee.assignedDeckNames.length > 0
                                    ? invitee.assignedDeckNames.join(", ")
                                    : "—"}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                ) : null}
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      ) : null}

      {activeSection === "subscription" ? (
        <Card className="rounded-tl-none border-t-0">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Subscription Management</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Track billing status, active plan, and renewal windows for each user.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  downloadCsv(
                    "admin-subscriptions.csv",
                    [
                      "User",
                      "Email",
                      "Plan",
                      "Status",
                      "Current Period Start",
                      "Current Period End",
                      "Next Payment",
                      "Auto Renew",
                      "Last Billing Sync",
                    ],
                    subscriptionRows.map((row) => [
                      row.userName,
                      row.email,
                      row.planSlug,
                      row.status,
                      row.currentPeriodStart,
                      row.currentPeriodEnd,
                      row.nextPaymentDate,
                      row.cancelAtPeriodEnd ? "No (cancels at period end)" : "Yes",
                      row.sourceUpdatedAt,
                    ]),
                  )
                }
              >
                <Download className="mr-1.5 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <div className="flex flex-col gap-2 border-b p-4 sm:flex-row sm:items-center">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search user, email, or plan…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select
                value={subscriptionStatusFilter}
                onValueChange={(v) =>
                  setSubscriptionStatusFilter(v as BillingSubscriptionStatusFilter)
                }
              >
                <SelectTrigger className="w-full sm:w-[190px]">
                  <SelectValue placeholder="Subscription status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="trialing">Trialing</SelectItem>
                  <SelectItem value="past_due">Past Due</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={paidOnlyFilter}
                onValueChange={(v) => setPaidOnlyFilter(v as PaidOnlyFilter)}
              >
                <SelectTrigger className="w-full sm:w-[170px]">
                  <SelectValue placeholder="Paid users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="paid-only">Paid Users Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Current Period</TableHead>
                  <TableHead>Next Payment</TableHead>
                  <TableHead>Auto-Renew</TableHead>
                  <TableHead>Last Billing Sync</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptionRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                      No subscription records available.
                    </TableCell>
                  </TableRow>
                ) : (
                  subscriptionRows.map((row) => (
                    <TableRow key={row.userId}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {row.userName}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {row.email ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.planSlug === "Free" ? "secondary" : "default"}>
                          {row.planSlug}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {row.status}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {row.currentPeriodStart
                          ? `${formatDate(row.currentPeriodStart)} - ${formatDate(row.currentPeriodEnd)}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(row.nextPaymentDate)}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        <Badge variant={row.cancelAtPeriodEnd ? "outline" : "secondary"}>
                          {row.cancelAtPeriodEnd ? "Cancels at period end" : "Renews"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {row.sourceUpdatedAt ? formatDateTime(row.sourceUpdatedAt) : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {activeSection === "invoices" ? (
        <Card className="rounded-tl-none border-t-0">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Invoice Management</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Review invoice status and open hosted invoice links when available.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  downloadCsv(
                    "admin-invoices.csv",
                    [
                      "Invoice Number",
                      "User",
                      "Email",
                      "Status",
                      "Amount Due",
                      "Currency",
                      "Created",
                      "Period Start",
                      "Period End",
                      "Hosted Invoice URL",
                      "Invoice PDF URL",
                    ],
                    invoiceRows.map((row) => [
                      row.invoiceNumber,
                      row.userName,
                      row.email,
                      row.status,
                      row.amountDue,
                      row.currency,
                      row.createdAt,
                      row.periodStart,
                      row.periodEnd,
                      row.hostedInvoiceUrl,
                      row.invoicePdfUrl,
                    ]),
                  )
                }
              >
                <Download className="mr-1.5 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <div className="grid gap-2 border-b p-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search invoice, user, or email…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select
                value={invoiceStatusFilter}
                onValueChange={(v) => setInvoiceStatusFilter(v as BillingInvoiceStatusFilter)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Invoice status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="void">Void</SelectItem>
                  <SelectItem value="uncollectible">Uncollectible</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={invoiceDateFrom}
                onChange={(e) => setInvoiceDateFrom(e.target.value)}
              />
              <Input
                type="date"
                value={invoiceDateTo}
                onChange={(e) => setInvoiceDateTo(e.target.value)}
              />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Amount Due</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoiceRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      No invoice data returned by the billing provider yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  invoiceRows.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {invoice.invoiceNumber}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex flex-col">
                          <span>{invoice.userName}</span>
                          <span className="text-xs text-muted-foreground">
                            {invoice.email ?? "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {invoice.status}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {invoice.amountDue != null
                          ? `${invoice.amountDue.toLocaleString()} ${invoice.currency ?? ""}`.trim()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(invoice.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {invoice.periodStart
                          ? `${formatDate(invoice.periodStart)} - ${formatDate(invoice.periodEnd)}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {invoice.hostedInvoiceUrl ? (
                            <a
                              href={invoice.hostedInvoiceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className={buttonVariants({ size: "sm", variant: "outline" })}
                            >
                              Open
                            </a>
                          ) : null}
                          {invoice.invoicePdfUrl ? (
                            <a
                              href={invoice.invoicePdfUrl}
                              target="_blank"
                              rel="noreferrer"
                              className={buttonVariants({ size: "sm", variant: "secondary" })}
                            >
                              PDF
                            </a>
                          ) : null}
                          {!invoice.hostedInvoiceUrl && !invoice.invoicePdfUrl ? (
                            <span className="text-xs text-muted-foreground">No links</span>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {/* ── Admin Role Management ── */}
      {activeSection === "admin-roles" ? (
        <Card className="rounded-tl-none border-t-0">
          <CardHeader>
            <CardTitle>Admin Role Management</CardTitle>
            <p className="text-sm text-muted-foreground">
              Only the platform owner can grant or revoke co-admin roles. Every
              change is recorded in the Privilege Audit Log tab.
            </p>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Current Role</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow
                    key={user.id}
                    className={user.isBanned ? "opacity-50" : ""}
                  >
                    <TableCell className="font-medium whitespace-nowrap">
                      <span className="flex items-center gap-2">
                        {user.fullName}
                        {user.isBanned && (
                          <Badge variant="outline" className="text-xs py-0 border-destructive text-destructive">
                            Banned
                          </Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {user.email ?? "—"}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5">
                        {user.isSuperadmin ? (
                          <>
                            <ShieldCheck className="h-4 w-4 text-primary" />
                            <Badge variant="default" className="text-xs">
                              Owner/Superadmin
                            </Badge>
                          </>
                        ) : user.isAdmin ? (
                          <>
                            <ShieldCheck className="h-4 w-4 text-destructive" />
                            <Badge variant="destructive" className="text-xs">
                              Co-admin
                            </Badge>
                          </>
                        ) : (
                          <>
                            <ShieldOff className="h-4 w-4 text-muted-foreground" />
                            <Badge variant="secondary" className="text-xs">
                              User
                            </Badge>
                          </>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>
                      <ToggleAdminRoleButton
                        targetUserId={user.id}
                        targetUserName={user.fullName}
                        targetUserEmail={user.email}
                        isCoAdmin={user.isAdmin && !user.isSuperadmin}
                        targetIsSuperadmin={user.isSuperadmin}
                        isSelf={user.id === currentUserId}
                        callerIsSuperadmin={callerIsSuperadmin}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {/* ── Privilege Audit Log ── */}
      {activeSection === "audit-log" ? (
        <Card className="rounded-tl-none border-t-0">
          <CardHeader>
            <CardTitle>Admin Privilege Audit Log</CardTitle>
            <p className="text-sm text-muted-foreground">
              A full record of every admin role grant and revocation, showing
              who made each change and when.
            </p>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {logs.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">
                No privilege changes recorded yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Target User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Granted By</TableHead>
                    <TableHead>Date &amp; Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {log.targetUserName}
                      </TableCell>
                      <TableCell>
                        {log.action === "granted" || log.action === "superadmin_granted" ? (
                          <Badge
                            variant={log.action === "superadmin_granted" ? "default" : "secondary"}
                            className="text-xs gap-1"
                          >
                            <ShieldCheck className="h-3 w-3" />
                            {log.action === "superadmin_granted"
                              ? "Owner role"
                              : "Co-admin granted"}
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs gap-1">
                            <ShieldOff className="h-3 w-3" />
                            {log.action === "superadmin_revoked"
                              ? "Owner revoked"
                              : "Co-admin revoked"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {log.grantedByName}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {formatDateTime(log.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* ── Plan Assignment History ── */}
      {activeSection === "plan-history" ? (
        <Card className="rounded-tl-none border-t-0">
          <CardHeader>
            <CardTitle>Plan Assignment &amp; Ban History</CardTitle>
            <p className="text-sm text-muted-foreground">
              A full record of every plan assignment and user ban/unban performed by admins,
              showing the user affected, previous and new plan, and who made the change.
            </p>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {planAssignmentLogs.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">
                No plan or ban actions recorded yet. Changes will appear here automatically after any
                plan assignment or user ban.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Previous Plan</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>New Plan</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Date &amp; Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {planAssignmentLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="font-medium whitespace-nowrap">{log.targetUserName}</div>
                        {log.targetUserEmail ? (
                          <div className="text-xs text-muted-foreground">{log.targetUserEmail}</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {log.action === "user_banned" || log.action === "user_unbanned"
                          ? <span className="text-muted-foreground/60">—</span>
                          : (log.previousPlanName ?? "Free")}
                      </TableCell>
                      <TableCell>
                        {log.action === "plan_assigned" ? (
                          <Badge variant="secondary" className="text-xs gap-1 whitespace-nowrap">
                            <ShieldCheck className="h-3 w-3" />
                            Plan Assigned
                          </Badge>
                        ) : log.action === "plan_removed" ? (
                          <Badge variant="outline" className="text-xs gap-1 whitespace-nowrap">
                            <ShieldOff className="h-3 w-3" />
                            Plan Removed
                          </Badge>
                        ) : log.action === "user_banned" ? (
                          <Badge variant="destructive" className="text-xs gap-1 whitespace-nowrap">
                            <ShieldOff className="h-3 w-3" />
                            User Banned
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs gap-1 whitespace-nowrap border-emerald-500 text-emerald-500">
                            <ShieldCheck className="h-3 w-3" />
                            User Unbanned
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {log.action === "user_banned" || log.action === "user_unbanned"
                          ? <span className="text-muted-foreground/60">—</span>
                          : <span className="font-medium">{log.planName ?? "Free"}</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {log.assignedByName}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {formatDateTime(log.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* ── Support Center ── */}
      {activeSection === "support-center" ? (
      <div className="mt-0 px-4 pb-8 sm:px-6">
        <AdminSupportPanel tickets={supportTickets} stats={supportStats} />
      </div>
      ) : null}

      {/* ── Plans Editor ── */}
      {activeSection === "plans" ? (
        <Card className="rounded-tl-none border-t-0">
          <CardHeader>
            <CardTitle>Pricing Plans</CardTitle>
            <p className="text-sm text-muted-foreground">
              Edit plan names, prices, descriptions, and features. Changes are saved to the pricing
              page immediately after clicking Save on each plan card.
            </p>
          </CardHeader>
          <CardContent>
            <AdminPlansEditor initialPlans={plansConfig} />
          </CardContent>
        </Card>
      ) : null}

      {/* ── Marketing Affiliates ── */}
      {activeSection === "marketing-affiliates" ? (
        <AdminAffiliatesPanel
          affiliates={affiliates}
          defaultInviteExpiresInDays={affiliateInviteDefaultExpiresInDays}
        />
      ) : null}
      </div>
    </div>
  );
}
