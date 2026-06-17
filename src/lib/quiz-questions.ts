import type { CardQuizVariants, FillInBlankSegment } from "@/lib/card-quiz-variants";
import type { QuizFormatsSettings } from "@/lib/quiz-formats";

export type QuizQuestionType = "multiple_choice" | "true_false" | "fill_in_blank";

export type QuizQuestion =
  | {
      type: "multiple_choice";
      cardId: number;
      question: string | null;
      questionImageUrl: string | null;
      options: string[];
      correctIndex: number;
    }
  | {
      type: "true_false";
      cardId: number;
      statement: string;
      questionImageUrl: string | null;
      correctAnswer: boolean;
    }
  | {
      type: "fill_in_blank";
      cardId: number;
      questionImageUrl: string | null;
      segments: FillInBlankSegment[];
    };

export type QuizAnswerPayload = {
  cardId: number;
  questionType: QuizQuestionType;
  selectedText: string | null;
  typedAnswer: string | null;
};

export type QuizCardInput = {
  id: number;
  front: string | null;
  frontImageUrl?: string | null;
  back: string | null;
  choices?: string[] | null;
  correctChoiceIndex?: number | null;
  quizVariants?: CardQuizVariants | null;
};

export function questionTypeLabel(type: QuizQuestionType): string {
  if (type === "multiple_choice") return "Multiple choice";
  if (type === "true_false") return "True / false";
  return "Fill in the blank";
}

/** Compact label for quiz result review rows (e.g. MCQ, True/False). */
export function questionTypeResultLabel(type: QuizQuestionType): string {
  if (type === "multiple_choice") return "MCQ";
  if (type === "true_false") return "True/False";
  return "Fill in the blank";
}

export function formatQuestionWithTypeLabel(
  questionNumber: number,
  questionType?: QuizQuestionType | null,
): string {
  const base = `Question ${questionNumber}`;
  if (!questionType) return base;
  return `${base} (${questionTypeResultLabel(questionType)})`;
}

export function summarizeSessionQuestionFormats(questions: QuizQuestion[]): string | null {
  if (questions.length === 0) return null;

  const counts: Record<QuizQuestionType, number> = {
    multiple_choice: 0,
    true_false: 0,
    fill_in_blank: 0,
  };
  for (const q of questions) counts[q.type]++;

  const parts: string[] = [];
  if (counts.multiple_choice > 0) {
    parts.push(
      `${counts.multiple_choice} multiple choice`,
    );
  }
  if (counts.true_false > 0) {
    parts.push(`${counts.true_false} true/false`);
  }
  if (counts.fill_in_blank > 0) {
    parts.push(`${counts.fill_in_blank} fill-in-the-blank`);
  }

  return parts.length > 0 ? `This session: ${parts.join(" · ")}` : null;
}

