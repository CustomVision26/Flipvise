import { cookies } from "next/headers";
import { getMemberRecord, getTeamById, teamWorkspaceAllowsViewerAccess } from "@/db/queries/teams";
import { TEAM_CONTEXT_COOKIE } from "@/lib/team-context-cookie";

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 180,
};

export type TeamContextCookieAction = "noop" | "set" | "clear";

/** Read-only: whether the team context cookie should be set, cleared, or left alone. */
export async function resolveTeamContextCookieAction(
  teamId: number,
  userId: string,
): Promise<TeamContextCookieAction> {
  if (!(await teamWorkspaceAllowsViewerAccess(teamId, userId))) {
    return "clear";
  }

  const team = await getTeamById(teamId);
  if (!team) return "noop";
  const isOwner = team.ownerUserId === userId;
  if (!isOwner) {
    const m = await getMemberRecord(teamId, userId);
    if (!m) return "noop";
  }

  const store = await cookies();
  if (store.get(TEAM_CONTEXT_COOKIE)?.value === String(teamId)) return "noop";
  return "set";
}

export function dashboardPathFromSearchParams(
  sp: Record<string, string | string[] | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry) params.append(key, entry);
      }
    } else if (value) {
      params.set(key, value);
    }
  }
  const query = params.toString();
  return query ? `/dashboard?${query}` : "/dashboard";
}

export function teamContextCookieApiPath(input: {
  action: "clear" | "sync";
  teamId?: number;
  redirectPath: string;
}): string {
  const params = new URLSearchParams({
    action: input.action,
    redirect: input.redirectPath,
  });
  if (input.teamId != null) {
    params.set("teamId", String(input.teamId));
  }
  return `/api/team-context?${params.toString()}`;
}

/** Route handlers / Server Actions only — not Server Components. */
export async function clearTeamContextCookie() {
  const store = await cookies();
  store.delete(TEAM_CONTEXT_COOKIE);
}

/** Route handlers / Server Actions only — not Server Components. */
export async function syncTeamContextCookieForUser(teamId: number, userId: string) {
  if (!(await teamWorkspaceAllowsViewerAccess(teamId, userId))) {
    await clearTeamContextCookie();
    return;
  }

  const team = await getTeamById(teamId);
  if (!team) return;
  const isOwner = team.ownerUserId === userId;
  if (!isOwner) {
    const m = await getMemberRecord(teamId, userId);
    if (!m) return;
  }

  const store = await cookies();
  if (store.get(TEAM_CONTEXT_COOKIE)?.value === String(teamId)) return;
  store.set(TEAM_CONTEXT_COOKIE, String(teamId), COOKIE_OPTIONS);
}
