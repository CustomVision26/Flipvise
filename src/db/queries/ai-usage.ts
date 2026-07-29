import { db } from "@/db";
import {
  aiUsageAdminAuditLogs,
  aiUsageEvents,
  aiUsagePeriodCounters,
  aiUsageTeamLimits,
  aiUsageUserLimits,
  teams,
} from "@/db/schema";
import {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  gte,
  inArray,
  lt,
  sql,
  type SQL,
} from "drizzle-orm";
import type { AiUsageFeature, AiUsageStatus } from "@/lib/ai-usage/types";
import {
  buildPeriodSnapshot,
  resolveAllowancePriority,
} from "@/lib/ai-usage/limits";
import { resolveUsagePeriod } from "@/lib/ai-usage/period";
import {
  estimateAiCostMicros,
  extractTokenUsage,
  getAiPricingCurrency,
  getAiPricingVersion,
} from "@/lib/ai-usage/pricing";
import { evaluateSuspiciousUsage } from "@/lib/ai-usage/abuse";
import { getActiveStripeSubscription } from "@/db/queries/stripe-subscriptions";
import planDefaults from "@/data/ai-usage-plan-defaults.json";

export async function getAiUsageUserLimit(userId: string) {
  const [row] = await db
    .select()
    .from(aiUsageUserLimits)
    .where(eq(aiUsageUserLimits.userId, userId))
    .limit(1);
  return row ?? null;
}

export async function getAiUsageTeamLimit(teamId: number) {
  const [row] = await db
    .select()
    .from(aiUsageTeamLimits)
    .where(eq(aiUsageTeamLimits.teamId, teamId))
    .limit(1);
  return row ?? null;
}

