"use server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getDeckById } from "@/db/queries/decks";
import { getCardsByDeck } from "@/db/queries/cards";
import {
  pickQuoteForPercent,
  type QuizQuote,
  type QuizTier,
} from "@/lib/quiz-quotes";

const quizAnswerSchema = z.object({
  cardId: z.number().int().positive(),
  /**
   * The exact text of the option the user picked. Null means the question was
   * left unanswered (either skipped or timer ran out before the user got to it).
   */
  selectedText: z.string().nullable(),
});

const submitQuizResultSchema = z.object({
  deckId: z.number().int().positive(),
  answers: z.array(quizAnswerSchema).min(1),
  /** Seconds elapsed on the timer. Informational — surfaced back in the result. */
  elapsedSeconds: z.number().int().min(0).optional(),
  /** True when the server-side submission was triggered by the client timer hitting zero. */
  timedOut: z.boolean().optional(),
});

type SubmitQuizResultInput = z.infer<typeof submitQuizResultSchema>;

export type QuizResult = {
  correct: number;
  incorrect: number;
  unanswered: number;
  total: number;
  percent: number;
  tier: QuizTier;
  quote: QuizQuote;
  elapsedSeconds: number;
  timedOut: boolean;
  perCard: {
    cardId: number;
    correct: boolean;
    answered: boolean;
    correctText: string;
  }[];
};

/**
 * Server-side source of truth for what the correct answer to a given card
 * is. For multiple-choice cards we read `choices[correctChoiceIndex]`; for
 * standard cards we fall back to `back`. Whitespace is normalized so client-
 * side rendering/whitespace differences do not cause false negatives.
 */
function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Validates a quiz submission on the server and returns the final score.
 *
 * The client sends the text string the user picked for each card, and the
 * server re-derives the correct text from the database. This means the
 * client cannot lie about correctness even when options were generated or
 * shuffled client-side.
 */
export async function submitQuizResultAction(
  data: SubmitQuizResultInput,
): Promise<QuizResult> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const parsed = submitQuizResultSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const { deckId, answers, elapsedSeconds, timedOut } = parsed.data;

  const deck = await getDeckById(deckId, userId);
  if (!deck) throw new Error("Deck not found");

  const cards = await getCardsByDeck(deckId, userId);
  const cardMap = new Map(cards.map((c) => [c.id, c]));

  let correct = 0;
  let unanswered = 0;
  let total = 0;
  const perCard: QuizResult["perCard"] = [];

  for (const answer of answers) {
    const card = cardMap.get(answer.cardId);
    if (!card) continue;
    total++;

    // Must match the client-side check in `quiz-study.tsx#buildQuestions`
    // exactly, otherwise a card with borderline `choices` could be treated
    // as multiple-choice by one side and free-response by the other, which
    // would silently mis-score the user.
    const hasStoredChoices =
      Array.isArray(card.choices) &&
      card.choices.length >= 2 &&
      card.correctChoiceIndex !== null &&
      card.correctChoiceIndex !== undefined &&
      card.correctChoiceIndex >= 0 &&
      card.correctChoiceIndex < card.choices.length;

    const correctText = hasStoredChoices
      ? (card.choices as string[])[card.correctChoiceIndex as number] ?? ""
      : card.back ?? "";

    const isAnswered = answer.selectedText !== null;
    let wasCorrect = false;

    if (isAnswered && correctText) {
      wasCorrect = normalize(answer.selectedText as string) === normalize(correctText);
    }

    if (!isAnswered) unanswered++;
    if (wasCorrect) correct++;

    perCard.push({
      cardId: card.id,
      correct: wasCorrect,
      answered: isAnswered,
      correctText,
    });
  }

  const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
  const seed = correct * 31 + deckId + total;
  const { tier, ...quote } = pickQuoteForPercent(percent, seed);

  return {
    correct,
    incorrect: total - correct - unanswered,
    unanswered,
    total,
    percent,
    tier,
    quote,
    elapsedSeconds: elapsedSeconds ?? 0,
    timedOut: timedOut ?? false,
    perCard,
  };
}
