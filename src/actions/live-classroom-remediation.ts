"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import { Output } from "ai";
import { auth } from "@/lib/clerk-auth";
import { getAccessContext } from "@/lib/access";
import {
  runWithAiUsageContext,
  trackedGenerateText,
} from "@/lib/ai-usage/track";
import {
  getLiveBattleReportBySession,
  getLiveClassroomSessionById,
} from "@/db/queries/live-classroom";
import { getDeckRowById } from "@/db/queries/decks";
import { bulkCreateCards, getCardsByDeckUnscoped } from "@/db/queries/cards";
import { resolveLiveClassroomOrgRole } from "@/lib/live-classroom-access";
import { deckHasTeamTierProFeatures } from "@/lib/team-deck-pro-features";
import {
  canUseDeckAiFeatures,
  DECK_AI_PLAN_REQUIREMENT,
} from "@/lib/deck-ai-access";
import { AI_GENERATION_CAP_PER_DECK, resolveDeckCardCap } from "@/lib/deck-limits";
import type { DeckRow } from "@/db/schema";

/** Owner-only — the workspace owner is the only role that may grow the shared deck. */
async function requireLiveClassroomOwner(sessionId: number) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const session = await getLiveClassroomSessionById(sessionId);
  if (!session) throw new Error("Session not found");

  const role = await resolveLiveClassroomOrgRole({
    teamId: session.teamId,
    userId,
  });
  if (role !== "subscription_owner") {
    throw new Error("Only the workspace owner can build a remediation deck.");
  }

  return { userId, session };
}

async function deckCapacityFor(deck: Pick<DeckRow, "teamId" | "userId">) {
  const access = await getAccessContext();
  const teamTierPro = await deckHasTeamTierProFeatures(deck);
  const deckCardLimit = resolveDeckCardCap({
    teamTierProWorkspace: teamTierPro,
    personalMaxCardsPerDeck: access.maxCardsPerDeck,
  });
  return { access, teamTierPro, deckCardLimit };
}

export type LiveClassroomRemediationQuestion = {
  front: string;
  back: string;
  distractors: [string, string, string];
};

const REMEDIATION_QUESTION_COUNT = 10;

export type LiveClassroomRemediationSuggestions = {
  deckId: number;
  deckName: string;
  existingCount: number;
  deckCardLimit: number;
  remainingDeckSlots: number;
  questions: LiveClassroomRemediationQuestion[];
};

/**
 * Owner-only. Suggests up to 10 new MCQ flashcards targeting the battle's
 * weakest topic / most-missed question. Nothing is written to the deck yet —
 * the caller checks which suggestions to keep, then calls
 * {@link addLiveClassroomRemediationCardsToDeckAction}.
 */
