import type { TeacherQuizQuestion } from "@/lib/teacher-generators";
import type { TeacherQuizPassageQuestion } from "@/lib/teacher-quiz-ai-schema";
import {
  formatReadingPassageQuizFront,
  normalizePassageQuizFront,
} from "@/lib/teacher-quiz-reading-passage";

export type TeacherQuizReviewRow = {
  id: string;
  selected: boolean;
  front: string;
  back: string;
  originalFront: string;
  originalBack: string;
  explanation: string;
  distractors: [string, string, string];
  distractorsFromOriginalFront: boolean;
  distractorsLoading: boolean;
  isReadingPassage?: boolean;
};

export function stripChoiceLabel(text: string): string {
  return text.replace(/^[A-D]\)\s*/i, "").trim();
}

export function extractWrongChoicesFromQuestion(
  question: TeacherQuizQuestion,
): [string, string, string] {
  const correctNorm = stripChoiceLabel(question.correctAnswer);
  const wrong = question.choices
    .map(stripChoiceLabel)
    .filter((choice) => choice !== correctNorm);

  const padded = [...wrong];
  while (padded.length < 3) {
    padded.push(`Incorrect option ${padded.length + 1}`);
  }

  return [padded[0]!, padded[1]!, padded[2]!];
}

export function teacherQuizQuestionToReviewRow(
  question: TeacherQuizQuestion,
  id: string,
): TeacherQuizReviewRow {
  const back = stripChoiceLabel(question.correctAnswer);
  return {
    id,
    selected: true,
    front: question.question.trim(),
    back,
    originalFront: question.question.trim(),
    originalBack: back,
    explanation: question.explanation.trim(),
    distractors: extractWrongChoicesFromQuestion(question),
    distractorsFromOriginalFront: false,
    distractorsLoading: false,
    isReadingPassage: false,
  };
}

export function teacherQuizPassageQuestionToReviewRow(
  question: TeacherQuizPassageQuestion,
  id: string,
): TeacherQuizReviewRow {
  const front = normalizePassageQuizFront(
    formatReadingPassageQuizFront(question.passage, question.question),
  );
  const back = question.correctAnswer.trim();
  return {
    id,
    selected: true,
    front,
    back,
    originalFront: front,
    originalBack: back,
    explanation: question.explanation.trim(),
    distractors: question.wrongAnswers,
    distractorsFromOriginalFront: false,
    distractorsLoading: false,
    isReadingPassage: true,
  };
}

export function teacherQuizMixedResultToReviewRows(input: {
  standardQuestions?: TeacherQuizQuestion[];
  passageQuestions?: TeacherQuizPassageQuestion[];
}): TeacherQuizReviewRow[] {
  const stamp = Date.now();
  const standardRows = (input.standardQuestions ?? []).map((question, index) =>
    teacherQuizQuestionToReviewRow(question, `teacher-quiz-${index}-${stamp}`),
  );
  const passageRows = (input.passageQuestions ?? []).map((question, index) =>
    teacherQuizPassageQuestionToReviewRow(
      question,
      `teacher-quiz-passage-${index}-${stamp}`,
    ),
  );
  return [...standardRows, ...passageRows];
}

export function teacherQuizResultToReviewRows(
  questions: TeacherQuizQuestion[],
): TeacherQuizReviewRow[] {
  return questions.map((question, index) =>
    teacherQuizQuestionToReviewRow(question, `teacher-quiz-${index}-${Date.now()}`),
  );
}

export function distractorContextForTeacherQuizRow(
  row: Pick<
    TeacherQuizReviewRow,
    "distractorsFromOriginalFront" | "originalFront" | "originalBack"
  >,
) {
  return row.distractorsFromOriginalFront
    ? {
        distractorQuestion: row.originalBack.trim(),
        distractorAnswer: row.originalFront.trim(),
      }
    : {
        distractorQuestion: row.originalFront.trim(),
        distractorAnswer: row.originalBack.trim(),
      };
}
