import type { QuizResult } from "@/actions/study";
import type { QuizSecuritySessionState } from "@/db/schema";
import { primaryBlankAnswer } from "@/lib/card-quiz-variants";
import {
  questionPromptText,
  trueFalseOptionText,
  type QuizQuestion,
} from "@/lib/quiz-questions";

export function isQuizQuestionAnswered(
  question: QuizQuestion,
  selectedIndex: number | null,
  typedAnswer: string | null,
): boolean {
  if (question.type === "fill_in_blank") {
    return Boolean(typedAnswer?.trim());
  }
  return selectedIndex !== null && selectedIndex !== undefined;
}

export function questionsFromSessionState(state: QuizSecuritySessionState): QuizQuestion[] {
  return state.questions.map((q) => {
    const type = q.type ?? "multiple_choice";
    if (type === "true_false") {
      return {
        type: "true_false",
        cardId: q.cardId,
        statement: q.statement ?? q.question ?? "",
        questionImageUrl: q.questionImageUrl,
        correctAnswer: q.correctAnswer ?? false,
      };
    }
    if (type === "fill_in_blank") {
      return {
        type: "fill_in_blank",
        cardId: q.cardId,
        questionImageUrl: q.questionImageUrl,
        segments: q.segments ?? [],
      };
    }
    return {
      type: "multiple_choice",
      cardId: q.cardId,
      question: q.question,
      questionImageUrl: q.questionImageUrl,
      options: q.options,
      optionImageUrls: q.optionImageUrls ?? q.options.map(() => null),
      correctIndex: q.correctIndex,
    };
  });
}

export function buildQuizSessionState(
  questions: QuizQuestion[],
  selectedByIndex: (number | null)[],
  typedAnswersByIndex: (string | null)[],
  currentIndex: number,
  remainingSeconds: number,
): QuizSecuritySessionState {
  return {
    questions: questions.map((q) => {
      if (q.type === "true_false") {
        return {
          type: "true_false" as const,
          cardId: q.cardId,
          question: null,
          questionImageUrl: q.questionImageUrl,
          options: ["True", "False"],
          correctIndex: q.correctAnswer ? 0 : 1,
          statement: q.statement,
          correctAnswer: q.correctAnswer,
        };
      }
      if (q.type === "fill_in_blank") {
        return {
          type: "fill_in_blank" as const,
          cardId: q.cardId,
          question: null,
          questionImageUrl: q.questionImageUrl,
          options: [],
          correctIndex: 0,
          segments: q.segments,
        };
      }
      return {
        type: "multiple_choice" as const,
        cardId: q.cardId,
        question: q.question,
        questionImageUrl: q.questionImageUrl,
        options: q.options,
        optionImageUrls: q.optionImageUrls,
        correctIndex: q.correctIndex,
      };
    }),
    selectedByIndex,
    typedAnswersByIndex,
    currentIndex,
    remainingSeconds,
  };
}

export function buildPerCardSnapshotForSave(
  result: QuizResult,
  questions: QuizQuestion[],
  selectedByIndex: (number | null)[],
  typedAnswersByIndex: (string | null)[],
) {
  return questions.map((q, i) => {
    const perCardEntry = result.perCard.find((p) => p.cardId === q.cardId);
    const selectedIdx = selectedByIndex[i];
    let selectedAnswer: string | null = null;
    let correctAnswer = perCardEntry?.correctText ?? "";

    if (q.type === "fill_in_blank") {
      selectedAnswer = typedAnswersByIndex[i]?.trim() || null;
      if (!correctAnswer) {
        correctAnswer = primaryBlankAnswer(q.segments);
      }
    } else if (q.type === "true_false") {
      selectedAnswer =
        selectedIdx !== null && selectedIdx !== undefined
          ? trueFalseOptionText(selectedIdx === 0)
          : null;
      if (!correctAnswer) {
        correctAnswer = trueFalseOptionText(q.correctAnswer);
      }
    } else {
      selectedAnswer =
        selectedIdx !== null && selectedIdx !== undefined ? q.options[selectedIdx] ?? null : null;
      if (!correctAnswer) {
        correctAnswer = q.options[q.correctIndex] ?? "";
      }
    }

    return {
      cardId: q.cardId,
      question: questionPromptText(q),
      questionType: q.type,
      correctAnswer,
      selectedAnswer,
      correct: perCardEntry?.correct ?? false,
    };
  });
}

export function trueFalseOptions(): string[] {
  return ["True", "False"];
}
