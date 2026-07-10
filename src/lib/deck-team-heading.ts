import { getTeamById } from "@/db/queries/teams";
import { deckHasTeamTierProFeatures } from "@/lib/team-deck-pro-features";
import { getClerkUserDisplayNameById } from "@/lib/clerk-user-display";

export type TeamDeckHeading = {
  teamName: string;
  ownerDisplayName: string;
};

/** Heading + tier flags: uses `deck.teamId` when set; otherwise falls back to any owned workspace-tier plan for the subscriber (`deck.userId`). */
export async function getTeamDeckContext(deck: {
  teamId: number | null;
  userId: string;
}): Promise<{
  heading: TeamDeckHeading | null;
  teamTierPro: boolean;
}> {
  const teamTierPro = await deckHasTeamTierProFeatures(deck);

  if (deck.teamId != null) {
    const team = await getTeamById(deck.teamId);
    if (!team) return { heading: null, teamTierPro };
    const ownerDisplayName = await getClerkUserDisplayNameById(team.ownerUserId);
    return {
      heading: { teamName: team.name, ownerDisplayName },
      teamTierPro,
    };
  }

  return { heading: null, teamTierPro };
}
