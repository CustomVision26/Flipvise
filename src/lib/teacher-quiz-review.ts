import type { TeacherQuizQuestion } from "@/lib/teacher-generators";
import type { TeacherQuizPassageQuestion } from "@/lib/teacher-quiz-ai-schema";
import {
  extractStepFinalAnswer,
  isStepAnswer,
} from "@/lib/parse-step-answer";
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

/**
 * Prefer a study-mode step workout on the card back when AI returned one
 * in correctAnswer or explanation. Quiz mode still shows only the final
 * Answer: line via formatQuizOptionForDisplay.
 */
export function resolveTeacherQuizStudyBack(
  correctAnswer: string,
  explanation?: string | null,
): string {
  const answer = stripChoiceLabel(correctAnswer).trim();
  const expl = (explanation ?? "").trim();

  if (isStepAnswer(answer)) return answer;

  if (isStepAnswer(expl)) {
    if (/(?:Answer|Result|Solution|∴)\s*:/i.test(expl)) return expl;
    return answer ? `${expl}\nAnswer: ${answer}` : expl;
  }

  return answer;
}

/** Short final-answer text for comparing/filtering MC choices and distractors. */
export function teacherQuizFinalAnswerKey(text: string): string {
  const stripped = stripChoiceLabel(text).trim();
  return extractStepFinalAnswer(stripped) ?? stripped;
}

export function extractWrongChoicesFromQuestion(
  question: TeacherQuizQuestion,
): [string, string, string] {
  const correctKey = teacherQuizFinalAnswerKey(question.correctAnswer);
  const wrong = question.choices
    .map(stripChoiceLabel)
    .filter((choice) => teacherQuizFinalAnswerKey(choice) !== correctKey)
    // Prefer short distractors when the correct choice is a full workout.
    .map((choice) => extractStepFinalAnswer(choice) ?? choice);

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
  const back = resolveTeacherQuizStudyBack(
    question.correctAnswer,
    question.explanation,
  );
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
    formatReadingPassageQuizFront(
      question.passage,
      question.question,
      question.passageTitle,
    ),
  );
  const back = resolveTeacherQuizStudyBack(
    question.correctAnswer,
    question.explanation,
  );
  const distractors = question.wrongAnswers.map(
    (answer) => extractStepFinalAnswer(answer) ?? answer.trim(),
  ) as [string, string, string];
  return {
    id,
    selected: true,
    front,
    back,
    originalFront: front,
    originalBack: back,
    explanation: question.explanation.trim(),
    distractors,
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
