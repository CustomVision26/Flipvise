import { TEAM_PLAN_IDS, TEAM_PLAN_LABELS, isTeamPlanId, type TeamPlanId } from "@/lib/team-plans";
import { ADMIN_PLAN_KEY } from "@/lib/plan-metadata-billing-resolution";

const BASE = [
  { id: "free" as const, label: "Free (clear plan flags)" },
  { id: "pro" as const, label: "Pro" },
] as const;

export const ADMIN_PLAN_DROPDOWN_OPTIONS = {
  base: BASE,
  team: TEAM_PLAN_IDS.map((id) => ({ id, label: TEAM_PLAN_LABELS[id as TeamPlanId] })),
} as const;

export type AdminPlanAssignment =
  | (typeof BASE)[number]["id"]
  | (typeof TEAM_PLAN_IDS)[number];

export function isAdminPlanAssignment(value: string): value is AdminPlanAssignment {
  if (value === "free" || value === "pro") {
    return true;
  }
  return isTeamPlanId(value);
}

/**
 * `publicMetadata` fields written by the admin "Assign plan" action. Shallow-merged; `null` removes a key in Clerk.
 * Sets `adminPlan` (the source-of-truth for admin overrides).
 * Does NOT set `plan` directly — the caller must call resolveEffectivePlan() and write `plan` separately.
 */
export function publicMetadataPatchForAdminPlanAssignment(
  assignment: AdminPlanAssignment,
): Record<string, unknown> {
  switch (assignment) {
    case "free":
      return {
        [ADMIN_PLAN_KEY]: null,
        teamPlanId: null,
        teamRole: null,
        adminGranted: null,
      };
    case "pro":
      return {
        [ADMIN_PLAN_KEY]: "pro",
        teamPlanId: null,
        teamRole: null,
        adminGranted: null,
      };
    default:
      if (isTeamPlanId(assignment)) {
        return {
          [ADMIN_PLAN_KEY]: assignment,
          teamPlanId: assignment,
          teamRole: "team_admin",
          adminGranted: null,
        };
      }
  }
  return {};
}

export function labelForAdminPlanAssignment(
  a: AdminPlanAssignment,
): string {
  for (const row of BASE) {
    if (row.id === a) return row.label;
  }
  if (isTeamPlanId(a)) {
    return TEAM_PLAN_LABELS[a];
  }
  return a;
}
