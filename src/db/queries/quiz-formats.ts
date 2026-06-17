import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { cards, decks, teams } from "@/db/schema";
import { getCardsByDeckUnscoped } from "@/db/queries/cards";
import { getDecksForTeam } from "@/db/queries/teams";
import { parseCardQuizVariants } from "@/lib/card-quiz-variants";
import {
  canReshuffleQuizFormats,
  countCardsReadyForQuizFormats,
  deckAiQuizContentReady,
  parseDeckQuizFormatAssignments,
  reshuffleQuizFormatAssignments,
  type DeckQuizFormatAssignments,
  type QuizFormatDistribution,
} from "@/lib/quiz-format-assignments";
import { resolveQuizFormats, type QuizFormatsSettings } from "@/lib/quiz-formats";
import type { QuizCardInput } from "@/lib/quiz-questions";

export type QuizFormatsWorkspaceSnapshot = {
  id: number;
  name: string;
  quizFormatMultipleChoice: boolean;
  quizFormatTrueFalse: boolean;
  quizFormatFillInBlank: boolean;
};

export type QuizFormatsDeckSnapshot = {
  id: number;
  name: string;
  eligibleCardCount: number;
  quizFormatMultipleChoice: boolean | null;
  quizFormatTrueFalse: boolean | null;
  quizFormatFillInBlank: boolean | null;
  savedDistribution: QuizFormatDistribution | null;
  hasQuizFormatAssignments: boolean;
  quizFormatShuffledAt: string | null;
  aiQuizContentReady: boolean;
  canReshuffleFormats: boolean;
};

