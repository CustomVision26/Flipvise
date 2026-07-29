import planDefaults from "@/data/ai-usage-plan-defaults.json";

export type AbuseSignal = {
  flagged: boolean;
  reasons: string[];
};

/**
 * Pure heuristic evaluation from recent event counters (caller supplies aggregates).
 * Does not ban accounts — only returns flag recommendations for admin review.
 */
export function evaluateSuspiciousUsage(params: {
  requestsLastMinute: number;
  failuresLastHour: number;
  blockedLastHour: number;
  costMicrosLastHour: number;
}): AbuseSignal {
  const rules = planDefaults.abuse;
  const reasons: string[] = [];

  if (params.requestsLastMinute >= rules.maxRequestsPerMinute) {
    reasons.push(
      `High request volume: ${params.requestsLastMinute} requests in the last minute`,
    );
  }
  if (params.failuresLastHour >= rules.maxFailuresPerHour) {
    reasons.push(
      `Rapid failures: ${params.failuresLastHour} failed requests in the last hour`,
    );
  }
  if (params.blockedLastHour >= rules.maxBlockedAttemptsPerHour) {
    reasons.push(
      `Continued attempts after limit: ${params.blockedLastHour} blocked requests in the last hour`,
    );
  }
  if (params.costMicrosLastHour >= rules.costSpikeMicros) {
    reasons.push(
      `Sudden cost spike: ~$${(params.costMicrosLastHour / 1_000_000).toFixed(2)} in the last hour`,
    );
  }

  return { flagged: reasons.length > 0, reasons };
}
