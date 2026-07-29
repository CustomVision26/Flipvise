"use server";

import { createClerkClient } from "@clerk/backend";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  getAiUsageUserLimit,
  getAiUsageTeamLimit,
  getAiUsageUserTable,
  logAiUsageAdminAction,
  resetAiUsageCounterForPeriod,
  resolveUserAiLimitContext,
  upsertAiUsageTeamLimit,
  upsertAiUsageUserLimit,
} from "@/db/queries/ai-usage";
import { assertAdminDashboardAccess } from "@/lib/admin/assert-admin-access";
import { rowsToCsv } from "@/lib/ai-usage/csv";
import {
  AI_USAGE_FEATURES,
  AI_USAGE_STATUSES,
} from "@/lib/ai-usage/types";
import { resolveDateRangePreset } from "@/lib/ai-usage/period";
import { formatMicrosAsUsd } from "@/lib/ai-usage/pricing";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

async function requireAiUsageAdminActor() {
  const admin = await assertAdminDashboardAccess();
  const caller = await clerkClient.users.getUser(admin.userId);
  const actorName =
    [caller.firstName, caller.lastName].filter(Boolean).join(" ") ||
    caller.username ||
    admin.userId;
  return { userId: admin.userId, actorName };
}

function revalidateAiUsagePaths(userId?: string) {
  revalidatePath("/admin/analytics/ai-usage");
  if (userId) {
    revalidatePath(`/admin/analytics/ai-usage/${userId}`);
  }
}

function serializeLimitSnapshot(
  limit: {
    monthlyAllowance: number | null;
    unlimited: boolean;
    aiAccessEnabled: boolean;
    blockAtLimit: boolean;
    allowOverage: boolean;
    warningThreshold80: boolean;
    warningThreshold90: boolean;
    warningThreshold100: boolean;
    flagged: boolean;
    flagReason: string | null;
    notes: string | null;
  } | null,
) {
  if (!limit) return null;
  return {
    monthlyAllowance: limit.monthlyAllowance,
    unlimited: limit.unlimited,
    aiAccessEnabled: limit.aiAccessEnabled,
    blockAtLimit: limit.blockAtLimit,
    allowOverage: limit.allowOverage,
    warningThreshold80: limit.warningThreshold80,
    warningThreshold90: limit.warningThreshold90,
    warningThreshold100: limit.warningThreshold100,
    flagged: limit.flagged,
    flagReason: limit.flagReason,
    notes: limit.notes,
  };
}

const userIdSchema = z.string().min(1).max(255);
const reasonSchema = z.string().trim().min(1).max(2000);

const setUserAllowanceSchema = z.object({
  userId: userIdSchema,
  unlimited: z.boolean(),
  monthlyAllowance: z.number().int().min(0).max(1_000_000).nullable().optional(),
  reason: reasonSchema,
});

export async function setAiUsageUserAllowanceAction(
  data: z.infer<typeof setUserAllowanceSchema>,
) {
  const parsed = setUserAllowanceSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");
  if (!parsed.data.unlimited && parsed.data.monthlyAllowance == null) {
    throw new Error("Provide a monthly allowance or set unlimited");
  }

  const actor = await requireAiUsageAdminActor();
  const previous = await getAiUsageUserLimit(parsed.data.userId);
  const { previous: prevRow, next } = await upsertAiUsageUserLimit({
    userId: parsed.data.userId,
    unlimited: parsed.data.unlimited,
    monthlyAllowance: parsed.data.unlimited
      ? null
      : (parsed.data.monthlyAllowance ?? null),
    updatedByUserId: actor.userId,
  });

  await logAiUsageAdminAction({
    actorUserId: actor.userId,
    actorName: actor.actorName,
    targetUserId: parsed.data.userId,
    action: "set_user_allowance",
    previousValue: serializeLimitSnapshot(prevRow ?? previous),
    newValue: serializeLimitSnapshot(next),
    reason: parsed.data.reason,
  });

  revalidateAiUsagePaths(parsed.data.userId);
  return { ok: true as const };
}

const clearUserAllowanceSchema = z.object({
  userId: userIdSchema,
  reason: reasonSchema,
});

export async function clearAiUsageUserAllowanceAction(
  data: z.infer<typeof clearUserAllowanceSchema>,
) {
  const parsed = clearUserAllowanceSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const actor = await requireAiUsageAdminActor();
  const { previous, next } = await upsertAiUsageUserLimit({
    userId: parsed.data.userId,
    clearAllowanceOverride: true,
    updatedByUserId: actor.userId,
  });

  await logAiUsageAdminAction({
    actorUserId: actor.userId,
    actorName: actor.actorName,
    targetUserId: parsed.data.userId,
    action: "clear_user_allowance",
    previousValue: serializeLimitSnapshot(previous),
    newValue: serializeLimitSnapshot(next),
    reason: parsed.data.reason,
  });

  revalidateAiUsagePaths(parsed.data.userId);
  return { ok: true as const };
}

