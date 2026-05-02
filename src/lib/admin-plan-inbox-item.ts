import type { UnifiedInboxItem } from "@/lib/inbox-item-types";

export type AdminPlanApplicationPath = "stripe_proration" | "clerk_metadata_only";

export type AdminPlanAssignmentLogInboxRow = {
  id: number;
  action: "plan_assigned" | "plan_removed";
  planName: string | null;
  previousPlanName: string | null;
  assignedByName: string;
  createdAt: Date;
  planApplicationPath: string | null;
};

function isApplicationPath(v: string | null): v is AdminPlanApplicationPath {
  return v === "stripe_proration" || v === "clerk_metadata_only";
}

/** User-facing copy for the dashboard inbox (admin “Assign plan” on All users). */
export function buildAdminPlanAssignmentInboxDescription(
  row: AdminPlanAssignmentLogInboxRow,
): string {
  const from = row.previousPlanName?.trim() || "—";
  const to = row.planName?.trim() || "Free";
  const by = row.assignedByName.trim() || "An administrator";

  let base: string;
  if (row.action === "plan_removed") {
    const prev = row.previousPlanName?.trim();
    base = prev
      ? `${by} removed or cleared your admin-assigned plan. Your effective plan is now ${to}. (Previously: ${prev}.)`
      : `${by} removed or cleared your admin-assigned plan. Your effective plan is now ${to}.`;
  } else {
    base = `${by} updated your Flipvise plan from ${from} to ${to}.`;
  }

  if (isApplicationPath(row.planApplicationPath)) {
    if (row.planApplicationPath === "stripe_proration") {
      return `${base} Your Stripe subscription was updated with proration: you may see a partial charge or credit for the current billing period. Check your email for Stripe’s receipt and open Billing in the dashboard for invoice details.`;
    }
    return `${base} This change was applied on your account without swapping your Stripe subscription price (no proration invoice from this action).`;
  }

  return base;
}

export function adminPlanAssignmentLogToInboxItem(
  row: AdminPlanAssignmentLogInboxRow,
  readSet: Set<string>,
): UnifiedInboxItem {
  const key = `admin_plan_log:${row.id}`;
  const path = isApplicationPath(row.planApplicationPath) ? row.planApplicationPath : null;

  return {
    type: "admin_plan_log",
    key,
    title: "Plan updated by administrator",
    description: buildAdminPlanAssignmentInboxDescription(row),
    dateIso: row.createdAt.toISOString(),
    isRead: readSet.has(key),
    requiresAction: false,
    payload: {
      logId: row.id,
      assignedByName: row.assignedByName,
      previousPlanName: row.previousPlanName,
      newPlanName: row.planName,
      action: row.action,
      planApplicationPath: path,
    },
  };
}
