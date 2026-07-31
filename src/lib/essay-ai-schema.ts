import { z } from "zod";
import {
  essayStanceSchema,
  essayTypeSchema,
  essayTypeSupportsStance,
} from "@/lib/essay-types";
import {
  ESSAY_ACCOMMODATION_VALUES,
  ESSAY_CITATION_VALUES,
  ESSAY_COMPLEXITY_VALUES,
  ESSAY_LENGTH_VALUES,
  ESSAY_TONE_VALUES,
  ESSAY_WORD_COUNT_PRESETS,
  ESSAY_WRITING_STYLE_VALUES,
} from "@/lib/essay-builder-options";
import {
  DOCUMENT_STUDIO_AI_DISCLOSURE,
  DOCUMENT_STUDIO_ALIGNMENTS,
  DOCUMENT_STUDIO_FONTS,
  DOCUMENT_STUDIO_FONT_SIZES,
  DOCUMENT_STUDIO_MARGINS,
  DOCUMENT_STUDIO_SOURCE_MODES,
  DOCUMENT_STUDIO_SPACING,
  defaultDocumentStudioMeta,
} from "@/lib/document-generation-studio";

export {
  ESSAY_TYPES,
  ESSAY_TYPE_META,
  ESSAY_TYPE_VALUES,
  essayStanceOptions,
  essayStanceSchema,
  essayTypeLabel,
  essayTypeSchema,
  essayTypeSupportsStance,
  formatEssayStanceForPrompt,
  type EssayStance,
  type EssayType,
} from "@/lib/essay-types";

export const essayDifficultySchema = z.enum(["easy", "medium", "hard"]);

const essayLengthSchema = z.enum(ESSAY_LENGTH_VALUES);
const essayComplexitySchema = z.enum(ESSAY_COMPLEXITY_VALUES);
const essayWordCountPresetSchema = z.enum(ESSAY_WORD_COUNT_PRESETS);
const essayWritingStyleSchema = z.enum(ESSAY_WRITING_STYLE_VALUES);
const essayToneSchema = z.enum(ESSAY_TONE_VALUES);
const essayCitationSchema = z.enum(ESSAY_CITATION_VALUES);
const essayAccommodationSchema = z.enum(ESSAY_ACCOMMODATION_VALUES);

const essayFormattingSchema = z.object({
  citationStyle: essayCitationSchema.default("none"),
  includeInTextCitations: z.boolean().default(false),
  includeReferences: z.boolean().default(false),
  sourceMode: z.enum(DOCUMENT_STUDIO_SOURCE_MODES).default("none"),
  userSourcesText: z.string().max(50_000).default(""),
  font: z.enum(DOCUMENT_STUDIO_FONTS).default("Times New Roman"),
  fontSize: z
    .union([z.literal(10), z.literal(11), z.literal(12), z.literal(14)])
    .default(12),
  lineSpacing: z
    .union([z.literal(1), z.literal(1.15), z.literal(1.5), z.literal(2)])
    .default(2),
  alignment: z.enum(DOCUMENT_STUDIO_ALIGNMENTS).default("left"),
  indentFirstLine: z.boolean().default(true),
  margins: z.enum(DOCUMENT_STUDIO_MARGINS).default("normal"),
  pageNumbers: z.boolean().default(true),
  titlePage: z.boolean().default(false),
  runningHeader: z.boolean().default(false),
  citationFormattedSavedAt: z
    .string()
    .max(64)
    .nullable()
    .optional()
    .default(null),
  formattedEssayPreview: z
    .object({
      bodyTitle: z.string().max(512),
      titlePageText: z.string().max(8_000).nullable(),
      bodyText: z.string().max(100_000),
      references: z.array(z.string().min(1)).max(40),
      referencesNote: z.string().max(2_000).nullable(),
      savedAt: z.string().max(64),
    })
    .nullable()
    .optional()
    .default(null),
});

const academicIntegritySchema = z.object({
  generateOriginalContent: z.boolean().default(true),
  aiDisclosure: z.enum(DOCUMENT_STUDIO_AI_DISCLOSURE).default("none"),
});

