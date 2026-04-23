import { getDeckRowById } from "@/db/queries/decks";
import {
  resolveDeckViewerAccess,
  type DeckViewerAccess,
} from "@/db/queries/teams";

export type { DeckViewerAccess };

export async function getDeckWithViewerAccess(deckId: number, userId: string) {
  const access = await resolveDeckViewerAccess(deckId, userId);
  if (!access) return null;
  const deck = await getDeckRowById(deckId);
  if (!deck) return null;
  return { deck, access };
}

export function canEditDeckContent(access: DeckViewerAccess): boolean {
  return access.kind === "owner" || access.kind === "team_admin";
}
