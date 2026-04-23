import { cookies } from "next/headers";
import { getMemberRecord, getTeamById } from "@/db/queries/teams";
import { TEAM_CONTEXT_COOKIE } from "@/lib/team-context-cookie";

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 180,
};

/** Align the team workspace cookie with URL-based team context (no client round-trip). */
export async function syncTeamContextCookieForUser(teamId: number, userId: string) {
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