const documentStudioTypeIdSchema = z.enum([
  "essay",
  "research_paper",
  "book_report",
  "lab_report",
  "literature_review",
  "reflection_journal",
  "speech",
  "debate",
  "business_report",
  "custom_document",
]);

export const documentStudioMetaSchema = z.object({
  documentType: documentStudioTypeIdSchema.default("essay"),
  essayFormatting: essayFormattingSchema.default(
    defaultDocumentStudioMeta().essayFormatting,
  ),
  academicIntegrity: academicIntegritySchema.default(
    defaultDocumentStudioMeta().academicIntegrity,
  ),
});

export const essayGenerateInputSchema = z
  .object({
    subject: z.string().min(1).max(255),
    gradeLevel: z.string().min(1).max(64),
    essayType: essayTypeSchema,
    essayStance: essayStanceSchema.nullable().optional().default(null),
    topic: z.string().min(1).max(512),
    learningStandard: z.string().max(512).optional().default(""),
    essayLength: essayLengthSchema.default("ai_recommended"),
    /** Used when essayLength is custom — number of main supporting points (1–10). */
    customMainPoints: z.number().int().min(1).max(10).optional().default(5),
    complexity: essayComplexitySchema.default("ai_recommended"),
    /** Legacy mirror — derived from complexity when omitted. */
    difficultyLevel: essayDifficultySchema.optional().default("medium"),
    wordCountPreset: essayWordCountPresetSchema.default("ai_recommended"),
    wordCount: z.number().int().min(50).max(5000),
    writingStyle: essayWritingStyleSchema.default("academic"),
    tone: essayToneSchema.default("neutral"),
    includeCounterargument: z.boolean().default(false),
    citationStyle: essayCitationSchema.default("none"),
    sourcesRequired: z.number().int().min(0).max(20).default(0),
    accommodations: z.array(essayAccommodationSchema).max(12).default([]),
    timeLimitMinutes: z.number().int().min(0).max(240).optional().default(0),
    includeVocabulary: z.boolean().default(true),
    includeOutline: z.boolean().default(true),
    includeRubric: z.boolean().default(true),
    includeModelEssay: z.boolean().default(true),
    /**
     * Document Generation Studio metadata (citation/formatting/integrity).
     * Optional for backward compatibility with older essays.
     */
    documentStudio: documentStudioMetaSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (essayTypeSupportsStance(data.essayType) && !data.essayStance) {
      ctx.addIssue({
        code: "custom",
        message: "Select both sides, side 1, or side 2 for this essay type.",
        path: ["essayStance"],
      });
    }
  });

export type EssayGenerateInput = z.infer<typeof essayGenerateInputSchema>;
export type DocumentStudioMetaInput = z.infer<typeof documentStudioMetaSchema>;

export const essayVocabularyItemSchema = z.object({
  term: z.string().min(1),
  definition: z.string().min(1),
});

export const essayRubricCriterionSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  maxPoints: z.number().int().min(1).max(100),
});

export const essayOutlineItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  purpose: z.string().min(1),
  estimatedWords: z.number().int().min(0).max(5000),
});

export type EssayOutlineItem = z.infer<typeof essayOutlineItemSchema>;

/** Dynamic essay section — AI decides count and titles (never fixed body paragraphs). */
export const essaySectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  /** e.g. introduction | supporting | counterargument | conclusion | narrative | analysis */
  type: z.string().min(1),
  instructions: z.string().min(1),
  sentenceStarters: z.array(z.string()).nullable(),
  examples: z.array(z.string()).nullable(),
  transitionWords: z.array(z.string()).nullable(),
  checklist: z.array(z.string()).nullable(),
  teacherNotes: z.string().nullable(),
  estimatedWords: z.number().int().min(10).max(2000),
  /** Optional model text for this section (teacher reveal / scaffolding). */
  generatedContent: z.string().nullable(),
  planningGoal: z.string().nullable(),
  planningKeyIdea: z.string().nullable(),
  planningEvidence: z.string().nullable(),
});

export type EssaySection = z.infer<typeof essaySectionSchema>;

