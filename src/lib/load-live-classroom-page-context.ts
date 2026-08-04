import "server-only";

import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/clerk-auth";
import { getAccessContext } from "@/lib/access";
import { getTeamsForTeamDashboard } from "@/db/queries/teams";
import {
  getLiveClassroomSessionById,
  getOrCreateLiveClassroomTeamSettings,
  type LiveClassroomSessionRow,
  type LiveClassroomTeamSettingsRow,
} from "@/db/queries/live-classroom";
import {
  liveClassroomRoleCanHost,
  liveClassroomRoleCanManageOrg,
  resolveLiveClassroomOrgRole,
  teamOwnsLiveClassroom,
} from "@/lib/live-classroom-access";
import type { LiveClassroomOrgRole } from "@/lib/live-classroom-types";
import { buildLiveClassroomHref, LIVE_CLASSROOM_ROOT_PATH } from "@/lib/live-classroom-url";
import type { InferSelectModel } from "drizzle-orm";
import type { teams } from "@/db/schema";

export type LiveClassroomSearchParams = {
  team?: string;
};

export type LiveClassroomPageContext = {
  userId: string;
  teamId: number;
  team: InferSelectModel<typeof teams>;
  role: LiveClassroomOrgRole | null;
  licensedSeats: number;
  owns: boolean;
  /** Owner or assigned Live Classroom roster member. */
  hasAccess: boolean;
  canHost: boolean;
  canManage: boolean;
  settings: LiveClassroomTeamSettingsRow | null;
  teams: InferSelectModel<typeof teams>[];
};

function parseTeamId(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/**
 * Resolves Live Classroom™ page context from `?team=`.
 * Does not redirect when the org lacks the add-on — callers render an unlock CTA.
 */
export async function loadLiveClassroomPageContext(
  searchParams: Promise<LiveClassroomSearchParams>,
  options?: { path?: string },
): Promise<LiveClassroomPageContext> {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const teamsForUser = await getTeamsForTeamDashboard(userId);
  if (teamsForUser.length === 0) {
    redirect("/onboarding/team");
  }

  const canonicalPath = options?.path ?? LIVE_CLASSROOM_ROOT_PATH;
  const sp = await searchParams;
  const requestedTeamId = parseTeamId(
    typeof sp.team === "string" ? sp.team : undefined,
  );

  let team =
    requestedTeamId != null
      ? teamsForUser.find((t) => t.id === requestedTeamId)
      : undefined;

  if (requestedTeamId != null && !team) {
    redirect(buildLiveClassroomHref(canonicalPath, teamsForUser[0]!.id));
  }

  team ??= teamsForUser[0]!;

  if (requestedTeamId == null) {
    redirect(buildLiveClassroomHref(canonicalPath, team.id));
  }

  const ownership = await teamOwnsLiveClassroom(team.id);
  const role = await resolveLiveClassroomOrgRole({
    teamId: team.id,
    userId,
  });
  const hasAccess = Boolean(role);

  const settings = ownership.owns
    ? await getOrCreateLiveClassroomTeamSettings(team.id)
    : null;

  return {
    userId,
    teamId: team.id,
    team,
    role,
    licensedSeats: ownership.licensedSeats,
    owns: ownership.owns,
    hasAccess,
    canHost: liveClassroomRoleCanHost(role),
    canManage: liveClassroomRoleCanManageOrg(role),
    settings,
    teams: teamsForUser,
  };
}

export type LiveClassroomSessionPageContext = {
  userId: string;
  teamId: number;
  team: NonNullable<Awaited<ReturnType<typeof teamOwnsLiveClassroom>>["team"]>;
  session: LiveClassroomSessionRow;
  role: LiveClassroomOrgRole | null;
  licensedSeats: number;
  owns: boolean;
  hasAccess: boolean;
  canHost: boolean;
  canManage: boolean;
  isAdmin: boolean;
};

/** Session routes — resolves access from the session's organization. */
export async function loadLiveClassroomSessionPageContext(
  sessionId: number,
): Promise<LiveClassroomSessionPageContext> {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const session = await getLiveClassroomSessionById(sessionId);
  if (!session) notFound();

  const ownership = await teamOwnsLiveClassroom(session.teamId);
  if (!ownership.team) notFound();

  const access = await getAccessContext();
  const role = await resolveLiveClassroomOrgRole({
    teamId: session.teamId,
    userId,
  });

  const hasAccess = Boolean(role);

  if (!ownership.owns) {
    return {
      userId,
      teamId: session.teamId,
      team: ownership.team,
      session,
      role,
      licensedSeats: ownership.licensedSeats,
      owns: false,
      hasAccess: false,
      canHost: false,
      canManage: false,
      isAdmin: access.isAdmin,
    };
  }

  return {
    userId,
    teamId: session.teamId,
    team: ownership.team,
    session,
    role,
    licensedSeats: ownership.licensedSeats,
    owns: true,
    hasAccess,
    canHost: liveClassroomRoleCanHost(role),
    canManage: liveClassroomRoleCanManageOrg(role),
    isAdmin: access.isAdmin,
  };
}
