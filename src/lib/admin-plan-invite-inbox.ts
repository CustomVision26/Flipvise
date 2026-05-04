import type { UnifiedInboxItem } from "@/lib/inbox-item-types";
import {
  labelForAdminPlanAssignment,
  type AdminPlanAssignment,
  isAdminPlanAssignment,
} from "@/lib/admin-assignable-plans";

type InviteRow = {
  id: number;
  assignedByName: string;
  assignment: string;
  previousPlanSlug: string | null;
  status: "pending" | "accepted" | "declined" | "superseded";
  createdAt: Date;
};

function planLabelFromSnapshotSlug(slug: string | null | undefined): string {
  if (slug == null || slug === "") return "—";
  if (!isAdminPlanAssignment(slug)) return slug;
  return labelForAdminPlanAssignment(slug);
}

function offeredLabel(assignment: string): string {
  if (!isAdminPlanAssignment(assignment)) return assignment;
  return labelForAdminPlanAssignment(assignment);
}

export function adminPlanInviteRowToInboxItem(
  row: InviteRow,
  readSet: Set<string>,
): UnifiedInboxItem {
  if (row.status === "accepted") {
    throw new Error("Invariant: accepted plan invites are not inbox items");
  }

  const key = `admin_plan_invite:${row.id}`;
  const fromLabel = planLabelFromSnapshotSlug(row.previousPlanSlug);
  const toLabel = offeredLabel(row.assignment);
  const by = row.assignedByName.trim() || "An administrator";

  const autoRead = row.status === "superseded";
  const isRead = readSet.has(key) || autoRead;

  let title: string;
  let description: string;

  switch (row.status) {
    case "pending":
      title = "Plan assignment from administrator";
      description = `${by} is offering to change your Flipvise plan from ${fromLabel} to ${toLabel}. Accept to apply this to your account. If you pay through Stripe and have an active subscription, accepting may update your subscription with proration; you may receive a Stripe receipt by email.`;
      break;
    case "declined":
      title = "Plan offer declined";
      description = `You declined an offer from ${by} to change your plan to ${toLabel}.`;
      break;
    case "superseded":
      title = "Plan offer replaced";
      description = `A plan offer (${fromLabel} → ${toLabel}) from ${by} was replaced by a newer assignment. Open your inbox for the latest pending request.`;
      break;
  }

  return {
    type: "admin_plan_invite",
    key,
    title,
    description,
    dateIso: row.createdAt.toISOString(),
    isRead,
    requiresAction: row.status === "pending",
    payload: {
      inviteId: row.id,
      assignedByName: row.assignedByName,
      offeredPlanSlug: row.assignment as AdminPlanAssignment,
      offeredPlanLabel: toLabel,
      previousPlanLabel: fromLabel,
      status: row.status,
    },
  };
}
