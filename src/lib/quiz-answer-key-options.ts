import type { PerCardSnapshot } from "@/db/schema";
import type { CardQuizVariants } from "@/lib/card-quiz-variants";
import { resolveCardMcqContext } from "@/lib/card-mcq-context";
import {
  normalizeQuizText,
  trueFalseOptionText,
  type QuizCardInput,
  type QuizQuestionType,
} from "@/lib/quiz-questions";

export type AnswerKeyMcqBreakdown = {
  correctOptions: string[];
  falseOptions: string[];
};

function hasStoredChoices(card: QuizCardInput): boolean {
  return (
    Array.isArray(card.choices) &&
    card.choices.length >= 2 &&
    card.correctChoiceIndex !== null &&
    card.correctChoiceIndex !== undefined &&
    card.correctChoiceIndex >= 0 &&
    card.correctChoiceIndex < card.choices.length
  );
}

function cardWithMcqSnapshot(card: QuizCardInput): QuizCardInput {
  const snap = card.quizVariants?.sourceMcq;
  if (!snap || hasStoredChoices(card)) return card;
  return {
    ...card,
    choices: snap.choices,
    correctChoiceIndex: snap.correctChoiceIndex,
  };
}

function splitMcqByFactualCorrect(card: QuizCardInput | undefined): AnswerKeyMcqBreakdown {
  if (!card) return { correctOptions: [], falseOptions: [] };

  const resolved = cardWithMcqSnapshot(card);
  const mcq = resolveCardMcqContext(resolved);
  if (!mcq || mcq.choices.length === 0) {
    return { correctOptions: [], falseOptions: [] };
  }

  const factualNorm = normalizeQuizText(mcq.correct);
  const correctOptions: string[] = [];
  const falseOptions: string[] = [];

  for (const choice of mcq.choices) {
    const trimmed = choice.trim();
    if (!trimmed) continue;
    if (normalizeQuizText(trimmed) === factualNorm) {
      correctOptions.push(trimmed);
    } else {
      falseOptions.push(trimmed);
    }
  }

  return { correctOptions, falseOptions };
}

function resolveMultipleChoiceFalseAnswers(
  snapshot: PerCardSnapshot,
  card: QuizCardInput | undefined,
  allCards: QuizCardInput[],
): string[] {
  const correctNorm = normalizeQuizText(snapshot.correctAnswer);

  const resolved = card ? cardWithMcqSnapshot(card) : undefined;
  if (resolved && hasStoredChoices(resolved)) {
    return (resolved.choices as string[])
      .map((choice) => choice.trim())
      .filter((choice) => choice && normalizeQuizText(choice) !== correctNorm);
  }

  if (card) {
    const backs = allCards
      .map((entry) => (entry.back ?? "").trim())
      .filter(Boolean);
    return Array.from(
      new Set(
        backs.filter((back) => normalizeQuizText(back) !== correctNorm),
      ),
    );
  }

  return [];
}

function resolveTrueFalseAnswerKeyOptions(
  snapshot: PerCardSnapshot,
  card: QuizCardInput | undefined,
): AnswerKeyMcqBreakdown {
  const fromMcq = splitMcqByFactualCorrect(card);
  if (fromMcq.correctOptions.length > 0 || fromMcq.falseOptions.length > 0) {
    return fromMcq;
  }

  const correctNorm = normalizeQuizText(snapshot.correctAnswer);
  const correctIsTrue = correctNorm === normalizeQuizText("True");
  const correctIsFalse = correctNorm === normalizeQuizText("False");

  if (correctIsTrue) {
    return { correctOptions: [], falseOptions: [trueFalseOptionText(false)] };
  }
  if (correctIsFalse) {
    return { correctOptions: [], falseOptions: [trueFalseOptionText(true)] };
  }
  return { correctOptions: [], falseOptions: [] };
}

export function resolveQuizAnswerKeyOptions(
  snapshot: PerCardSnapshot,
  card: QuizCardInput | undefined,
  allCards: QuizCardInput[],
): AnswerKeyMcqBreakdown {
  const questionType = (snapshot.questionType ?? "multiple_choice") as QuizQuestionType;

  if (questionType === "true_false") {
    return resolveTrueFalseAnswerKeyOptions(snapshot, card);
  }

  if (questionType === "fill_in_blank") {
    return splitMcqByFactualCorrect(card);
  }

  return {
    correctOptions: [],
    falseOptions: resolveMultipleChoiceFalseAnswers(snapshot, card, allCards),
  };
}

/** @deprecated Use buildAnswerKeyOptionsByCardId */
export function buildFalseAnswersByCardId(
  perCard: PerCardSnapshot[],
  deckCards: QuizAnswerKeyDeckCard[],
): Record<number, string[]> {
  const breakdown = buildAnswerKeyOptionsByCardId(perCard, deckCards);
  const out: Record<number, string[]> = {};
  for (const [cardId, options] of Object.entries(breakdown)) {
    out[Number(cardId)] = options.falseOptions;
  }
  return out;
}

export type QuizAnswerKeyDeckCard = {
  id: number;
  front: string | null;
  back: string | null;
  choices?: string[] | null;
  correctChoiceIndex?: number | null;
  choiceImageUrls?: (string | null)[] | null;
  quizVariants?: CardQuizVariants | null;
};

export function buildAnswerKeyOptionsByCardId(
  perCard: PerCardSnapshot[],
  deckCards: QuizAnswerKeyDeckCard[],
): Record<number, AnswerKeyMcqBreakdown> {
  const cardsById = new Map<number, QuizCardInput>(
    deckCards.map((card) => [
      card.id,
      {
        id: card.id,
        front: card.front,
        back: card.back,
        choices: card.choices,
        correctChoiceIndex: card.correctChoiceIndex,
        choiceImageUrls: card.choiceImageUrls,
        quizVariants: card.quizVariants,
      },
    ]),
  );
  const allCards = Array.from(cardsById.values());
  const answerKeyOptionsByCardId: Record<number, AnswerKeyMcqBreakdown> = {};

  for (const snapshot of perCard) {
    answerKeyOptionsByCardId[snapshot.cardId] = resolveQuizAnswerKeyOptions(
      snapshot,
      cardsById.get(snapshot.cardId),
      allCards,
    );
  }

  return answerKeyOptionsByCardId;
}
