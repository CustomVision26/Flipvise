"use client";

import { useState, useMemo, useTransition, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Ticket,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  SendHorizonal,
  ChevronRight,
} from "lucide-react";
import {
  adminUpdateTicketStatusAction,
  adminReplyToTicketAction,
  adminMarkTicketResolvedAction,
  getAdminSupportTicketThreadAction,
} from "@/actions/support-admin";
import { SupportTicketThread } from "@/components/support-ticket-thread";
import type {
  SerializedTicketMessage,
  SupportTicketThreadTicket,
} from "@/lib/support-ticket-dto";
import type { SerializedTicket, SupportStats } from "@/lib/support-admin-dto";
import {
  adminFilterInputClass,
  adminSectionTitleClass,
  adminSupportChartCardClass,
  adminSupportEmptyStateClass,
  adminSupportFilterBarClass,
  adminSupportKpiCardClass,
  adminSupportKpiGridClass,
  adminSupportSectionLabelClass,
  adminSupportShellClass,
  adminSupportTableCardClass,
} from "@/components/admin-panel-styles";
import { cn } from "@/lib/utils";

// ── Serialised types (plain objects safe to pass from Server → Client) ─────

export type { SerializedTicket, SupportStats };

export type SerializedReply = SerializedTicketMessage;

interface AdminSupportPanelProps {
  tickets: SerializedTicket[];
  stats: SupportStats;
}

// ── Label maps ─────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  general_support: "Support",
  bug_report: "Bug",
  feature_request: "Feature",
  feedback: "Feedback",
  billing: "Billing",
  account: "Account",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

