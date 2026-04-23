"use client";

import { useState, useMemo, useTransition } from "react";
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
} from "@/actions/support-admin";
import type { SerializedTicket, SupportStats } from "@/lib/support-admin-dto";

// ── Serialised types (plain objects safe to pass from Server → Client) ─────

export type { SerializedTicket, SupportStats };

export type SerializedReply = {
  id: number;
  ticketId: number;
  adminId: string;
  adminName: string;
  message: string;
  createdAt: string;
};

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
  const [replyText, setReplyText] = useState("");
  const [localReplies, setLocalReplies] = useState<SerializedReply[]>([]);
  const [status, setStatus] = useState(ticket.status);
  const [isPendingReply, startReplyTransition] = useTransition();
  const [isPendingStatus, startStatusTransition] = useTransition();
  const [replyError, setReplyError] = useState<string | null>(null);

  // Sync status when ticket prop changes
  if (ticket.status !== status && !isPendingStatus) {
    setStatus(ticket.status);
  }

  function handleStatusChange(newStatus: string | null) {
    if (!newStatus) return;
    setStatus(newStatus);
    startStatusTransition(async () => {
      try {
        const { ticket: next, stats } = await adminUpdateTicketStatusAction({
          ticketId: ticket.id,
          status: newStatus as "open" | "in_progress" | "resolved" | "closed",
        });
        onTicketUpdated(next, stats);
      } catch {
        setStatus(ticket.status);
      }
    });
  }

  function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyText.trim()) return;
    setReplyError(null);
    const text = replyText;
    startReplyTransition(async () => {
      try {
        const { ticket: next } = await adminReplyToTicketAction({
          ticketId: ticket.id,
          message: text,
        });
        onTicketUpdated(next);
        setLocalReplies((prev) => [
          ...prev,
          {
            id: Date.now(),
            ticketId: ticket.id,
            adminId: "me",
            adminName: "You",
            message: text,
            createdAt: new Date().toISOString(),
          },
        ]);
        setReplyText("");
      } catch (err) {
        setReplyError(err instanceof Error ? err.message : "Failed to send reply");
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0 gap-0">
        <SheetHeader className="px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-sm leading-snug truncate">
                #{ticket.id} — {ticket.subject}
              </SheetTitle>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <StatusBadge status={status} />
                <PriorityBadge priority={ticket.priority} />
                <span className="text-xs text-muted-foreground capitalize">
                  {CATEGORY_LABELS[ticket.category] ?? ticket.category}
                </span>
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto flex flex-col gap-4 px-6 py-4">
          {/* Ticket meta */}
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div>
              <span className="font-medium text-foreground">From</span>
              <p>{ticket.userName || "Unknown"}</p>
              <p>{ticket.userEmail || ticket.userId}</p>
            </div>
            <div>
              <span className="font-medium text-foreground">Submitted</span>
              <p>{formatDateTime(ticket.createdAt)}</p>
            </div>
          </div>

          {/* Original message */}
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">Original Message</p>
            <p className="text-sm whitespace-pre-wrap">{ticket.message}</p>
          </div>

          {/* Admin replies */}
          {localReplies.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground">Admin Replies</p>
              {localReplies.map((r) => (
                <div
                  key={r.id}
                  className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold">{r.adminName}</span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{r.message}</p>
                </div>
              ))}
            </div>
          )}

          {/* Status control */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Update Status</Label>
            <Select value={status} onValueChange={handleStatusChange} disabled={isPendingStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reply form */}
          <form onSubmit={handleReply} className="flex flex-col gap-2">
            <Label className="text-xs">Reply to User</Label>
            <Textarea
              placeholder="Type your response..."
              rows={4}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              disabled={isPendingReply}
            />
            {replyError && (
              <p className="text-xs text-destructive">{replyError}</p>
            )}
            <Button
              type="submit"
              size="sm"
              disabled={isPendingReply || !replyText.trim()}
            >
              {isPendingReply ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <SendHorizonal className="h-3.5 w-3.5 mr-1.5" />
              )}
              Send Reply
            </Button>
          </form>
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
  const [tickets, setTickets] = useState(initialTickets);
  const [stats, setStats] = useState(initialStats);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [selectedTicket, setSelectedTicket] = useState<SerializedTicket | null>(null);

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
    <div className="flex flex-col gap-6 mt-4">
      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Tickets", value: stats.totals.total, icon: Ticket, color: "text-foreground" },
          { label: "Open", value: stats.totals.openCount, icon: Clock, color: "text-blue-400" },
          { label: "Resolved", value: stats.totals.resolvedCount, icon: CheckCircle2, color: "text-green-400" },
          { label: "Urgent", value: stats.totals.urgentCount, icon: AlertTriangle, color: "text-red-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs text-muted-foreground">{label}</CardTitle>
              <Icon className={`h-4 w-4 ${color}`} />
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Category bar chart */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Tickets by Category</CardTitle>
            <CardDescription className="text-xs">Volume per support type</CardDescription>
          </CardHeader>
          <CardContent className="h-52">
            {categoryChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No data yet</div>
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

        {/* Status donut chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Status Breakdown</CardTitle>
            <CardDescription className="text-xs">Current resolution state</CardDescription>
          </CardHeader>
          <CardContent className="h-52">
            {statusChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No data yet</div>
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

      {/* Priority bar chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Priority Distribution</CardTitle>
          <CardDescription className="text-xs">Tickets grouped by assigned severity</CardDescription>
        </CardHeader>
        <CardContent className="h-40">
          {priorityChartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No data yet</div>
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

      {/* ── Ticket table ── */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-sm">All Support Tickets</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {filteredTickets.length} of {tickets.length} tickets
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <div className="relative w-full sm:w-auto sm:min-w-[200px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search by subject, user, ID…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-sm w-full"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                  <SelectTrigger className="w-[calc(50%-4px)] sm:w-[120px] h-8 text-sm">
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
                  <SelectTrigger className="w-[calc(50%-4px)] sm:w-[120px] h-8 text-sm">
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
                  <SelectTrigger className="w-full sm:w-[110px] h-8 text-sm">
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
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredTickets.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No tickets match the current filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
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
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setSelectedTicket(ticket)}
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
          onOpenChange={(v) => { if (!v) setSelectedTicket(null); }}
          onTicketUpdated={handleTicketUpdated}
        />
      )}
    </div>
  );
}
