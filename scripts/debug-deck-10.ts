import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

import { getDeckRowById } from "../src/db/queries/decks";
import { resolveDeckViewerAccess } from "../src/db/queries/teams";
import { db } from "../src/db";
import { teamDeckAssignments, deckWorkspaceLinks, cards } from "../src/db/schema";
import { eq } from "drizzle-orm";

const deckId = 10;

async function main() {
  const deck = await getDeckRowById(deckId);
  console.log("deck", deck);

  const cardCount = await db
    .select()
    .from(cards)
    .where(eq(cards.deckId, deckId));
  console.log("cardCount", cardCount.length);

  const assignments = await db
    .select()
    .from(teamDeckAssignments)
    .where(eq(teamDeckAssignments.deckId, deckId));
  console.log("assignments", assignments);

  const links = await db
    .select()
    .from(deckWorkspaceLinks)
    .where(eq(deckWorkspaceLinks.deckId, deckId));
  console.log("workspaceLinks", links);

  const testUsers = [
    "user_3CaADSF1WpGseVrQRkMH2LSVzuj",
    "user_3CL3VVo19GBtTo00XJvygYddloT",
    "user_3ExPucaLuI84AKQmx4VLm7rSYhy",
    "user_3CY2tvm7kHof7ymwDn9sxwJFW0j",
  ];
  for (const uid of testUsers) {
    const access = await resolveDeckViewerAccess(deckId, uid);
    console.log(uid.slice(-12), { access });
  }
}

main().catch(console.error);