export const essayGenerationResultSchema = z.object({
  title: z.string().min(1),
  thesis: z.string().nullable(),
  prompt: z.string().min(1),
  learningObjectives: z.array(z.string().min(1)).min(1).max(8),
  outline: z.array(essayOutlineItemSchema).nullable(),
  sections: z.array(essaySectionSchema).min(1).max(12),
  vocabulary: z.array(essayVocabularyItemSchema).nullable(),
  /** Global planning steps (section-level planning lives on each section). */
  planningGuide: z.array(z.string().min(1)).nullable(),
  successChecklist: z.array(z.string().min(1)).min(1).max(16),
  rubric: z.array(essayRubricCriterionSchema).nullable(),
  references: z.array(z.string().min(1)).nullable(),
  /**
   * APA/Chicago-style title page body (plain text with line breaks).
   * Null when title page is not requested.
   */
  titlePage: z.string().nullable().optional().default(null),
  /** True only when placeholder/demo references were unavoidable; prefer false for real published sources. */
  referencesAreSamples: z.boolean().nullable().optional().default(null),
  /** Integrity note shown above the references list. */
  referencesNote: z.string().nullable().optional().default(null),
  conclusion: z.string().nullable(),
  modelEssay: z.string().nullable(),
});

export type EssayGenerationResult = z.infer<typeof essayGenerationResultSchema>;

/** Student draft content keyed by section id. */
export const essaySectionsContentSchema = z.record(z.string(), z.string());

export type EssaySectionsContent = z.infer<typeof essaySectionsContentSchema>;

export const essayFeedbackCriterionScoresSchema = z.object({
  grammar: z.number().int().min(0).max(100),
  organization: z.number().int().min(0).max(100),
  vocabulary: z.number().int().min(0).max(100),
  supportingDetails: z.number().int().min(0).max(100),
  essayStructure: z.number().int().min(0).max(100),
  introduction: z.number().int().min(0).max(100),
  bodyParagraphs: z.number().int().min(0).max(100),
  conclusion: z.number().int().min(0).max(100),
});

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
  /** Legacy field name kept for older feedback rows; describes dynamic sections. */
  bodyParagraphs: z.string().min(1),
  conclusion: z.string().min(1),
});

/** AI generation shape — includes per-criterion scores used to derive overallScore. */
export const essayFeedbackAiOutputSchema = essayFeedbackResultSchema.extend({
  criterionScores: essayFeedbackCriterionScoresSchema,
});

export type EssayFeedbackResult = z.infer<typeof essayFeedbackResultSchema>;
export type EssayFeedbackAiOutput = z.infer<typeof essayFeedbackAiOutputSchema>;

export const essayDraftBodySchema = z.object({
  documentId: z.number().int().positive(),
  body: z.string().max(100_000),
  wordCount: z.number().int().min(0).max(100_000),
  sectionsContent: essaySectionsContentSchema.optional().default({}),
});

export const essaySubmitSchema = z.object({
  documentId: z.number().int().positive(),
  body: z.string().min(1).max(100_000),
  wordCount: z.number().int().min(1).max(100_000),
  sectionsContent: essaySectionsContentSchema.optional().default({}),
});

export const essayTopicMatchRequestSchema = z.object({
  documentId: z.number().int().positive(),
  body: z.string().min(1).max(100_000),
});

export const essayTopicMatchResultSchema = z.object({
  matches: z.boolean(),
  confidence: z.enum(["high", "medium", "low"]),
  reason: z.string().min(1),
  writingSeemsAbout: z.string().nullable(),
});

export const essayFeedbackRequestSchema = z.object({
  documentId: z.number().int().positive(),
  draftId: z.number().int().positive().optional(),
});

/** AI split of a freeform essay into dynamic workspace sections. */
export const essaySectionSplitRequestSchema = z.object({
  documentId: z.number().int().positive(),
  essayText: z.string().min(1).max(100_000),
  sections: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1),
        type: z.string().min(1),
        instructions: z.string().min(1),
      }),
    )
    .min(1)
    .max(12),
});

export const essaySectionSplitResultSchema = z.object({
  parts: z
    .array(
      z.object({
        sectionId: z.string().min(1),
        text: z.string(),
      }),
    )
    .min(1)
    .max(12),
});

export type EssaySectionSplitResult = z.infer<
  typeof essaySectionSplitResultSchema
>;

export type EssayDocumentStatus = "ready" | "archived";
export type EssayDraftStatus = "draft" | "submitted";
