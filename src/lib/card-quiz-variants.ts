import { z } from "zod";

export const fillInBlankSegmentSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), value: z.string() }),
  z.object({
    type: z.literal("blank"),
    acceptedAnswers: z.array(z.string().min(1)).min(1),
  }),
]);

export type FillInBlankSegment = z.infer<typeof fillInBlankSegmentSchema>;

export const cardQuizVariantsSchema = z.object({
  trueFalse: z
    .object({
      statement: z.string().min(1),
      correctAnswer: z.boolean(),
    })
    .optional(),
  fillInBlank: z
    .object({
      segments: z.array(fillInBlankSegmentSchema).min(1),
    })
    .optional(),
});

export type CardQuizVariants = z.infer<typeof cardQuizVariantsSchema>;

export function parseCardQuizVariants(raw: unknown): CardQuizVariants | null {
  const parsed = cardQuizVariantsSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** First accepted answer for display in results / PDF. */
export function primaryBlankAnswer(segments: FillInBlankSegment[]): string {
  for (const seg of segments) {
    if (seg.type === "blank" && seg.acceptedAnswers[0]) {
      return seg.acceptedAnswers[0];
    }
  }
  return "";
}

/** Render fill-in-blank prompt as plain text (blanks shown as "___"). */
export function fillInBlankPromptText(segments: FillInBlankSegment[]): string {
  return segments
    .map((seg) => (seg.type === "text" ? seg.value : "___"))
    .join("")
    .trim();
}
