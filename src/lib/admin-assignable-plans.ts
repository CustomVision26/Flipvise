import { TEAM_PLAN_IDS, TEAM_PLAN_LABELS, isTeamPlanId, type TeamPlanId } from "@/lib/team-plans";

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
 */
export function publicMetadataPatchForAdminPlanAssignment(
  assignment: AdminPlanAssignment,
): Record<string, unknown> {
  switch (assignment) {
    case "free":
      return {
        plan: null,
        teamPlanId: null,
        teamRole: null,
        adminGranted: null,
      };
    case "pro":
      return {
        plan: "pro",
        teamPlanId: null,
        teamRole: null,
        adminGranted: null,
      };
    default:
      if (isTeamPlanId(assignment)) {
        return {
          plan: assignment,
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
