import { getTeamById, getTeamsByOwner } from "@/db/queries/teams";
import { getClerkUserDisplayNameById } from "@/lib/clerk-user-display";
import { isTeamPlanId } from "@/lib/team-plans";

export type TeamDeckHeading = {
  teamName: string;
  ownerDisplayName: string;
};

/** Heading + tier flags: uses `deck.teamId` when set; otherwise falls back to any owned team-tier workspace for the subscriber (`deck.userId`). */
export async function getTeamDeckContext(deck: {
  teamId: number | null;
  userId: string;
}): Promise<{
  heading: TeamDeckHeading | null;
  teamTierPro: boolean;
}> {
  if (deck.teamId != null) {
    const team = await getTeamById(deck.teamId);
    if (!team) return { heading: null, teamTierPro: false };
    const ownerDisplayName = await getClerkUserDisplayNameById(team.ownerUserId);
    return {
      heading: { teamName: team.name, ownerDisplayName },
      teamTierPro: isTeamPlanId(team.planSlug),
    };
  }

  const ownedTeams = await getTeamsByOwner(deck.userId);
  const teamTierPro = ownedTeams.some((t) => isTeamPlanId(t.planSlug));
  return { heading: null, teamTierPro };
}