// ── Badge helpers ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    open: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    in_progress: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    resolved: "bg-green-500/15 text-green-400 border-green-500/30",
    closed: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${variants[status] ?? variants.closed}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const variants: Record<string, string> = {
    low: "bg-muted text-muted-foreground border-border",
    normal: "bg-muted text-foreground border-border",
    high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    urgent: "bg-red-500/15 text-red-400 border-red-500/30",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${variants[priority] ?? variants.normal}`}
    >
      {PRIORITY_LABELS[priority] ?? priority}
    </span>
  );
}

// ── Chart colour palette ───────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  open: "#3b82f6",
  in_progress: "#eab308",
  resolved: "#22c55e",
  closed: "#6b7280",
};

const CATEGORY_COLORS = [
  "#6366f1", "#3b82f6", "#14b8a6", "#f59e0b", "#ec4899", "#8b5cf6",
];

const PRIORITY_COLORS: Record<string, string> = {
  low: "#6b7280",
  normal: "#94a3b8",
  high: "#f97316",
  urgent: "#ef4444",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Ticket Detail Sheet ────────────────────────────────────────────────────

interface TicketDetailSheetProps {
  ticket: SerializedTicket;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onTicketUpdated: (updated: SerializedTicket, stats?: SupportStats) => void;
}

function TicketDetailSheet({
  ticket,
  open,
  onOpenChange,
  onTicketUpdated,
}: TicketDetailSheetProps) {
  const [threadTicket, setThreadTicket] = useState<SupportTicketThreadTicket | null>(null);
  const [messages, setMessages] = useState<SerializedTicketMessage[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, startLoad] = useTransition();

  const loadThread = useCallback(() => {
    startLoad(async () => {
      try {
        setLoadError(null);
        const thread = await getAdminSupportTicketThreadAction(ticket.id);
        setThreadTicket(thread.ticket);
        setMessages(thread.messages);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Failed to load thread");
      }
    });
  }, [ticket.id]);

  useEffect(() => {
    if (!open) return;
    loadThread();
  }, [open, loadThread]);

  async function handleSendReply(message: string) {
    const { ticket: next, message: reply } = await adminReplyToTicketAction({
      ticketId: ticket.id,
      message,
    });
    onTicketUpdated(next);
    setThreadTicket((prev) =>
      prev
        ? {
            ...prev,
            status: next.status,
            updatedAt: next.updatedAt,
          }
        : prev,
    );
    setMessages((prev) => [...prev, reply]);
  }

  async function handleMarkResolved() {
    const { ticket: next, stats } = await adminMarkTicketResolvedAction(ticket.id);
    onTicketUpdated(next, stats);
    setThreadTicket((prev) => (prev ? { ...prev, status: "resolved" } : prev));
  }

  async function handleReopen() {
    const { ticket: next, stats } = await adminUpdateTicketStatusAction({
      ticketId: ticket.id,
      status: "open",
    });
    onTicketUpdated(next, stats);
    setThreadTicket((prev) => (prev ? { ...prev, status: "open" } : prev));
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 border-l-2 border-primary/40 p-0 sm:max-w-lg"
      >
        <SheetHeader className="shrink-0 border-b border-border/70 bg-muted/20 px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <SheetTitle className="truncate text-sm leading-snug">
                #{ticket.id} — {ticket.subject}
              </SheetTitle>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <StatusBadge status={threadTicket?.status ?? ticket.status} />
                <PriorityBadge priority={ticket.priority} />
                <span className="text-xs capitalize text-muted-foreground">
                  {CATEGORY_LABELS[ticket.category] ?? ticket.category}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">From:</span>{" "}
                  {ticket.userName || "Unknown"} · {ticket.userEmail || ticket.userId}
                </p>
                <p>
                  <span className="font-medium text-foreground">Submitted:</span>{" "}
                  {formatDateTime(ticket.createdAt)}
                </p>
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col px-6 py-4">
          {isLoading && !threadTicket ? (
            <div className="flex flex-1 items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : loadError ? (
            <p className="text-sm text-destructive">{loadError}</p>
          ) : threadTicket ? (
            <SupportTicketThread
              ticket={threadTicket}
              messages={messages}
              viewerRole="admin"
              onSendReply={handleSendReply}
              onMarkResolved={handleMarkResolved}
              onReopen={handleReopen}
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────

type StatusFilter = "all" | "open" | "in_progress" | "resolved" | "closed";
type CategoryFilter = "all" | string;
type PriorityFilter = "all" | "low" | "normal" | "high" | "urgent";

export function AdminSupportPanel({
  tickets: initialTickets,
  stats: initialStats,
}: AdminSupportPanelProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const ticketFromUrl = Number(searchParams.get("ticket") || "");
  const deepLinkTicketId =
    Number.isFinite(ticketFromUrl) && ticketFromUrl > 0 ? ticketFromUrl : null;

  const [tickets, setTickets] = useState(initialTickets);
  const [stats, setStats] = useState(initialStats);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [selectedTicket, setSelectedTicket] = useState<SerializedTicket | null>(null);

  useEffect(() => {
    if (!deepLinkTicketId) return;
    const match = tickets.find((t) => t.id === deepLinkTicketId);
    if (match) setSelectedTicket(match);
  }, [deepLinkTicketId, tickets]);

  function handleSelectTicket(ticket: SerializedTicket) {
    setSelectedTicket(ticket);
    router.replace(`/admin/support-center?ticket=${ticket.id}`);
  }

  function handleCloseTicketSheet(open: boolean) {
    if (!open) {
      setSelectedTicket(null);
      router.replace("/admin/support-center");
    }
  }

  const filteredTickets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (q) {
        const match =
          t.subject.toLowerCase().includes(q) ||
          (t.userName ?? "").toLowerCase().includes(q) ||
          (t.userEmail ?? "").toLowerCase().includes(q) ||
          String(t.id).includes(q);
        if (!match) return false;
      }
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      return true;
    });
  }, [tickets, search, statusFilter, categoryFilter, priorityFilter]);

  const categoryChartData = stats.byCategory.map((d) => ({
    name: CATEGORY_LABELS[d.category] ?? d.category,
    value: d.count,
    rawKey: d.category,
  }));

  const statusChartData = stats.byStatus.map((d) => ({
    name: STATUS_LABELS[d.status] ?? d.status,
    value: d.count,
    color: STATUS_COLORS[d.status] ?? "#6b7280",
  }));

  const priorityChartData = stats.byPriority.map((d) => ({
    name: PRIORITY_LABELS[d.priority] ?? d.priority,
    value: d.count,
    color: PRIORITY_COLORS[d.priority] ?? "#94a3b8",
  }));

  function handleTicketUpdated(updated: SerializedTicket, nextStats?: SupportStats) {
    setTickets((prev) =>
      prev.map((t) => (t.id === updated.id ? updated : t))
    );
    if (nextStats) setStats(nextStats);
    if (selectedTicket?.id === updated.id) setSelectedTicket(updated);
  }

  return (
    <div className={adminSupportShellClass}>
      <div className="mb-5 border-b border-border/50 pb-4">
        <h2 className={adminSectionTitleClass}>Support Center</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Monitor ticket volume, resolution status, and respond to user requests.
        </p>
      </div>

      <p className={adminSupportSectionLabelClass}>Ticket metrics</p>
      <div className={cn(adminSupportKpiGridClass, "mb-6")}>
        {[
          {
            label: "Total Tickets",
            value: stats.totals.total,
            icon: Ticket,
            color: "text-foreground",
            iconWrap: "border-border/60 bg-muted/30",
          },
          {
            label: "Open",
            value: stats.totals.openCount,
            icon: Clock,
            color: "text-blue-400",
            iconWrap: "border-blue-500/30 bg-blue-500/10",
          },
          {
            label: "Resolved",
            value: stats.totals.resolvedCount,
            icon: CheckCircle2,
            color: "text-green-400",
            iconWrap: "border-green-500/30 bg-green-500/10",
          },
          {
            label: "Urgent",
            value: stats.totals.urgentCount,
            icon: AlertTriangle,
            color: "text-red-400",
            iconWrap: "border-red-500/30 bg-red-500/10",
          },
        ].map(({ label, value, icon: Icon, color, iconWrap }, index) => (
          <Card
            key={label}
            className={cn(
              adminSupportKpiCardClass,
              "animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both duration-500",
            )}
            style={{ animationDelay: `${index * 75}ms` }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                  iconWrap,
                )}
              >
                <Icon className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4", color)} />
              </span>
            </CardHeader>
            <CardContent>
              <p className={cn("text-2xl font-bold tabular-nums sm:text-3xl", color)}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className={adminSupportSectionLabelClass}>Analytics</p>
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className={cn(adminSupportChartCardClass, "md:col-span-2")}>
          <CardHeader className="border-b border-border/50 pb-3">
            <CardTitle className="text-sm font-semibold tracking-tight">Tickets by Category</CardTitle>
            <CardDescription className="text-xs">Volume per support type</CardDescription>
          </CardHeader>
          <CardContent className="h-52 pt-4">
            {categoryChartData.length === 0 ? (
              <div className={adminSupportEmptyStateClass}>
                <Ticket className="h-5 w-5 text-muted-foreground/70" />
                <p className="text-xs text-muted-foreground">No category data yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryChartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <RechartsTooltip
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    cursor={{ fill: "hsl(var(--muted))" }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {categoryChartData.map((entry, i) => (
                      <Cell key={entry.rawKey} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className={adminSupportChartCardClass}>
          <CardHeader className="border-b border-border/50 pb-3">
            <CardTitle className="text-sm font-semibold tracking-tight">Status Breakdown</CardTitle>
            <CardDescription className="text-xs">Current resolution state</CardDescription>
          </CardHeader>
          <CardContent className="h-52 pt-4">
            {statusChartData.length === 0 ? (
              <div className={adminSupportEmptyStateClass}>
                <CheckCircle2 className="h-5 w-5 text-muted-foreground/70" />
                <p className="text-xs text-muted-foreground">No status data yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusChartData}
                    cx="50%"
                    cy="45%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusChartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend
                    iconSize={8}
                    wrapperStyle={{ fontSize: 11 }}
                    formatter={(value) => <span style={{ color: "hsl(var(--foreground))" }}>{value}</span>}
                  />
                  <RechartsTooltip
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className={cn(adminSupportChartCardClass, "mb-6")}>
        <CardHeader className="border-b border-border/50 pb-3">
          <CardTitle className="text-sm font-semibold tracking-tight">Priority Distribution</CardTitle>
          <CardDescription className="text-xs">Tickets grouped by assigned severity</CardDescription>
        </CardHeader>
        <CardContent className="h-40 pt-4">
          {priorityChartData.length === 0 ? (
            <div className={adminSupportEmptyStateClass}>
              <AlertTriangle className="h-5 w-5 text-muted-foreground/70" />
              <p className="text-xs text-muted-foreground">No priority data yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priorityChartData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 40 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={56} />
                <RechartsTooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  cursor={{ fill: "hsl(var(--muted))" }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {priorityChartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <p className={adminSupportSectionLabelClass}>Ticket queue</p>
      <Card className={adminSupportTableCardClass}>
        <CardHeader className="border-b border-border/50 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-sm font-semibold tracking-tight">All Support Tickets</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {filteredTickets.length} of {tickets.length} tickets
              </p>
            </div>
          </div>
        </CardHeader>
        <div className={adminSupportFilterBarClass}>
          <div className="relative md:col-span-2 lg:col-span-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by subject, user, ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(adminFilterInputClass, "h-9 w-full pl-8 text-sm")}
            />
          </div>
          <div className="flex flex-wrap gap-2 md:col-span-2 lg:col-span-3">
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                  <SelectTrigger className={cn(adminFilterInputClass, "h-9 w-[calc(50%-4px)] text-sm sm:w-[130px]")}>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={categoryFilter} onValueChange={(v) => { if (v !== null) setCategoryFilter(v); }}>
                  <SelectTrigger className={cn(adminFilterInputClass, "h-9 w-[calc(50%-4px)] text-sm sm:w-[130px]")}>
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="general_support">Support</SelectItem>
                    <SelectItem value="bug_report">Bug Report</SelectItem>
                    <SelectItem value="feature_request">Feature Request</SelectItem>
                    <SelectItem value="feedback">Feedback</SelectItem>
                    <SelectItem value="billing">Billing</SelectItem>
                    <SelectItem value="account">Account</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as PriorityFilter)}>
                  <SelectTrigger className={cn(adminFilterInputClass, "h-9 w-full text-sm sm:w-[130px]")}>
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
          </div>
        </div>
        <CardContent className="p-0">
          {filteredTickets.length === 0 ? (
            <div className="px-4 py-16">
              <div className={cn(adminSupportEmptyStateClass, "min-h-32 py-8")}>
                <Ticket className="h-5 w-5 text-muted-foreground/70" />
                <p className="text-sm text-muted-foreground">No tickets match the current filters.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border/60 hover:bg-transparent">
                    <TableHead className="w-12 text-xs">#</TableHead>
                    <TableHead className="text-xs">Subject</TableHead>
                    <TableHead className="text-xs">User</TableHead>
                    <TableHead className="text-xs">Category</TableHead>
                    <TableHead className="text-xs">Priority</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTickets.map((ticket) => (
                    <TableRow
                      key={ticket.id}
                      className="cursor-pointer border-b border-border/40 transition-colors hover:bg-muted/40"
                      onClick={() => handleSelectTicket(ticket)}
                    >
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {ticket.id}
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate font-medium">
                        {ticket.subject}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="truncate max-w-[140px]">
                          <span className="block font-medium">{ticket.userName || "—"}</span>
                          <span className="text-muted-foreground">{ticket.userEmail || ticket.userId.slice(0, 12) + "…"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize whitespace-nowrap">
                          {CATEGORY_LABELS[ticket.category] ?? ticket.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <PriorityBadge priority={ticket.priority} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={ticket.status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(ticket.createdAt)}
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Ticket detail sheet ── */}
      {selectedTicket && (
        <TicketDetailSheet
          ticket={selectedTicket}
          open={!!selectedTicket}
          onOpenChange={handleCloseTicketSheet}
          onTicketUpdated={handleTicketUpdated}
        />
      )}
    </div>
  );
}
