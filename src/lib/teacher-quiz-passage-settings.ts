import { z } from "zod";

/** Passage genre — Auto lets the model choose from the lesson. */
export const TEACHER_QUIZ_PASSAGE_TYPES = [
  "auto",
  "scenario",
  "story",
  "dialogue",
  "case_study",
  "investigation",
  "news_article",
  "journal_entry",
  "letter",
  "report",
  "workplace_situation",
  "experiment",
  "observation",
  "historical_narrative",
  "interview",
  "debate",
] as const;

export type TeacherQuizPassageType = (typeof TEACHER_QUIZ_PASSAGE_TYPES)[number];

export const TEACHER_QUIZ_PASSAGE_TYPE_LABELS: Record<TeacherQuizPassageType, string> = {
  auto: "Auto",
  scenario: "Scenario",
  story: "Story",
  dialogue: "Dialogue",
  case_study: "Case Study",
  investigation: "Investigation",
  news_article: "News Article",
  journal_entry: "Journal Entry",
  letter: "Letter",
  report: "Report",
  workplace_situation: "Workplace Situation",
  experiment: "Experiment",
  observation: "Observation",
  historical_narrative: "Historical Narrative",
  interview: "Interview",
  debate: "Debate",
};

/** Writing style — Auto lets the model choose from the lesson. */
export const TEACHER_QUIZ_PASSAGE_STYLES = [
  "auto",
  "realistic",
  "realistic_workplace",
  "academic",
  "conversational",
  "narrative",
  "formal",
  "problem_solving",
  "investigation",
  "historical",
  "informational",
] as const;

export type TeacherQuizPassageStyle = (typeof TEACHER_QUIZ_PASSAGE_STYLES)[number];

export const TEACHER_QUIZ_PASSAGE_STYLE_LABELS: Record<TeacherQuizPassageStyle, string> = {
  auto: "Auto",
  realistic: "Realistic",
  realistic_workplace: "Realistic Workplace",
  academic: "Academic",
  conversational: "Conversational",
  narrative: "Narrative",
  formal: "Formal",
  problem_solving: "Problem Solving",
  investigation: "Investigation",
  historical: "Historical",
  informational: "Informational",
};

export const TEACHER_QUIZ_READING_LEVELS = [
  "below_grade",
  "on_grade",
  "above_grade",
] as const;

export type TeacherQuizReadingLevel = (typeof TEACHER_QUIZ_READING_LEVELS)[number];

export const TEACHER_QUIZ_READING_LEVEL_LABELS: Record<TeacherQuizReadingLevel, string> = {
  below_grade: "Below Grade",
  on_grade: "On Grade",
  above_grade: "Above Grade",
};

/** Passage question categories teachers can enable. */
export const TEACHER_QUIZ_PASSAGE_QUESTION_TYPES = [
  "multiple_choice",
  "critical_thinking",
  "scenario_based",
  "practical_application",
] as const;

export type TeacherQuizPassageQuestionType =
  (typeof TEACHER_QUIZ_PASSAGE_QUESTION_TYPES)[number];

export const TEACHER_QUIZ_PASSAGE_QUESTION_TYPE_LABELS: Record<
  TeacherQuizPassageQuestionType,
  string
> = {
  multiple_choice: "Multiple Choice",
  critical_thinking: "Critical Thinking",
  scenario_based: "Scenario-Based",
  practical_application: "Practical/Application",
};

export const DEFAULT_TEACHER_QUIZ_PASSAGE_TYPE: TeacherQuizPassageType = "auto";
export const DEFAULT_TEACHER_QUIZ_PASSAGE_STYLE: TeacherQuizPassageStyle = "auto";
export const DEFAULT_TEACHER_QUIZ_READING_LEVEL: TeacherQuizReadingLevel = "on_grade";
/** Multiple Choice enabled by default; at least one type required. */
export const DEFAULT_TEACHER_QUIZ_PASSAGE_QUESTION_TYPES: TeacherQuizPassageQuestionType[] = [
  "multiple_choice",
];
export const DEFAULT_TEACHER_QUIZ_QUESTIONS_PER_PASSAGE = 5;
/** Soft cap for questions-per-passage in the UI (plan card limit still applies). */
export const TEACHER_QUIZ_MAX_QUESTIONS_PER_PASSAGE = 10;

export type PassageGenerationToggles = {
  includeVocabulary: boolean;
  includeTeacherNotes: boolean;
  includeAnswerExplanations: boolean;
  useRelevantLocalContext: boolean;
  avoidPreviousPassages: boolean;
};

export const DEFAULT_PASSAGE_GENERATION_TOGGLES: PassageGenerationToggles = {
  includeVocabulary: true,
  includeTeacherNotes: false,
  includeAnswerExplanations: true,
  useRelevantLocalContext: true,
  avoidPreviousPassages: true,
};

export const teacherQuizPassageTypeSchema = z.enum(TEACHER_QUIZ_PASSAGE_TYPES);
export const teacherQuizPassageStyleSchema = z.enum(TEACHER_QUIZ_PASSAGE_STYLES);
export const teacherQuizReadingLevelSchema = z.enum(TEACHER_QUIZ_READING_LEVELS);
export const teacherQuizPassageQuestionTypeSchema = z.enum(
  TEACHER_QUIZ_PASSAGE_QUESTION_TYPES,
);

export const passageGenerationTogglesSchema = z.object({
  includeVocabulary: z.boolean().optional(),
  includeTeacherNotes: z.boolean().optional(),
  includeAnswerExplanations: z.boolean().optional(),
  useRelevantLocalContext: z.boolean().optional(),
  avoidPreviousPassages: z.boolean().optional(),
});

export function formatPassageTypeForPrompt(type: TeacherQuizPassageType): string {
  if (type === "auto") {
    return "Auto — choose the best passage form for this subject and lesson.";
  }
  return TEACHER_QUIZ_PASSAGE_TYPE_LABELS[type];
}

export function formatPassageStyleForPrompt(style: TeacherQuizPassageStyle): string {
  if (style === "auto") {
    return "Auto — choose the best tone for this subject and lesson.";
  }
  return TEACHER_QUIZ_PASSAGE_STYLE_LABELS[style];
}

export function formatReadingLevelForPrompt(
  level: TeacherQuizReadingLevel,
  gradeLevel: string,
): string {
  switch (level) {
    case "below_grade":
      return `Below grade — slightly simpler than typical ${gradeLevel} reading`;
    case "above_grade":
      return `Above grade — slightly more demanding than typical ${gradeLevel} reading`;
    default:
      return `On grade — appropriate for ${gradeLevel}`;
  }
}

export function formatPassageQuestionTypesForPrompt(
  types: TeacherQuizPassageQuestionType[],
): string {
  const resolved =
    types.length > 0 ? types : DEFAULT_TEACHER_QUIZ_PASSAGE_QUESTION_TYPES;
  return resolved.map((type) => TEACHER_QUIZ_PASSAGE_QUESTION_TYPE_LABELS[type]).join(", ");
}

/** Distribute requested question types across N questions (round-robin). */
export function distributePassageQuestionTypes(
  totalQuestions: number,
  types: TeacherQuizPassageQuestionType[],
): TeacherQuizPassageQuestionType[] {
  const resolved =
    types.length > 0 ? types : DEFAULT_TEACHER_QUIZ_PASSAGE_QUESTION_TYPES;
  if (totalQuestions < 1) return [];
  return Array.from(
    { length: totalQuestions },
    (_, index) => resolved[index % resolved.length]!,
  );
}
