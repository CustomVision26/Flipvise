import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { cards, decks, teams } from "@/db/schema";
import { getCardsByDeckUnscoped } from "@/db/queries/cards";
import { getDecksForTeam } from "@/db/queries/teams";
import { parseCardQuizVariants } from "@/lib/card-quiz-variants";
import {
  canReshuffleQuizFormats,
  countCardsReadyForQuizFormats,
  explainQuizFormatReshuffleBlock,
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
  formatReadyCounts: {
    multipleChoice: number;
    trueFalse: number;
    fillInBlank: number;
    total: number;
  };
  quizFormatMultipleChoice: boolean | null;
  quizFormatTrueFalse: boolean | null;
  quizFormatFillInBlank: boolean | null;
  savedDistribution: QuizFormatDistribution | null;
  hasQuizFormatAssignments: boolean;
  quizFormatShuffledAt: string | null;
  aiQuizContentReady: boolean;
  canReshuffleFormats: boolean;
  /** Personal timed-quiz length in minutes; null means auto from card count. */
  quizDurationMinutes: number | null;
};

let warnedMissingDeckQuizDurationColumn = false;
function warnMissingDeckQuizDurationColumnOnce() {
  if (warnedMissingDeckQuizDurationColumn) return;
  warnedMissingDeckQuizDurationColumn = true;
  console.warn(
    "[db] Column decks.quizDurationMinutes is missing. Apply migration 0059_deck_quiz_duration_minutes.sql.",
  );
}

function isMissingDeckQuizDurationColumnError(error: unknown): boolean {
  if (error === null || error === undefined) return false;
  const msg = error instanceof Error ? error.message : String(error);
  return /quizDurationMinutes|quiz_duration_minutes/i.test(msg);
}

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

