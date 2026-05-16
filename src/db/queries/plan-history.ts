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
import { displayNameForBillingPlanSlug } from "@/lib/plan-slug-display";
import { receiptPlanTitle } from "@/lib/stripe-receipt-plan-title";

export type { PlanHistoryRow, PlanHistoryTypeLabel };

function slugToPlanDisplayName(slug: string | null | undefined): string {
  return displayNameForBillingPlanSlug(slug);
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

function groupProrationLinesByInvoice(
  lines: ProrationLineWithReceipt[],
): Map<string, ProrationLineWithReceipt[]> {
  const byInvoice = new Map<string, ProrationLineWithReceipt[]>();
  for (const line of lines) {
    const group = byInvoice.get(line.stripeInvoiceId) ?? [];
    group.push(line);
    byInvoice.set(line.stripeInvoiceId, group);
  }
  return byInvoice;
}

function prorationInvoicePlanName(lines: ProrationLineWithReceipt[]): string {
  const descriptions = lines.map((l) => l.description);
  const slug = lines.find((l) => l.invoicePlanSlug?.trim())?.invoicePlanSlug ?? null;
  return receiptPlanTitle(slug, descriptions);
}

function prorationInvoicePeriod(lines: ProrationLineWithReceipt[]): {
  start: Date | null;
  end: Date | null;
} {
  let start: Date | null = null;
  let end: Date | null = null;
  for (const line of lines) {
    if (line.periodStart) {
      if (!start || line.periodStart.getTime() < start.getTime()) {
        start = line.periodStart;
      }
    }
    if (line.periodEnd) {
      if (!end || line.periodEnd.getTime() > end.getTime()) {
        end = line.periodEnd;
      }
    }
  }
  if (!start) {
    const created = lines[0]?.createdAt;
    start = created instanceof Date ? created : created ? new Date(created) : null;
  }
  return { start, end };
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
  try {
    return await db
      .select({
        action: adminPlanAssignmentLogs.action,
        planName: adminPlanAssignmentLogs.planName,
        createdAt: adminPlanAssignmentLogs.createdAt,
      })
      .from(adminPlanAssignmentLogs)
      .where(
        and(
          eq(adminPlanAssignmentLogs.targetUserId, targetUserId),
          inArray(adminPlanAssignmentLogs.action, [
            "plan_assigned",
            "plan_removed",
          ]),
        ),
      )
      .orderBy(asc(adminPlanAssignmentLogs.createdAt));
  } catch (error) {
    console.error("[plan-history] listPlanAssignmentLogsForUser:", error);
    return [];
  }
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
function toIsoString(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export async function getMergedPlanHistoryForUser(
  userId: string,
  userEmail: string | null,
): Promise<PlanHistoryRow[]> {
  try {
    return await buildMergedPlanHistoryForUser(userId, userEmail);
  } catch (error) {
    console.error("[plan-history] getMergedPlanHistoryForUser:", error);
    return [];
  }
}

async function buildMergedPlanHistoryForUser(
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

    const startIso = toIsoString(
      inv.periodStart ?? inv.paidAt ?? inv.createdAt,
    );
    if (!startIso) continue;

    const endIso = toIsoString(inv.periodEnd);
    const planName = receiptPlanTitle(inv.planSlug);

    const planType: PlanHistoryTypeLabel =
      inv.source === "invoice" && billingReason === "subscription_update"
        ? "Proration"
        : "Paid subscription";

    rows.push({
      id: `inv-${inv.id}`,
      planName,
      planType,
      statusLabel: invoiceStatusLabel(inv.status),
      startAt: startIso,
      endAt: endIso,
      receiptUrl,
      receiptLabel: inv.invoiceNumber?.trim() || null,
    });
  }

  const prorationByInvoice = groupProrationLinesByInvoice(prorationLines);
  for (const [stripeInvoiceId, lines] of prorationByInvoice) {
    const { start, end } = prorationInvoicePeriod(lines);
    const startIso = toIsoString(start);
    if (!startIso) continue;
    const endIso = toIsoString(end);
    const first = lines[0]!;
    const receiptUrl = receiptUrlFromStoredInvoice(first);
    const receiptNumber = first.invoiceNumber?.trim() || null;
    rows.push({
      id: `prl-inv-${stripeInvoiceId}`,
      planName: prorationInvoicePlanName(lines),
      planType: "Proration",
      statusLabel: first.invoiceStatus
        ? invoiceStatusLabel(first.invoiceStatus)
        : "—",
      startAt: startIso,
      endAt: endIso,
      receiptUrl,
      receiptLabel: receiptNumber,
    });
  }

  const segments = buildAdminComplimentarySegments(
    assignmentLogs as AssignmentLogRow[],
  );
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    const startIso = toIsoString(seg.start);
    if (!startIso) continue;
    rows.push({
      id: `admin-${i}-${startIso}`,
      planName: seg.planName,
      planType: "Complimentary (admin)",
      statusLabel: seg.end ? "Ended" : "Active",
      startAt: startIso,
      endAt: toIsoString(seg.end),
      receiptUrl: null,
      receiptLabel: null,
    });
  }

  for (const a of affiliatesList) {
    const startRaw =
      a.inviteAcceptedAt ??
      (a.status !== "pending" ? a.startedAt : null);
    if (!startRaw) continue;

    const startIso = toIsoString(startRaw);
    if (!startIso) continue;

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

    const endIso = toIsoString(endAt);
    if (!endIso) continue;

    rows.push({
      id: `aff-${a.id}`,
      planName: slugToPlanDisplayName(a.planAssigned),
      planType: "Complimentary (affiliate)",
      statusLabel: affiliateStatusLabel(a.status, endsAt, revokedAt),
      startAt: startIso,
      endAt: endIso,
      receiptUrl: null,
      receiptLabel: null,
    });
  }

  rows.sort(
    (a, b) =>
      new Date(b.startAt).getTime() - new Date(a.startAt).getTime(),
  );

  return rows;
}
