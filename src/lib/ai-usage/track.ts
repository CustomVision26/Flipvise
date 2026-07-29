import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { generateText } from "ai";
import {
  insertAiUsageEvent,
  maybeFlagUserForAbuse,
  releaseReservedAiGeneration,
  resolveUserAiLimitContext,
  tryReserveAiGeneration,
} from "@/db/queries/ai-usage";
import {
  AiAccessDisabledError,
  AiUsageLimitError,
} from "@/lib/ai-usage/errors";
import type { AiUsageFeature } from "@/lib/ai-usage/types";
import { extractTokenUsage } from "@/lib/ai-usage/pricing";

export type TrackAiUsageContext = {
  userId: string;
  feature: AiUsageFeature;
  teamId?: number | null;
  subscriptionPlan?: string | null;
  isPlatformAdmin?: boolean;
  model?: string;
  provider?: string;
  /** When true, skip reservation / blocking (still records the event). */
  skipLimitEnforcement?: boolean;
  imageCount?: number;
};

export type TrackedExecuteResult<T> = {
  value: T;
  usage?: unknown;
  providerRequestId?: string | null;
  timedOut?: boolean;
};

const aiUsageStore = new AsyncLocalStorage<TrackAiUsageContext>();

/** Run a callback with AI usage tracking context for nested OpenAI calls. */
export function runWithAiUsageContext<T>(
  ctx: TrackAiUsageContext,
  fn: () => Promise<T>,
): Promise<T> {
  return aiUsageStore.run(ctx, fn);
}

export function getAiUsageContext(): TrackAiUsageContext | undefined {
  return aiUsageStore.getStore();
}

/**
 * Centralized AI usage wrapper:
 * resolve plan/period → check access/allowance → reserve → execute → record → return.
 */