export function normalizeQuizText(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

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

function buildMultipleChoiceQuestion(
  card: QuizCardInput,
  allCards: QuizCardInput[],
): QuizQuestion | null {
  if (hasStoredChoices(card)) {
    const correctText = (card.choices as string[])[card.correctChoiceIndex as number];
    if (!correctText?.trim()) return null;
    const shuffled = shuffleArray(card.choices as string[]);
    const correctIndex = shuffled.findIndex(
      (text) => normalizeQuizText(text) === normalizeQuizText(correctText),
    );
    return {
      type: "multiple_choice",
      cardId: card.id,
      question: card.front,
      questionImageUrl: card.frontImageUrl ?? null,
      options: shuffled,
      correctIndex: correctIndex === -1 ? 0 : correctIndex,
    };
  }

  const back = (card.back ?? "").trim();
  if (!back) return null;

  const textBacks = allCards
    .map((c) => (c.back ?? "").trim())
    .filter((t) => t.length > 0);
  const correctNorm = normalizeQuizText(back);
  const distractorPool = Array.from(
    new Set(
      textBacks
        .map((t) => t.trim())
        .filter((t) => normalizeQuizText(t) !== correctNorm),
    ),
  );
  const distractors = shuffleArray(distractorPool).slice(0, 3);
  if (distractors.length === 0) return null;

  const options = shuffleArray([back, ...distractors]);
  const correctIndex = options.findIndex((o) => normalizeQuizText(o) === correctNorm);

  return {
    type: "multiple_choice",
    cardId: card.id,
    question: card.front,
    questionImageUrl: card.frontImageUrl ?? null,
    options,
    correctIndex: correctIndex === -1 ? 0 : correctIndex,
  };
}

function buildTrueFalseQuestion(card: QuizCardInput): QuizQuestion | null {
  const tf = card.quizVariants?.trueFalse;
  if (!tf?.statement?.trim()) return null;
  return {
    type: "true_false",
    cardId: card.id,
    statement: tf.statement.trim(),
    questionImageUrl: card.frontImageUrl ?? null,
    correctAnswer: tf.correctAnswer,
  };
}

function buildFillInBlankQuestion(card: QuizCardInput): QuizQuestion | null {
  const fib = card.quizVariants?.fillInBlank;
  if (!fib?.segments?.length) return null;
  const hasBlank = fib.segments.some((s) => s.type === "blank");
  if (!hasBlank) return null;
  return {
    type: "fill_in_blank",
    cardId: card.id,
    questionImageUrl: card.frontImageUrl ?? null,
    segments: fib.segments,
  };
}

/**
 * Builds one quiz question per card, choosing randomly among enabled formats
 * that have content for that card.
 */
export function buildQuizQuestions(
  cards: QuizCardInput[],
  formats: QuizFormatsSettings,
): QuizQuestion[] {
  const questions: QuizQuestion[] = [];

  for (const card of cards) {
    const candidates: QuizQuestion[] = [];

    if (formats.multipleChoice) {
      const mc = buildMultipleChoiceQuestion(card, cards);
      if (mc) candidates.push(mc);
    }
    if (formats.trueFalse) {
      const tf = buildTrueFalseQuestion(card);
      if (tf) candidates.push(tf);
    }
    if (formats.fillInBlank) {
      const fib = buildFillInBlankQuestion(card);
      if (fib) candidates.push(fib);
    }

    if (candidates.length > 0) {
      questions.push(pickRandom(candidates));
    }
  }

  return shuffleArray(questions);
}

export function trueFalseOptionText(correct: boolean): string {
  return correct ? "True" : "False";
}

export function gradeQuizAnswer(
  card: QuizCardInput,
  questionType: QuizQuestionType,
  payload: { selectedText: string | null; typedAnswer: string | null },
): { correctText: string; wasCorrect: boolean; isAnswered: boolean } {
  if (questionType === "true_false") {
    const tf = card.quizVariants?.trueFalse;
    const correctText = trueFalseOptionText(tf?.correctAnswer ?? false);
    const isAnswered = payload.selectedText !== null;
    const wasCorrect =
      isAnswered &&
      normalizeQuizText(payload.selectedText as string) === normalizeQuizText(correctText);
    return { correctText, wasCorrect, isAnswered };
  }

  if (questionType === "fill_in_blank") {
    const segments = card.quizVariants?.fillInBlank?.segments ?? [];
    const blank = segments.find((s) => s.type === "blank");
    const accepted = blank?.type === "blank" ? blank.acceptedAnswers : [];
    const correctText = accepted[0] ?? "";
    const typed = (payload.typedAnswer ?? "").trim();
    const isAnswered = typed.length > 0;
    const normTyped = normalizeQuizText(typed);
    const wasCorrect =
      isAnswered &&
      accepted.some((a) => normalizeQuizText(a) === normTyped);
    return { correctText, wasCorrect, isAnswered };
  }

  const hasChoices = hasStoredChoices(card);
  const correctText = hasChoices
    ? ((card.choices as string[])[card.correctChoiceIndex as number] ?? "")
    : (card.back ?? "");
  const isAnswered = payload.selectedText !== null;
  const wasCorrect =
    isAnswered &&
    Boolean(correctText) &&
    normalizeQuizText(payload.selectedText as string) === normalizeQuizText(correctText);
  return { correctText, wasCorrect, isAnswered };
}

export function questionPromptText(q: QuizQuestion): string | null {
  if (q.type === "multiple_choice") return q.question;
  if (q.type === "true_false") return q.statement;
  return q.segments
    .map((seg) => (seg.type === "text" ? seg.value : "___"))
    .join("")
    .trim();
}

export function questionTypeForCard(
  card: QuizCardInput,
  formats: QuizFormatsSettings,
): QuizQuestionType {
  if (formats.trueFalse && card.quizVariants?.trueFalse?.statement) return "true_false";
  if (formats.fillInBlank && card.quizVariants?.fillInBlank?.segments?.length) {
    return "fill_in_blank";
  }
  return "multiple_choice";
}
