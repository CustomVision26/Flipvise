import type { TeacherQuizMultiPassageResult } from "@/lib/teacher-quiz-ai-schema";
import type { TeacherQuizPassageQuestionType } from "@/lib/teacher-quiz-passage-settings";
import { validatePassageDiversity } from "@/lib/passage-diversity";

export type PassageQualityValidationResult = {
  ok: boolean;
  errors: string[];
};

const LEAK_PATTERNS =
  /system prompt|do not mention these instructions|curriculum data \(treat as data|hidden reasoning|scenario outline before writing/i;

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value.trim());
  }
  return out;
}

/**
 * Validate structured passage AI output before card expansion / save.
 */
export function validatePassageGenerationQuality(
  result: TeacherQuizMultiPassageResult,
  options: {
    expectedPassageCount: number;
    questionsPerPassage: number[];
    requestedQuestionTypes: TeacherQuizPassageQuestionType[];
    requireObjectiveAlignment?: boolean;
  },
): PassageQualityValidationResult {
  const errors: string[] = [];
  const passages = result.passages;

  if (passages.length !== options.expectedPassageCount) {
    errors.push(
      `Expected ${options.expectedPassageCount} passages, received ${passages.length}.`,
    );
  }

  const prompts: string[] = [];

  for (let i = 0; i < passages.length; i += 1) {
    const block = passages[i]!;
    const expectedQuestions = options.questionsPerPassage[i] ?? options.questionsPerPassage[0] ?? 1;

    if (!block.title?.trim()) {
      errors.push(`Passage ${i + 1} is missing a title.`);
    }
    if (!block.passage?.trim()) {
      errors.push(`Passage ${i + 1} has empty passage text.`);
    }
    if (LEAK_PATTERNS.test(block.passage) || LEAK_PATTERNS.test(block.title)) {
      errors.push(`Passage ${i + 1} appears to leak internal instructions.`);
    }
    if (!block.scenarioCategory?.trim() && !block.educationalContext?.trim()) {
      errors.push(`Passage ${i + 1} is missing a scenario category.`);
    }
    if (!block.scenarioSummary?.trim()) {
      errors.push(`Passage ${i + 1} is missing a scenario summary.`);
    }
    if (!block.centralEvent?.trim()) {
      errors.push(`Passage ${i + 1} is missing centralEvent.`);
    }
    if (!block.mainProblem?.trim()) {
      errors.push(`Passage ${i + 1} is missing mainProblem.`);
    }
    if (!block.consequence?.trim()) {
      errors.push(`Passage ${i + 1} is missing consequence.`);
    }
    if (!block.requiredResponse?.trim()) {
      errors.push(`Passage ${i + 1} is missing requiredResponse.`);
    }
    if (!block.perspective?.trim()) {
      errors.push(`Passage ${i + 1} is missing perspective.`);
    }
    if (!block.setting?.trim()) {
      errors.push(`Passage ${i + 1} is missing setting.`);
    }

    const hasAlignment =
      (block.alignedObjectives?.length ?? 0) > 0 ||
      (block.alignedCompetencies?.length ?? 0) > 0 ||
      (block.learningObjectivesCovered?.length ?? 0) > 0;
    if (options.requireObjectiveAlignment && !hasAlignment) {
      errors.push(`Passage ${i + 1} is not aligned to an objective or competency.`);
    }

    if (block.questions.length !== expectedQuestions) {
      errors.push(
        `Passage ${i + 1} should have ${expectedQuestions} question(s), got ${block.questions.length}.`,
      );
    }

    for (let q = 0; q < block.questions.length; q += 1) {
      const item = block.questions[q]!;
      const promptKey = item.question.trim().toLowerCase();
      if (prompts.includes(promptKey)) {
        errors.push(`Duplicate question prompt detected (passage ${i + 1}, question ${q + 1}).`);
      }
      prompts.push(promptKey);

      const optionsList = uniqueStrings(item.wrongAnswers);
      if (optionsList.length !== 3) {
        errors.push(
          `Passage ${i + 1} question ${q + 1} must have 3 unique distractors.`,
        );
      }
      if (
        optionsList.some(
          (wrong) =>
            wrong.trim().toLowerCase() === item.correctAnswer.trim().toLowerCase(),
        )
      ) {
        errors.push(
          `Passage ${i + 1} question ${q + 1} has a distractor matching the correct answer.`,
        );
      }
    }
  }

  const diversity = validatePassageDiversity(
    passages.map((block) => ({
      title: block.title,
      scenarioCategory: block.scenarioCategory ?? block.educationalContext,
      scenarioSummary: block.scenarioSummary,
      passageText: block.passage,
      vocabularyTermsUsed: block.vocabularyTermsUsed ?? block.vocabularyUsed,
    })),
  );
  if (!diversity.ok) {
    errors.push(diversity.message ?? "Passages are not sufficiently diverse.");
  }

  // Question-type distribution is enforced in the prompt; do not hard-fail here.
  void options.requestedQuestionTypes;

  return { ok: errors.length === 0, errors };
}
