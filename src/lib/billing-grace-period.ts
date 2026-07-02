/** Users with a failed renewal keep paid access for this window before reverting to Free. */
export const PAYMENT_GRACE_PERIOD_MS = 12 * 60 * 60 * 1000;

export function paymentGraceExpiresAt(failedAt: Date): Date {
  return new Date(failedAt.getTime() + PAYMENT_GRACE_PERIOD_MS);
}

export function isWithinPaymentGracePeriod(
  failedAt: Date | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!failedAt) return false;
  return nowMs < paymentGraceExpiresAt(failedAt).getTime();
}

export function paymentGraceRemainingMs(
  failedAt: Date | null | undefined,
  nowMs: number = Date.now(),
): number {
  if (!failedAt) return 0;
  return Math.max(0, paymentGraceExpiresAt(failedAt).getTime() - nowMs);
}

export function formatPaymentGraceRemaining(
  failedAt: Date | null | undefined,
  nowMs: number = Date.now(),
): string {
  const ms = paymentGraceRemainingMs(failedAt, nowMs);
  if (ms <= 0) return "0m";
  const totalMinutes = Math.ceil(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
