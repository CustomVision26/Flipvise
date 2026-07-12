"use client";

import { Fragment, useState, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  History,
  Loader2,
  Mail,
  BookOpen,
  Timer,
  Activity,
  UserRoundX,
} from "lucide-react";
import type { AdminBillingMonitorRow } from "@/lib/admin/billing-monitor-snapshot";
import type { SerializedDeletionProrationRow } from "@/lib/admin/deletion-proration-admin-dto";
import { countDeletionProrationOwedFromSerialized } from "@/lib/admin/deletion-proration-admin-dto";
import {
  AdminSupportPanel,
  type SerializedTicket,
  type SupportStats,
} from "@/components/admin-support-panel";
import { AdminPlansEditor } from "@/components/admin-plans-editor";
import { AdminPlanTrialSettings } from "@/components/admin-plan-trial-settings";
import {
  AdminBillingMonitor,
  AdminDeletionProrationMonitor,
} from "@/components/admin-subscription-monitor";
import { AdminAffiliatePromoBroadcast } from "@/components/admin-affiliate-promo-broadcast";
import { AdminAffiliatesPanel } from "@/components/admin-affiliates-panel";
import { PlatformDocumentationManager } from "@/components/platform-documentation-manager";
import { AdminSupportNotificationsMenu } from "@/components/admin-support-notifications-menu";
import type { SerializedSupportNotification } from "@/lib/support-ticket-dto";
import type {
  SerializedAdminInvoice,
  SerializedAdminSubscription,
  SerializedAdminWorkspace,
  SerializedAffiliate,
  SerializedLog,
  SerializedPlanAssignmentLog,
  SerializedUser,
} from "@/lib/admin-dashboard-types";
import { formatAdminInvoicePromoCell } from "@/lib/admin-invoice-promo-display";
import type { AdminUserPlanAccessType } from "@/lib/admin-user-plan-label";
import { TEAM_PLAN_LABELS } from "@/lib/team-plans";
import type { PlanConfig } from "@/components/pricing-content";
import type {
  ContactUsStats,
  SerializedContactMessage,
  SerializedContactSettings,
} from "@/lib/contact-us-admin-dto";
import {
  adminFilterInputClass,
  adminMenuCardClass,
  adminMenuContentClass,
  adminMenuHeaderClass,
  adminMenuIconButtonClass,
  adminMenuTabClass,
  adminMenuTitleClass,
  adminPlanHistoryTableShellClass,
  adminPlansSubTabPanelClass,
  adminSectionCardClass,
  adminSectionTitleClass,
  adminSupportSectionLabelClass,
  adminShowMenuButtonClass,
} from "@/components/admin-panel-styles";
import { cn } from "@/lib/utils";
import { formatCurrencyFromCents } from "@/lib/format-currency";

const AdminContactUsPanel = dynamic(
  () => import("@/components/admin-contact-us-panel").then((mod) => mod.AdminContactUsPanel),
  {
    loading: () => (
      <div className="flex min-h-[240px] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
      </div>
    ),
  },
);

export type { SerializedUser, SerializedLog } from "@/lib/admin-dashboard-types";

function planAccessTypeBadgeVariant(
  type: AdminUserPlanAccessType,
): "default" | "secondary" | "outline" {
  switch (type) {
    case "Paid":
      return "default";
    case "Assigned":
    case "Complimentary":
      return "outline";
    case "Affiliate":
    case "Free":
      return "secondary";
  }
}

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
  contactSettings: SerializedContactSettings;
  contactMessages: SerializedContactMessage[];
  contactUsStats: ContactUsStats;
  supportNotifications: SerializedSupportNotification[];
  supportUnreadCount: number;
  plansConfig: PlanConfig[];
  affiliates: SerializedAffiliate[];
  /** Server default (env) — used as the initial value for “accept link” days in the invite form. */
  affiliateInviteDefaultExpiresInDays: number;
  billingMonitorRows: AdminBillingMonitorRow[];
  deletionProrationRows?: SerializedDeletionProrationRow[];
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

