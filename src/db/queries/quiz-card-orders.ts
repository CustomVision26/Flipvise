import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { cards, decks, quizCardOrders, teamDeckAssignments, teamMembers, teams } from "@/db/schema";
import { getDecksForTeam, getTeamById } from "@/db/queries/teams";
import {
  buildUniqueQuizCardOrders,
  parseQuizCardOrder,
} from "@/lib/quiz-card-order";

export type QuizCardOrderStudyContext = {
  cardIds: number[];
  shuffledAt: string;
  deckShuffledAt: string | null;
};

async function listEligibleCardIdsForDeck(deckId: number): Promise<number[]> {
  const rows = await db
    .select({ id: cards.id, front: cards.front, back: cards.back })
    .from(cards)
    .where(eq(cards.deckId, deckId));
  return rows
    .filter((r) => Boolean(r.front?.trim()) && Boolean(r.back?.trim()))
    .map((r) => r.id)
    .sort((a, b) => a - b);
}

async function listQuizCardOrderViewerIds(
  teamId: number,
  deckId: number,
  ownerUserId: string,
): Promise<string[]> {
  const [assignments, members] = await Promise.all([
    db
      .select({ memberUserId: teamDeckAssignments.memberUserId })
      .from(teamDeckAssignments)
      .where(
        and(eq(teamDeckAssignments.teamId, teamId), eq(teamDeckAssignments.deckId, deckId)),
      ),
    db
      .select({ userId: teamMembers.userId, role: teamMembers.role })
      .from(teamMembers)
      .where(eq(teamMembers.teamId, teamId)),
  ]);

  const viewers = new Set<string>([ownerUserId]);
  for (const row of assignments) viewers.add(row.memberUserId);
  for (const row of members) {
    if (row.role === "team_admin" || row.role === "team_member") {
      viewers.add(row.userId);
    }
  }
  return [...viewers];
}

export async function getDeckQuizCardOrderShuffledAt(
  deckId: number,
): Promise<Date | null> {
  const [row] = await db
    .select({ quizCardOrderShuffledAt: decks.quizCardOrderShuffledAt })
    .from(decks)
    .where(eq(decks.id, deckId));
  return row?.quizCardOrderShuffledAt ?? null;
}

export async function getQuizCardOrderForViewer(
  teamId: number,
  deckId: number,
  viewerUserId: string,
): Promise<QuizCardOrderStudyContext | null> {
  const [deckRow] = await db
    .select({ quizCardOrderShuffledAt: decks.quizCardOrderShuffledAt })
    .from(decks)
    .where(eq(decks.id, deckId));
  if (!deckRow?.quizCardOrderShuffledAt) return null;

  const [orderRow] = await db
    .select({
      cardIds: quizCardOrders.cardIds,
      shuffledAt: quizCardOrders.shuffledAt,
    })
    .from(quizCardOrders)
    .where(
      and(
        eq(quizCardOrders.teamId, teamId),
        eq(quizCardOrders.deckId, deckId),
        eq(quizCardOrders.viewerUserId, viewerUserId),
      ),
    )
    .limit(1);

  const cardIds = parseQuizCardOrder(orderRow?.cardIds);
  if (!cardIds || !orderRow) {
    return {
      cardIds: [],
      shuffledAt: deckRow.quizCardOrderShuffledAt.toISOString(),
      deckShuffledAt: deckRow.quizCardOrderShuffledAt.toISOString(),
    };
  }

  return {
    cardIds,
    shuffledAt: orderRow.shuffledAt.toISOString(),
    deckShuffledAt: deckRow.quizCardOrderShuffledAt.toISOString(),
  };
}

