import "server-only";

import { cache } from "react";
import { auth } from "@/lib/clerk-auth";
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
  getLiveClassroomParticipant,
  getLiveClassroomParticipantGrant,
  getLiveClassroomSessionById,
  getLiveClassroomTeacherGrant,
  getOrCreateLiveClassroomTeamSettings,
} from "@/db/queries/live-classroom";
import type { LiveClassroomSessionRow } from "@/db/queries/live-classroom";
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
type TeamOwnsLiveClassroomResult = {
  owns: boolean;
  team: NonNullable<Awaited<ReturnType<typeof getTeamById>>> | null;
  licensedSeats: number;
  subscriptionActive: boolean;
};

/** Short process cache — ownership rarely changes; avoids Clerk cascades on every nav. */
const teamOwnsCache = new Map<
  number,
  { expiresAt: number; value: TeamOwnsLiveClassroomResult }
>();
const TEAM_OWNS_TTL_MS = 20_000;

export async function teamOwnsLiveClassroom(
  teamId: number,
): Promise<TeamOwnsLiveClassroomResult> {
  const cached = teamOwnsCache.get(teamId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const team = await getTeamByIdCached(teamId);
  if (!team) {
    return { owns: false, team: null, licensedSeats: 0, subscriptionActive: false };
  }

  const eligible = isLiveClassroomEligiblePlanSlug(team.planSlug);
  const [subscriptionActive, ownerEntitlement] = await Promise.all([
    subscriberHasActiveWorkspacePlan(team.ownerUserId),
    getUserAddonEntitlement(team.ownerUserId, LIVE_CLASSROOM_ADDON_KEY),
  ]);
  const licensedSeats = eligible
    ? liveClassroomParticipantLimitForPlan(team.planSlug)
    : 0;

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

  const value: TeamOwnsLiveClassroomResult = {
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
  teamOwnsCache.set(teamId, { expiresAt: Date.now() + TEAM_OWNS_TTL_MS, value });
  return value;
}

const getTeamByIdCached = cache(getTeamById);

export async function resolveLiveClassroomOrgRole(input: {
  teamId: number;
  userId: string;
}): Promise<LiveClassroomOrgRole | null> {
  const team = await getTeamByIdCached(input.teamId);
  if (!team) return null;
  if (team.ownerUserId === input.userId) return "subscription_owner";

  const [members, assigned, teacherGrant] = await Promise.all([
    listTeamMembers(input.teamId),
    getLiveClassroomParticipantGrant(input.teamId, input.userId),
    getLiveClassroomTeacherGrant(input.teamId, input.userId),
  ]);
  const membership = members.find((m) => m.userId === input.userId);
  if (!membership) return null;

  // Workspace membership alone is not enough — must be on the LC roster.
  if (!assigned) return null;

  // Team admins need an explicit host token (teacher grant) to host or manage
  // Live Classroom for this workspace. Without a token they can only join as a
  // participant when assigned to the roster.
  if (membership.role === "team_admin") {
    return teacherGrant ? "team_administrator" : "student";
  }
  if (teacherGrant) return "teacher";
  return "student";
}

/**
 * Fast gate for lobby heartbeat / realtime polls.
 * Uses JWT auth + a few DB lookups — skips getAccessContext, Clerk Backend,
 * and subscription ownership cascades that were saturating Neon/Clerk in dev.
 */
export async function requireLiveClassroomPollAccess(sessionId: number): Promise<{
  userId: string;
  session: LiveClassroomSessionRow;
}> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const session = await getLiveClassroomSessionById(sessionId);
  if (!session) throw new Error("Session not found");
  if (session.status === "completed") {
    throw new Error("Session completed.");
  }
  if (session.status === "cancelled") {
    throw new Error("Session cancelled.");
  }
  if (!["lobby", "scheduled", "active", "paused"].includes(session.status)) {
    throw new Error("Session is not available.");
  }

  const [team, participant, grant] = await Promise.all([
    getTeamByIdCached(session.teamId),
    getLiveClassroomParticipant(sessionId, userId),
    getLiveClassroomParticipantGrant(session.teamId, userId),
  ]);
  if (!team) throw new Error("Workspace not found");

  const allowed =
    team.ownerUserId === userId ||
    session.hostUserId === userId ||
    (participant != null && !participant.removed) ||
    grant != null;

  if (!allowed) {
    throw new Error("You are not assigned to this Live Classroom session.");
  }

  return { userId, session };
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
  // Prefer a direct auth() check so Server Actions get a clear failure when the
  // Clerk session is missing from the action request (not a vague Unauthorized).
  const { userId: authUserId } = await auth();
  if (!authUserId) {
    if (mode === "page") redirect("/");
    throw new Error(
      "Your session expired. Refresh the page and sign in again, then retry.",
    );
  }

  const access = await getAccessContext();
  if (!access.userId) {
    if (mode === "page") redirect("/");
    throw new Error(
      "Your session expired. Refresh the page and sign in again, then retry.",
    );
  }

  const [ownership, role, settings] = await Promise.all([
    teamOwnsLiveClassroom(input.teamId),
    resolveLiveClassroomOrgRole({
      teamId: input.teamId,
      userId: access.userId,
    }),
    getOrCreateLiveClassroomTeamSettings(input.teamId),
  ]);

  if (!ownership.owns || !ownership.team) {
    if (mode === "page") redirect(await redirectPathForMissingLiveClassroomAddon());
    throw new Error("Live Classroom™ add-on required for this organization.");
  }

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