export async function ensurePeriodCounter(params: {
  userId: string;
  periodStart: Date;
  periodEnd: Date;
}) {
  const existing = await db
    .select()
    .from(aiUsagePeriodCounters)
    .where(
      and(
        eq(aiUsagePeriodCounters.userId, params.userId),
        eq(aiUsagePeriodCounters.periodStart, params.periodStart),
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0];

  try {
    const [created] = await db
      .insert(aiUsagePeriodCounters)
      .values({
        userId: params.userId,
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
      })
      .returning();
    return created;
  } catch {
    const [row] = await db
      .select()
      .from(aiUsagePeriodCounters)
      .where(
        and(
          eq(aiUsagePeriodCounters.userId, params.userId),
          eq(aiUsagePeriodCounters.periodStart, params.periodStart),
        ),
      )
      .limit(1);
    if (!row) throw new Error("Failed to ensure AI usage period counter");
    return row;
  }
}

export async function resolveUserAiLimitContext(params: {
  userId: string;
  teamId?: number | null;
  subscriptionPlan?: string | null;
  isPlatformAdmin?: boolean;
}) {
  const stripe = await getActiveStripeSubscription(params.userId);
  const period = resolveUsagePeriod({
    stripeCurrentPeriodEnd: stripe?.currentPeriodEnd ?? null,
  });
  const userLimit = await getAiUsageUserLimit(params.userId);
  const teamLimit =
    params.teamId != null ? await getAiUsageTeamLimit(params.teamId) : null;

  const plan =
    params.subscriptionPlan ?? stripe?.planSlug ?? null;

  const { allowance, source } = resolveAllowancePriority({
    isPlatformAdmin: Boolean(params.isPlatformAdmin),
    userUnlimited: userLimit?.unlimited,
    userMonthlyAllowance: userLimit?.monthlyAllowance,
    teamUnlimited: teamLimit?.unlimited,
    teamMonthlyAllowance: teamLimit?.monthlyAllowance,
    subscriptionPlan: plan,
  });

  const aiAccessEnabled =
    (userLimit?.aiAccessEnabled ?? true) && (teamLimit?.aiAccessEnabled ?? true);
  const blockAtLimit =
    userLimit?.blockAtLimit ??
    teamLimit?.blockAtLimit ??
    planDefaults.blockAtLimitDefault;
  const allowOverage =
    userLimit?.allowOverage ??
    teamLimit?.allowOverage ??
    planDefaults.allowOverageDefault;

  const counter = await ensurePeriodCounter({
    userId: params.userId,
    periodStart: period.start,
    periodEnd: period.end,
  });

  const usedGenerations = Math.max(
    0,
    counter.generationCount - counter.resetAdjustment,
  );

  const snapshot = buildPeriodSnapshot({
    aiAccessEnabled,
    flagged: Boolean(userLimit?.flagged),
    allowance,
    usedGenerations,
    inputTokens: counter.inputTokens,
    outputTokens: counter.outputTokens,
    totalTokens: counter.totalTokens,
    estimatedCostMicros: counter.estimatedCostMicros,
  });

  return {
    allowance,
    source,
    aiAccessEnabled,
    blockAtLimit,
    allowOverage,
    subscriptionPlan: plan,
    teamId: params.teamId ?? null,
    periodStart: period.start,
    periodEnd: period.end,
    flagged: Boolean(userLimit?.flagged),
    flagReason: userLimit?.flagReason ?? null,
    counter,
    snapshot,
    userLimit,
    teamLimit,
  };
}

/**
 * Atomically reserve one generation against the period counter when limited.
 * Returns false when the limit would be exceeded (and blockAtLimit is enforced by caller).
 */
export async function tryReserveAiGeneration(params: {
  userId: string;
  periodStart: Date;
  periodEnd: Date;
  maxGenerations: number | null;
}): Promise<{ ok: boolean; usedAfter: number }> {
  await ensurePeriodCounter({
    userId: params.userId,
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
  });

  if (params.maxGenerations == null) {
    const [row] = await db
      .update(aiUsagePeriodCounters)
      .set({
        generationCount: sql`${aiUsagePeriodCounters.generationCount} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(aiUsagePeriodCounters.userId, params.userId),
          eq(aiUsagePeriodCounters.periodStart, params.periodStart),
        ),
      )
      .returning();
    const used = Math.max(
      0,
      (row?.generationCount ?? 1) - (row?.resetAdjustment ?? 0),
    );
    return { ok: true, usedAfter: used };
  }

  const [row] = await db
    .update(aiUsagePeriodCounters)
    .set({
      generationCount: sql`${aiUsagePeriodCounters.generationCount} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(aiUsagePeriodCounters.userId, params.userId),
        eq(aiUsagePeriodCounters.periodStart, params.periodStart),
        sql`(${aiUsagePeriodCounters.generationCount} - ${aiUsagePeriodCounters.resetAdjustment}) < ${params.maxGenerations}`,
      ),
    )
    .returning();

  if (!row) {
    const [current] = await db
      .select()
      .from(aiUsagePeriodCounters)
      .where(
        and(
          eq(aiUsagePeriodCounters.userId, params.userId),
          eq(aiUsagePeriodCounters.periodStart, params.periodStart),
        ),
      )
      .limit(1);
    const used = Math.max(
      0,
      (current?.generationCount ?? 0) - (current?.resetAdjustment ?? 0),
    );
    return { ok: false, usedAfter: used };
  }

  const used = Math.max(0, row.generationCount - row.resetAdjustment);
  return { ok: true, usedAfter: used };
}

export async function releaseReservedAiGeneration(params: {
  userId: string;
  periodStart: Date;
}) {
  await db
    .update(aiUsagePeriodCounters)
    .set({
      generationCount: sql`GREATEST(0, ${aiUsagePeriodCounters.generationCount} - 1)`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(aiUsagePeriodCounters.userId, params.userId),
        eq(aiUsagePeriodCounters.periodStart, params.periodStart),
      ),
    );
}

export async function insertAiUsageEvent(params: {
  userId: string;
  teamId?: number | null;
  subscriptionPlan?: string | null;
  feature: AiUsageFeature;
  model: string;
  provider?: string;
  usage?: unknown;
  imageCount?: number;
  status: AiUsageStatus;
  responseTimeMs?: number | null;
  providerRequestId?: string | null;
  errorCode?: string | null;
  errorCategory?: string | null;
  periodStart?: Date;
}) {
  const tokens = extractTokenUsage(params.usage);
  const estimatedCostMicros = estimateAiCostMicros({
    model: params.model,
    usage: tokens,
    imageCount: params.imageCount,
  });

  const [event] = await db
    .insert(aiUsageEvents)
    .values({
      userId: params.userId,
      teamId: params.teamId ?? null,
      subscriptionPlan: params.subscriptionPlan ?? null,
      feature: params.feature,
      model: params.model,
      provider: params.provider ?? "openai",
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
      cachedInputTokens: tokens.cachedInputTokens ?? 0,
      totalTokens: tokens.totalTokens,
      estimatedCostMicros,
      currency: getAiPricingCurrency(),
      pricingVersion: getAiPricingVersion(),
      status: params.status,
      responseTimeMs: params.responseTimeMs ?? null,
      providerRequestId: params.providerRequestId ?? null,
      errorCode: params.errorCode ?? null,
      errorCategory: params.errorCategory ?? null,
    })
    .returning();

  if (params.status === "success" && params.periodStart) {
    await db
      .update(aiUsagePeriodCounters)
      .set({
        inputTokens: sql`${aiUsagePeriodCounters.inputTokens} + ${tokens.inputTokens}`,
        outputTokens: sql`${aiUsagePeriodCounters.outputTokens} + ${tokens.outputTokens}`,
        totalTokens: sql`${aiUsagePeriodCounters.totalTokens} + ${tokens.totalTokens}`,
        estimatedCostMicros: sql`${aiUsagePeriodCounters.estimatedCostMicros} + ${estimatedCostMicros}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(aiUsagePeriodCounters.userId, params.userId),
          eq(aiUsagePeriodCounters.periodStart, params.periodStart),
        ),
      );
  }

  return event;
}

export async function maybeFlagUserForAbuse(userId: string) {
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60_000);
  const oneHourAgo = new Date(now.getTime() - 3_600_000);

  const [minuteCount] = await db
    .select({ c: count() })
    .from(aiUsageEvents)
    .where(
      and(
        eq(aiUsageEvents.userId, userId),
        gte(aiUsageEvents.createdAt, oneMinuteAgo),
      ),
    );

  const [failCount] = await db
    .select({ c: count() })
    .from(aiUsageEvents)
    .where(
      and(
        eq(aiUsageEvents.userId, userId),
        eq(aiUsageEvents.status, "failed"),
        gte(aiUsageEvents.createdAt, oneHourAgo),
      ),
    );

  const [blockedCount] = await db
    .select({ c: count() })
    .from(aiUsageEvents)
    .where(
      and(
        eq(aiUsageEvents.userId, userId),
        eq(aiUsageEvents.status, "blocked"),
        gte(aiUsageEvents.createdAt, oneHourAgo),
      ),
    );

  const [costRow] = await db
    .select({
      cost: sql<number>`coalesce(sum(${aiUsageEvents.estimatedCostMicros}), 0)::int`,
    })
    .from(aiUsageEvents)
    .where(
      and(
        eq(aiUsageEvents.userId, userId),
        gte(aiUsageEvents.createdAt, oneHourAgo),
      ),
    );

  const signal = evaluateSuspiciousUsage({
    requestsLastMinute: Number(minuteCount?.c ?? 0),
    failuresLastHour: Number(failCount?.c ?? 0),
    blockedLastHour: Number(blockedCount?.c ?? 0),
    costMicrosLastHour: Number(costRow?.cost ?? 0),
  });

  if (!signal.flagged) return signal;

  const existing = await getAiUsageUserLimit(userId);
  if (existing?.flagged) return signal;

  if (existing) {
    await db
      .update(aiUsageUserLimits)
      .set({
        flagged: true,
        flagReason: signal.reasons.join("; "),
        updatedAt: new Date(),
      })
      .where(eq(aiUsageUserLimits.userId, userId));
  } else {
    await db.insert(aiUsageUserLimits).values({
      userId,
      flagged: true,
      flagReason: signal.reasons.join("; "),
    });
  }

  return signal;
}

export async function logAiUsageAdminAction(data: {
  actorUserId: string;
  actorName: string;
  targetUserId?: string | null;
  targetTeamId?: number | null;
  action: string;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  reason?: string | null;
}) {
  const [row] = await db
    .insert(aiUsageAdminAuditLogs)
    .values({
      actorUserId: data.actorUserId,
      actorName: data.actorName,
      targetUserId: data.targetUserId ?? null,
      targetTeamId: data.targetTeamId ?? null,
      action: data.action,
      previousValue: data.previousValue ?? null,
      newValue: data.newValue ?? null,
      reason: data.reason ?? null,
    })
    .returning();
  return row;
}

export async function upsertAiUsageUserLimit(params: {
  userId: string;
  monthlyAllowance?: number | null;
  unlimited?: boolean;
  aiAccessEnabled?: boolean;
  blockAtLimit?: boolean;
  allowOverage?: boolean;
  warningThreshold80?: boolean;
  warningThreshold90?: boolean;
  warningThreshold100?: boolean;
  flagged?: boolean;
  flagReason?: string | null;
  notes?: string | null;
  updatedByUserId: string;
  clearAllowanceOverride?: boolean;
}) {
  const existing = await getAiUsageUserLimit(params.userId);
  const values = {
    monthlyAllowance: params.clearAllowanceOverride
      ? null
      : params.monthlyAllowance !== undefined
        ? params.monthlyAllowance
        : (existing?.monthlyAllowance ?? null),
    unlimited: params.clearAllowanceOverride
      ? false
      : (params.unlimited ?? existing?.unlimited ?? false),
    aiAccessEnabled: params.aiAccessEnabled ?? existing?.aiAccessEnabled ?? true,
    blockAtLimit: params.blockAtLimit ?? existing?.blockAtLimit ?? true,
    allowOverage: params.allowOverage ?? existing?.allowOverage ?? false,
    warningThreshold80:
      params.warningThreshold80 ?? existing?.warningThreshold80 ?? true,
    warningThreshold90:
      params.warningThreshold90 ?? existing?.warningThreshold90 ?? true,
    warningThreshold100:
      params.warningThreshold100 ?? existing?.warningThreshold100 ?? true,
    flagged: params.flagged ?? existing?.flagged ?? false,
    flagReason:
      params.flagReason !== undefined
        ? params.flagReason
        : (existing?.flagReason ?? null),
    notes: params.notes !== undefined ? params.notes : (existing?.notes ?? null),
    updatedAt: new Date(),
    updatedByUserId: params.updatedByUserId,
  };

  if (existing) {
    const [row] = await db
      .update(aiUsageUserLimits)
      .set(values)
      .where(eq(aiUsageUserLimits.userId, params.userId))
      .returning();
    return { previous: existing, next: row };
  }

  const [row] = await db
    .insert(aiUsageUserLimits)
    .values({ userId: params.userId, ...values })
    .returning();
  return { previous: null, next: row };
}

export async function upsertAiUsageTeamLimit(params: {
  teamId: number;
  monthlyAllowance?: number | null;
  unlimited?: boolean;
  aiAccessEnabled?: boolean;
  blockAtLimit?: boolean;
  allowOverage?: boolean;
  updatedByUserId: string;
  clearAllowanceOverride?: boolean;
}) {
  const existing = await getAiUsageTeamLimit(params.teamId);
  const values = {
    monthlyAllowance: params.clearAllowanceOverride
      ? null
      : params.monthlyAllowance !== undefined
        ? params.monthlyAllowance
        : (existing?.monthlyAllowance ?? null),
    unlimited: params.clearAllowanceOverride
      ? false
      : (params.unlimited ?? existing?.unlimited ?? false),
    aiAccessEnabled: params.aiAccessEnabled ?? existing?.aiAccessEnabled ?? true,
    blockAtLimit: params.blockAtLimit ?? existing?.blockAtLimit ?? true,
    allowOverage: params.allowOverage ?? existing?.allowOverage ?? false,
    updatedAt: new Date(),
    updatedByUserId: params.updatedByUserId,
  };

  if (existing) {
    const [row] = await db
      .update(aiUsageTeamLimits)
      .set(values)
      .where(eq(aiUsageTeamLimits.teamId, params.teamId))
      .returning();
    return { previous: existing, next: row };
  }

  const [row] = await db
    .insert(aiUsageTeamLimits)
    .values({ teamId: params.teamId, ...values })
    .returning();
  return { previous: null, next: row };
}

/** Reset period counter via adjustment — never deletes historical events. */
export async function resetAiUsageCounterForPeriod(params: {
  userId: string;
  periodStart: Date;
  periodEnd: Date;
}) {
  const counter = await ensurePeriodCounter(params);
  const [row] = await db
    .update(aiUsagePeriodCounters)
    .set({
      resetAdjustment: counter.generationCount,
      updatedAt: new Date(),
    })
    .where(eq(aiUsagePeriodCounters.id, counter.id))
    .returning();
  return { previous: counter, next: row };
}

export async function deleteAiUsageDataForUser(userId: string) {
  await db.delete(aiUsageEvents).where(eq(aiUsageEvents.userId, userId));
  await db
    .delete(aiUsagePeriodCounters)
    .where(eq(aiUsagePeriodCounters.userId, userId));
  await db.delete(aiUsageUserLimits).where(eq(aiUsageUserLimits.userId, userId));
  await db
    .delete(aiUsageAdminAuditLogs)
    .where(eq(aiUsageAdminAuditLogs.targetUserId, userId));
}

function dateRangeFilter(start: Date, end: Date): SQL {
  return and(
    gte(aiUsageEvents.createdAt, start),
    lt(aiUsageEvents.createdAt, end),
  )!;
}

export async function getAiUsageSummaryMetrics(params: {
  start: Date;
  end: Date;
}) {
  const base = dateRangeFilter(params.start, params.end);

  const [totals] = await db
    .select({
      totalEvents: count(),
      successful: sql<number>`coalesce(sum(case when ${aiUsageEvents.status} = 'success' then 1 else 0 end), 0)::int`,
      failed: sql<number>`coalesce(sum(case when ${aiUsageEvents.status} = 'failed' then 1 else 0 end), 0)::int`,
      blocked: sql<number>`coalesce(sum(case when ${aiUsageEvents.status} = 'blocked' then 1 else 0 end), 0)::int`,
      timedOut: sql<number>`coalesce(sum(case when ${aiUsageEvents.status} = 'timed_out' then 1 else 0 end), 0)::int`,
      totalTokens: sql<number>`coalesce(sum(${aiUsageEvents.totalTokens}), 0)::int`,
      estimatedCostMicros: sql<number>`coalesce(sum(${aiUsageEvents.estimatedCostMicros}), 0)::int`,
      avgResponseTimeMs: sql<number>`coalesce(avg(${aiUsageEvents.responseTimeMs}), 0)::int`,
      activeUsers: countDistinct(aiUsageEvents.userId),
    })
    .from(aiUsageEvents)
    .where(base);

  return {
    totalGenerations: Number(totals?.successful ?? 0),
    totalEvents: Number(totals?.totalEvents ?? 0),
    successful: Number(totals?.successful ?? 0),
    failed: Number(totals?.failed ?? 0),
    blocked: Number(totals?.blocked ?? 0),
    timedOut: Number(totals?.timedOut ?? 0),
    totalTokens: Number(totals?.totalTokens ?? 0),
    estimatedCostMicros: Number(totals?.estimatedCostMicros ?? 0),
    avgResponseTimeMs: Number(totals?.avgResponseTimeMs ?? 0),
    activeUsers: Number(totals?.activeUsers ?? 0),
  };
}

export async function getAiUsageTimeSeries(params: {
  start: Date;
  end: Date;
  granularity: "day" | "week" | "month";
}) {
  const trunc =
    params.granularity === "month"
      ? sql`date_trunc('month', ${aiUsageEvents.createdAt})`
      : params.granularity === "week"
        ? sql`date_trunc('week', ${aiUsageEvents.createdAt})`
        : sql`date_trunc('day', ${aiUsageEvents.createdAt})`;

  const rows = await db
    .select({
      bucket: trunc.as("bucket"),
      generations: sql<number>`coalesce(sum(case when ${aiUsageEvents.status} = 'success' then 1 else 0 end), 0)::int`,
      totalTokens: sql<number>`coalesce(sum(${aiUsageEvents.totalTokens}), 0)::int`,
      estimatedCostMicros: sql<number>`coalesce(sum(${aiUsageEvents.estimatedCostMicros}), 0)::int`,
    })
    .from(aiUsageEvents)
    .where(dateRangeFilter(params.start, params.end))
    .groupBy(trunc)
    .orderBy(asc(trunc));

  return rows.map((r) => ({
    bucket: r.bucket instanceof Date ? r.bucket.toISOString() : String(r.bucket),
    generations: Number(r.generations),
    totalTokens: Number(r.totalTokens),
    estimatedCostMicros: Number(r.estimatedCostMicros),
  }));
}

export async function getAiUsageBreakdownByFeature(params: {
  start: Date;
  end: Date;
}) {
  const rows = await db
    .select({
      feature: aiUsageEvents.feature,
      generations: sql<number>`coalesce(sum(case when ${aiUsageEvents.status} = 'success' then 1 else 0 end), 0)::int`,
      totalTokens: sql<number>`coalesce(sum(${aiUsageEvents.totalTokens}), 0)::int`,
      estimatedCostMicros: sql<number>`coalesce(sum(${aiUsageEvents.estimatedCostMicros}), 0)::int`,
    })
    .from(aiUsageEvents)
    .where(dateRangeFilter(params.start, params.end))
    .groupBy(aiUsageEvents.feature)
    .orderBy(desc(sql`3`));

  return rows.map((r) => ({
    feature: r.feature,
    generations: Number(r.generations),
    totalTokens: Number(r.totalTokens),
    estimatedCostMicros: Number(r.estimatedCostMicros),
  }));
}

export async function getAiUsageBreakdownByPlan(params: {
  start: Date;
  end: Date;
}) {
  const rows = await db
    .select({
      plan: sql<string>`coalesce(${aiUsageEvents.subscriptionPlan}, 'unknown')`,
      generations: sql<number>`coalesce(sum(case when ${aiUsageEvents.status} = 'success' then 1 else 0 end), 0)::int`,
      users: countDistinct(aiUsageEvents.userId),
      totalTokens: sql<number>`coalesce(sum(${aiUsageEvents.totalTokens}), 0)::int`,
      estimatedCostMicros: sql<number>`coalesce(sum(${aiUsageEvents.estimatedCostMicros}), 0)::int`,
    })
    .from(aiUsageEvents)
    .where(dateRangeFilter(params.start, params.end))
    .groupBy(sql`coalesce(${aiUsageEvents.subscriptionPlan}, 'unknown')`)
    .orderBy(desc(sql`2`));

  return rows.map((r) => ({
    plan: r.plan,
    generations: Number(r.generations),
    users: Number(r.users),
    totalTokens: Number(r.totalTokens),
    estimatedCostMicros: Number(r.estimatedCostMicros),
  }));
}

export async function getAiUsageBreakdownByModel(params: {
  start: Date;
  end: Date;
}) {
  const rows = await db
    .select({
      model: aiUsageEvents.model,
      generations: sql<number>`coalesce(sum(case when ${aiUsageEvents.status} = 'success' then 1 else 0 end), 0)::int`,
      totalTokens: sql<number>`coalesce(sum(${aiUsageEvents.totalTokens}), 0)::int`,
      estimatedCostMicros: sql<number>`coalesce(sum(${aiUsageEvents.estimatedCostMicros}), 0)::int`,
    })
    .from(aiUsageEvents)
    .where(dateRangeFilter(params.start, params.end))
    .groupBy(aiUsageEvents.model)
    .orderBy(desc(sql`2`));

  return rows.map((r) => ({
    model: r.model,
    generations: Number(r.generations),
    totalTokens: Number(r.totalTokens),
    estimatedCostMicros: Number(r.estimatedCostMicros),
  }));
}

export async function getAiUsageOutcomeBreakdown(params: {
  start: Date;
  end: Date;
}) {
  const rows = await db
    .select({
      status: aiUsageEvents.status,
      count: count(),
    })
    .from(aiUsageEvents)
    .where(dateRangeFilter(params.start, params.end))
    .groupBy(aiUsageEvents.status);

  return rows.map((r) => ({
    status: r.status,
    count: Number(r.count),
  }));
}

export type AiUsageUserTableFilters = {
  start: Date;
  end: Date;
  plan?: string | null;
  teamId?: number | null;
  feature?: AiUsageFeature | null;
  model?: string | null;
  status?: AiUsageStatus | null;
  searchUserIds?: string[] | null;
  page: number;
  pageSize: number;
};

export async function getAiUsageUserTable(filters: AiUsageUserTableFilters) {
  const conditions: SQL[] = [dateRangeFilter(filters.start, filters.end)];
  if (filters.plan) {
    conditions.push(eq(aiUsageEvents.subscriptionPlan, filters.plan));
  }
  if (filters.teamId != null) {
    conditions.push(eq(aiUsageEvents.teamId, filters.teamId));
  }
  if (filters.feature) {
    conditions.push(eq(aiUsageEvents.feature, filters.feature));
  }
  if (filters.model) {
    conditions.push(eq(aiUsageEvents.model, filters.model));
  }
  if (filters.status) {
    conditions.push(eq(aiUsageEvents.status, filters.status));
  }
  if (filters.searchUserIds && filters.searchUserIds.length > 0) {
    conditions.push(inArray(aiUsageEvents.userId, filters.searchUserIds));
  }

  const where = and(...conditions);

  const aggregated = await db
    .select({
      userId: aiUsageEvents.userId,
      subscriptionPlan: sql<string>`max(${aiUsageEvents.subscriptionPlan})`,
      teamId: sql<number | null>`max(${aiUsageEvents.teamId})`,
      generations: sql<number>`coalesce(sum(case when ${aiUsageEvents.status} = 'success' then 1 else 0 end), 0)::int`,
      inputTokens: sql<number>`coalesce(sum(${aiUsageEvents.inputTokens}), 0)::int`,
      outputTokens: sql<number>`coalesce(sum(${aiUsageEvents.outputTokens}), 0)::int`,
      totalTokens: sql<number>`coalesce(sum(${aiUsageEvents.totalTokens}), 0)::int`,
      estimatedCostMicros: sql<number>`coalesce(sum(${aiUsageEvents.estimatedCostMicros}), 0)::int`,
      lastUsed: sql<Date>`max(${aiUsageEvents.createdAt})`,
    })
    .from(aiUsageEvents)
    .where(where)
    .groupBy(aiUsageEvents.userId)
    .orderBy(desc(sql`4`));

  const total = aggregated.length;
  const page = Math.max(1, filters.page);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize));
  const slice = aggregated.slice((page - 1) * pageSize, page * pageSize);

  const userIds = slice.map((r) => r.userId);
  const limits =
    userIds.length > 0
      ? await db
          .select()
          .from(aiUsageUserLimits)
          .where(inArray(aiUsageUserLimits.userId, userIds))
      : [];
  const limitMap = new Map(limits.map((l) => [l.userId, l]));

  const teamIds = [
    ...new Set(
      slice.map((r) => r.teamId).filter((id): id is number => id != null),
    ),
  ];
  const teamRows =
    teamIds.length > 0
      ? await db.select().from(teams).where(inArray(teams.id, teamIds))
      : [];
  const teamMap = new Map(teamRows.map((t) => [t.id, t]));

  const rows = slice.map((r) => {
    const limit = limitMap.get(r.userId);
    const { allowance } = resolveAllowancePriority({
      isPlatformAdmin: false,
      userUnlimited: limit?.unlimited,
      userMonthlyAllowance: limit?.monthlyAllowance,
      subscriptionPlan: r.subscriptionPlan,
    });
    const snapshot = buildPeriodSnapshot({
      aiAccessEnabled: limit?.aiAccessEnabled ?? true,
      flagged: Boolean(limit?.flagged),
      allowance,
      usedGenerations: Number(r.generations),
      inputTokens: Number(r.inputTokens),
      outputTokens: Number(r.outputTokens),
      totalTokens: Number(r.totalTokens),
      estimatedCostMicros: Number(r.estimatedCostMicros),
    });
    const team = r.teamId != null ? teamMap.get(r.teamId) : null;
    return {
      userId: r.userId,
      subscriptionPlan: r.subscriptionPlan,
      teamId: r.teamId,
      teamName: team?.name ?? null,
      generations: Number(r.generations),
      inputTokens: Number(r.inputTokens),
      outputTokens: Number(r.outputTokens),
      totalTokens: Number(r.totalTokens),
      estimatedCostMicros: Number(r.estimatedCostMicros),
      lastUsed:
        r.lastUsed instanceof Date
          ? r.lastUsed.toISOString()
          : r.lastUsed
            ? String(r.lastUsed)
            : null,
      allowance,
      snapshot,
      aiAccessEnabled: limit?.aiAccessEnabled ?? true,
    };
  });

  return { rows, total, page, pageSize };
}

export async function getAiUsageUserDetails(params: {
  userId: string;
  start: Date;
  end: Date;
}) {
  const context = await resolveUserAiLimitContext({ userId: params.userId });
  const recent = await db
    .select()
    .from(aiUsageEvents)
    .where(
      and(
        eq(aiUsageEvents.userId, params.userId),
        dateRangeFilter(params.start, params.end),
      ),
    )
    .orderBy(desc(aiUsageEvents.createdAt))
    .limit(50);

  const byFeature = await db
    .select({
      feature: aiUsageEvents.feature,
      generations: sql<number>`coalesce(sum(case when ${aiUsageEvents.status} = 'success' then 1 else 0 end), 0)::int`,
      failed: sql<number>`coalesce(sum(case when ${aiUsageEvents.status} = 'failed' then 1 else 0 end), 0)::int`,
      totalTokens: sql<number>`coalesce(sum(${aiUsageEvents.totalTokens}), 0)::int`,
      estimatedCostMicros: sql<number>`coalesce(sum(${aiUsageEvents.estimatedCostMicros}), 0)::int`,
    })
    .from(aiUsageEvents)
    .where(
      and(
        eq(aiUsageEvents.userId, params.userId),
        dateRangeFilter(params.start, params.end),
      ),
    )
    .groupBy(aiUsageEvents.feature);

  const byModel = await db
    .select({
      model: aiUsageEvents.model,
      generations: sql<number>`coalesce(sum(case when ${aiUsageEvents.status} = 'success' then 1 else 0 end), 0)::int`,
      totalTokens: sql<number>`coalesce(sum(${aiUsageEvents.totalTokens}), 0)::int`,
      estimatedCostMicros: sql<number>`coalesce(sum(${aiUsageEvents.estimatedCostMicros}), 0)::int`,
    })
    .from(aiUsageEvents)
    .where(
      and(
        eq(aiUsageEvents.userId, params.userId),
        dateRangeFilter(params.start, params.end),
      ),
    )
    .groupBy(aiUsageEvents.model);

  const daily = await db
    .select({
      day: sql`date_trunc('day', ${aiUsageEvents.createdAt})`.as("day"),
      generations: sql<number>`coalesce(sum(case when ${aiUsageEvents.status} = 'success' then 1 else 0 end), 0)::int`,
      totalTokens: sql<number>`coalesce(sum(${aiUsageEvents.totalTokens}), 0)::int`,
      estimatedCostMicros: sql<number>`coalesce(sum(${aiUsageEvents.estimatedCostMicros}), 0)::int`,
    })
    .from(aiUsageEvents)
    .where(
      and(
        eq(aiUsageEvents.userId, params.userId),
        dateRangeFilter(params.start, params.end),
      ),
    )
    .groupBy(sql`date_trunc('day', ${aiUsageEvents.createdAt})`)
    .orderBy(asc(sql`1`));

  const [outcomes] = await db
    .select({
      successful: sql<number>`coalesce(sum(case when ${aiUsageEvents.status} = 'success' then 1 else 0 end), 0)::int`,
      failed: sql<number>`coalesce(sum(case when ${aiUsageEvents.status} = 'failed' then 1 else 0 end), 0)::int`,
      blocked: sql<number>`coalesce(sum(case when ${aiUsageEvents.status} = 'blocked' then 1 else 0 end), 0)::int`,
      timedOut: sql<number>`coalesce(sum(case when ${aiUsageEvents.status} = 'timed_out' then 1 else 0 end), 0)::int`,
    })
    .from(aiUsageEvents)
    .where(
      and(
        eq(aiUsageEvents.userId, params.userId),
        dateRangeFilter(params.start, params.end),
      ),
    );

  return {
    context: {
      ...context,
      periodStart: context.periodStart.toISOString(),
      periodEnd: context.periodEnd.toISOString(),
      counter: undefined,
      userLimit: context.userLimit,
      teamLimit: context.teamLimit,
    },
    recent: recent.map((e) => ({
      id: e.id,
      feature: e.feature,
      model: e.model,
      status: e.status,
      inputTokens: e.inputTokens,
      outputTokens: e.outputTokens,
      totalTokens: e.totalTokens,
      estimatedCostMicros: e.estimatedCostMicros,
      responseTimeMs: e.responseTimeMs,
      errorCode: e.errorCode,
      errorCategory: e.errorCategory,
      createdAt: e.createdAt.toISOString(),
    })),
    byFeature,
    byModel,
    daily: daily.map((d) => ({
      day: d.day instanceof Date ? d.day.toISOString() : String(d.day),
      generations: Number(d.generations),
      totalTokens: Number(d.totalTokens),
      estimatedCostMicros: Number(d.estimatedCostMicros),
    })),
    outcomes: {
      successful: Number(outcomes?.successful ?? 0),
      failed: Number(outcomes?.failed ?? 0),
      blocked: Number(outcomes?.blocked ?? 0),
      timedOut: Number(outcomes?.timedOut ?? 0),
    },
  };
}

export async function countUsersNearLimit() {
  const counters = await db.select().from(aiUsagePeriodCounters);
  const limits = await db.select().from(aiUsageUserLimits);
  const limitMap = new Map(limits.map((l) => [l.userId, l]));

  let approaching = 0;
  let reached = 0;

  for (const c of counters) {
    const limit = limitMap.get(c.userId);
    const { allowance } = resolveAllowancePriority({
      isPlatformAdmin: false,
      userUnlimited: limit?.unlimited,
      userMonthlyAllowance: limit?.monthlyAllowance,
      subscriptionPlan: null,
    });
    if (allowance.kind === "unlimited") continue;
    const used = Math.max(0, c.generationCount - c.resetAdjustment);
    const pct =
      allowance.generations <= 0 ? 100 : (used / allowance.generations) * 100;
    if (pct >= 100) reached += 1;
    else if (pct >= 80) approaching += 1;
  }

  return { approaching, reached };
}

export async function listTeamsForAiUsageFilter() {
  return db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .orderBy(asc(teams.name))
    .limit(500);
}
