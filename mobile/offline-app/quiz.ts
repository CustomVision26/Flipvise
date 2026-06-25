import type { OfflineCardRow } from "../../src/lib/offline/schema";

/** A single offline quiz question derived from a local card. */
export interface QuizQuestion {
  /** Local id of the source card. */
  cardLocalId: string;
  /** Server id when known (used for the result snapshot). */
  cardServerId: number | null;
  question: string;
  questionImageUrl: string | null;
  options: string[];
  correctIndex: number;
}

function shuffle<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function text(value: string | null | undefined): string {
  return (value ?? "").trim();
}

/**
 * Builds multiple-choice questions from a deck's local cards, fully offline.
 *
 * - multiple_choice cards use their stored choices + correct index.
 * - standard cards use the back as the answer and borrow distractors from other cards'
 *   backs (deduped). Cards that can't form at least 2 options are skipped.
 *
 * Returns an empty array when the deck can't produce a usable quiz.
 */
export function buildQuizQuestions(cards: OfflineCardRow[]): QuizQuestion[] {
  // Pool of candidate distractor answers (non-empty card backs).
  const answerPool = Array.from(
    new Set(cards.map((c) => text(c.back)).filter((t) => t.length > 0)),
  );

  const questions: QuizQuestion[] = [];

  for (const card of cards) {
    const question = text(card.front);

    // Stored multiple-choice card.
    if (card.card_type === "multiple_choice" && card.choices_json) {
      let choices: string[] = [];
      try {
        choices = (JSON.parse(card.choices_json) as string[]).filter(
          (o) => text(o).length > 0,
        );
      } catch {
        choices = [];
      }
      const correct =
        card.correct_choice_index != null ? choices[card.correct_choice_index] : undefined;
      if (choices.length >= 2 && correct != null && (question.length > 0 || card.front_image_url)) {
        const shuffled = shuffle(choices);
        questions.push({
          cardLocalId: card.local_id,
          cardServerId: card.server_id,
          question: question || "(image question)",
          questionImageUrl: card.front_image_url,
          options: shuffled,
          correctIndex: shuffled.indexOf(correct),
        });
        continue;
      }
    }

    // Standard Q&A card → generate distractors.
    const answer = text(card.back);
    if ((question.length === 0 && !card.front_image_url) || answer.length === 0) continue;

    const distractors = shuffle(
      answerPool.filter((a) => a !== answer),
    ).slice(0, 3);
    if (distractors.length === 0) continue; // need at least one wrong option

    const options = shuffle([answer, ...distractors]);
    questions.push({
      cardLocalId: card.local_id,
      cardServerId: card.server_id,
      question: question || "(image question)",
      questionImageUrl: card.front_image_url,
      options,
      correctIndex: options.indexOf(answer),
    });
  }

  return shuffle(questions);
}
