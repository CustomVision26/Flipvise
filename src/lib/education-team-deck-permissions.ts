import type { DeckRow } from "@/db/schema";
import { isEducationTeamPlanId } from "@/lib/education-plans";

/** Education Gold/Enterprise co-admins may edit only decks they created. */
export function resolveEducationTeamAdminCanEditDeck(
  deck: Pick<DeckRow, "createdByUserId" | "userId">,
  team: { planSlug: string } | null | undefined,
  viewerUserId: string,
): boolean {
  if (!team || !isEducationTeamPlanId(team.planSlug)) {
    return true;
  }
  return deck.createdByUserId === viewerUserId;
}
