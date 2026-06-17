import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { decks, teams } from "@/db/schema";
import { getDecksForTeam } from "@/db/queries/teams";
import { resolveQuizFormats, type QuizFormatsSettings } from "@/lib/quiz-formats";

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
  quizFormatMultipleChoice: boolean | null;
  quizFormatTrueFalse: boolean | null;
  quizFormatFillInBlank: boolean | null;
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
    })
    .from(decks)
    .where(eq(decks.userId, ownerUserId));

  const idSet = new Set(deckIds);
  return rows
    .filter((r) => idSet.has(r.id))
    .map((r) => ({
      id: r.id,
      name: r.name,
      quizFormatMultipleChoice: r.quizFormatMultipleChoice ?? null,
      quizFormatTrueFalse: r.quizFormatTrueFalse ?? null,
      quizFormatFillInBlank: r.quizFormatFillInBlank ?? null,
    }))
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
      updatedAt: new Date(),
    })
    .where(and(eq(decks.id, deckId), eq(decks.userId, ownerUserId)));
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
