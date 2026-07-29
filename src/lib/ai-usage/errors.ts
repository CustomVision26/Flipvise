export class AiUsageLimitError extends Error {
  readonly code = "AI_USAGE_LIMIT_REACHED" as const;
  readonly resetsAt: Date;
  readonly used: number;
  readonly allowance: number | null;
  readonly upgradeSuggested: boolean;

  constructor(params: {
    message?: string;
    resetsAt: Date;
    used: number;
    allowance: number | null;
    upgradeSuggested?: boolean;
  }) {
    super(
      params.message ??
        `AI generation limit reached. Access resets on ${params.resetsAt.toISOString()}.`,
    );
    this.name = "AiUsageLimitError";
    this.resetsAt = params.resetsAt;
    this.used = params.used;
    this.allowance = params.allowance;
    this.upgradeSuggested = params.upgradeSuggested ?? true;
  }
}

export class AiAccessDisabledError extends Error {
  readonly code = "AI_ACCESS_DISABLED" as const;

  constructor(message = "AI access has been disabled for this account.") {
    super(message);
    this.name = "AiAccessDisabledError";
  }
}

export function isAiUsageLimitError(error: unknown): error is AiUsageLimitError {
  return error instanceof AiUsageLimitError;
}

export function isAiAccessDisabledError(
  error: unknown,
): error is AiAccessDisabledError {
  return error instanceof AiAccessDisabledError;
}
