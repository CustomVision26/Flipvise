import { db } from "@/db";
import { adminPlanAssignmentLogs, adminPrivilegeLogs } from "@/db/schema";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  isClerkPlatformAdminRole,
} from "@/lib/clerk-platform-admin-role";
import { listAffiliatesForPlanHistory } from "@/db/queries/affiliates";
import { listBillingInvoicesForUser } from "@/db/queries/billing";
import {
  listProrationLinesWithReceiptForUser,
  type ProrationLineWithReceipt,
} from "@/db/queries/billing-proration";
import { getActiveStripeSubscription } from "@/db/queries/stripe-subscriptions";
import type { PlanHistoryRow, PlanHistoryTypeLabel } from "@/lib/plan-history-types";
import { displayNameForBillingPlanSlug } from "@/lib/plan-slug-display";
import { formatUserInvoicePromoDisplay, parsePromoFromDiscountLabel } from "@/lib/admin-invoice-promo-display";
import { receiptPlanTitle, planSlugFromStripeLineDescription } from "@/lib/stripe-receipt-plan-title";

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

type ActiveStripeSubRow = NonNullable<
  Awaited<ReturnType<typeof getActiveStripeSubscription>>
>;

function activePaidSubscriptionStart(
  activeSub: ActiveStripeSubRow,
  invoices: StoredBillingInvoice[],
): Date {
  const planSlug = activeSub.planSlug?.trim();
  if (planSlug) {
    const inv = latestPaidInvoiceForPlan(invoices, planSlug);
    const fromInvoice = inv?.periodStart ?? inv?.paidAt;
    if (fromInvoice) {
      return fromInvoice instanceof Date ? fromInvoice : new Date(fromInvoice);
    }
  }
  const fallback = activeSub.updatedAt ?? activeSub.createdAt;
  return fallback instanceof Date ? fallback : new Date(fallback);
}

/** Close open admin-assigned complimentary intervals when a paid Stripe sub is active. */
function closeAdminSegmentsSupersededByPaidSubscription(
  segments: Array<{ planName: string; start: Date; end: Date | null }>,
  activeSub: ActiveStripeSubRow | null,
  invoices: StoredBillingInvoice[],
): void {
  if (!activeSub) return;
  if (activeSub.status !== "active" && activeSub.status !== "trialing") return;

  const supersedeAt = activePaidSubscriptionStart(activeSub, invoices);
  for (const seg of segments) {
    if (seg.end != null) continue;
    if (supersedeAt.getTime() <= seg.start.getTime()) continue;
    seg.end = supersedeAt;
  }
}

