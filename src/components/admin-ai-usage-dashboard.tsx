"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, ExternalLink, Loader2, Search, X } from "lucide-react";
import { exportAiUsageCsvAction } from "@/actions/ai-usage-admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  adminFilterInputClass,
  adminSupportChartCardClass,
  adminSupportEmptyStateClass,
  adminSupportKpiCardClass,
  adminSupportKpiGridClass,
  adminSupportSectionLabelClass,
} from "@/components/admin-panel-styles";
import { AI_USAGE_FEATURES, AI_USAGE_STATUSES } from "@/lib/ai-usage/types";
import { formatMicrosAsUsd } from "@/lib/ai-usage/pricing";
import { displayNameForBillingPlanSlug } from "@/lib/plan-slug-display";
import { cn } from "@/lib/utils";

const FILTER_ALL = "__all__";

const USAGE_STATUS_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "approaching", label: "Approaching limit" },
  { value: "critical", label: "Critical" },
  { value: "limit_reached", label: "Limit reached" },
  { value: "disabled", label: "AI disabled" },
  { value: "flagged", label: "Flagged" },
  { value: "unlimited", label: "Unlimited" },
] as const;

const SORT_OPTIONS = [
  { value: "generations", label: "Generations" },
  { value: "tokens", label: "Tokens" },
  { value: "cost", label: "Estimated cost" },
  { value: "lastUsed", label: "Last used" },
] as const;

export type AdminAiUsageDashboardProps = {
  timezone: string;
  filters: {
    preset: string;
    from: string;
    to: string;
    plan: string;
    teamId: string;
    feature: string;
    model: string;
    status: string;
    usageStatus: string;
    q: string;
    page: number;
    sort: string;
  };
  range: { start: string; end: string };
  summary: {
    totalGenerations: number;
    totalEvents: number;
    successful: number;
    failed: number;
    blocked: number;
    timedOut: number;
    totalTokens: number;
    estimatedCostMicros: number;
    avgResponseTimeMs: number;
    activeUsers: number;
  };
  previousSummary: AdminAiUsageDashboardProps["summary"];
  nearLimit: { approaching: number; reached: number };
  timeSeries: Array<{
    bucket: string;
    generations: number;
    totalTokens: number;
    estimatedCostMicros: number;
  }>;
  byFeature: Array<{
    feature: string;
    generations: number;
    totalTokens: number;
    estimatedCostMicros: number;
  }>;
  byPlan: Array<{
    plan: string;
    generations: number;
    users: number;
    totalTokens: number;
    estimatedCostMicros: number;
  }>;
  byModel: Array<{
    model: string;
    generations: number;
    totalTokens: number;
    estimatedCostMicros: number;
  }>;
  outcomes: Array<{ status: string; count: number }>;
  teams: Array<{ id: number; name: string }>;
  users: {
    rows: Array<{
      userId: string;
      name: string;
      email: string | null;
      subscriptionPlan: string | null;
      teamId: number | null;
      teamName: string | null;
      generations: number;
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      estimatedCostMicros: number;
      lastUsed: string | null;
      allowance:
        | { kind: "limited"; generations: number }
        | { kind: "unlimited" };
      snapshot: {
        usedGenerations: number;
        remainingGenerations: number | null;
        percentUsed: number | null;
        usageStatus: string;
      };
      aiAccessEnabled: boolean;
    }>;
    total: number;
    page: number;
    pageSize: number;
  };
  planOptions: string[];
  modelOptions: string[];
};

const PRESETS = [
  { value: "today", label: "Today" },
  { value: "last_7_days", label: "Last 7 days" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "current_billing_period", label: "Current billing period" },
  { value: "current_month", label: "Current month" },
  { value: "custom", label: "Custom range" },
] as const;

const CHART_COLORS = [
  "#38bdf8",
  "#34d399",
  "#fbbf24",
  "#f472b6",
  "#a78bfa",
  "#fb7185",
  "#2dd4bf",
  "#94a3b8",
];

const OUTCOME_COLORS: Record<string, string> = {
  success: "#22c55e",
  failed: "#ef4444",
  blocked: "#f97316",
  timed_out: "#eab308",
};

