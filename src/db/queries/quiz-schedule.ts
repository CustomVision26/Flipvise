import { db } from "@/db";
import { decks, teams } from "@/db/schema";
import {
  resolveQuizStartSchedule,
  type QuizStartScheduleFields,
} from "@/lib/quiz-start-schedule";
import { and, eq } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { getDecksForTeam } from "@/db/queries/teams";

export type QuizScheduleWorkspaceSnapshot = {
  id: number;
  name: string;
  quizStartScheduleEnabled: boolean;
  quizStartAt: string | null;
};

export type QuizScheduleDeckSnapshot = {
  id: number;
  name: string;
  quizStartScheduleEnabled: boolean;
  quizStartAt: string | null;
};

export type QuizScheduleStudyContext = {
  enabled: boolean;
  startAtIso: string;
  source: "deck" | "workspace";
};

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function scheduleFields(
  row: QuizStartScheduleFields,
): QuizStartScheduleFields {
  return {
    quizStartScheduleEnabled: Boolean(row.quizStartScheduleEnabled),
    quizStartAt: row.quizStartAt ?? null,
  };
}

export async function listQuizScheduleWorkspaceSnapshots(
  manageableTeams: InferSelectModel<typeof teams>[],
): Promise<QuizScheduleWorkspaceSnapshot[]> {
  return manageableTeams
    .map((team) => ({
      id: team.id,
      name: team.name,
      quizStartScheduleEnabled: Boolean(team.quizStartScheduleEnabled),
      quizStartAt: toIso(team.quizStartAt ?? null),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function listQuizScheduleDeckSnapshots(
  teamId: number,
  ownerUserId: string,
): Promise<QuizScheduleDeckSnapshot[]> {
  const teamDecks = await getDecksForTeam(teamId, ownerUserId);
  const deckIds = teamDecks.map((deck) => deck.id);
  if (deckIds.length === 0) return [];

  const rows = await db
    .select({
      id: decks.id,
      name: decks.name,
      quizStartScheduleEnabled: decks.quizStartScheduleEnabled,
      quizStartAt: decks.quizStartAt,
    })
    .from(decks)
    .where(eq(decks.userId, ownerUserId));

  const deckIdSet = new Set(deckIds);
  return rows
    .filter((row) => deckIdSet.has(row.id))
    .map((row) => ({
      id: row.id,
      name: row.name,
      quizStartScheduleEnabled: Boolean(row.quizStartScheduleEnabled),
      quizStartAt: toIso(row.quizStartAt ?? null),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function updateTeamQuizStartSchedule(
  teamId: number,
  enabled: boolean,
  startAt: Date | null,
): Promise<void> {
  await db
    .update(teams)
    .set({
      quizStartScheduleEnabled: enabled,
      quizStartAt: enabled ? startAt : startAt,
    })
    .where(eq(teams.id, teamId));
}

export async function updateDeckQuizStartSchedule(
  deckId: number,
  ownerUserId: string,
  enabled: boolean,
  startAt: Date | null,
): Promise<void> {
  await db
    .update(decks)
    .set({
      quizStartScheduleEnabled: enabled,
      quizStartAt: startAt,
      updatedAt: new Date(),
    })
    .where(and(eq(decks.id, deckId), eq(decks.userId, ownerUserId)));
}

export async function assertDeckInWorkspaceForSchedule(
  teamId: number,
  ownerUserId: string,
  deckId: number,
): Promise<void> {
  const inWorkspace = await isDeckInSubscriberWorkspace(teamId, ownerUserId, deckId);
  if (!inWorkspace) {
    throw new Error("Deck is not part of this workspace.");
  }
}

async function isDeckInSubscriberWorkspace(
  teamId: number,
  ownerUserId: string,
  deckId: number,
): Promise<boolean> {
  const teamDecks = await getDecksForTeam(teamId, ownerUserId);
  return teamDecks.some((deck) => deck.id === deckId);
}

export async function resolveQuizStartScheduleForStudy(
  deckId: number,
  teamId: number,
): Promise<QuizScheduleStudyContext | null> {
  const [deckRow] = await db
    .select({
      quizStartScheduleEnabled: decks.quizStartScheduleEnabled,
      quizStartAt: decks.quizStartAt,
    })
    .from(decks)
    .where(eq(decks.id, deckId));

  const [teamRow] = await db
    .select({
      quizStartScheduleEnabled: teams.quizStartScheduleEnabled,
      quizStartAt: teams.quizStartAt,
    })
    .from(teams)
    .where(eq(teams.id, teamId));

  if (!deckRow || !teamRow) return null;

  const resolved = resolveQuizStartSchedule(
    scheduleFields(deckRow),
    scheduleFields(teamRow),
  );
  if (!resolved) return null;

  return {
    enabled: true,
    startAtIso: resolved.startAt.toISOString(),
    source: resolved.source,
  };
}