/** Mark the current paid subscription period as Active in history (not just Paid). */
function reconcileActivePaidPlanStatusInHistory(
  rows: PlanHistoryRow[],
  activeSub: ActiveStripeSubRow | null,
): void {
  if (!activeSub) return;
  if (activeSub.status !== "active" && activeSub.status !== "trialing") return;

  const planSlug = activeSub.planSlug?.trim();
  if (!planSlug) return;

  const now = Date.now();
  const matching = rows
    .filter(
      (row) =>
        row.planType === "Paid subscription" &&
        planNamesMatch(row.planName, planSlug),
    )
    .sort(
      (a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime(),
    );

  const current = matching.find((row) => {
    if (!row.endAt) return true;
    const endMs = new Date(row.endAt).getTime();
    return !Number.isNaN(endMs) && endMs > now;
  });

  if (!current) return;

  current.statusLabel =
    activeSub.status === "trialing" ? "Trialing" : "Active";
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

type StoredBillingInvoice = Awaited<
  ReturnType<typeof listBillingInvoicesForUser>
>[number];

function planNamesMatch(rowPlanName: string, planSlug: string): boolean {
  const normalizedRow = rowPlanName.trim().toLowerCase();
  const fromReceipt = receiptPlanTitle(planSlug).trim().toLowerCase();
  const fromSlug = slugToPlanDisplayName(planSlug).trim().toLowerCase();
  return normalizedRow === fromReceipt || normalizedRow === fromSlug;
}

function invoiceEventTime(inv: StoredBillingInvoice): number {
  const raw = inv.paidAt ?? inv.periodStart ?? inv.createdAt;
  if (raw instanceof Date) return raw.getTime();
  if (raw) return new Date(raw).getTime();
  return 0;
}

function latestPaidInvoiceForPlan(
  invoices: StoredBillingInvoice[],
  planSlug: string,
): StoredBillingInvoice | undefined {
  return invoices
    .filter(
      (inv) =>
        inv.planSlug?.trim().toLowerCase() === planSlug.toLowerCase() &&
        inv.status?.toLowerCase() === "paid",
    )
    .sort((a, b) => invoiceEventTime(b) - invoiceEventTime(a))[0];
}

function rowCoversActiveSubscriptionPeriod(
  row: PlanHistoryRow,
  planSlug: string,
  latestPaidExternalId: string | null,
  subUpdatedAt: Date | null,
): boolean {
  if (row.planType === "Proration") return false;
  if (!planNamesMatch(row.planName, planSlug)) return false;

  if (latestPaidExternalId && row.id === `inv-${latestPaidExternalId}`) {
    return true;
  }

  if (subUpdatedAt) {
    const rowStart = new Date(row.startAt).getTime();
    if (rowStart >= subUpdatedAt.getTime() - 60_000) {
      return true;
    }
  }

  return false;
}

function inferPromoPercentFromInvoice(inv: StoredBillingInvoice): number | null {
  const subtotal = inv.subtotalCents;
  const discount = inv.discountAmountCents;
  if (
    typeof subtotal === "number" &&
    subtotal > 0 &&
    typeof discount === "number" &&
    discount > 0
  ) {
    return Math.round((discount / subtotal) * 100);
  }
  return null;
}

function promoDisplayForInvoice(inv: StoredBillingInvoice): string | null {
  return formatUserInvoicePromoDisplay({
    promoCode: inv.promoCode,
    promoKind: inv.promoKind,
    discountLabel: inv.discountLabel,
    percentOff: inferPromoPercentFromInvoice(inv),
  });
}

function pushPaidInvoiceHistoryRow(
  rows: PlanHistoryRow[],
  inv: StoredBillingInvoice,
  planType: PlanHistoryTypeLabel = "Paid subscription",
) {
  const receiptUrl = receiptUrlFromStoredInvoice(inv);
  const startIso = toIsoString(inv.periodStart ?? inv.paidAt ?? inv.createdAt);
  if (!startIso) return;

  rows.push({
    id: `inv-${inv.externalId}`,
    planName: receiptPlanTitle(inv.planSlug),
    planType,
    statusLabel: invoiceStatusLabel(inv.status),
    startAt: startIso,
    endAt: toIsoString(inv.periodEnd),
    receiptUrl,
    receiptLabel: inv.invoiceNumber?.trim() || null,
    promoDisplay: promoDisplayForInvoice(inv),
  });
}

function latestProrationReceiptForPlanSlug(
  planSlug: string,
  prorationLines: ProrationLineWithReceipt[],
): { receiptUrl: string; receiptLabel: string | null } | null {
  const byInvoice = groupProrationLinesByInvoice(prorationLines);
  const sorted = [...byInvoice.entries()].sort((a, b) => {
    const aT = a[1][0]?.createdAt?.getTime() ?? 0;
    const bT = b[1][0]?.createdAt?.getTime() ?? 0;
    return bT - aT;
  });

  for (const [, lines] of sorted) {
    const upgradedToPlan = lines.some((line) => {
      if ((line.amountCents ?? 0) <= 0) return false;
      const slug =
        line.invoicePlanSlug?.trim() ||
        planSlugFromStripeLineDescription(line.description);
      return slug != null && slug.toLowerCase() === planSlug.toLowerCase();
    });
    if (!upgradedToPlan) continue;

    const first = lines[0]!;
    const receiptUrl = receiptUrlFromStoredInvoice(first);
    if (!receiptUrl) continue;

    return {
      receiptUrl,
      receiptLabel: first.invoiceNumber?.trim() || null,
    };
  }

  return null;
}

function isSubscriptionUpdateInvoice(inv: StoredBillingInvoice): boolean {
  return inv.stripeBillingReason?.toLowerCase() === "subscription_update";
}

function latestUpgradeReceiptForPlanSlug(
  planSlug: string,
  invoices: StoredBillingInvoice[],
  prorationLines: ProrationLineWithReceipt[],
): { receiptUrl: string; receiptLabel: string | null } | null {
  const fromLines = latestProrationReceiptForPlanSlug(planSlug, prorationLines);
  if (fromLines) return fromLines;

  const updateInvoices = invoices
    .filter(
      (inv) =>
        isSubscriptionUpdateInvoice(inv) &&
        inv.status?.toLowerCase() === "paid",
    )
    .sort((a, b) => invoiceEventTime(b) - invoiceEventTime(a));

  for (const inv of updateInvoices) {
    const storedSlug = inv.planSlug?.trim().toLowerCase();
    const matchesStoredSlug = storedSlug === planSlug.toLowerCase();
    const matchesProrationTarget = prorationLines.some(
      (line) =>
        line.stripeInvoiceId === inv.externalId &&
        (line.amountCents ?? 0) > 0 &&
        (line.invoicePlanSlug?.trim().toLowerCase() === planSlug.toLowerCase() ||
          planSlugFromStripeLineDescription(line.description)?.toLowerCase() ===
            planSlug.toLowerCase()),
    );
    if (!matchesStoredSlug && !matchesProrationTarget) continue;

    const receiptUrl = receiptUrlFromStoredInvoice(inv);
    if (!receiptUrl) continue;

    return {
      receiptUrl,
      receiptLabel: inv.invoiceNumber?.trim() || null,
    };
  }

  return null;
}

function removeRedundantProrationRows(
  rows: PlanHistoryRow[],
  activeSub: ActiveStripeSubRow | null,
): void {
  if (!activeSub?.planSlug?.trim()) return;
  const planSlug = activeSub.planSlug.trim();
  const activeHasReceipt = rows.some(
    (row) =>
      row.planType === "Paid subscription" &&
      (row.statusLabel === "Active" || row.statusLabel === "Trialing") &&
      planNamesMatch(row.planName, planSlug) &&
      !!row.receiptUrl,
  );
  if (!activeHasReceipt) return;

  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i]!.planType === "Proration") {
      rows.splice(i, 1);
    }
  }
}

