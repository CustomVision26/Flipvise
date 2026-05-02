import { db } from "@/db";
import { adminPlanAssignmentLogs } from "@/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import { listAffiliatesForPlanHistory } from "@/db/queries/affiliates";
import { listBillingInvoicesForUser } from "@/db/queries/billing";
import {
  listProrationLinesWithReceiptForUser,
  type ProrationLineWithReceipt,
} from "@/db/queries/billing-proration";
import type { PlanHistoryRow, PlanHistoryTypeLabel } from "@/lib/plan-history-types";
import {
  TEAM_PLAN_LABELS,
  isTeamPlanId,
  type TeamPlanId,
} from "@/lib/team-plans";

export type { PlanHistoryRow, PlanHistoryTypeLabel };

function slugToPlanDisplayName(slug: string | null | undefined): string {
  if (!slug || slug === "free") return "Free";
  if (slug === "pro") return "Pro";
  if (isTeamPlanId(slug)) return TEAM_PLAN_LABELS[slug as TeamPlanId];
  return slug;
}

function invoiceStatusLabel(status: string): string {
  const s = status.toLowerCase();
  if (s === "paid") return "Paid";
  if (s === "open") return "Open";
  if (s === "draft") return "Draft";
  if (s === "void") return "Void";
  if (s === "uncollectible") return "Uncollectible";
  return status;
}

function receiptUrlFromStoredInvoice(input: {
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
}): string | null {
  return input.hostedInvoiceUrl ?? input.invoicePdfUrl ?? null;
}

function formatMoney(amountCents: number | null, currency: string | null): string {
  if (amountCents == null) return "—";
  const code = (currency ?? "usd").toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
    }).format(amountCents / 100);
  } catch {
    return `${(amountCents / 100).toFixed(2)} ${code}`;
  }
}

function formatProrationLinePlanName(line: ProrationLineWithReceipt): string {
  const money = formatMoney(line.amountCents, line.currency);
  const desc = line.description?.trim();
  if (!desc) return money;
  const short = desc.length > 72 ? `${desc.slice(0, 69)}…` : desc;
  return `${money} · ${short}`;
}

type AssignmentLogRow = {
  action: "plan_assigned" | "plan_removed" | "user_banned" | "user_unbanned";
  planName: string | null;
  createdAt: Date;
};

/**
 * Converts admin plan assignment audit rows into contiguous complimentary intervals.
 */
export function buildAdminComplimentarySegments(
  logs: AssignmentLogRow[],
): Array<{ planName: string; start: Date; end: Date | null }> {
  const segments: Array<{ planName: string; start: Date; end: Date | null }> =
    [];
  let open: { planName: string; start: Date } | null = null;

  for (const log of logs) {
    const t =
      log.createdAt instanceof Date ? log.createdAt : new Date(log.createdAt);

    if (
      log.action === "plan_assigned" &&
      log.planName &&
      log.planName !== "Free"
    ) {
      if (open) {
        segments.push({ ...open, end: t });
      }
      open = { planName: log.planName, start: t };
    } else if (
      log.action === "plan_removed" ||
      (log.action === "plan_assigned" && log.planName === "Free")
    ) {
      if (open) {
        segments.push({ ...open, end: t });
        open = null;
      }
    }
  }

  if (open) {
    segments.push({ ...open, end: null });
  }

  return segments;
}

export async function listPlanAssignmentLogsForUser(targetUserId: string) {
  return db
    .select({
      action: adminPlanAssignmentLogs.action,
      planName: adminPlanAssignmentLogs.planName,
      createdAt: adminPlanAssignmentLogs.createdAt,
    })
    .from(adminPlanAssignmentLogs)
    .where(
      and(
        eq(adminPlanAssignmentLogs.targetUserId, targetUserId),
        inArray(adminPlanAssignmentLogs.action, ["plan_assigned", "plan_removed"]),
      ),
    )
    .orderBy(asc(adminPlanAssignmentLogs.createdAt));
}

function affiliateStatusLabel(
  status: "pending" | "active" | "revoked",
  endsAt: Date,
  revokedAt: Date | null,
): string {
  const now = Date.now();
  if (status === "revoked") return "Revoked";
  if (status === "pending") return "Pending";
  if (endsAt.getTime() <= now) return "Expired";
  return "Active";
}

/**
 * Returns merged plan history for the account settings billing view.
 * Combines Stripe invoice periods, Stripe proration lines, admin complimentary intervals, and affiliate grants.
 */