export async function withAiUsageTracking<T>(
  ctx: TrackAiUsageContext,
  execute: () => Promise<TrackedExecuteResult<T>>,
): Promise<T> {
  const model = ctx.model ?? "gpt-4o";
  const limitCtx = await resolveUserAiLimitContext({
    userId: ctx.userId,
    teamId: ctx.teamId,
    subscriptionPlan: ctx.subscriptionPlan,
    isPlatformAdmin: ctx.isPlatformAdmin,
  });

  if (!limitCtx.aiAccessEnabled) {
    await insertAiUsageEvent({
      userId: ctx.userId,
      teamId: limitCtx.teamId,
      subscriptionPlan: limitCtx.subscriptionPlan,
      feature: ctx.feature,
      model,
      provider: ctx.provider,
      status: "blocked",
      errorCode: "AI_ACCESS_DISABLED",
      errorCategory: "access",
      periodStart: limitCtx.periodStart,
    });
    await maybeFlagUserForAbuse(ctx.userId);
    throw new AiAccessDisabledError();
  }

  let reserved = false;
  if (!ctx.skipLimitEnforcement && limitCtx.blockAtLimit && !limitCtx.allowOverage) {
    const max =
      limitCtx.allowance.kind === "unlimited"
        ? null
        : limitCtx.allowance.generations;
    const reservation = await tryReserveAiGeneration({
      userId: ctx.userId,
      periodStart: limitCtx.periodStart,
      periodEnd: limitCtx.periodEnd,
      maxGenerations: max,
    });
    if (!reservation.ok) {
      await insertAiUsageEvent({
        userId: ctx.userId,
        teamId: limitCtx.teamId,
        subscriptionPlan: limitCtx.subscriptionPlan,
        feature: ctx.feature,
        model,
        provider: ctx.provider,
        status: "blocked",
        errorCode: "AI_USAGE_LIMIT_REACHED",
        errorCategory: "limit",
        periodStart: limitCtx.periodStart,
      });
      await maybeFlagUserForAbuse(ctx.userId);
      throw new AiUsageLimitError({
        resetsAt: limitCtx.periodEnd,
        used: reservation.usedAfter,
        allowance:
          limitCtx.allowance.kind === "unlimited"
            ? null
            : limitCtx.allowance.generations,
        upgradeSuggested:
          limitCtx.subscriptionPlan === "free" ||
          limitCtx.subscriptionPlan === "pro",
      });
    }
    reserved = true;
  } else if (!ctx.skipLimitEnforcement) {
    await tryReserveAiGeneration({
      userId: ctx.userId,
      periodStart: limitCtx.periodStart,
      periodEnd: limitCtx.periodEnd,
      maxGenerations: null,
    });
    reserved = true;
  }

  const started = Date.now();
  try {
    const result = await execute();
    const responseTimeMs = Date.now() - started;
    const status = result.timedOut ? "timed_out" : "success";

    await insertAiUsageEvent({
      userId: ctx.userId,
      teamId: limitCtx.teamId,
      subscriptionPlan: limitCtx.subscriptionPlan,
      feature: ctx.feature,
      model,
      provider: ctx.provider,
      usage: result.usage,
      imageCount: ctx.imageCount,
      status,
      responseTimeMs,
      providerRequestId: result.providerRequestId,
      periodStart: limitCtx.periodStart,
    });

    await maybeFlagUserForAbuse(ctx.userId);
    return result.value;
  } catch (error) {
    const responseTimeMs = Date.now() - started;
    const message = error instanceof Error ? error.message : "AI_REQUEST_FAILED";
    const timedOut =
      /timeout|timed out|ETIMEDOUT|AbortError/i.test(message) ||
      (error instanceof Error && error.name === "AbortError");

    if (reserved) {
      await releaseReservedAiGeneration({
        userId: ctx.userId,
        periodStart: limitCtx.periodStart,
      });
    }

    await insertAiUsageEvent({
      userId: ctx.userId,
      teamId: limitCtx.teamId,
      subscriptionPlan: limitCtx.subscriptionPlan,
      feature: ctx.feature,
      model,
      provider: ctx.provider,
      status: timedOut ? "timed_out" : "failed",
      responseTimeMs,
      errorCode: timedOut ? "AI_TIMEOUT" : "AI_REQUEST_FAILED",
      errorCategory: timedOut ? "timeout" : "provider",
      periodStart: limitCtx.periodStart,
    });
    await maybeFlagUserForAbuse(ctx.userId);
    throw error;
  }
}

function resolveModelId(model: unknown, fallback: string): string {
  if (
    model &&
    typeof model === "object" &&
    "modelId" in model &&
    typeof (model as { modelId?: unknown }).modelId === "string"
  ) {
    return (model as { modelId: string }).modelId;
  }
  return fallback;
}

/**
 * Drop-in replacement for `generateText` that records usage when an ALS
 * tracking context is active. Falls back to untracked `generateText` only
 * when no context exists (should not happen for user-facing AI paths).
 *
 * Typed as `typeof generateText` so structured-output generics keep working.
 */
export const trackedGenerateText: typeof generateText = (async (
  params: Parameters<typeof generateText>[0],
) => {
  const store = aiUsageStore.getStore();
  if (!store) {
    console.warn(
      "[ai-usage] trackedGenerateText called without runWithAiUsageContext; call is untracked",
    );
    return generateText(params);
  }

  const modelId = resolveModelId(params.model, store.model ?? "gpt-4o");

  return withAiUsageTracking({ ...store, model: modelId }, async () => {
    const result = await generateText(params);
    return {
      value: result,
      usage: result.usage ?? extractTokenUsage(result.totalUsage),
      providerRequestId:
        (result as { response?: { id?: string } }).response?.id ?? null,
    };
  });
}) as typeof generateText;

/** Track a raw OpenAI HTTP / non-generateText provider call. */
export async function trackRawAiCall<T>(
  ctx: TrackAiUsageContext & { model: string },
  execute: () => Promise<TrackedExecuteResult<T>>,
): Promise<T> {
  return withAiUsageTracking(ctx, execute);
}
