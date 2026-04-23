import { getTeamById } from "@/db/queries/teams";
import { getClerkUserDisplayNameById } from "@/lib/clerk-user-display";
import { isTeamPlanId } from "@/lib/team-plans";

export type TeamDeckHeading = {
  teamName: string;
  ownerDisplayName: string;
};

/** Single team fetch for deck/study pages: heading copy + whether team tier grants Pro card limits. */
export async function getTeamDeckContext(deck: { teamId: number | null }): Promise<{
  heading: TeamDeckHeading | null;
  teamTierPro: boolean;
}> {
  if (deck.teamId == null) return { heading: null, teamTierPro: false };
  const team = await getTeamById(deck.teamId);
  if (!team) return { heading: null, teamTierPro: false };
  const ownerDisplayName = await getClerkUserDisplayNameById(team.ownerUserId);
  return {
    heading: { teamName: team.name, ownerDisplayName },
    teamTierPro: isTeamPlanId(team.planSlug),
  };
}
