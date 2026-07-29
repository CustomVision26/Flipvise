import { createClerkClient } from "@clerk/backend";
import {
  AdminAiUsageDashboard,
  type AdminAiUsageDashboardProps,
} from "@/components/admin-ai-usage-dashboard";
import {
  countUsersNearLimit,
  getAiUsageBreakdownByFeature,
  getAiUsageBreakdownByModel,
  getAiUsageBreakdownByPlan,
  getAiUsageOutcomeBreakdown,
  getAiUsageSummaryMetrics,
  getAiUsageTimeSeries,
  getAiUsageUserTable,
  listTeamsForAiUsageFilter,
} from "@/db/queries/ai-usage";
import {
  AI_USAGE_PLATFORM_TIMEZONE,
  previousEquivalentRange,
  resolveDateRangePreset,
} from "@/lib/ai-usage/period";
import {
  AI_USAGE_FEATURES,
  AI_USAGE_STATUSES,
  type AiUsageFeature,
  type AiUsageStatus,
} from "@/lib/ai-usage/types";
import { toClientJson } from "@/lib/to-client-json";

export const dynamic = "force-dynamic";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function parsePage(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

function pickFeature(raw: string | undefined): AiUsageFeature | null {
  if (!raw) return null;
  return (AI_USAGE_FEATURES as readonly string[]).includes(raw)
    ? (raw as AiUsageFeature)
    : null;
}

function pickStatus(raw: string | undefined): AiUsageStatus | null {
  if (!raw) return null;
  return (AI_USAGE_STATUSES as readonly string[]).includes(raw)
    ? (raw as AiUsageStatus)
    : null;
}

function timeSeriesGranularity(
  start: Date,
  end: Date,
): "day" | "week" | "month" {
  const days = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
  if (days <= 45) return "day";
  if (days <= 180) return "week";
  return "month";
}

function clerkDisplayName(user: {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
}): string {
  return (
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.username ||
    "—"
  );
}

export default async function AdminAiUsageAnalyticsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const preset = first(sp.preset) ?? "current_month";
  const from = first(sp.from) ?? null;
  const to = first(sp.to) ?? null;
  const plan = first(sp.plan) || null;
  const teamIdRaw = first(sp.teamId);
  const teamId =
    teamIdRaw && Number.isFinite(Number(teamIdRaw))
      ? Number(teamIdRaw)
      : null;
  const feature = pickFeature(first(sp.feature));
  const model = first(sp.model) || null;
  const status = pickStatus(first(sp.status));
  const usageStatus = first(sp.usageStatus) || null;
  const q = (first(sp.q) ?? "").trim();
  const page = parsePage(first(sp.page));
  const sort = first(sp.sort) ?? "generations";

  const range = resolveDateRangePreset(preset, from, to);
  const previousRange = previousEquivalentRange(range.start, range.end);
  const granularity = timeSeriesGranularity(range.start, range.end);

  let searchUserIds: string[] | null = null;
  let searchEmpty = false;
  if (q) {
    try {
      const { data } = await clerkClient.users.getUserList({
        query: q,
        limit: 50,
      });
      searchUserIds = data.map((u) => u.id);
      if (searchUserIds.length === 0) searchEmpty = true;
    } catch {
      searchEmpty = true;
      searchUserIds = [];
    }
  }

  const [
    summary,
    previousSummary,
    timeSeries,
    byFeature,
    byPlan,
    byModel,
    outcomes,
    nearLimit,
    teams,
    userTable,
  ] = await Promise.all([
    getAiUsageSummaryMetrics({ start: range.start, end: range.end }),
    getAiUsageSummaryMetrics({
      start: previousRange.start,
      end: previousRange.end,
    }),
    getAiUsageTimeSeries({
      start: range.start,
      end: range.end,
      granularity,
    }),
    getAiUsageBreakdownByFeature({ start: range.start, end: range.end }),
    getAiUsageBreakdownByPlan({ start: range.start, end: range.end }),
    getAiUsageBreakdownByModel({ start: range.start, end: range.end }),
    getAiUsageOutcomeBreakdown({ start: range.start, end: range.end }),
    countUsersNearLimit(),
    listTeamsForAiUsageFilter(),
    searchEmpty
      ? Promise.resolve({ rows: [], total: 0, page: 1, pageSize: 25 })
      : getAiUsageUserTable({
          start: range.start,
          end: range.end,
          plan,
          teamId,
          feature,
          model,
          status,
          searchUserIds,
          page,
          pageSize: 25,
        }),
  ]);

  let rows = userTable.rows;
  if (usageStatus) {
    rows = rows.filter((r) => r.snapshot.usageStatus === usageStatus);
  }

  if (sort === "tokens") {
    rows = [...rows].sort((a, b) => b.totalTokens - a.totalTokens);
  } else if (sort === "cost") {
    rows = [...rows].sort(
      (a, b) => b.estimatedCostMicros - a.estimatedCostMicros,
    );
  } else if (sort === "lastUsed") {
    rows = [...rows].sort((a, b) =>
      (b.lastUsed ?? "").localeCompare(a.lastUsed ?? ""),
    );
  } else {
    rows = [...rows].sort((a, b) => b.generations - a.generations);
  }

  const userIds = rows.map((r) => r.userId);
  const identityMap = new Map<
    string,
    { name: string; email: string | null }
  >();
  if (userIds.length > 0) {
    try {
      const { data: clerkUsers } = await clerkClient.users.getUserList({
        userId: userIds,
        limit: userIds.length,
      });
      for (const u of clerkUsers) {
        const email =
          u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)
            ?.emailAddress ??
          u.emailAddresses[0]?.emailAddress ??
          null;
        identityMap.set(u.id, {
          name: clerkDisplayName(u),
          email,
        });
      }
    } catch {
      // identity enrichment is best-effort
    }
  }

  const enrichedRows = rows.map((r) => ({
    ...r,
    name: identityMap.get(r.userId)?.name ?? r.userId,
    email: identityMap.get(r.userId)?.email ?? null,
  }));

  const props: AdminAiUsageDashboardProps = {
    timezone: AI_USAGE_PLATFORM_TIMEZONE,
    filters: {
      preset: range.preset,
      from: from ?? "",
      to: to ?? "",
      plan: plan ?? "",
      teamId: teamId != null ? String(teamId) : "",
      feature: feature ?? "",
      model: model ?? "",
      status: status ?? "",
      usageStatus: usageStatus ?? "",
      q,
      page: userTable.page,
      sort,
    },
    range: {
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    },
    summary,
    previousSummary,
    nearLimit,
    timeSeries,
    byFeature,
    byPlan,
    byModel,
    outcomes,
    teams,
    users: {
      rows: enrichedRows,
      total: searchEmpty ? 0 : userTable.total,
      page: userTable.page,
      pageSize: userTable.pageSize,
    },
    planOptions: [
      ...new Set(
        byPlan.map((p) => p.plan).filter((p) => p && p !== "unknown"),
      ),
    ].sort(),
    modelOptions: byModel.map((m) => m.model).filter(Boolean),
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1.5 border-b border-border/60 pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          AI &amp; analytics
        </p>
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          AI Usage Analytics
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Monitor AI generations, token consumption, estimated costs, plan
          limits, and user activity.
        </p>
        <p className="text-xs text-muted-foreground">
          Timezone:{" "}
          <span className="font-medium text-foreground">
            {AI_USAGE_PLATFORM_TIMEZONE}
          </span>
        </p>
      </header>

      <AdminAiUsageDashboard {...toClientJson(props)} />
    </div>
  );
}