export function buildQuizFormatsWorkspaceSnapshots(
  teamRows: Array<{
    id: number;
    name: string;
    quizFormatMultipleChoice: boolean;
    quizFormatTrueFalse: boolean;
    quizFormatFillInBlank: boolean;
  }>,
): QuizFormatsWorkspaceSnapshot[] {
  return teamRows
    .map((t) => ({
      id: t.id,
      name: t.name,
      quizFormatMultipleChoice: t.quizFormatMultipleChoice,
      quizFormatTrueFalse: t.quizFormatTrueFalse,
      quizFormatFillInBlank: t.quizFormatFillInBlank,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function listQuizFormatsDecksForWorkspace(
  teamId: number,
  ownerUserId: string,
): Promise<QuizFormatsDeckSnapshot[]> {
  const teamDecks = await getDecksForTeam(teamId, ownerUserId);
  const deckIds = teamDecks.map((d) => d.id);
  if (deckIds.length === 0) return [];

  type DeckFormatRow = {
    id: number;
    name: string;
    quizFormatMultipleChoice: boolean | null;
    quizFormatTrueFalse: boolean | null;
    quizFormatFillInBlank: boolean | null;
    quizFormatAssignments: DeckQuizFormatAssignments | null;
    quizDurationMinutes: number | null;
  };

  let rows: DeckFormatRow[];
  try {
    rows = await db
      .select({
        id: decks.id,
        name: decks.name,
        quizFormatMultipleChoice: decks.quizFormatMultipleChoice,
        quizFormatTrueFalse: decks.quizFormatTrueFalse,
        quizFormatFillInBlank: decks.quizFormatFillInBlank,
        quizFormatAssignments: decks.quizFormatAssignments,
        quizDurationMinutes: decks.quizDurationMinutes,
      })
      .from(decks)
      .where(eq(decks.userId, ownerUserId));
  } catch (e) {
    if (!isMissingDeckQuizDurationColumnError(e)) throw e;
    warnMissingDeckQuizDurationColumnOnce();
    const fallback = await db
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
    rows = fallback.map((r) => ({ ...r, quizDurationMinutes: null }));
  }

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
        formatReadyCounts: counts,
        quizFormatMultipleChoice: r.quizFormatMultipleChoice ?? null,
        quizFormatTrueFalse: r.quizFormatTrueFalse ?? null,
        quizFormatFillInBlank: r.quizFormatFillInBlank ?? null,
        savedDistribution,
        hasQuizFormatAssignments:
          assignments != null && Object.keys(assignments.byCardId).length > 0,
        quizFormatShuffledAt: assignments?.shuffledAt ?? null,
        aiQuizContentReady: deckAiQuizContentReady(
          formats,
          counts,
          savedDistribution,
          deckCards,
        ),
        canReshuffleFormats: canReshuffleQuizFormats(
          formats,
          counts,
          savedDistribution,
          deckCards,
        ),
        quizDurationMinutes: r.quizDurationMinutes ?? null,
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

export async function updateDeckQuizDurationMinutes(
  deckId: number,
  ownerUserId: string,
  durationMinutes: number | null,
): Promise<void> {
  try {
    await db
      .update(decks)
      .set({
        quizDurationMinutes: durationMinutes,
        updatedAt: new Date(),
      })
      .where(and(eq(decks.id, deckId), eq(decks.userId, ownerUserId)));
  } catch (e) {
    if (!isMissingDeckQuizDurationColumnError(e)) throw e;
    warnMissingDeckQuizDurationColumnOnce();
    throw new Error(
      "Database is missing quiz duration support. Apply migration 0059_deck_quiz_duration_minutes.sql.",
    );
  }
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
): Promise<import("@/lib/quiz-format-assignments").DeckQuizFormatAssignments | null> {
  const [row] = await db
    .select({ quizFormatAssignments: decks.quizFormatAssignments })
    .from(decks)
    .where(eq(decks.id, deckId))
    .limit(1);
  const parsed = parseDeckQuizFormatAssignments(row?.quizFormatAssignments);
  if (!parsed || Object.keys(parsed.byCardId).length === 0) return null;
  return parsed;
}

export async function reshuffleDeckQuizFormatAssignments(
  deckId: number,
  ownerUserId: string,
  teamId: number | null,
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
  const reshuffleBlock = explainQuizFormatReshuffleBlock(
    formats,
    counts,
    distribution,
    prepared,
  );
  if (reshuffleBlock) {
    throw new Error(reshuffleBlock);
  }

  const byCardId = reshuffleQuizFormatAssignments(prepared, formats, distribution);
  if (Object.keys(byCardId).length === 0) {
    throw new Error(
      "Could not assign question formats to every card. Regenerate AI content and try again.",
    );
  }
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

/** Single-deck snapshot for personal Pro Plus / Education Plus format configuration. */
export async function getQuizFormatsDeckSnapshotForOwner(
  deckId: number,
  ownerUserId: string,
): Promise<QuizFormatsDeckSnapshot | null> {
  type OwnerDeckRow = {
    id: number;
    name: string;
    userId: string;
    quizFormatMultipleChoice: boolean | null;
    quizFormatTrueFalse: boolean | null;
    quizFormatFillInBlank: boolean | null;
    quizFormatAssignments: DeckQuizFormatAssignments | null;
    quizDurationMinutes: number | null;
    teamId: number | null;
  };

  let row: OwnerDeckRow | undefined;
  try {
    const rows = await db
      .select({
        id: decks.id,
        name: decks.name,
        userId: decks.userId,
        quizFormatMultipleChoice: decks.quizFormatMultipleChoice,
        quizFormatTrueFalse: decks.quizFormatTrueFalse,
        quizFormatFillInBlank: decks.quizFormatFillInBlank,
        quizFormatAssignments: decks.quizFormatAssignments,
        quizDurationMinutes: decks.quizDurationMinutes,
        teamId: decks.teamId,
      })
      .from(decks)
      .where(and(eq(decks.id, deckId), eq(decks.userId, ownerUserId)))
      .limit(1);
    row = rows[0];
  } catch (e) {
    if (!isMissingDeckQuizDurationColumnError(e)) throw e;
    warnMissingDeckQuizDurationColumnOnce();
    const rows = await db
      .select({
        id: decks.id,
        name: decks.name,
        userId: decks.userId,
        quizFormatMultipleChoice: decks.quizFormatMultipleChoice,
        quizFormatTrueFalse: decks.quizFormatTrueFalse,
        quizFormatFillInBlank: decks.quizFormatFillInBlank,
        quizFormatAssignments: decks.quizFormatAssignments,
        teamId: decks.teamId,
      })
      .from(decks)
      .where(and(eq(decks.id, deckId), eq(decks.userId, ownerUserId)))
      .limit(1);
    row = rows[0] ? { ...rows[0], quizDurationMinutes: null } : undefined;
  }

  if (!row) return null;

  let teamRow = null;
  if (row.teamId != null) {
    const [team] = await db
      .select({
        quizFormatMultipleChoice: teams.quizFormatMultipleChoice,
        quizFormatTrueFalse: teams.quizFormatTrueFalse,
        quizFormatFillInBlank: teams.quizFormatFillInBlank,
      })
      .from(teams)
      .where(eq(teams.id, row.teamId))
      .limit(1);
    teamRow = team ?? null;
  }

  const formats = resolveQuizFormats(teamRow, row);
  const cardRows = await getCardsByDeckUnscoped(deckId);
  const deckCards: QuizCardInput[] = cardRows.map((c) => ({
    id: c.id,
    front: c.front,
    back: c.back,
    choices: c.choices,
    correctChoiceIndex: c.correctChoiceIndex,
    quizVariants: parseCardQuizVariants(c.quizVariants),
  }));
  const counts = countCardsReadyForQuizFormats(deckCards, formats);
  const assignments = parseDeckQuizFormatAssignments(row.quizFormatAssignments);
  const savedDistribution = assignments?.distribution ?? null;

  return {
    id: row.id,
    name: row.name,
    eligibleCardCount: counts.total,
    formatReadyCounts: counts,
    quizFormatMultipleChoice: row.quizFormatMultipleChoice ?? null,
    quizFormatTrueFalse: row.quizFormatTrueFalse ?? null,
    quizFormatFillInBlank: row.quizFormatFillInBlank ?? null,
    savedDistribution,
    hasQuizFormatAssignments:
      assignments != null && Object.keys(assignments.byCardId).length > 0,
    quizFormatShuffledAt: assignments?.shuffledAt ?? null,
    aiQuizContentReady: deckAiQuizContentReady(
      formats,
      counts,
      savedDistribution,
      deckCards,
    ),
    canReshuffleFormats: canReshuffleQuizFormats(
      formats,
      counts,
      savedDistribution,
      deckCards,
    ),
    quizDurationMinutes: row.quizDurationMinutes ?? null,
  };
}
