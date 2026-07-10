import { getTeamById, getTeamsByOwner } from "@/db/queries/teams";
import { isEducationTeamPlanId } from "@/lib/education-plans";
import { isTeamPlanId } from "@/lib/team-plans";

function workspacePlanGrantsDeckAi(planSlug: string): boolean {
  return isTeamPlanId(planSlug) || isEducationTeamPlanId(planSlug);
}

/**
 * Decks under a subscriber team workspace (consumer team tier or Education Gold / Enterprise)
 * get Pro-level AI for that deck — including for invited editors without a personal AI plan.
 */
export async function deckHasTeamTierProFeatures(deck: {
  teamId: number | null;
  userId: string;
}): Promise<boolean> {
  if (deck.teamId != null) {
    const team = await getTeamById(deck.teamId);
    return team != null && workspacePlanGrantsDeckAi(team.planSlug);
  }
  const owned = await getTeamsByOwner(deck.userId);
  return owned.some((t) => workspacePlanGrantsDeckAi(t.planSlug));
}