export async function listQuizFormatsWorkspacesForOwner(
  ownerUserId: string,
): Promise<QuizFormatsWorkspaceSnapshot[]> {
  const rows = await db
    .select({
      id: teams.id,
      name: teams.name,
      quizFormatMultipleChoice: teams.quizFormatMultipleChoice,
      quizFormatTrueFalse: teams.quizFormatTrueFalse,
      quizFormatFillInBlank: teams.quizFormatFillInBlank,
    })
    .from(teams)
    .where(eq(teams.ownerUserId, ownerUserId));

  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export async function listQuizFormatsDecksForWorkspace(
  teamId: number,
  ownerUserId: string,
): Promise<QuizFormatsDeckSnapshot[]> {
  const teamDecks = await getDecksForTeam(teamId, ownerUserId);
  const deckIds = teamDecks.map((d) => d.id);
  if (deckIds.length === 0) return [];

  const rows = await db
    .select({
      id: decks.id,
      name: decks.name,
      quizFormatMultipleChoice: decks.quizFormatMultipleChoice,
      quizFormatTrueFalse: decks.quizFormatTrueFalse,
      quizFormatFillInBlank: decks.quizFormatFillInBlank,
      quizFormatAssignments: decks.quizFormatAssignments,
    })
    .from(decks)
    .where(eq(decks.userId, ownerUserId));

  const idSet = new Set(deckIds);
  const filtered = rows.filter((r) => idSet.has(r.id));

  const cardRows =
    filtered.length === 0
      ? []
      : await db
          .select({
            id: cards.id,
            deckId: cards.deckId,
            front: cards.front,
            back: cards.back,
            choices: cards.choices,
            correctChoiceIndex: cards.correctChoiceIndex,
            quizVariants: cards.quizVariants,
          })
          .from(cards)
          .where(inArray(cards.deckId, filtered.map((d) => d.id)));

  const cardsByDeckId = new Map<number, QuizCardInput[]>();
  for (const row of cardRows) {
    const list = cardsByDeckId.get(row.deckId) ?? [];
    list.push({
      id: row.id,
      front: row.front,
      back: row.back,
      choices: row.choices,
      correctChoiceIndex: row.correctChoiceIndex,
      quizVariants: parseCardQuizVariants(row.quizVariants),
    });
    cardsByDeckId.set(row.deckId, list);
  }

  const teamRow = await db
    .select({
      quizFormatMultipleChoice: teams.quizFormatMultipleChoice,
      quizFormatTrueFalse: teams.quizFormatTrueFalse,
      quizFormatFillInBlank: teams.quizFormatFillInBlank,
    })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1)
    .then((r) => r[0] ?? null);

  return filtered
    .map((r) => {
      const formats = resolveQuizFormats(teamRow, r);
      const deckCards = cardsByDeckId.get(r.id) ?? [];
      const counts = countCardsReadyForQuizFormats(deckCards, formats);
      const assignments = parseDeckQuizFormatAssignments(r.quizFormatAssignments);
      const savedDistribution = assignments?.distribution ?? null;
      return {
        id: r.id,
        name: r.name,
        eligibleCardCount: counts.total,
        quizFormatMultipleChoice: r.quizFormatMultipleChoice ?? null,
        quizFormatTrueFalse: r.quizFormatTrueFalse ?? null,
        quizFormatFillInBlank: r.quizFormatFillInBlank ?? null,
        savedDistribution,
        hasQuizFormatAssignments:
          assignments != null && Object.keys(assignments.byCardId).length > 0,
        quizFormatShuffledAt: assignments?.shuffledAt ?? null,
        aiQuizContentReady: deckAiQuizContentReady(formats, counts, savedDistribution),
        canReshuffleFormats: canReshuffleQuizFormats(
          formats,
          counts,
          savedDistribution,
          deckCards,
        ),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function updateTeamQuizFormats(
  teamId: number,
  ownerUserId: string,
  formats: QuizFormatsSettings,
): Promise<void> {
  await db
    .update(teams)
    .set({
      quizFormatMultipleChoice: formats.multipleChoice,
      quizFormatTrueFalse: formats.trueFalse,
      quizFormatFillInBlank: formats.fillInBlank,
    })
    .where(and(eq(teams.id, teamId), eq(teams.ownerUserId, ownerUserId)));

  const teamDecks = await getDecksForTeam(teamId, ownerUserId);
  await clearDeckQuizFormatAssignmentsForOwner(
    ownerUserId,
    teamDecks.map((d) => d.id),
  );
}

export async function updateDeckQuizFormats(
  deckId: number,
  ownerUserId: string,
  formats: QuizFormatsSettings | null,
): Promise<void> {
  await db
    .update(decks)
    .set({
      quizFormatMultipleChoice: formats?.multipleChoice ?? null,
      quizFormatTrueFalse: formats?.trueFalse ?? null,
      quizFormatFillInBlank: formats?.fillInBlank ?? null,
      quizFormatAssignments: null,
      updatedAt: new Date(),
    })
    .where(and(eq(decks.id, deckId), eq(decks.userId, ownerUserId)));
}

export async function clearDeckQuizFormatAssignmentsForOwner(
  ownerUserId: string,
  deckIds: number[],
): Promise<void> {
  if (deckIds.length === 0) return;
  await db
    .update(decks)
    .set({ quizFormatAssignments: null, updatedAt: new Date() })
    .where(and(eq(decks.userId, ownerUserId), inArray(decks.id, deckIds)));
}

export async function getDeckQuizFormatAssignmentsForStudy(
  deckId: number,
): Promise<Record<number, import("@/lib/quiz-questions").QuizQuestionType> | null> {
  const [row] = await db
    .select({ quizFormatAssignments: decks.quizFormatAssignments })
    .from(decks)
    .where(eq(decks.id, deckId))
    .limit(1);
  const parsed = parseDeckQuizFormatAssignments(row?.quizFormatAssignments);
  return parsed?.byCardId ?? null;
}

export async function reshuffleDeckQuizFormatAssignments(
  deckId: number,
  ownerUserId: string,
  teamId: number,
  distribution: QuizFormatDistribution,
): Promise<DeckQuizFormatAssignments> {
  const formats = await resolveQuizFormatsForStudy(deckId, teamId);
  const cardRows = await getCardsByDeckUnscoped(deckId);
  const prepared: QuizCardInput[] = cardRows.map((c) => ({
    id: c.id,
    front: c.front,
    back: c.back,
    choices: c.choices,
    correctChoiceIndex: c.correctChoiceIndex,
    quizVariants: parseCardQuizVariants(c.quizVariants),
  }));

  const counts = countCardsReadyForQuizFormats(prepared, formats);
  if (!canReshuffleQuizFormats(formats, counts, distribution, prepared)) {
    throw new Error(
      "Set question counts that add up to the deck total, generate AI content where needed, then try again.",
    );
  }

  const byCardId = reshuffleQuizFormatAssignments(prepared, formats, distribution);
  const payload: DeckQuizFormatAssignments = {
    distribution,
    byCardId,
    shuffledAt: new Date().toISOString(),
  };

  await db
    .update(decks)
    .set({ quizFormatAssignments: payload, updatedAt: new Date() })
    .where(and(eq(decks.id, deckId), eq(decks.userId, ownerUserId)));

  return payload;
}

export async function resolveQuizFormatsForStudy(
  deckId: number,
  teamId: number | null,
): Promise<QuizFormatsSettings> {
  const [deckRow] = await db
    .select({
      quizFormatMultipleChoice: decks.quizFormatMultipleChoice,
      quizFormatTrueFalse: decks.quizFormatTrueFalse,
      quizFormatFillInBlank: decks.quizFormatFillInBlank,
      teamId: decks.teamId,
    })
    .from(decks)
    .where(eq(decks.id, deckId))
    .limit(1);

  if (!deckRow) {
    return resolveQuizFormats(null, null);
  }

  const effectiveTeamId = teamId ?? deckRow.teamId;
  let teamRow = null;
  if (effectiveTeamId != null) {
    const [row] = await db
      .select({
        quizFormatMultipleChoice: teams.quizFormatMultipleChoice,
        quizFormatTrueFalse: teams.quizFormatTrueFalse,
        quizFormatFillInBlank: teams.quizFormatFillInBlank,
      })
      .from(teams)
      .where(eq(teams.id, effectiveTeamId))
      .limit(1);
    teamRow = row ?? null;
  }

  return resolveQuizFormats(teamRow, deckRow);
}

export async function assertDeckInWorkspaceForFormats(
  teamId: number,
  ownerUserId: string,
  deckId: number,
): Promise<void> {
  const teamDecks = await getDecksForTeam(teamId, ownerUserId);
  if (!teamDecks.some((deck) => deck.id === deckId)) {
    throw new Error("Deck is not part of this workspace.");
  }
}