export async function getMergedPlanHistoryForUser(
  userId: string,
  userEmail: string | null,
): Promise<PlanHistoryRow[]> {
  const emailLower = userEmail?.toLowerCase() ?? null;

  const settled = await Promise.allSettled([
    listBillingInvoicesForUser(userId, emailLower),
    listPlanAssignmentLogsForUser(userId),
    listAffiliatesForPlanHistory(userId, emailLower),
    listProrationLinesWithReceiptForUser(userId),
  ]);

  const invoices =
    settled[0].status === "fulfilled" ? settled[0].value : [];
  const assignmentLogs =
    settled[1].status === "fulfilled" ? settled[1].value : [];
  const affiliatesList =
    settled[2].status === "fulfilled" ? settled[2].value : [];
  const prorationLines =
    settled[3].status === "fulfilled" ? settled[3].value : [];

  if (process.env.NODE_ENV === "development") {
    for (let i = 0; i < settled.length; i++) {
      const s = settled[i];
      if (s.status === "rejected") {
        console.error(
          `[plan-history] source ${i} failed:`,
          s.reason,
        );
      }
    }
  }

  const invoicesWithProrationDetail = new Set(
    prorationLines.map((p) => p.stripeInvoiceId),
  );

  const rows: PlanHistoryRow[] = [];

  for (const inv of invoices) {
    const receiptUrl = receiptUrlFromStoredInvoice(inv);

    const billingReason = inv.stripeBillingReason?.toLowerCase() ?? "";
    const skipInvoiceAggregate =
      inv.source === "invoice" &&
      billingReason === "subscription_update" &&
      invoicesWithProrationDetail.has(inv.externalId);

    if (skipInvoiceAggregate) {
      continue;
    }

    const start = inv.periodStart ?? inv.paidAt ?? inv.createdAt;
    if (!start) continue;

    const end = inv.periodEnd ?? null;
    const planName = slugToPlanDisplayName(inv.planSlug);

    const planType: PlanHistoryTypeLabel =
      inv.source === "invoice" && billingReason === "subscription_update"
        ? "Proration"
        : "Paid subscription";

    rows.push({
      id: `inv-${inv.id}`,
      planName,
      planType,
      statusLabel: invoiceStatusLabel(inv.status),
      startAt: start.toISOString(),
      endAt: end ? end.toISOString() : null,
      receiptUrl,
    });
  }

  for (const line of prorationLines) {
    const start =
      line.periodStart ??
      (line.createdAt instanceof Date
        ? line.createdAt
        : new Date(line.createdAt));
    const end = line.periodEnd ?? null;
    const receiptUrl = receiptUrlFromStoredInvoice(line);
    rows.push({
      id: `prl-${line.id}`,
      planName: formatProrationLinePlanName(line),
      planType: "Proration",
      statusLabel: line.invoiceStatus
        ? invoiceStatusLabel(line.invoiceStatus)
        : "—",
      startAt: start.toISOString(),
      endAt: end ? end.toISOString() : null,
      receiptUrl,
    });
  }

  const segments = buildAdminComplimentarySegments(
    assignmentLogs as AssignmentLogRow[],
  );
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    rows.push({
      id: `admin-${i}-${seg.start.toISOString()}`,
      planName: seg.planName,
      planType: "Complimentary (admin)",
      statusLabel: seg.end ? "Ended" : "Active",
      startAt: seg.start.toISOString(),
      endAt: seg.end ? seg.end.toISOString() : null,
      receiptUrl: null,
    });
  }

  for (const a of affiliatesList) {
    const startRaw =
      a.inviteAcceptedAt ??
      (a.status !== "pending" ? a.startedAt : null);
    if (!startRaw) continue;

    const start =
      startRaw instanceof Date ? startRaw : new Date(startRaw);
    const endsAt =
      a.endsAt instanceof Date ? a.endsAt : new Date(a.endsAt);
    const revokedAt = a.revokedAt
      ? a.revokedAt instanceof Date
        ? a.revokedAt
        : new Date(a.revokedAt)
      : null;

    const endAt: Date =
      a.status === "revoked" && revokedAt
        ? revokedAt < endsAt
          ? revokedAt
          : endsAt
        : endsAt;

    rows.push({
      id: `aff-${a.id}`,
      planName: slugToPlanDisplayName(a.planAssigned),
      planType: "Complimentary (affiliate)",
      statusLabel: affiliateStatusLabel(a.status, endsAt, revokedAt),
      startAt: start.toISOString(),
      endAt: endAt.toISOString(),
      receiptUrl: null,
    });
  }

  rows.sort(
    (a, b) =>
      new Date(b.startAt).getTime() - new Date(a.startAt).getTime(),
  );

  return rows;
}
