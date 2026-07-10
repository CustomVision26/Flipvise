import type { CardQuizVariants } from "@/lib/card-quiz-variants";

export type CardMcqContext = {
  choices: string[];
  correctChoiceIndex: number;
  correct: string;
  distractors: string[];
};

type McqSourceCard = {
  back?: string | null;
  choices?: string[] | null;
  correctChoiceIndex?: number | null;
  quizVariants?: CardQuizVariants | null;
};

export function hasStoredMcqChoices(card: McqSourceCard): boolean {
  return (
    Array.isArray(card.choices) &&
    card.choices.length >= 2 &&
    card.correctChoiceIndex !== null &&
    card.correctChoiceIndex !== undefined &&
    card.correctChoiceIndex >= 0 &&
    card.correctChoiceIndex < card.choices.length
  );
}

/** Resolve stored multiple-choice options from the card row or a prior quizVariants snapshot. */
export function resolveCardMcqContext(card: McqSourceCard): CardMcqContext | null {
  if (hasStoredMcqChoices(card)) {
    const choices = (card.choices as string[]).map((c) => c.trim()).filter(Boolean);
    const correctChoiceIndex = card.correctChoiceIndex as number;
    const correct = (choices[correctChoiceIndex] ?? "").trim();
    if (!correct) return null;
    const distractors = choices
      .filter((_, index) => index !== correctChoiceIndex)
      .map((c) => c.trim())
      .filter(Boolean);
    return { choices, correctChoiceIndex, correct, distractors };
  }

  const snap = card.quizVariants?.sourceMcq;
  if (snap && snap.choices.length > 0) {
    const choices = snap.choices.map((c) => c.trim()).filter(Boolean);
    const correctChoiceIndex = Math.min(
      Math.max(0, snap.correctChoiceIndex),
      choices.length - 1,
    );
    const correct = (choices[correctChoiceIndex] ?? "").trim();
    if (!correct) return null;
    const distractors = choices
      .filter((_, index) => index !== correctChoiceIndex)
      .map((c) => c.trim())
      .filter(Boolean);
    return { choices, correctChoiceIndex, correct, distractors };
  }

  const correct = (card.back ?? "").trim();
  if (!correct) return null;
  return {
    choices: [correct],
    correctChoiceIndex: 0,
    correct,
    distractors: [],
  };
}

export function formatMcqContextForAiPrompt(mcq: CardMcqContext): string {
  const lines = [
    "STORED MULTIPLE-CHOICE OPTIONS (from the database — use these first; do not invent new numeric or factual wrong values):",
    `Correct answer: ${mcq.correct}`,
  ];
  if (mcq.distractors.length > 0) {
    lines.push(`Wrong options: ${mcq.distractors.join(" | ")}`);
    lines.push(
      "When creating a FALSE true/false statement, rewrite one of the wrong options above into a plausible declarative sentence.",
      "When creating a TRUE true/false statement, state the fact that matches the correct answer.",
      "For fill-in-the-blank, the blank must accept the correct answer (and close variants only if already listed above).",
    );
  }
  return lines.join("\n");
}

export function mcqSnapshotFromContext(
  mcq: CardMcqContext,
): { choices: string[]; correctChoiceIndex: number } {
  return {
    choices: mcq.choices,
    correctChoiceIndex: mcq.correctChoiceIndex,
  };
}
