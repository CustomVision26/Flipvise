import { z } from "zod";

export const essayTypeSchema = z.enum([
  "argumentative",
  "expository",
  "narrative",
  "persuasive",
  "compare_contrast",
  "descriptive",
]);

export type EssayType = z.infer<typeof essayTypeSchema>;

export const ESSAY_TYPES: { value: EssayType; label: string }[] = [
  { value: "argumentative", label: "Argumentative" },
  { value: "expository", label: "Expository" },
  { value: "narrative", label: "Narrative" },
  { value: "persuasive", label: "Persuasive" },
  { value: "compare_contrast", label: "Compare & Contrast" },
  { value: "descriptive", label: "Descriptive" },
];

export const essayDifficultySchema = z.enum(["easy", "medium", "hard"]);

export const essayGenerateInputSchema = z.object({
  subject: z.string().min(1).max(255),
  gradeLevel: z.string().min(1).max(64),
  essayType: essayTypeSchema,
  difficultyLevel: essayDifficultySchema,
  topic: z.string().min(1).max(512),
  learningStandard: z.string().max(512).optional().default(""),
  wordCount: z.number().int().min(100).max(5000),
  timeLimitMinutes: z.number().int().min(0).max(240).optional().default(0),
  includeVocabulary: z.boolean().default(true),
  includeOutline: z.boolean().default(true),
  includeRubric: z.boolean().default(true),
  includeModelEssay: z.boolean().default(false),
});

export type EssayGenerateInput = z.infer<typeof essayGenerateInputSchema>;

export const essayVocabularyItemSchema = z.object({
  term: z.string().min(1),
  definition: z.string().min(1),
});

export const essayRubricCriterionSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  maxPoints: z.number().int().min(1).max(100),
});

/** Structured AI output for an essay activity (nullable fields for OpenAI required props). */
export const essayGenerationResultSchema = z.object({
  title: z.string().min(1),
  prompt: z.string().min(1),
  learningObjectives: z.array(z.string().min(1)).min(1).max(8),
  outline: z.array(z.string().min(1)).nullable(),
  vocabulary: z.array(essayVocabularyItemSchema).nullable(),
  planningGuide: z.array(z.string().min(1)).min(1).max(12),
  successChecklist: z.array(z.string().min(1)).min(1).max(12),
  rubric: z.array(essayRubricCriterionSchema).nullable(),
  modelEssay: z.string().nullable(),
});

export type EssayGenerationResult = z.infer<typeof essayGenerationResultSchema>;

export const essayFeedbackResultSchema = z.object({
  overallScore: z.number().int().min(0).max(100),
  strengths: z.array(z.string().min(1)).min(1).max(8),
  areasForImprovement: z.array(z.string().min(1)).min(1).max(8),
  revisionSuggestions: z.array(z.string().min(1)).min(1).max(10),
  grammar: z.string().min(1),
  organization: z.string().min(1),
  vocabulary: z.string().min(1),
  supportingDetails: z.string().min(1),
  essayStructure: z.string().min(1),
  introduction: z.string().min(1),
  bodyParagraphs: z.string().min(1),
  conclusion: z.string().min(1),
});

export type EssayFeedbackResult = z.infer<typeof essayFeedbackResultSchema>;

export const essayDraftBodySchema = z.object({
  documentId: z.number().int().positive(),
  body: z.string().max(100_000),
  wordCount: z.number().int().min(0).max(100_000),
});

export const essaySubmitSchema = z.object({
  documentId: z.number().int().positive(),
  body: z.string().min(1).max(100_000),
  wordCount: z.number().int().min(1).max(100_000),
});

export const essayFeedbackRequestSchema = z.object({
  documentId: z.number().int().positive(),
  draftId: z.number().int().positive().optional(),
});

export type EssayDocumentStatus = "ready" | "archived";
export type EssayDraftStatus = "draft" | "submitted";
