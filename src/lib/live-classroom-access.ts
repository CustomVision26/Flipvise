import "server-only";

import { redirect } from "next/navigation";
import {
  accessHasAddon,
  canAccessAddon,
  getAccessContext,
  type AccessContext,
} from "@/lib/access";
import { LIVE_CLASSROOM_ADDON_KEY } from "@/lib/addon-keys";
import {
  getUserAddonEntitlement,
  getAddonCatalogSettings,
} from "@/db/queries/addons";
import { getTeamById, listTeamMembers } from "@/db/queries/teams";
import {
  getLiveClassroomParticipantGrant,
  getLiveClassroomTeacherGrant,
  getOrCreateLiveClassroomTeamSettings,
} from "@/db/queries/live-classroom";
import {
  isLiveClassroomEligiblePlanSlug,
  liveClassroomParticipantLimitForPlan,
} from "@/lib/live-classroom-eligibility";
import type { LiveClassroomOrgRole } from "@/lib/live-classroom-types";
import { subscriberHasActiveWorkspacePlan } from "@/lib/subscriber-team-plan-access";

export { accessHasAddon, canAccessAddon };

export function hasLiveClassroomAddon(ctx: AccessContext): boolean {
  return canAccessAddon(ctx, LIVE_CLASSROOM_ADDON_KEY);
}

export async function redirectPathForMissingLiveClassroomAddon(): Promise<string> {
  try {
    const settings = await getAddonCatalogSettings();
    if (settings.pricingCatalogVisible) return "/pricing/add-ons";
  } catch {
    // Fall through.
  }
  return "/dashboard/team-admin/add-ons";
}

/**
 * Organization owns Live Classroom when the subscription owner has an active
 * stripe/admin entitlement and the workspace plan is an eligible team tier.
 * Platform admins do not inherit product access — they monitor usage elsewhere.
 */
export async function teamOwnsLiveClassroom(teamId: number): Promise<{
  owns: boolean;
  team: NonNullable<Awaited<ReturnType<typeof getTeamById>>> | null;
  licensedSeats: number;
  subscriptionActive: boolean;
}> {
  const team = await getTeamById(teamId);
  if (!team) {
    return { owns: false, team: null, licensedSeats: 0, subscriptionActive: false };
  }

  const subscriptionActive = await subscriberHasActiveWorkspacePlan(
    team.ownerUserId,
  );
  const eligible = isLiveClassroomEligiblePlanSlug(team.planSlug);
  const licensedSeats = eligible
    ? liveClassroomParticipantLimitForPlan(team.planSlug)
    : 0;

  const ownerEntitlement = await getUserAddonEntitlement(
    team.ownerUserId,
    LIVE_CLASSROOM_ADDON_KEY,
  );
  const ownerOwns =
    ownerEntitlement?.status === "active" &&
    (ownerEntitlement.source === "stripe" ||
      ownerEntitlement.source === "admin");

  // Stripe purchases require an active workspace subscription.
  // Complimentary admin grants unlock the org when the workspace plan is an
  // eligible team tier (even if billing sync is temporarily stale).
  const owns =
    ownerOwns &&
    eligible &&
    (ownerEntitlement?.source === "admin" || subscriptionActive);

  return {
    owns: Boolean(owns),
    team,
    licensedSeats:
      licensedSeats > 0
        ? licensedSeats
        : owns
          ? liveClassroomParticipantLimitForPlan("pro_plus_team_basic")
          : 0,
    subscriptionActive,
  };
}

export async function resolveLiveClassroomOrgRole(input: {
  teamId: number;
  userId: string;
}): Promise<LiveClassroomOrgRole | null> {
  const team = await getTeamById(input.teamId);
  if (!team) return null;
  if (team.ownerUserId === input.userId) return "subscription_owner";

  const members = await listTeamMembers(input.teamId);
  const membership = members.find((m) => m.userId === input.userId);
  if (!membership) return null;

  // Workspace membership alone is not enough — must be on the LC roster.
  const assigned = await getLiveClassroomParticipantGrant(
    input.teamId,
    input.userId,
  );
  if (!assigned) return null;

  if (membership.role === "team_admin") return "team_administrator";

  const grant = await getLiveClassroomTeacherGrant(input.teamId, input.userId);
  if (grant) return "teacher";
  return "student";
}

export function liveClassroomRoleCanHost(
  role: LiveClassroomOrgRole | null,
): boolean {
  return (
    role === "subscription_owner" ||
    role === "team_administrator" ||
    role === "teacher"
  );
}

export function liveClassroomRoleCanManageOrg(
  role: LiveClassroomOrgRole | null,
): boolean {
  return role === "subscription_owner" || role === "team_administrator";
}

export function liveClassroomRoleCanPurchase(
  role: LiveClassroomOrgRole | null,
): boolean {
  return role === "subscription_owner";
}

/**
 * Page/action gate: user must belong to a team that owns Live Classroom and
 * have an LC role (owner or assigned roster). Platform admins do not bypass.
 * For host actions, pass `requireHost`.
 */
export async function requireLiveClassroomAccess(input: {
  teamId: number;
  mode?: "page" | "action";
  requireHost?: boolean;
  requireOrgManage?: boolean;
}): Promise<{
  access: AccessContext & { userId: string };
  role: LiveClassroomOrgRole;
  licensedSeats: number;
  settings: Awaited<ReturnType<typeof getOrCreateLiveClassroomTeamSettings>>;
}> {
  const mode = input.mode ?? "action";
  const access = await getAccessContext();
  if (!access.userId) {
    if (mode === "page") redirect("/");
    throw new Error("Unauthorized");
  }

  const ownership = await teamOwnsLiveClassroom(input.teamId);
  if (!ownership.owns || !ownership.team) {
    if (mode === "page") redirect(await redirectPathForMissingLiveClassroomAddon());
    throw new Error("Live Classroom™ add-on required for this organization.");
  }

  const role = await resolveLiveClassroomOrgRole({
    teamId: input.teamId,
    userId: access.userId,
  });
  if (!role) {
    if (mode === "page") redirect(`/dashboard/live-classroom?team=${input.teamId}`);
    throw new Error(
      "You are not assigned to Live Classroom™ for this workspace. Ask the subscription owner or a team administrator to assign you.",
    );
  }

  if (input.requireHost && !liveClassroomRoleCanHost(role)) {
    if (mode === "page") redirect(`/dashboard/live-classroom?team=${input.teamId}`);
    throw new Error("Teacher permission required to host Live Classroom sessions.");
  }

  if (input.requireOrgManage && !liveClassroomRoleCanManageOrg(role)) {
    if (mode === "page") redirect(`/dashboard/live-classroom?team=${input.teamId}`);
    throw new Error("Organization admin permission required.");
  }

  const settings = await getOrCreateLiveClassroomTeamSettings(input.teamId);
  if (!settings.enabled) {
    if (mode === "page") redirect(`/dashboard/live-classroom?team=${input.teamId}`);
    throw new Error("Live Classroom is disabled for this organization.");
  }

  return {
    access: access as AccessContext & { userId: string },
    role,
    licensedSeats: ownership.licensedSeats,
    settings,
  };
}