const setTeamAllowanceSchema = z.object({
  teamId: z.number().int().positive(),
  unlimited: z.boolean(),
  monthlyAllowance: z.number().int().min(0).max(1_000_000).nullable().optional(),
  reason: reasonSchema,
});

export async function setAiUsageTeamAllowanceAction(
  data: z.infer<typeof setTeamAllowanceSchema>,
) {
  const parsed = setTeamAllowanceSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");
  if (!parsed.data.unlimited && parsed.data.monthlyAllowance == null) {
    throw new Error("Provide a monthly allowance or set unlimited");
  }

  const actor = await requireAiUsageAdminActor();
  const previous = await getAiUsageTeamLimit(parsed.data.teamId);
  const { previous: prevRow, next } = await upsertAiUsageTeamLimit({
    teamId: parsed.data.teamId,
    unlimited: parsed.data.unlimited,
    monthlyAllowance: parsed.data.unlimited
      ? null
      : (parsed.data.monthlyAllowance ?? null),
    updatedByUserId: actor.userId,
  });

  await logAiUsageAdminAction({
    actorUserId: actor.userId,
    actorName: actor.actorName,
    targetTeamId: parsed.data.teamId,
    action: "set_team_allowance",
    previousValue: previous
      ? {
          monthlyAllowance: (prevRow ?? previous).monthlyAllowance,
          unlimited: (prevRow ?? previous).unlimited,
        }
      : null,
    newValue: {
      monthlyAllowance: next.monthlyAllowance,
      unlimited: next.unlimited,
    },
    reason: parsed.data.reason,
  });

  revalidateAiUsagePaths();
  return { ok: true as const };
}

const setAiAccessSchema = z.object({
  userId: userIdSchema,
  enabled: z.boolean(),
  reason: z.string().trim().max(2000).optional(),
});

export async function setAiAccessEnabledAction(
  data: z.infer<typeof setAiAccessSchema>,
) {
  const parsed = setAiAccessSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");
  if (!parsed.data.enabled) {
    const reason = parsed.data.reason?.trim();
    if (!reason) throw new Error("Reason is required when disabling AI access");
  }

  const actor = await requireAiUsageAdminActor();
  const { previous, next } = await upsertAiUsageUserLimit({
    userId: parsed.data.userId,
    aiAccessEnabled: parsed.data.enabled,
    updatedByUserId: actor.userId,
  });

  await logAiUsageAdminAction({
    actorUserId: actor.userId,
    actorName: actor.actorName,
    targetUserId: parsed.data.userId,
    action: parsed.data.enabled ? "restore_ai_access" : "disable_ai_access",
    previousValue: { aiAccessEnabled: previous?.aiAccessEnabled ?? true },
    newValue: { aiAccessEnabled: next.aiAccessEnabled },
    reason: parsed.data.reason?.trim() || null,
  });

  revalidateAiUsagePaths(parsed.data.userId);
  return { ok: true as const };
}

const resetCounterSchema = z.object({
  userId: userIdSchema,
  reason: reasonSchema,
});

export async function resetAiUsageCounterAction(
  data: z.infer<typeof resetCounterSchema>,
) {
  const parsed = resetCounterSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const actor = await requireAiUsageAdminActor();
  const context = await resolveUserAiLimitContext({ userId: parsed.data.userId });
  const { previous, next } = await resetAiUsageCounterForPeriod({
    userId: parsed.data.userId,
    periodStart: context.periodStart,
    periodEnd: context.periodEnd,
  });

  await logAiUsageAdminAction({
    actorUserId: actor.userId,
    actorName: actor.actorName,
    targetUserId: parsed.data.userId,
    action: "reset_usage_counter",
    previousValue: {
      generationCount: previous.generationCount,
      resetAdjustment: previous.resetAdjustment,
      periodStart: previous.periodStart.toISOString(),
    },
    newValue: {
      generationCount: next.generationCount,
      resetAdjustment: next.resetAdjustment,
      periodStart: next.periodStart.toISOString(),
    },
    reason: parsed.data.reason,
  });

  revalidateAiUsagePaths(parsed.data.userId);
  return { ok: true as const };
}

const warningThresholdsSchema = z.object({
  userId: userIdSchema,
  warningThreshold80: z.boolean(),
  warningThreshold90: z.boolean(),
  warningThreshold100: z.boolean(),
  reason: z.string().trim().max(2000).optional(),
});