function deltaLabel(current: number, previous: number): string | null {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return "+100%";
  const pct = ((current - previous) / previous) * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function formatBucket(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatFeature(feature: string): string {
  return feature.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatStatusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatRangeLabel(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "";
  }
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };
  return `${start.toLocaleDateString("en-US", opts)} – ${end.toLocaleDateString("en-US", opts)}`;
}

function FilterField({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <Label
        htmlFor={htmlFor}
        className="text-xs font-medium text-muted-foreground"
      >
        {label}
      </Label>
      {children}
    </div>
  );
}

function UsageStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    normal: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    approaching: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    critical: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    limit_reached: "bg-red-500/15 text-red-400 border-red-500/30",
    disabled: "bg-muted text-muted-foreground border-border",
    flagged: "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30",
    unlimited: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        styles[status] ?? styles.normal,
      )}
    >
      {formatStatusLabel(status)}
    </span>
  );
}

function ChartEmpty({ label }: { label: string }) {
  return (
    <div className={adminSupportEmptyStateClass}>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function KpiCard({
  label,
  value,
  previous,
  hint,
}: {
  label: string;
  value: string;
  previous?: number;
  currentNumeric?: number;
  hint?: string;
}) {
  return (
    <Card className={adminSupportKpiCardClass}>
      <CardHeader className="space-y-1 p-4 pb-2">
        <CardDescription className="text-xs">{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums tracking-tight">
          {value}
        </CardTitle>
      </CardHeader>
      {(previous != null || hint) && (
        <CardContent className="px-4 pb-4 pt-0">
          {hint ? (
            <p className="text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </CardContent>
      )}
    </Card>
  );
}

function KpiWithDelta({
  label,
  value,
  current,
  previous,
  format = (n: number) => n.toLocaleString(),
}: {
  label: string;
  value?: string;
  current: number;
  previous: number;
  format?: (n: number) => string;
}) {
  const delta = deltaLabel(current, previous);
  return (
    <Card className={adminSupportKpiCardClass}>
      <CardHeader className="space-y-1 p-4 pb-2">
        <CardDescription className="text-xs">{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums tracking-tight">
          {value ?? format(current)}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        {delta ? (
          <p
            className={cn(
              "text-xs tabular-nums",
              current >= previous
                ? "text-emerald-400"
                : "text-red-400",
            )}
          >
            {delta} vs prior period
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">No prior-period change</p>
        )}
      </CardContent>
    </Card>
  );
}

export function AdminAiUsageDashboard(props: AdminAiUsageDashboardProps) {
  const {
    filters,
    range,
    summary,
    previousSummary,
    nearLimit,
    timeSeries,
    byFeature,
    byPlan,
    byModel,
    outcomes,
    teams,
    users,
    planOptions,
    modelOptions,
  } = props;

  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(filters.q);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    setSearchValue(filters.q);
  }, [filters.q]);

  const update = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value == null || value === "") next.delete(key);
        else next.set(key, value);
      }
      if (!("page" in updates)) next.delete("page");
      startTransition(() => {
        router.push(`${pathname}?${next.toString()}`, { scroll: false });
      });
    },
    [router, pathname, params],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue !== filters.q) {
        update({ q: searchValue || null });
      }
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue]);

  const hasFilters =
    Boolean(filters.q) ||
    Boolean(filters.plan) ||
    Boolean(filters.teamId) ||
    Boolean(filters.feature) ||
    Boolean(filters.model) ||
    Boolean(filters.status) ||
    Boolean(filters.usageStatus) ||
    filters.preset !== "current_month" ||
    filters.sort !== "generations";

  const seriesData = useMemo(
    () =>
      timeSeries.map((row) => ({
        ...row,
        label: formatBucket(row.bucket),
        costUsd: row.estimatedCostMicros / 1_000_000,
      })),
    [timeSeries],
  );

  const featureData = useMemo(
    () =>
      byFeature.map((row) => ({
        ...row,
        label: formatFeature(row.feature),
      })),
    [byFeature],
  );

  const planData = useMemo(
    () =>
      byPlan.map((row) => ({
        ...row,
        label: displayNameForBillingPlanSlug(row.plan),
      })),
    [byPlan],
  );

  const outcomeData = useMemo(
    () =>
      outcomes.map((row) => ({
        ...row,
        label: formatStatusLabel(row.status),
      })),
    [outcomes],
  );

  const totalPages = Math.max(1, Math.ceil(users.total / users.pageSize));

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      const result = await exportAiUsageCsvAction({
        preset: filters.preset,
        from: filters.from || undefined,
        to: filters.to || undefined,
        plan: filters.plan || undefined,
        teamId: filters.teamId ? Number(filters.teamId) : undefined,
        feature: (filters.feature || undefined) as
          | (typeof AI_USAGE_FEATURES)[number]
          | undefined,
        model: filters.model || undefined,
        status: (filters.status || undefined) as
          | (typeof AI_USAGE_STATUSES)[number]
          | undefined,
      });
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ai-usage-${filters.preset}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : "Export failed",
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <TooltipProvider>
      <div
        className={cn(
          "space-y-6 transition-opacity duration-150",
          isPending && "pointer-events-none opacity-50",
        )}
      >
        <Card className="border-border/70 bg-card/80">
          <CardHeader className="gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base">Filters</CardTitle>
              <CardDescription>
                Narrow the report by date, user, plan, feature, and outcome.
                {formatRangeLabel(range.start, range.end) ? (
                  <>
                    {" "}
                    Showing{" "}
                    <span className="font-medium text-foreground">
                      {formatRangeLabel(range.start, range.end)}
                    </span>
                    .
                  </>
                ) : null}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() => void handleExport()}
                disabled={exporting}
              >
                {exporting ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <Download className="mr-1.5 size-3.5" />
                )}
                Export CSV
              </Button>
              {hasFilters ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 text-muted-foreground"
                  onClick={() => {
                    setSearchValue("");
                    startTransition(() => {
                      router.push(pathname, { scroll: false });
                    });
                  }}
                >
                  <X className="mr-1 size-3.5" />
                  Clear filters
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <FilterField label="Date range">
                <Select
                  value={filters.preset}
                  onValueChange={(v) =>
                    update({
                      preset: v,
                      ...(v !== "custom" ? { from: null, to: null } : {}),
                    })
                  }
                >
                  <SelectTrigger
                    className={cn(adminFilterInputClass, "h-9 w-full")}
                  >
                    <SelectValue placeholder="Date range">
                      {PRESETS.find((p) => p.value === filters.preset)?.label ??
                        "Date range"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PRESETS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>

              {filters.preset === "custom" ? (
                <>
                  <FilterField label="From" htmlFor="ai-usage-from">
                    <Input
                      id="ai-usage-from"
                      type="date"
                      value={filters.from}
                      onChange={(e) =>
                        update({ from: e.target.value, preset: "custom" })
                      }
                      className={cn(adminFilterInputClass, "h-9 w-full")}
                    />
                  </FilterField>
                  <FilterField label="To" htmlFor="ai-usage-to">
                    <Input
                      id="ai-usage-to"
                      type="date"
                      value={filters.to}
                      onChange={(e) =>
                        update({ to: e.target.value, preset: "custom" })
                      }
                      className={cn(adminFilterInputClass, "h-9 w-full")}
                    />
                  </FilterField>
                </>
              ) : null}

              <FilterField
                label="Search users"
                htmlFor="ai-usage-search"
                className={
                  filters.preset === "custom"
                    ? "sm:col-span-2 xl:col-span-1"
                    : "sm:col-span-1 xl:col-span-1"
                }
              >
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    id="ai-usage-search"
                    placeholder="Name or email…"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    className={cn(adminFilterInputClass, "h-9 w-full pl-9")}
                  />
                </div>
              </FilterField>

              <FilterField label="Plan">
                <Select
                  value={filters.plan || FILTER_ALL}
                  onValueChange={(v) =>
                    update({ plan: v === FILTER_ALL ? null : v })
                  }
                >
                  <SelectTrigger
                    className={cn(adminFilterInputClass, "h-9 w-full")}
                  >
                    <SelectValue placeholder="All plans">
                      {filters.plan
                        ? displayNameForBillingPlanSlug(filters.plan)
                        : "All plans"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={FILTER_ALL}>All plans</SelectItem>
                    {planOptions.map((p) => (
                      <SelectItem key={p} value={p}>
                        {displayNameForBillingPlanSlug(p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>

              <FilterField label="Team">
                <Select
                  value={filters.teamId || FILTER_ALL}
                  onValueChange={(v) =>
                    update({ teamId: v === FILTER_ALL ? null : v })
                  }
                >
                  <SelectTrigger
                    className={cn(adminFilterInputClass, "h-9 w-full")}
                  >
                    <SelectValue placeholder="All teams">
                      {filters.teamId
                        ? (teams.find((t) => String(t.id) === filters.teamId)
                            ?.name ?? "Selected team")
                        : "All teams"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={FILTER_ALL}>All teams</SelectItem>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>

              <FilterField label="Feature">
                <Select
                  value={filters.feature || FILTER_ALL}
                  onValueChange={(v) =>
                    update({ feature: v === FILTER_ALL ? null : v })
                  }
                >
                  <SelectTrigger
                    className={cn(adminFilterInputClass, "h-9 w-full")}
                  >
                    <SelectValue placeholder="All features">
                      {filters.feature
                        ? formatFeature(filters.feature)
                        : "All features"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={FILTER_ALL}>All features</SelectItem>
                    {AI_USAGE_FEATURES.map((f) => (
                      <SelectItem key={f} value={f}>
                        {formatFeature(f)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>

              <FilterField label="Model">
                <Select
                  value={filters.model || FILTER_ALL}
                  onValueChange={(v) =>
                    update({ model: v === FILTER_ALL ? null : v })
                  }
                >
                  <SelectTrigger
                    className={cn(adminFilterInputClass, "h-9 w-full")}
                  >
                    <SelectValue placeholder="All models">
                      {filters.model || "All models"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={FILTER_ALL}>All models</SelectItem>
                    {modelOptions.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>

              <FilterField label="Request status">
                <Select
                  value={filters.status || FILTER_ALL}
                  onValueChange={(v) =>
                    update({ status: v === FILTER_ALL ? null : v })
                  }
                >
                  <SelectTrigger
                    className={cn(adminFilterInputClass, "h-9 w-full")}
                  >
                    <SelectValue placeholder="All statuses">
                      {filters.status
                        ? formatStatusLabel(filters.status)
                        : "All statuses"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={FILTER_ALL}>All statuses</SelectItem>
                    {AI_USAGE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {formatStatusLabel(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>

              <FilterField label="Usage status">
                <Select
                  value={filters.usageStatus || FILTER_ALL}
                  onValueChange={(v) =>
                    update({ usageStatus: v === FILTER_ALL ? null : v })
                  }
                >
                  <SelectTrigger
                    className={cn(adminFilterInputClass, "h-9 w-full")}
                  >
                    <SelectValue placeholder="All usage levels">
                      {filters.usageStatus
                        ? (USAGE_STATUS_OPTIONS.find(
                            (s) => s.value === filters.usageStatus,
                          )?.label ?? formatStatusLabel(filters.usageStatus))
                        : "All usage levels"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={FILTER_ALL}>All usage levels</SelectItem>
                    {USAGE_STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>

              <FilterField label="Sort users by">
                <Select
                  value={filters.sort}
                  onValueChange={(v) => update({ sort: v })}
                >
                  <SelectTrigger
                    className={cn(adminFilterInputClass, "h-9 w-full")}
                  >
                    <SelectValue placeholder="Sort by">
                      {SORT_OPTIONS.find((s) => s.value === filters.sort)
                        ?.label ?? "Generations"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>
            </div>

            {exportError ? (
              <p className="text-sm text-destructive" role="alert">
                {exportError}
              </p>
            ) : null}
            {isPending ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Updating filters…
              </div>
            ) : null}
          </CardContent>
        </Card>

        <section aria-labelledby="ai-usage-summary">
          <p id="ai-usage-summary" className={adminSupportSectionLabelClass}>
            Summary
          </p>
          <div className={cn(adminSupportKpiGridClass, "lg:grid-cols-3 xl:grid-cols-5")}>
            <KpiWithDelta
              label="Total AI generations"
              current={summary.totalGenerations}
              previous={previousSummary.totalGenerations}
            />
            <KpiWithDelta
              label="Active AI users"
              current={summary.activeUsers}
              previous={previousSummary.activeUsers}
            />
            <KpiWithDelta
              label="Total tokens"
              current={summary.totalTokens}
              previous={previousSummary.totalTokens}
            />
            <KpiWithDelta
              label="Estimated AI cost"
              current={summary.estimatedCostMicros}
              previous={previousSummary.estimatedCostMicros}
              value={formatMicrosAsUsd(summary.estimatedCostMicros)}
              format={(n) => formatMicrosAsUsd(n)}
            />
            <KpiWithDelta
              label="Successful"
              current={summary.successful}
              previous={previousSummary.successful}
            />
            <KpiWithDelta
              label="Failed"
              current={summary.failed}
              previous={previousSummary.failed}
            />
            <KpiWithDelta
              label="Avg response time"
              current={summary.avgResponseTimeMs}
              previous={previousSummary.avgResponseTimeMs}
              value={`${summary.avgResponseTimeMs.toLocaleString()} ms`}
              format={(n) => `${n.toLocaleString()} ms`}
            />
            <KpiCard
              label="Users approaching limit"
              value={nearLimit.approaching.toLocaleString()}
              hint="≥ 80% of period allowance"
            />
            <KpiCard
              label="Users who reached limit"
              value={nearLimit.reached.toLocaleString()}
              hint="≥ 100% of period allowance"
            />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2" aria-label="Usage charts">
          <Card className={adminSupportChartCardClass}>
            <CardHeader>
              <CardTitle className="text-base">Generations over time</CardTitle>
              <CardDescription>
                Successful AI generations across the selected range.
              </CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              {seriesData.length === 0 ? (
                <ChartEmpty label="No generation activity in this range." />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={seriesData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <RechartsTooltip />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="generations"
                        name="Generations"
                        stroke="#38bdf8"
                        fill="#38bdf8"
                        fillOpacity={0.25}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                  <p className="sr-only">
                    Generations over time:{" "}
                    {seriesData
                      .map((d) => `${d.label}: ${d.generations}`)
                      .join("; ")}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className={adminSupportChartCardClass}>
            <CardHeader>
              <CardTitle className="text-base">Usage by feature</CardTitle>
              <CardDescription>
                Successful generations grouped by product feature.
              </CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              {featureData.length === 0 ? (
                <ChartEmpty label="No feature breakdown available." />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={featureData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <RechartsTooltip />
                      <Bar dataKey="generations" name="Generations" fill="#34d399" />
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="sr-only">
                    Usage by feature:{" "}
                    {featureData
                      .map((d) => `${d.label}: ${d.generations}`)
                      .join("; ")}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className={adminSupportChartCardClass}>
            <CardHeader>
              <CardTitle className="text-base">Tokens &amp; cost over time</CardTitle>
              <CardDescription>
                Token volume and estimated USD cost by period bucket.
              </CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              {seriesData.length === 0 ? (
                <ChartEmpty label="No token or cost data in this range." />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={seriesData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: 11 }}
                      />
                      <RechartsTooltip
                        formatter={(value, name) => {
                          if (name === "Cost (USD)") {
                            return [
                              formatMicrosAsUsd(Number(value) * 1_000_000),
                              name,
                            ];
                          }
                          return [Number(value).toLocaleString(), name];
                        }}
                      />
                      <Legend />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="totalTokens"
                        name="Tokens"
                        stroke="#a78bfa"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="costUsd"
                        name="Cost (USD)"
                        stroke="#fbbf24"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  <p className="sr-only">
                    Tokens and cost over time:{" "}
                    {seriesData
                      .map(
                        (d) =>
                          `${d.label}: ${d.totalTokens} tokens, ${formatMicrosAsUsd(d.estimatedCostMicros)}`,
                      )
                      .join("; ")}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className={adminSupportChartCardClass}>
            <CardHeader>
              <CardTitle className="text-base">By subscription plan</CardTitle>
              <CardDescription>
                Generations attributed to each plan slug.
              </CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              {planData.length === 0 ? (
                <ChartEmpty label="No plan breakdown available." />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={planData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={110}
                        tick={{ fontSize: 10 }}
                      />
                      <RechartsTooltip />
                      <Bar dataKey="generations" name="Generations" fill="#38bdf8" />
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="sr-only">
                    By plan:{" "}
                    {planData
                      .map((d) => `${d.label}: ${d.generations}`)
                      .join("; ")}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className={adminSupportChartCardClass}>
            <CardHeader>
              <CardTitle className="text-base">Request outcomes</CardTitle>
              <CardDescription>
                Success, failure, blocked, and timed-out counts.
              </CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              {outcomeData.length === 0 ? (
                <ChartEmpty label="No outcome data available." />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={outcomeData}
                        dataKey="count"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        label
                      >
                        {outcomeData.map((entry) => (
                          <Cell
                            key={entry.status}
                            fill={
                              OUTCOME_COLORS[entry.status] ?? CHART_COLORS[0]
                            }
                          />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                  <p className="sr-only">
                    Outcomes:{" "}
                    {outcomeData
                      .map((d) => `${d.label}: ${d.count}`)
                      .join("; ")}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className={adminSupportChartCardClass}>
            <CardHeader>
              <CardTitle className="text-base">Model usage</CardTitle>
              <CardDescription>
                Successful generations by model identifier.
              </CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              {byModel.length === 0 ? (
                <ChartEmpty label="No model usage recorded." />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byModel}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="model" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <RechartsTooltip />
                      <Bar dataKey="generations" name="Generations">
                        {byModel.map((_, i) => (
                          <Cell
                            key={byModel[i].model}
                            fill={CHART_COLORS[i % CHART_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="sr-only">
                    Model usage:{" "}
                    {byModel
                      .map((d) => `${d.model}: ${d.generations}`)
                      .join("; ")}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="ai-usage-users">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p id="ai-usage-users" className={adminSupportSectionLabelClass}>
              Users ({users.total.toLocaleString()})
            </p>
            {isPending ? <Skeleton className="h-4 w-24" /> : null}
          </div>

          <Card className="border-border/70 bg-card/80">
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-right">Generations</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead className="text-right">Est. cost</TableHead>
                    <TableHead>Allowance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last used</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.rows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={10}
                        className="py-10 text-center text-muted-foreground"
                      >
                        No users match the current filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.rows.map((row) => (
                      <TableRow key={row.userId}>
                        <TableCell>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">
                              {row.name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {row.email ?? row.userId}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {displayNameForBillingPlanSlug(row.subscriptionPlan)}
                        </TableCell>
                        <TableCell>{row.teamName ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.generations.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.totalTokens.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMicrosAsUsd(row.estimatedCostMicros)}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {row.allowance.kind === "unlimited"
                            ? "Unlimited"
                            : `${row.snapshot.usedGenerations}/${row.allowance.generations}`}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <UsageStatusBadge status={row.snapshot.usageStatus} />
                            {!row.aiAccessEnabled ? (
                              <Badge variant="destructive">AI off</Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.lastUsed
                            ? new Date(row.lastUsed).toLocaleString()
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <span className="inline-flex" />
                              }
                            >
                              <Link
                                href={`/admin/analytics/ai-usage/${row.userId}`}
                                className={cn(
                                  buttonVariants({
                                    variant: "ghost",
                                    size: "sm",
                                  }),
                                  "h-8 px-2",
                                )}
                                aria-label={`View AI usage details for ${row.name}`}
                              >
                                <ExternalLink className="size-3.5" />
                                <span className="sr-only">View details</span>
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent>View details</TooltipContent>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Page {users.page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={users.page <= 1}
                onClick={() =>
                  update({ page: String(Math.max(1, users.page - 1)) })
                }
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={users.page >= totalPages}
                onClick={() =>
                  update({ page: String(Math.min(totalPages, users.page + 1)) })
                }
              >
                Next
              </Button>
            </div>
          </div>
        </section>
      </div>
    </TooltipProvider>
  );
}
