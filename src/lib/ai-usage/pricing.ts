import pricingConfig from "@/data/ai-model-pricing.json";
import type { AiTokenUsage } from "@/lib/ai-usage/types";

type ModelRates = {
  inputPerMillionMicros: number;
  cachedInputPerMillionMicros: number;
  outputPerMillionMicros: number;
  flatPerImageMicros?: number;
};

const models = pricingConfig.models as Record<string, ModelRates>;

export function getAiPricingVersion(): string {
  return pricingConfig.version;
}

export function getAiPricingCurrency(): string {
  return pricingConfig.currency;
}

export function resolveModelRates(model: string): ModelRates {
  return models[model] ?? models.default;
}

/**
 * Estimated cost in micros (1/1_000_000 of currency unit).
 * Uses integer arithmetic only — never floating-point money math.
 */
export function estimateAiCostMicros(params: {
  model: string;
  usage: AiTokenUsage;
  imageCount?: number;
}): number {
  const rates = resolveModelRates(params.model);
  const input = Math.max(0, Math.floor(params.usage.inputTokens));
  const cached = Math.max(0, Math.floor(params.usage.cachedInputTokens ?? 0));
  const uncachedInput = Math.max(0, input - cached);
  const output = Math.max(0, Math.floor(params.usage.outputTokens));

  const inputCost =
    Math.floor((uncachedInput * rates.inputPerMillionMicros) / 1_000_000) +
    Math.floor((cached * rates.cachedInputPerMillionMicros) / 1_000_000);
  const outputCost = Math.floor(
    (output * rates.outputPerMillionMicros) / 1_000_000,
  );
  const imageCost =
    (rates.flatPerImageMicros ?? 0) * Math.max(0, Math.floor(params.imageCount ?? 0));

  return inputCost + outputCost + imageCost;
}

export function formatMicrosAsUsd(micros: number): string {
  const dollars = micros / 1_000_000;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(dollars);
}

export function extractTokenUsage(usage: unknown): AiTokenUsage {
  if (!usage || typeof usage !== "object") {
    return { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, totalTokens: 0 };
  }
  const u = usage as Record<string, unknown>;
  const inputTokens =
    (typeof u.inputTokens === "number" && u.inputTokens) ||
    (typeof u.promptTokens === "number" && u.promptTokens) ||
    (typeof u.prompt_tokens === "number" && u.prompt_tokens) ||
    0;
  const outputTokens =
    (typeof u.outputTokens === "number" && u.outputTokens) ||
    (typeof u.completionTokens === "number" && u.completionTokens) ||
    (typeof u.completion_tokens === "number" && u.completion_tokens) ||
    0;
  const cachedInputTokens =
    (typeof u.cachedInputTokens === "number" && u.cachedInputTokens) ||
    (typeof u.cached_input_tokens === "number" && u.cached_input_tokens) ||
    0;
  const totalTokens =
    (typeof u.totalTokens === "number" && u.totalTokens) ||
    (typeof u.total_tokens === "number" && u.total_tokens) ||
    inputTokens + outputTokens;

  return {
    inputTokens: Math.max(0, Math.floor(inputTokens)),
    outputTokens: Math.max(0, Math.floor(outputTokens)),
    cachedInputTokens: Math.max(0, Math.floor(cachedInputTokens)),
    totalTokens: Math.max(0, Math.floor(totalTokens)),
  };
}