function pruneDuplicatePaidSubscriptionRows(
  rows: PlanHistoryRow[],
  invoices: StoredBillingInvoice[],
  activeSub: ActiveStripeSubRow | null,
): void {
  const subscriptionUpdateIds = new Set(
    invoices.filter(isSubscriptionUpdateInvoice).map((inv) => inv.externalId),
  );

  const subUpdatedAt =
    activeSub?.updatedAt instanceof Date
      ? activeSub.updatedAt.getTime()
      : activeSub?.updatedAt
        ? new Date(activeSub.updatedAt).getTime()
        : null;

  const activePlanSlug = activeSub?.planSlug?.trim() ?? null;
  const activePeriodEndIso = activeSub?.currentPeriodEnd
    ? toIsoString(
        activeSub.currentPeriodEnd instanceof Date
          ? activeSub.currentPeriodEnd
          : new Date(activeSub.currentPeriodEnd),
      )
    : null;

  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i]!;
    if (row.planType !== "Paid subscription") continue;

    if (row.id.startsWith("inv-")) {
      const extId = row.id.slice(4);
      if (subscriptionUpdateIds.has(extId)) {
        rows.splice(i, 1);
        continue;
      }
    }

    if (
      activePlanSlug &&
      subUpdatedAt != null &&
      activePeriodEndIso &&
      row.endAt === activePeriodEndIso &&
      row.statusLabel === "Paid" &&
      !planNamesMatch(row.planName, activePlanSlug) &&
      !row.id.startsWith("stripe-sub-active")
    ) {
      const rowStart = new Date(row.startAt).getTime();
      if (Math.abs(rowStart - subUpdatedAt) <= 5 * 60_000) {
        rows.splice(i, 1);
      }
    }
  }
}

