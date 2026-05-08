import { getTeamById, getTeamsByOwner } from "@/db/queries/teams";
import { isTeamPlanId } from "@/lib/team-plans";

/**
 * Decks under a subscriber team (Clerk team-tier plan at team creation) get the same
 * Pro card, AI, and study limits as personal Pro for that deck — including for invited
 * editors who may not carry the team plan on their own Clerk subscription.
 */
export async function deckHasTeamTierProFeatures(deck: {
  teamId: number | null;
  userId: string;
}): Promise<boolean> {
  if (deck.teamId != null) {
    const team = await getTeamById(deck.teamId);
    return team != null && isTeamPlanId(team.planSlug);
  }
  const owned = await getTeamsByOwner(deck.userId);
  return owned.some((t) => isTeamPlanId(t.planSlug));
}