export async function generateLiveClassroomRemediationQuestionsAction(
  sessionId: number,
): Promise<LiveClassroomRemediationSuggestions> {
  const parsedId = z.number().int().positive().safeParse(sessionId);
  if (!parsedId.success) throw new Error("Invalid session");

  const { userId, session } = await requireLiveClassroomOwner(parsedId.data);
  if (session.deckId == null) {
    throw new Error(
      "This session has no deck attached — pick a deck when starting a session to enable remediation decks.",
    );
  }

  const [deck, report, existingCards] = await Promise.all([
    getDeckRowById(session.deckId),
    getLiveBattleReportBySession(parsedId.data),
    getCardsByDeckUnscoped(session.deckId),
  ]);
  if (!deck) throw new Error("Deck not found.");
  if (!report) throw new Error("This battle doesn't have a report yet.");

  const { access, teamTierPro, deckCardLimit } = await deckCapacityFor(deck);
  if (!canUseDeckAiFeatures(access, teamTierPro)) {
    throw new Error(DECK_AI_PLAN_REQUIREMENT);
  }

  const remainingDeckSlots = Math.max(0, deckCardLimit - existingCards.length);
  if (remainingDeckSlots <= 0) {
    throw new Error(
      `"${deck.name}" is already at its ${deckCardLimit}-card plan limit — delete cards to make room before adding a remediation set.`,
    );
  }

  const targetCount = Math.min(REMEDIATION_QUESTION_COUNT, remainingDeckSlots);
  const { stats } = report;
  const sampleCards = existingCards
    .slice(0, 8)
    .map((c) => `- ${c.front} => ${c.back}`)
    .join("\n");

  const questions = await runWithAiUsageContext(
    {
      userId,
      feature: "flashcards",
      teamId: deck.teamId ?? null,
      subscriptionPlan: access.effectivePlanSlug,
      isPlatformAdmin: access.isAdmin || access.isSuperadmin,
    },
    async () => {
      const { output } = await trackedGenerateText({
        model: openai("gpt-4o"),
        output: Output.object({
          schema: z.object({
            cards: z.array(
              z.object({
                front: z.string(),
                back: z.string(),
                distractors: z.array(z.string().min(1)).length(3),
              }),
            ),
          }),
        }),
        system: `You are a remediation-deck assistant reviewing a Live Classroom battle report for a teacher. Generate multiple-choice flashcards that directly reteach the class's weakest area from the battle. Match the tone, length, and format of the deck's existing cards. For each card, also produce exactly 3 plausible-but-incorrect distractors, similar in length/tone to the correct answer. Never use markdown formatting (no **, *, #, backticks) and never duplicate the existing cards shown.`,
        prompt: `Deck: ${deck.name}${deck.description ? ` — ${deck.description}` : ""}
Sample existing cards (match this style, do not duplicate):
${sampleCards || "(deck is currently empty)"}

Battle report context to target for remediation:
Weakest topic: ${stats.weakestTopic ?? "n/a"}
Most missed question: ${stats.mostMissedQuestion ?? "n/a"}
Teacher recommendations: ${stats.recommendations.join(" | ") || "n/a"}

Generate exactly ${targetCount} new multiple-choice flashcards that reteach and reinforce the weakest topic / most missed question above, so the class can review before the next lesson.`,
      });

      return output.cards.slice(0, targetCount).map((c) => ({
        front: c.front.trim(),
        back: c.back.trim(),
        distractors: [
          c.distractors[0]!.trim(),
          c.distractors[1]!.trim(),
          c.distractors[2]!.trim(),
        ] as [string, string, string],
      }));
    },
  );

  if (questions.length === 0) {
    throw new Error("The model did not return any questions. Please try again.");
  }

  return {
    deckId: deck.id,
    deckName: deck.name,
    existingCount: existingCards.length,
    deckCardLimit,
    remainingDeckSlots,
    questions,
  };
}

const addRemediationCardsSchema = z.object({
  sessionId: z.number().int().positive(),
  deckId: z.number().int().positive(),
  cards: z
    .array(
      z.object({
        front: z.string().trim().min(1),
        back: z.string().trim().min(1),
        distractors: z.array(z.string().trim().min(1)).length(3),
      }),
    )
    .min(1)
    .max(REMEDIATION_QUESTION_COUNT),
});

/** Owner-only. Inserts the checked suggestions, enforcing the deck's plan card cap. */
export async function addLiveClassroomRemediationCardsToDeckAction(raw: {
  sessionId: number;
  deckId: number;
  cards: LiveClassroomRemediationQuestion[];
}): Promise<{ added: number }> {
  const parsed = addRemediationCardsSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Invalid input");

  const { session } = await requireLiveClassroomOwner(parsed.data.sessionId);
  if (session.deckId !== parsed.data.deckId) {
    throw new Error("Deck does not match this session.");
  }

  const deck = await getDeckRowById(parsed.data.deckId);
  if (!deck) throw new Error("Deck not found.");

  const existingCards = await getCardsByDeckUnscoped(deck.id);
  const { deckCardLimit } = await deckCapacityFor(deck);
  const remainingDeckSlots = Math.max(0, deckCardLimit - existingCards.length);

  if (parsed.data.cards.length > remainingDeckSlots) {
    throw new Error(
      `Not enough room in "${deck.name}" (${remainingDeckSlots} card slot${
        remainingDeckSlots !== 1 ? "s" : ""
      } left; max ${deckCardLimit} per deck).`,
    );
  }

  const aiGeneratedSoFar = existingCards.filter((c) => c.aiGenerated).length;
  if (aiGeneratedSoFar + parsed.data.cards.length > AI_GENERATION_CAP_PER_DECK) {
    throw new Error(
      `This deck can receive at most ${AI_GENERATION_CAP_PER_DECK} AI-generated cards.`,
    );
  }

  await bulkCreateCards(deck.id, parsed.data.cards, true);

  revalidatePath(`/decks/${deck.id}`);
  revalidatePath(`/dashboard/live-classroom/reports/${parsed.data.sessionId}`);

  return { added: parsed.data.cards.length };
}