function enrichActivePaidRowsWithProrationReceipts(
  rows: PlanHistoryRow[],
  activeSub: ActiveStripeSubRow | null,
  invoices: StoredBillingInvoice[],
  prorationLines: ProrationLineWithReceipt[],
): void {
  if (!activeSub?.planSlug?.trim()) return;
  const planSlug = activeSub.planSlug.trim();
  const receipt = latestUpgradeReceiptForPlanSlug(
    planSlug,
    invoices,
    prorationLines,
  );
  if (!receipt) return;

  const now = Date.now();
  const candidates = rows
    .filter(
      (row) =>
        row.planType === "Paid subscription" &&
        planNamesMatch(row.planName, planSlug),
    )
    .sort(
      (a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime(),
    );

  const target =
    candidates.find((row) => {
      if (row.statusLabel === "Active" || row.statusLabel === "Trialing") {
        return true;
      }
      if (!row.endAt) return true;
      const endMs = new Date(row.endAt).getTime();
      return !Number.isNaN(endMs) && endMs > now;
    }) ?? candidates[0];

  if (!target || target.receiptUrl) return;

  target.receiptUrl = receipt.receiptUrl;
  target.receiptLabel = target.receiptLabel ?? receipt.receiptLabel;
}

async function appendActiveStripeSubscriptionRow(
  userId: string,
  rows: PlanHistoryRow[],
  invoices: StoredBillingInvoice[],
  prorationLines: ProrationLineWithReceipt[],
): Promise<void> {
  const activeSub = await getActiveStripeSubscription(userId);
  const planSlug = activeSub?.planSlug?.trim();
  if (!activeSub || !planSlug) return;
  if (activeSub.status !== "active" && activeSub.status !== "trialing") return;

  const periodEnd =
    activeSub.currentPeriodEnd instanceof Date
      ? activeSub.currentPeriodEnd
      : activeSub.currentPeriodEnd
        ? new Date(activeSub.currentPeriodEnd)
        : null;

  const subUpdatedAt =
    activeSub.updatedAt instanceof Date
      ? activeSub.updatedAt
      : activeSub.updatedAt
        ? new Date(activeSub.updatedAt)
        : null;

  const latestPaidInvoice = latestPaidInvoiceForPlan(invoices, planSlug);

  let paidInvoice = latestPaidInvoice;
  if (!paidInvoice || !receiptUrlFromStoredInvoice(paidInvoice)) {
    try {
      const { refreshLatestPaidInvoiceForUser } = await import(
        "@/lib/stripe-invoice-persist"
      );
      const refreshed = await refreshLatestPaidInvoiceForUser(userId, planSlug);
      if (refreshed) paidInvoice = refreshed;
    } catch (error) {
      console.error("[plan-history] refresh latest paid invoice:", error);
    }
  }

  const latestPaidExternalId = paidInvoice?.externalId?.trim() || null;
  const prorationReceipt = latestUpgradeReceiptForPlanSlug(
    planSlug,
    invoices,
    prorationLines,
  );

  if (
    rows.some((row) =>
      rowCoversActiveSubscriptionPeriod(
        row,
        planSlug,
        latestPaidExternalId,
        subUpdatedAt,
      ),
    )
  ) {
    return;
  }

  const startIso = toIsoString(
    paidInvoice?.periodStart ??
      paidInvoice?.paidAt ??
      activeSub.updatedAt ??
      activeSub.createdAt,
  );
  if (!startIso) return;

  rows.push({
    id: `stripe-sub-active-${activeSub.stripeSubscriptionId}`,
    planName: receiptPlanTitle(planSlug),
    planType: "Paid subscription",
    statusLabel:
      activeSub.status === "trialing"
        ? "Trialing"
        : paidInvoice
          ? invoiceStatusLabel(paidInvoice.status)
          : "Active",
    startAt: startIso,
    endAt: toIsoString(periodEnd ?? paidInvoice?.periodEnd),
    receiptUrl:
      (paidInvoice ? receiptUrlFromStoredInvoice(paidInvoice) : null) ??
      prorationReceipt?.receiptUrl ??
      null,
    receiptLabel:
      paidInvoice?.invoiceNumber?.trim() ||
      prorationReceipt?.receiptLabel ||
      null,
    promoDisplay: paidInvoice ? promoDisplayForInvoice(paidInvoice) : null,
  });
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

async function enrichPlanHistoryPromoFromReceipts(
  userId: string,
  userEmail: string | null,
  rows: PlanHistoryRow[],
  invoices: StoredBillingInvoice[],
): Promise<void> {
  const invoiceByExternalId = new Map(
    invoices.map((inv) => [inv.externalId, inv]),
  );
  const invoiceByNumber = new Map<string, StoredBillingInvoice>();
  for (const inv of invoices) {
    const number = inv.invoiceNumber?.trim();
    if (number) invoiceByNumber.set(number, inv);
  }

  const { backfillInvoicePromoForUser } = await import(
    "@/lib/stripe-invoice-persist"
  );

  for (const row of rows) {
    if (row.promoDisplay?.trim()) continue;
    if (row.planType !== "Paid subscription") continue;

    let inv: StoredBillingInvoice | undefined;
    if (row.id.startsWith("inv-")) {
      inv = invoiceByExternalId.get(row.id.slice(4));
    } else if (row.receiptLabel?.trim()) {
      inv = invoiceByNumber.get(row.receiptLabel.trim());
    }

    const fromDb = inv ? promoDisplayForInvoice(inv) : null;
    if (fromDb) {
      row.promoDisplay = fromDb;
      continue;
    }

    if (inv) {
      const parsed = parsePromoFromDiscountLabel(inv.discountLabel);
      const fromLabel = formatUserInvoicePromoDisplay({
        promoCode: inv.promoCode ?? parsed.promoCode,
        promoKind: inv.promoKind ?? parsed.promoKind,
        discountLabel: inv.discountLabel,
        percentOff: inferPromoPercentFromInvoice(inv),
      });
      if (fromLabel) {
        row.promoDisplay = fromLabel;
        continue;
      }
    }

    const invoiceId =
      (row.id.startsWith("inv-") ? row.id.slice(4) : null) ?? inv?.externalId ?? null;
    if (!invoiceId?.startsWith("in_")) continue;

    const fromStripe = await backfillInvoicePromoForUser(
      userId,
      userEmail,
      invoiceId,
    );
    if (fromStripe) row.promoDisplay = fromStripe;
  }
}

async function buildMergedPlanHistoryForUser(
  userId: string,
  userEmail: string | null,
): Promise<PlanHistoryRow[]> {
  const emailLower = userEmail?.toLowerCase() ?? null;

  try {
    const { syncBillingInvoicesForUser } = await import(
      "@/lib/stripe-invoice-persist"
    );
    await syncBillingInvoicesForUser(userId);
  } catch (error) {
    console.error("[plan-history] invoice sync:", error);
  }

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

  const rows: PlanHistoryRow[] = [];

  for (const inv of invoices) {
    if (isSubscriptionUpdateInvoice(inv)) {
      // Plan-change proration — receipt belongs on the active upgraded plan row only.
      continue;
    }

    pushPaidInvoiceHistoryRow(rows, inv, "Paid subscription");
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
      promoDisplay: null,
    });
  }

  const segments = buildAdminComplimentarySegments(
    assignmentLogs as AssignmentLogRow[],
  );
  const activeSubForHistory = await getActiveStripeSubscription(userId);
  closeAdminSegmentsSupersededByPaidSubscription(
    segments,
    activeSubForHistory,
    invoices,
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
      promoDisplay: null,
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
      promoDisplay: null,
    });
  }

  pruneDuplicatePaidSubscriptionRows(rows, invoices, activeSubForHistory);

  await appendActiveStripeSubscriptionRow(userId, rows, invoices, prorationLines);

  reconcileActivePaidPlanStatusInHistory(rows, activeSubForHistory);

  enrichActivePaidRowsWithProrationReceipts(
    rows,
    activeSubForHistory,
    invoices,
    prorationLines,
  );

  removeRedundantProrationRows(rows, activeSubForHistory);

  await enrichPlanHistoryPromoFromReceipts(userId, emailLower, rows, invoices);

  rows.sort(
    (a, b) =>
      new Date(b.startAt).getTime() - new Date(a.startAt).getTime(),
  );

  return rows;
}