function renderAdminInvoicePromoCell(invoice: SerializedAdminInvoice) {
  const { code, kindLabel, detail } = formatAdminInvoicePromoCell({
    promoCode: invoice.promoCode,
    promoKind: invoice.promoKind,
    discountLabel: invoice.discount,
  });
  if (!code && !detail) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="space-y-1">
      {code ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-xs font-semibold text-emerald-500">{code}</span>
          {kindLabel ? (
            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
              {kindLabel}
            </Badge>
          ) : null}
        </div>
      ) : (
        <span className="text-xs font-semibold text-emerald-500">{detail}</span>
      )}
      {code && detail ? (
        <p className="text-[11px] text-muted-foreground">{detail}</p>
      ) : null}
    </div>
  );
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
  contactSettings,
  contactMessages,
  contactUsStats,
  supportNotifications,
  supportUnreadCount,
  plansConfig,
  affiliates,
  affiliateInviteDefaultExpiresInDays,
  billingMonitorRows,
  deletionProrationRows = [],
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

  useEffect(() => {
    if (window.matchMedia("(max-width: 1023px)").matches) {
      setSidebarHidden(true);
    }
  }, []);
  const [profileDialogUser, setProfileDialogUser] = useState<SerializedUser | null>(null);
  const [expandedWorkspaceUserId, setExpandedWorkspaceUserId] = useState<string | null>(null);
  const [workspaceDialog, setWorkspaceDialog] = useState<SerializedAdminWorkspace | null>(null);
  const activeSection:
    | "all-users"
    | "workspace-admin"
    | "subscription"
    | "invoices"
    | "admin-roles"
    | "support-center"
    | "plans"
    | "marketing-affiliates"
    | "documentation" =
    pathname === "/admin/team-workspaces"
      ? "workspace-admin"
      : pathname === "/admin/subscription" ||
          pathname === "/admin/subscription-monitor" ||
          pathname === "/admin/subscription-deletion-proration"
        ? "subscription"
        : pathname === "/admin/invoices"
          ? "invoices"
      : pathname === "/admin/admin-roles" || pathname === "/admin/audit-log"
        ? "admin-roles"
        : pathname === "/admin/support-center" ||
            pathname.startsWith("/admin/support-center/")
          ? "support-center"
            : pathname === "/admin/plans" ||
                pathname === "/admin/plan-history" ||
                pathname === "/admin/affiliate-messaging" ||
                pathname === "/admin/plan-trials"
              ? "plans"
              : pathname === "/admin/marketing-affiliates"
                ? "marketing-affiliates"
                : pathname === "/admin/documentation"
                  ? "documentation"
                : "all-users";

  const plansSubTab =
    pathname === "/admin/plan-history"
      ? "plan-history"
      : pathname === "/admin/affiliate-messaging"
        ? "affiliate-messaging"
        : pathname === "/admin/plan-trials"
          ? "trial-settings"
          : "pricing-plans";

  const subscriptionSubTab =
    pathname === "/admin/subscription-monitor"
      ? "billing-monitor"
      : pathname === "/admin/subscription-deletion-proration"
        ? "deletion-proration"
        : "subscriptions";

  const deletionProrationOwedCount = useMemo(
    () => countDeletionProrationOwedFromSerialized(deletionProrationRows),
    [deletionProrationRows],
  );

  const supportSubTab =
    pathname === "/admin/support-center/contact-us" ? "contact-us" : "tickets";

  const contactUsOpenCount = contactUsStats.openCount;

  const activeAffiliateCount = useMemo(
    () => affiliates.filter((a) => a.status === "active").length,
    [affiliates],
  );

  const adminRolesSubTab =
    pathname === "/admin/audit-log" ? "audit-log" : "roles";

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
        const planMatch =
          row.planSlug.toLowerCase().includes(q) ||
          row.planLabel.toLowerCase().includes(q);
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
    <div
      className={`grid gap-4 sm:gap-6 ${sidebarHidden ? "grid-cols-1" : "lg:grid-cols-[15rem_minmax(0,1fr)]"}`}
    >
      {sidebarHidden ? null : (
        <Card className={adminMenuCardClass}>
          <CardHeader className={adminMenuHeaderClass}>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className={adminMenuTitleClass}>Admin Menu</CardTitle>
              <div className="flex items-center gap-1">
                <AdminSupportNotificationsMenu
                  unreadCount={supportUnreadCount}
                  notifications={supportNotifications}
                />
                <button
                  type="button"
                  onClick={() => setSidebarHidden(true)}
                  className={adminMenuIconButtonClass}
                  aria-label="Hide admin menu"
                  title="Hide admin menu"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className={adminMenuContentClass}>
            <button
              type="button"
              onClick={() => router.push("/admin/all-users")}
              className={adminMenuTabClass(activeSection === "all-users")}
            >
              <span className="flex w-full items-center gap-2.5">
                <Users className="h-4 w-4 shrink-0 opacity-80" />
                <span className="truncate">All Users</span>
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
              className={adminMenuTabClass(activeSection === "workspace-admin")}
            >
              <span className="flex w-full items-center gap-2.5">
                <Building2 className="h-4 w-4 shrink-0 opacity-80" />
                <span className="truncate">Team Workspaces</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => router.push("/admin/subscription")}
              className={adminMenuTabClass(activeSection === "subscription")}
            >
              <span className="flex w-full items-center gap-2.5">
                <WalletCards className="h-4 w-4 shrink-0 opacity-80" />
                <span className="truncate">Subscription</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => router.push("/admin/invoices")}
              className={adminMenuTabClass(activeSection === "invoices")}
            >
              <span className="flex w-full items-center gap-2.5">
                <ReceiptText className="h-4 w-4 shrink-0 opacity-80" />
                <span className="truncate">Invoices</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => router.push("/admin/admin-roles")}
              className={adminMenuTabClass(activeSection === "admin-roles")}
            >
              <span className="flex w-full items-center gap-2.5">
                <ShieldCheck className="h-4 w-4 shrink-0 opacity-80" />
                <span className="truncate">Admin Roles</span>
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
              className={adminMenuTabClass(activeSection === "support-center")}
            >
              <span className="flex w-full items-center gap-2.5">
                <LifeBuoy className="h-4 w-4 shrink-0 opacity-80" />
                <span className="truncate">Support Center</span>
                {supportUnreadCount > 0 ? (
                  <Badge className="ml-auto text-xs" variant="destructive">
                    {supportUnreadCount}
                  </Badge>
                ) : supportStats.totals.openCount > 0 ? (
                  <Badge className="ml-auto text-xs" variant="secondary">
                    {supportStats.totals.openCount}
                  </Badge>
                ) : null}
              </span>
            </button>
            <button
              type="button"
              onClick={() => router.push("/admin/plans")}
              className={adminMenuTabClass(activeSection === "plans")}
            >
              <span className="flex w-full items-center gap-2.5">
                <LayoutList className="h-4 w-4 shrink-0 opacity-80" />
                <span className="truncate">Plans</span>
                {planAssignmentLogs.length > 0 ? (
                  <Badge className="ml-auto text-xs" variant="secondary">
                    {planAssignmentLogs.length}
                  </Badge>
                ) : null}
              </span>
            </button>
            <button
              type="button"
              onClick={() => router.push("/admin/marketing-affiliates")}
              className={adminMenuTabClass(activeSection === "marketing-affiliates")}
            >
              <span className="flex w-full items-center gap-2.5">
                <Megaphone className="h-4 w-4 shrink-0 opacity-80" />
                <span className="truncate">Marketing Affiliates</span>
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
              onClick={() => router.push("/admin/documentation")}
              className={adminMenuTabClass(activeSection === "documentation")}
            >
              <span className="flex w-full items-center gap-2.5">
                <BookOpen className="h-4 w-4 shrink-0 opacity-80" />
                <span className="truncate">Documentation</span>
              </span>
            </button>
          </CardContent>
        </Card>
      )}

      <div className="min-w-0">
      {sidebarHidden ? (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setSidebarHidden(false)}
            className={adminShowMenuButtonClass}
            aria-label="Show admin menu"
          >
            <PanelLeftOpen className="h-4 w-4 shrink-0 opacity-80" />
            Admin Menu
          </button>
        </div>
      ) : null}
      {activeSection === "all-users" ? (
        <Card className={adminSectionCardClass}>
          <CardHeader className="space-y-4 border-b border-border/50 pb-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-1">
                <CardTitle className={adminSectionTitleClass}>All Users</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {filteredUsers.length} of {users.length} users
                  <span className="hidden sm:inline"> · </span>
                  <span className="block sm:inline text-xs sm:text-sm">
                    Double-click a row to view profile and plan details
                  </span>
                </p>
              </div>
              <div className="flex w-full min-w-0 flex-col gap-2 lg:max-w-xl">
                {/* Search */}
                <div className="relative w-full min-w-0">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={cn(adminFilterInputClass, "w-full pl-8")}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  {/* Plan filter */}
                  <Select
                    value={planFilter}
                    onValueChange={(v) => setPlanFilter(v as PlanFilter)}
                  >
                    <SelectTrigger className={cn(adminFilterInputClass, "w-full sm:w-[130px]")}>
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
                    <SelectTrigger className={cn(adminFilterInputClass, "w-full sm:w-[130px]")}>
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
                    <SelectTrigger className={cn(adminFilterInputClass, "col-span-2 w-full sm:col-span-1 sm:w-[130px]")}>
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
                  <TableHead>Plan type</TableHead>
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
                      colSpan={9}
                      className="text-center text-muted-foreground py-10"
                    >
                      No users match your search or filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow
                      key={user.id}
                      onDoubleClick={() => setProfileDialogUser(user)}
                      className={`cursor-pointer ${user.isBanned ? "opacity-60" : ""}`}
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
                          <TableCell className="whitespace-nowrap">
                            <Badge
                              variant={planAccessTypeBadgeVariant(user.planAccessType)}
                              className="text-xs font-normal"
                            >
                              {user.planAccessType}
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
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
          <Dialog
            open={profileDialogUser != null}
            onOpenChange={(open) => {
              if (!open) setProfileDialogUser(null);
            }}
          >
            <DialogContent className="max-h-[min(85vh,32rem)] overflow-y-auto sm:max-w-md">
              {profileDialogUser ? (
                <>
                  <DialogHeader>
                    <DialogTitle className="text-left leading-snug">
                      {profileDialogUser.fullName}
                    </DialogTitle>
                    <DialogDescription className="text-left">
                      User profile and billing summary
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-5">
                    <div className="flex flex-wrap gap-2">
                      {profileDialogUser.isSuperadmin ? (
                        <Badge variant="default" className="text-xs">
                          Owner/Superadmin
                        </Badge>
                      ) : null}
                      {profileDialogUser.isAdmin && !profileDialogUser.isSuperadmin ? (
                        <Badge variant="destructive" className="text-xs">
                          Admin
                        </Badge>
                      ) : null}
                      {profileDialogUser.isBanned ? (
                        <Badge
                          variant="outline"
                          className="border-destructive text-xs text-destructive"
                        >
                          Banned
                        </Badge>
                      ) : null}
                      {profileDialogUser.isOnline ? (
                        <Badge variant="secondary" className="text-xs">
                          Online
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          Offline
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Profile
                      </p>
                      <dl className="grid gap-2 text-sm">
                        <div className="grid grid-cols-[7rem_1fr] gap-2">
                          <dt className="text-muted-foreground">Email</dt>
                          <dd className="break-all font-medium">{profileDialogUser.email ?? "—"}</dd>
                        </div>
                        <div className="grid grid-cols-[7rem_1fr] gap-2">
                          <dt className="text-muted-foreground">User ID</dt>
                          <dd className="break-all font-mono text-xs">{profileDialogUser.id}</dd>
                        </div>
                        <div className="grid grid-cols-[7rem_1fr] gap-2">
                          <dt className="text-muted-foreground">Joined</dt>
                          <dd>{formatDate(profileDialogUser.createdAt)}</dd>
                        </div>
                        <div className="grid grid-cols-[7rem_1fr] gap-2">
                          <dt className="text-muted-foreground">Last sign-in</dt>
                          <dd>
                            {profileDialogUser.lastSignInAt
                              ? formatDate(profileDialogUser.lastSignInAt)
                              : "Never"}
                          </dd>
                        </div>
                        {profileDialogUser.associatePlan ? (
                          <div className="grid grid-cols-[7rem_1fr] gap-2">
                            <dt className="text-muted-foreground">Associate plan</dt>
                            <dd>{profileDialogUser.associatePlan}</dd>
                          </div>
                        ) : null}
                      </dl>
                    </div>

                    <div className="space-y-3 border-t border-border/60 pt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Current plan
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={
                            profileDialogUser.planDisplayName === "Free" ? "secondary" : "default"
                          }
                          className="text-sm"
                        >
                          {profileDialogUser.planDisplayName}
                        </Badge>
                        <Badge
                          variant={planAccessTypeBadgeVariant(profileDialogUser.planAccessType)}
                          className="text-sm"
                        >
                          {profileDialogUser.planAccessType}
                        </Badge>
                      </div>
                      <dl className="grid gap-2 text-sm">
                        <div className="grid grid-cols-[7rem_1fr] gap-2">
                          <dt className="text-muted-foreground">Personal plan</dt>
                          <dd className="font-medium">{profileDialogUser.currentPersonalPlan}</dd>
                        </div>
                        <div className="grid grid-cols-[7rem_1fr] gap-2">
                          <dt className="text-muted-foreground">Plan type</dt>
                          <dd className="font-medium">{profileDialogUser.planAccessType}</dd>
                        </div>
                        <div className="grid grid-cols-[7rem_1fr] gap-2">
                          <dt className="text-muted-foreground">Plan updated</dt>
                          <dd>{formatDate(profileDialogUser.planSetAt)}</dd>
                        </div>
                        <div className="grid grid-cols-[7rem_1fr] gap-2">
                          <dt className="text-muted-foreground">Active since</dt>
                          <dd>{formatDateTime(profileDialogUser.currentPersonalPlanDateTime)}</dd>
                        </div>
                        <div className="grid grid-cols-[7rem_1fr] gap-2">
                          <dt className="text-muted-foreground">Clerk plan</dt>
                          <dd>{profileDialogUser.clerkPlan}</dd>
                        </div>
                        <div className="grid grid-cols-[7rem_1fr] gap-2">
                          <dt className="text-muted-foreground">Admin assigned</dt>
                          <dd>{profileDialogUser.adminAssignedPlan}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </>
              ) : null}
            </DialogContent>
          </Dialog>
        </Card>
      ) : null}

      {activeSection === "workspace-admin" ? (
        <Card className={adminSectionCardClass}>
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
                        {/*
                         * Avoid Tooltip on the row: cells include AssignUserPlanButton (DropdownMenu portals).
                         * Row tooltip + nested portals tear down out of order → React removeChild(null) crashes.
                         */}
                        <TableRow
                          onDoubleClick={() =>
                            setExpandedWorkspaceUserId((current) =>
                              current === user.id ? null : user.id,
                            )
                          }
                          className="cursor-pointer"
                          title="Double-click to view workspaces created by this user."
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
                        </TableRow>
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
        <Card className={adminSectionCardClass}>
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
            <p className="text-sm text-muted-foreground">
              Manage subscriptions, monitor trials, payment failures, and upcoming expirations.
            </p>
          </CardHeader>
          <CardContent>
            <Tabs
              value={subscriptionSubTab}
              onValueChange={(v) =>
                router.push(
                  v === "billing-monitor"
                    ? "/admin/subscription-monitor"
                    : v === "deletion-proration"
                      ? "/admin/subscription-deletion-proration"
                      : "/admin/subscription",
                )
              }
              className="w-full gap-4"
            >
              <TabsList variant="line" className="h-auto w-full flex-wrap justify-start gap-1 p-1 sm:w-fit">
                <TabsTrigger value="subscriptions" className="gap-1.5">
                  <WalletCards className="h-4 w-4 shrink-0" />
                  All subscriptions
                </TabsTrigger>
                <TabsTrigger value="billing-monitor" className="gap-1.5">
                  <Activity className="h-4 w-4 shrink-0" />
                  Billing monitor
                  {billingMonitorRows.length > 0 ? (
                    <Badge className="text-[0.6875rem] tabular-nums" variant="secondary">
                      {billingMonitorRows.length}
                    </Badge>
                  ) : null}
                </TabsTrigger>
                <TabsTrigger value="deletion-proration" className="gap-1.5">
                  <UserRoundX className="h-4 w-4 shrink-0" />
                  Account deletion proration
                  {deletionProrationOwedCount > 0 ? (
                    <Badge className="text-[0.6875rem] tabular-nums" variant="destructive">
                      {deletionProrationOwedCount}
                    </Badge>
                  ) : null}
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="subscriptions"
                className="mt-0 border-0 bg-transparent p-0 shadow-none ring-0"
              >
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      Track billing status, active plan, and renewal windows for each user.
                    </p>
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
                            row.planLabel,
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
                  <div className="overflow-x-auto rounded-lg border border-border/80">
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
                                <Badge variant={row.planSlug === "free" ? "secondary" : "default"}>
                                  {row.planLabel}
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
                  </div>
                </div>
              </TabsContent>

              <TabsContent
                value="billing-monitor"
                className="mt-0 border-0 bg-transparent p-0 shadow-none ring-0"
              >
                <AdminBillingMonitor rows={billingMonitorRows} />
              </TabsContent>

              <TabsContent
                value="deletion-proration"
                className="mt-0 border-0 bg-transparent p-0 shadow-none ring-0"
              >
                <AdminDeletionProrationMonitor rows={deletionProrationRows} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      ) : null}

      {activeSection === "invoices" ? (
        <Card className={adminSectionCardClass}>
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
                      "Promo Code",
                      "Promo Type",
                      "Discount",
                      "Amount Due",
                      "Currency",
                      "Created",
                      "Period Start",
                      "Period End",
                      "Hosted Invoice URL",
                      "Invoice PDF URL",
                    ],
                    invoiceRows.map((row) => {
                      const promo = formatAdminInvoicePromoCell({
                        promoCode: row.promoCode,
                        promoKind: row.promoKind,
                        discountLabel: row.discount,
                      });
                      return [
                        row.invoiceNumber,
                        row.userName,
                        row.email,
                        row.status,
                        promo.code,
                        promo.kindLabel,
                        row.discount,
                        formatCurrencyFromCents(row.amountDue, row.currency),
                        row.createdAt,
                        row.periodStart,
                        row.periodEnd,
                        row.hostedInvoiceUrl,
                        row.invoicePdfUrl,
                      ];
                    }),
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
                  <TableHead>Promo code</TableHead>
                  <TableHead>Amount Due</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoiceRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
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
                      <TableCell className="text-sm text-muted-foreground">
                        {renderAdminInvoicePromoCell(invoice)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap tabular-nums">
                        {formatCurrencyFromCents(invoice.amountDue, invoice.currency)}
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

      {/* ── Admin roles + privilege audit (sub-tabs; URLs /admin/admin-roles & /admin/audit-log) ── */}
      {activeSection === "admin-roles" ? (
        <Card className={adminSectionCardClass}>
          <CardHeader>
            <CardTitle>Admin roles</CardTitle>
            <p className="text-sm text-muted-foreground">
              Manage co-admins from the Roles tab and review privilege changes in Audit log.
            </p>
          </CardHeader>
          <CardContent>
            <Tabs
              value={adminRolesSubTab}
              onValueChange={(v) =>
                router.push(v === "audit-log" ? "/admin/audit-log" : "/admin/admin-roles")
              }
              className="w-full gap-4"
            >
              <TabsList variant="line" className="h-auto w-full flex-wrap justify-start gap-1 p-1 sm:w-fit">
                <TabsTrigger value="roles" className="gap-1.5">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  Roles
                </TabsTrigger>
                <TabsTrigger value="audit-log" className="gap-1.5">
                  <ClipboardList className="h-4 w-4 shrink-0" />
                  Audit log
                  {logs.length > 0 ? (
                    <Badge className="text-[0.6875rem] tabular-nums" variant="secondary">
                      {logs.length}
                    </Badge>
                  ) : null}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="roles" className="mt-4 flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                  Only the platform owner can grant or revoke co-admin roles. Every change is
                  listed under the Audit log tab.
                </p>
                <div className="-mx-1 overflow-x-auto sm:mx-0">
                  <div className="inline-block min-w-full rounded-md border">
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
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="audit-log" className="mt-4 space-y-4">
                <p className="text-sm text-muted-foreground">
                  A full record of every admin role grant and revocation, showing who made each
                  change and when.
                </p>
                <div className="overflow-x-auto rounded-md border">
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
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      ) : null}

      {/* ── Support Center ── */}
      {activeSection === "support-center" ? (
        <Card className={adminSectionCardClass}>
          <CardHeader>
            <CardTitle>Support Center</CardTitle>
            <p className="text-sm text-muted-foreground">
              Monitor support tickets and manage public Contact Us settings and messages.
            </p>
          </CardHeader>
          <CardContent>
            <Tabs
              value={supportSubTab}
              onValueChange={(v) =>
                router.push(
                  v === "contact-us"
                    ? "/admin/support-center/contact-us"
                    : "/admin/support-center",
                )
              }
              className="w-full gap-4"
            >
              <TabsList variant="line" className="h-auto w-full flex-wrap justify-start gap-1 p-1 sm:w-fit">
                <TabsTrigger value="tickets" className="gap-1.5">
                  <LifeBuoy className="h-4 w-4 shrink-0" />
                  Tickets
                  {supportStats.totals.openCount > 0 ? (
                    <Badge className="text-[0.6875rem] tabular-nums" variant="secondary">
                      {supportStats.totals.openCount}
                    </Badge>
                  ) : null}
                </TabsTrigger>
                <TabsTrigger value="contact-us" className="gap-1.5">
                  <Mail className="h-4 w-4 shrink-0" />
                  Contact Us
                  {contactUsOpenCount > 0 ? (
                    <Badge className="text-[0.6875rem] tabular-nums" variant="secondary">
                      {contactUsOpenCount}
                    </Badge>
                  ) : null}
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="tickets"
                className="mt-0 border-0 bg-transparent p-0 shadow-none ring-0"
              >
                <AdminSupportPanel tickets={supportTickets} stats={supportStats} />
              </TabsContent>

              <TabsContent
                value="contact-us"
                className="mt-0 border-0 bg-transparent p-0 shadow-none ring-0"
              >
                <AdminContactUsPanel
                  settings={contactSettings}
                  messages={contactMessages}
                  stats={contactUsStats}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      ) : null}

      {/* ── Plans (pricing editor + assignment history) ── */}
      {activeSection === "plans" ? (
        <Card className={adminSectionCardClass}>
          <CardHeader>
            <CardTitle>Plans</CardTitle>
            <p className="text-sm text-muted-foreground">
              Manage public pricing and review admin-driven plan assignments and bans.
            </p>
          </CardHeader>
          <CardContent>
            <Tabs
              value={plansSubTab}
              onValueChange={(v) =>
                router.push(
                  v === "plan-history"
                    ? "/admin/plan-history"
                    : v === "affiliate-messaging"
                      ? "/admin/affiliate-messaging"
                      : v === "trial-settings"
                        ? "/admin/plan-trials"
                        : "/admin/plans",
                )
              }
              className="w-full gap-4"
            >
              <TabsList variant="line" className="h-auto w-full flex-wrap justify-start gap-1 p-1 sm:w-fit">
                <TabsTrigger value="pricing-plans" className="gap-1.5">
                  <LayoutList className="h-4 w-4 shrink-0" />
                  Pricing plans
                </TabsTrigger>
                <TabsTrigger value="plan-history" className="gap-1.5">
                  <History className="h-4 w-4 shrink-0" />
                  Plan history
                  {planAssignmentLogs.length > 0 ? (
                    <Badge className="text-[0.6875rem] tabular-nums" variant="secondary">
                      {planAssignmentLogs.length}
                    </Badge>
                  ) : null}
                </TabsTrigger>
                <TabsTrigger value="affiliate-messaging" className="gap-1.5">
                  <Mail className="h-4 w-4 shrink-0" />
                  Affiliate messaging
                  {activeAffiliateCount > 0 ? (
                    <Badge className="text-[0.6875rem] tabular-nums" variant="secondary">
                      {activeAffiliateCount}
                    </Badge>
                  ) : null}
                </TabsTrigger>
                <TabsTrigger value="trial-settings" className="gap-1.5">
                  <Timer className="h-4 w-4 shrink-0" />
                  Trial settings
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="pricing-plans"
                className="mt-0 border-0 bg-transparent p-0 shadow-none ring-0"
              >
                <div className={adminPlansSubTabPanelClass}>
                  <p className={adminSupportSectionLabelClass}>Public pricing</p>
                  <p className="text-sm text-muted-foreground">
                    Edit plan names, prices, descriptions, and features. Changes are saved to the pricing
                    page immediately after clicking Save on each plan card.
                  </p>
                  <AdminPlansEditor initialPlans={plansConfig} />
                </div>
              </TabsContent>

              <TabsContent
                value="affiliate-messaging"
                className="mt-0 border-0 bg-transparent p-0 shadow-none ring-0"
              >
                <div className={adminPlansSubTabPanelClass}>
                  <p className={adminSupportSectionLabelClass}>Affiliate messaging (Loops)</p>
                  <p className="text-sm text-muted-foreground">
                    General promo posts go to every registered user&apos;s dashboard inbox; affiliate
                    code posts go to active affiliates only (no Loops email). Requires the affiliate
                    broadcast inbox table in the database.
                  </p>
                  <AdminAffiliatePromoBroadcast affiliates={affiliates} plans={plansConfig} />
                </div>
              </TabsContent>

              <TabsContent
                value="trial-settings"
                className="mt-0 border-0 bg-transparent p-0 shadow-none ring-0"
              >
                <div className={adminPlansSubTabPanelClass}>
                  <p className={adminSupportSectionLabelClass}>Plan trials</p>
                  <AdminPlanTrialSettings initialPlans={plansConfig} />
                </div>
              </TabsContent>

              <TabsContent
                value="plan-history"
                className="mt-0 border-0 bg-transparent p-0 shadow-none ring-0"
              >
                <div className={adminPlansSubTabPanelClass}>
                  <p className={adminSupportSectionLabelClass}>Assignment audit log</p>
                  <p className="text-sm text-muted-foreground">
                    A full record of every plan assignment and user ban/unban performed by admins,
                    showing the user affected, previous and new plan, and who made the change.
                  </p>
                  <div className={adminPlanHistoryTableShellClass}>
                  {planAssignmentLogs.length === 0 ? (
                    <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                      No plan or ban actions recorded yet. Changes will appear here automatically after any
                      plan assignment or user ban.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b border-border/60 hover:bg-transparent">
                          <TableHead className="text-xs">User</TableHead>
                          <TableHead className="text-xs">Previous Plan</TableHead>
                          <TableHead className="text-xs">Action</TableHead>
                          <TableHead className="text-xs">New Plan</TableHead>
                          <TableHead className="text-xs">Admin</TableHead>
                          <TableHead className="text-xs">Date &amp; Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {planAssignmentLogs.map((log) => (
                          <TableRow
                            key={log.id}
                            className="border-b border-border/40 transition-colors hover:bg-muted/30"
                          >
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
                            <TableCell className="text-muted-foreground text-sm whitespace-nowrap tabular-nums">
                              {formatDateTime(log.createdAt)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    </div>
                  )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
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

      {activeSection === "documentation" ? (
        <PlatformDocumentationManager
          headerSlot={
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Platform admin
              </p>
              <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                Documentation
              </h2>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Use the AI agent to add, update, or remove topics from admin and user docs. Attach UI
                screenshots for step-by-step updates. Edit mode still supports manual per-page edits.
              </p>
            </div>
          }
        />
      ) : null}
      </div>
    </div>
  );
}