export async function shuffleQuizCardOrdersForDeck(
  teamId: number,
  deckId: number,
  ownerUserId: string,
): Promise<{ shuffledAt: string; viewerCount: number }> {
  const team = await getTeamById(teamId);
  if (!team || team.ownerUserId !== ownerUserId) {
    throw new Error("Workspace not found.");
  }

  const teamDecks = await getDecksForTeam(teamId, ownerUserId);
  if (!teamDecks.some((d) => d.id === deckId)) {
    throw new Error("Deck is not part of this workspace.");
  }

  const cardIds = await listEligibleCardIdsForDeck(deckId);
  if (cardIds.length === 0) {
    throw new Error("This deck has no eligible quiz cards to shuffle.");
  }

  const viewerIds = await listQuizCardOrderViewerIds(teamId, deckId, ownerUserId);
  const orders = buildUniqueQuizCardOrders(viewerIds, cardIds);
  const shuffledAt = new Date();

  await db
    .delete(quizCardOrders)
    .where(and(eq(quizCardOrders.teamId, teamId), eq(quizCardOrders.deckId, deckId)));

  const values = [...orders.entries()].map(([viewerUserId, order]) => ({
    teamId,
    deckId,
    viewerUserId,
    cardIds: order,
    shuffledAt,
    updatedAt: shuffledAt,
  }));
  if (values.length > 0) {
    await db.insert(quizCardOrders).values(values);
  }

  await db
    .update(decks)
    .set({
      quizCardOrderShuffledAt: shuffledAt,
      updatedAt: shuffledAt,
    })
    .where(and(eq(decks.id, deckId), eq(decks.userId, ownerUserId)));

  return { shuffledAt: shuffledAt.toISOString(), viewerCount: values.length };
}

export async function shuffleQuizCardOrdersForWorkspace(
  teamId: number,
  ownerUserId: string,
): Promise<{ deckCount: number; viewerCount: number; shuffledAt: string }> {
  const teamDecks = await getDecksForTeam(teamId, ownerUserId);
  if (teamDecks.length === 0) {
    throw new Error("No decks linked to this workspace.");
  }

  let viewerCount = 0;
  let shuffledAt = new Date().toISOString();
  let deckCount = 0;

  for (const deck of teamDecks) {
    try {
      const result = await shuffleQuizCardOrdersForDeck(teamId, deck.id, ownerUserId);
      viewerCount += result.viewerCount;
      shuffledAt = result.shuffledAt;
      deckCount += 1;
    } catch (e) {
      // Skip decks with no cards / no assignees; continue others.
      if (e instanceof Error && /no eligible quiz cards|No members are assigned/i.test(e.message)) {
        continue;
      }
      throw e;
    }
  }

  if (deckCount === 0) {
    throw new Error(
      "Could not shuffle any deck. Link decks, add cards, and assign members first.",
    );
  }

  return { deckCount, viewerCount, shuffledAt };
}

export async function listDeckQuizCardOrderShuffleSnapshots(
  teamId: number,
  deckIds: number[],
): Promise<Record<number, { shuffledAt: string | null; viewerCount: number }>> {
  if (deckIds.length === 0) return {};

  const deckRows = await db
    .select({
      id: decks.id,
      quizCardOrderShuffledAt: decks.quizCardOrderShuffledAt,
    })
    .from(decks)
    .where(inArray(decks.id, deckIds));

  const orderRows = await db
    .select({
      deckId: quizCardOrders.deckId,
      viewerUserId: quizCardOrders.viewerUserId,
    })
    .from(quizCardOrders)
    .where(
      and(eq(quizCardOrders.teamId, teamId), inArray(quizCardOrders.deckId, deckIds)),
    );

  const countByDeck = new Map<number, number>();
  for (const row of orderRows) {
    countByDeck.set(row.deckId, (countByDeck.get(row.deckId) ?? 0) + 1);
  }

  const out: Record<number, { shuffledAt: string | null; viewerCount: number }> = {};
  for (const deck of deckRows) {
    out[deck.id] = {
      shuffledAt: deck.quizCardOrderShuffledAt?.toISOString() ?? null,
      viewerCount: countByDeck.get(deck.id) ?? 0,
    };
  }
  return out;
}