function hasOpenComplimentaryPlanRow(
  rows: PlanHistoryRow[],
  planName: string,
): boolean {
  return rows.some(
    (row) =>
      row.endAt == null &&
      row.planName === planName &&
      row.planType.startsWith("Complimentary"),
  );
}

/** Platform-admin / `adminGranted` unlock is not logged as a plan assignment — surface it in history. */
export async function appendComplimentaryAccessHistoryRows(
  userId: string,
  rows: PlanHistoryRow[],
  meta: Record<string, unknown>,
): Promise<void> {
  const role = typeof meta.role === "string" ? meta.role : null;
  const adminGranted = meta.adminGranted === true;
  const isPlatformAdmin = isClerkPlatformAdminRole(role);

  if (!isPlatformAdmin && !adminGranted) return;

  const activeSub = await getActiveStripeSubscription(userId);
  if (
    activeSub &&
    (activeSub.status === "active" || activeSub.status === "trialing")
  ) {
    return;
  }

  const planName = "Pro Plus";
  if (hasOpenComplimentaryPlanRow(rows, planName)) return;

  let startIso = new Date().toISOString();
  try {
    const [latestGrant] = await db
      .select({ createdAt: adminPrivilegeLogs.createdAt })
      .from(adminPrivilegeLogs)
      .where(
        and(
          eq(adminPrivilegeLogs.targetUserId, userId),
          inArray(adminPrivilegeLogs.action, ["granted", "superadmin_granted"]),
        ),
      )
      .orderBy(desc(adminPrivilegeLogs.createdAt))
      .limit(1);
    if (latestGrant?.createdAt) {
      startIso = toIsoString(latestGrant.createdAt) ?? startIso;
    }
  } catch (error) {
    console.error("[plan-history] admin privilege grant lookup:", error);
  }

  rows.push({
    id: isPlatformAdmin
      ? `platform-admin-complimentary-${userId}`
      : `admin-granted-complimentary-${userId}`,
    planName,
    planType: "Complimentary (admin)",
    statusLabel: "Active",
    startAt: startIso,
    endAt: null,
    receiptUrl: null,
    receiptLabel: null,
    promoDisplay: null,
  });
}