export async function setAiUsageWarningThresholdsAction(
  data: z.infer<typeof warningThresholdsSchema>,
) {
  const parsed = warningThresholdsSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const actor = await requireAiUsageAdminActor();
  const { previous, next } = await upsertAiUsageUserLimit({
    userId: parsed.data.userId,
    warningThreshold80: parsed.data.warningThreshold80,
    warningThreshold90: parsed.data.warningThreshold90,
    warningThreshold100: parsed.data.warningThreshold100,
    updatedByUserId: actor.userId,
  });

  await logAiUsageAdminAction({
    actorUserId: actor.userId,
    actorName: actor.actorName,
    targetUserId: parsed.data.userId,
    action: "set_warning_thresholds",
    previousValue: {
      warningThreshold80: previous?.warningThreshold80 ?? true,
      warningThreshold90: previous?.warningThreshold90 ?? true,
      warningThreshold100: previous?.warningThreshold100 ?? true,
    },
    newValue: {
      warningThreshold80: next.warningThreshold80,
      warningThreshold90: next.warningThreshold90,
      warningThreshold100: next.warningThreshold100,
    },
    reason: parsed.data.reason?.trim() || null,
  });

  revalidateAiUsagePaths(parsed.data.userId);
  return { ok: true as const };
}

const clearFlagSchema = z.object({
  userId: userIdSchema,
  reason: reasonSchema,
});

export async function clearAiUsageFlagAction(
  data: z.infer<typeof clearFlagSchema>,
) {
  const parsed = clearFlagSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const actor = await requireAiUsageAdminActor();
  const { previous, next } = await upsertAiUsageUserLimit({
    userId: parsed.data.userId,
    flagged: false,
    flagReason: null,
    updatedByUserId: actor.userId,
  });

  await logAiUsageAdminAction({
    actorUserId: actor.userId,
    actorName: actor.actorName,
    targetUserId: parsed.data.userId,
    action: "clear_usage_flag",
    previousValue: {
      flagged: previous?.flagged ?? false,
      flagReason: previous?.flagReason ?? null,
    },
    newValue: {
      flagged: next.flagged,
      flagReason: next.flagReason,
    },
    reason: parsed.data.reason,
  });

  revalidateAiUsagePaths(parsed.data.userId);
  return { ok: true as const };
}

const exportCsvSchema = z.object({
  preset: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  plan: z.string().optional(),
  teamId: z.coerce.number().int().positive().optional(),
  feature: z.enum(AI_USAGE_FEATURES).optional(),
  model: z.string().optional(),
  status: z.enum(AI_USAGE_STATUSES).optional(),
  searchUserIds: z.array(z.string().min(1)).optional(),
});

export async function exportAiUsageCsvAction(
  data: z.infer<typeof exportCsvSchema>,
): Promise<{ csv: string }> {
  const parsed = exportCsvSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const actor = await requireAiUsageAdminActor();
  const range = resolveDateRangePreset(
    parsed.data.preset ?? "current_month",
    parsed.data.from,
    parsed.data.to,
  );

  const { rows } = await getAiUsageUserTable({
    start: range.start,
    end: range.end,
    plan: parsed.data.plan ?? null,
    teamId: parsed.data.teamId ?? null,
    feature: parsed.data.feature ?? null,
    model: parsed.data.model ?? null,
    status: parsed.data.status ?? null,
    searchUserIds: parsed.data.searchUserIds ?? null,
    page: 1,
    pageSize: 100,
  });

  const headers = [
    "userId",
    "plan",
    "teamId",
    "teamName",
    "generations",
    "inputTokens",
    "outputTokens",
    "totalTokens",
    "estimatedCostUsd",
    "allowance",
    "usageStatus",
    "aiAccessEnabled",
    "lastUsed",
  ];

  const csv = rowsToCsv(
    headers,
    rows.map((r) => [
      r.userId,
      r.subscriptionPlan,
      r.teamId,
      r.teamName,
      r.generations,
      r.inputTokens,
      r.outputTokens,
      r.totalTokens,
      formatMicrosAsUsd(r.estimatedCostMicros),
      r.allowance.kind === "unlimited"
        ? "unlimited"
        : r.allowance.generations,
      r.snapshot.usageStatus,
      r.aiAccessEnabled ? "yes" : "no",
      r.lastUsed,
    ]),
  );

  await logAiUsageAdminAction({
    actorUserId: actor.userId,
    actorName: actor.actorName,
    action: "export_csv",
    previousValue: null,
    newValue: {
      rowCount: rows.length,
      preset: range.preset,
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    },
    reason: "CSV export",
  });

  return { csv };
}
