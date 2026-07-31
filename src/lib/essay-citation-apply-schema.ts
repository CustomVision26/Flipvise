import { z } from "zod";

/** Structured AI output for applying citations + building References. */
export const essayCitationApplyResultSchema = z.object({
  /** Continuous student-paper body with in-text citations (no References block). */
  citedEssay: z.string().min(1),
  /** APA/MLA/etc title page lines, or null when not requested. */
  titlePage: z.string().nullable(),
  /**
   * Formatted bibliography entries that appear in the essay.
   * Only sources actually cited in citedEssay.
   */
  references: z.array(z.string().min(1)).min(1).max(40),
  referencesAreSamples: z.boolean(),
  referencesNote: z.string().nullable(),
  /**
   * Cited text per original section id (same ids provided in the request).
   * Array form — OpenAI structured output rejects z.record (propertyNames).
   */
  sections: z
    .array(
      z.object({
        id: z.string().min(1),
        content: z.string(),
      }),
    )
    .max(40),
});

export type EssayCitationApplyResult = z.infer<
  typeof essayCitationApplyResultSchema
>;

export const essayCitationFormatSourceSchema = z.enum([
  "user_written",
  "model_essay",
]);

export type EssayCitationFormatSource = z.infer<
  typeof essayCitationFormatSourceSchema
>;

export const applyEssayCitationFormatSchema = z.object({
  documentId: z.number().int().positive(),
  citationStyle: z.enum(["apa", "mla", "chicago", "harvard"]),
  /** Which essay to copy before applying citations. */
  source: essayCitationFormatSourceSchema,
  userSourcesText: z.string().max(50_000).optional().default(""),
});

export type ApplyEssayCitationFormatInput = z.infer<
  typeof applyEssayCitationFormatSchema
>;
