import type { ClerkClient } from "@clerk/backend";
import { getTeamById, getTeamMembershipsForUser } from "@/db/queries/teams";
import type { TeamMemberRole } from "@/db/queries/teams";
import { isTeamPlanId } from "@/lib/team-plans";

/** Clerk `publicMetadata` key — team-tier workspaces where this platform admin is a member (invite-only). */
export const TEAM_TIER_INVITED_MEMBERSHIPS_META_KEY = "teamTierInvitedMemberships" as const;

export type TeamTierInvitedMembershipMeta = {
  teamId: number;
  /** Matches `team_members.role`: co-manage vs member-only. */
  role: TeamMemberRole;
};

/**
 * Keeps `teamTierInvitedMemberships` aligned with DB for platform admins (`role === "admin"` or `"superadmin"`).
 * Only team-tier subscriber workspaces (`planSlug` is a known team plan) are listed.
 */
export async function syncPlatformAdminTeamTierInvitedMetadata(
  clerkClient: ClerkClient,
  userId: string,
): Promise<void> {
  const user = await clerkClient.users.getUser(userId);
  const role = (user.publicMetadata as { role?: string })?.role;
  if (role !== "admin" && role !== "superadmin") return;

  const memberships = await getTeamMembershipsForUser(userId);
  const out: TeamTierInvitedMembershipMeta[] = [];

  for (const m of memberships) {
    const team = await getTeamById(m.teamId);
    if (team && isTeamPlanId(team.planSlug)) {
      out.push({ teamId: m.teamId, role: m.role });
    }
  }

  const prev = { ...(user.publicMetadata as Record<string, unknown>) };
  if (out.length > 0) {
    prev[TEAM_TIER_INVITED_MEMBERSHIPS_META_KEY] = out;
  } else {
    delete prev[TEAM_TIER_INVITED_MEMBERSHIPS_META_KEY];
  }

  await clerkClient.users.updateUserMetadata(userId, {
    publicMetadata: prev,
  });
}
