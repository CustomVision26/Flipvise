export type PlanHistoryTypeLabel =
  | "Paid subscription"
  | "Proration"
  | "Complimentary (admin)"
  | "Complimentary (affiliate)";

export type PlanHistoryRow = {
  id: string;
  planName: string;
  planType: PlanHistoryTypeLabel;
  statusLabel: string;
  /** ISO 8601 */
  startAt: string;
  /** ISO 8601; null when the row represents an open-ended period */
  endAt: string | null;
  /** Stripe hosted invoice or PDF; null for non-billed rows */
  receiptUrl: string | null;
  /** Stripe receipt / invoice number for receipt link label (e.g. 2815-9731) */
  receiptLabel: string | null;
};
