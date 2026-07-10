import { resolveCardMcqContext } from "@/lib/card-mcq-context";
import {
  allBlankAcceptedAnswers,
  fillInBlankFromSimpleForm,
  fillInBlankPromptText,
  type FillInBlankSegment,
} from "@/lib/card-quiz-variants";
import {
  quizFormatDistributionsEqual,
  reshuffleQuizFormatAssignments,
  type DeckQuizFormatAssignments,
  type QuizFormatDistribution,
} from "@/lib/quiz-format-assignments";
import type { QuizFormatsSettings } from "@/lib/quiz-formats";
import {
  buildQuestionForCardType,
  type QuizCardInput,
  type QuizQuestionType,
} from "@/lib/quiz-questions";

export type QuizFormatPreviewItem = {
  cardId: number;
  formatType: QuizQuestionType;
  originalQuestion: string;
  originalCorrectAnswer: string;
  mcqOptions: { text: string; isCorrect: boolean }[];
  /** Whether the quiz-facing variant can be edited (T/F and FIB only). */
  editable: boolean;
  trueFalse: { statement: string; correctAnswer: boolean } | null;
  fillInBlank: { promptText: string; acceptedAnswers: string[] } | null;
  multipleChoice: {
    question: string;
    options: string[];
    correctIndex: number;
  } | null;
  buildError: string | null;
};

const FORMAT_SORT_ORDER: Record<QuizQuestionType, number> = {
  multiple_choice: 0,
  true_false: 1,
  fill_in_blank: 2,
};

export function formatPreviewTypeLabel(type: QuizQuestionType): string {
  if (type === "multiple_choice") return "Multiple choice";
  if (type === "true_false") return "True / false";
  return "Fill in the blank";
}

export function resolvePreviewAssignments(
  cards: QuizCardInput[],
  formats: QuizFormatsSettings,
  distribution: QuizFormatDistribution,
  saved: DeckQuizFormatAssignments | null,
): { byCardId: Record<number, QuizQuestionType>; usesPublishedAssignments: boolean } {
  if (
    saved?.byCardId &&
    Object.keys(saved.byCardId).length > 0 &&
    saved.distribution &&
    quizFormatDistributionsEqual(saved.distribution, distribution)
  ) {
    return { byCardId: saved.byCardId, usesPublishedAssignments: true };
  }

  const byCardId = reshuffleQuizFormatAssignments(cards, formats, distribution);
  return { byCardId, usesPublishedAssignments: false };
}

export function buildQuizFormatPreviewItems(
  cards: QuizCardInput[],
  formats: QuizFormatsSettings,
  assignments: Record<number, QuizQuestionType>,
): QuizFormatPreviewItem[] {
  const items: QuizFormatPreviewItem[] = [];

  for (const [rawCardId, formatType] of Object.entries(assignments)) {
    const cardId = Number(rawCardId);
    const card = cards.find((c) => c.id === cardId);
    if (!card) continue;

    const mcq = resolveCardMcqContext(card);
    const question = buildQuestionForCardType(card, cards, formatType, formats);

    const item: QuizFormatPreviewItem = {
      cardId,
      formatType,
      originalQuestion: (card.front ?? "").trim(),
      originalCorrectAnswer: mcq?.correct ?? (card.back ?? "").trim(),
      mcqOptions: mcq
        ? mcq.choices.map((text, index) => ({
            text,
            isCorrect: index === mcq.correctChoiceIndex,
          }))
        : [],
      editable: formatType === "true_false" || formatType === "fill_in_blank",
      trueFalse: null,
      fillInBlank: null,
      multipleChoice: null,
      buildError: question ? null : "This card cannot build this format yet.",
    };

    if (formatType === "true_false" && card.quizVariants?.trueFalse?.statement?.trim()) {
      item.trueFalse = {
        statement: card.quizVariants.trueFalse.statement.trim(),
        correctAnswer: card.quizVariants.trueFalse.correctAnswer,
      };
    }

    if (formatType === "fill_in_blank" && card.quizVariants?.fillInBlank?.segments?.length) {
      const segments = card.quizVariants.fillInBlank.segments;
      item.fillInBlank = {
        promptText: fillInBlankPromptText(segments),
        acceptedAnswers: allBlankAcceptedAnswers(segments),
      };
    }

    if (formatType === "multiple_choice" && question?.type === "multiple_choice") {
      item.multipleChoice = {
        question: question.question ?? "",
        options: question.options,
        correctIndex: question.correctIndex,
      };
    }

    items.push(item);
  }

  return items.sort((a, b) => {
    const order =
      FORMAT_SORT_ORDER[a.formatType] - FORMAT_SORT_ORDER[b.formatType];
    if (order !== 0) return order;
    return a.cardId - b.cardId;
  });
}

export function segmentsFromPreviewFillInBlank(
  promptText: string,
  acceptedAnswers: string[],
): FillInBlankSegment[] | null {
  return fillInBlankFromSimpleForm(promptText, acceptedAnswers);
}
