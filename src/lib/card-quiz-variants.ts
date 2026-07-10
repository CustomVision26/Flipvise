import { z } from "zod";

export const fillInBlankSegmentSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), value: z.string() }),
  z.object({
    type: z.literal("blank"),
    acceptedAnswers: z.array(z.string().min(1)).min(1),
  }),
]);

export type FillInBlankSegment = z.infer<typeof fillInBlankSegmentSchema>;

export const mcqSourceSnapshotSchema = z.object({
  choices: z.array(z.string().min(1)).min(1),
  correctChoiceIndex: z.number().int().min(0),
});

export type McqSourceSnapshot = z.infer<typeof mcqSourceSnapshotSchema>;

export const cardQuizVariantsSchema = z.object({
  /** Snapshot of MCQ options used when T/F or FIB variants were generated. */
  sourceMcq: mcqSourceSnapshotSchema.optional(),
  trueFalse: z
    .object({
      statement: z
        .string()
        .transform((value) => value.trim())
        .pipe(z.string().min(1)),
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

/** Rebuild fill-in-the-blank segments from a simple admin edit form. */
export function fillInBlankFromSimpleForm(
  promptWithBlank: string,
  acceptedAnswers: string[],
): FillInBlankSegment[] | null {
  const prompt = promptWithBlank.trim();
  if (!prompt.includes("___")) return null;
  const answers = acceptedAnswers.map((a) => a.trim()).filter(Boolean);
  if (answers.length === 0) return null;

  const [before = "", after = ""] = prompt.split("___");
  const segments: FillInBlankSegment[] = [];
  if (before) segments.push({ type: "text", value: before });
  segments.push({ type: "blank", acceptedAnswers: answers });
  if (after) segments.push({ type: "text", value: after });
  return segments.length > 0 ? segments : null;
}

/** All accepted spellings across blank segments (for preview / edit forms). */
export function allBlankAcceptedAnswers(segments: FillInBlankSegment[]): string[] {
  const out: string[] = [];
  for (const seg of segments) {
    if (seg.type === "blank") {
      for (const answer of seg.acceptedAnswers) {
        const trimmed = answer.trim();
        if (trimmed) out.push(trimmed);
      }
    }
  }
  return out;
}
