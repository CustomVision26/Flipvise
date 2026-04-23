import { getMemberRecord } from "@/db/queries/teams";

/** Help Center is hidden for normal team members while a team workspace cookie is active. */
export async function shouldHideHelpCenter(
  userId: string | null,
  teamContextCookie: string | undefined,
): Promise<boolean> {
  if (!userId || !teamContextCookie) return false;
  const teamId = Number(teamContextCookie);
  if (Number.isNaN(teamId)) return false;
  try {
    const m = await getMemberRecord(teamId, userId);
    return m?.role === "team_member";
  } catch {
    return false;
  }
}
