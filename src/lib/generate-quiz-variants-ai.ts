import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import {
  formatMcqContextForAiPrompt,
  mcqSnapshotFromContext,
  resolveCardMcqContext,
  type CardMcqContext,
} from "@/lib/card-mcq-context";
import {
  type CardQuizVariants,
  type FillInBlankSegment,
} from "@/lib/card-quiz-variants";

/**
 * OpenAI structured output requires every property to be listed in `required`.
 * Use parallel fields instead of optional `value` / `acceptedAnswers`.
 */
const aiFillInBlankSegmentSchema = z.object({
  type: z.enum(["text", "blank"]),
  text: z
    .string()
    .describe("Visible text for this segment; use empty string when type is blank"),
  answers: z
    .array(z.string().min(1))
    .describe("Accepted answers when type is blank; use empty array when type is text"),
});

function buildAiOutputSchema(includeTrueFalse: boolean, includeFillInBlank: boolean) {
  const shape: Record<string, z.ZodTypeAny> = {};

  if (includeTrueFalse) {
    shape.trueFalse = z.object({
      statement: z.string().min(1),
      correctAnswer: z.boolean(),
    });
  }

  if (includeFillInBlank) {
    shape.fillInBlank = z.object({
      segments: z.array(aiFillInBlankSegmentSchema).min(1),
    });
  }

  return z.object(shape);
}

function normalizeAiFillInBlankSegments(
  segments: z.infer<typeof aiFillInBlankSegmentSchema>[],
): FillInBlankSegment[] | null {
  const out: FillInBlankSegment[] = [];

  for (const seg of segments) {
    if (seg.type === "text") {
      const value = seg.text.trim();
      if (!value) return null;
      out.push({ type: "text", value });
      continue;
    }

    if (seg.type === "blank") {
      const acceptedAnswers = seg.answers
        .map((answer) => answer.trim())
        .filter((answer) => answer.length > 0);
      if (acceptedAnswers.length === 0) return null;
      out.push({ type: "blank", acceptedAnswers });
      continue;
    }

    return null;
  }

  if (!out.some((seg) => seg.type === "blank")) return null;
  return out;
}

export async function generateQuizVariantsForCard(input: {
  front: string;
  back: string;
  includeTrueFalse: boolean;
  includeFillInBlank: boolean;
  mcqContext?: CardMcqContext | null;
}): Promise<CardQuizVariants> {
  const { front, back, includeTrueFalse, includeFillInBlank, mcqContext } = input;
  if (!includeTrueFalse && !includeFillInBlank) {
    return {};
  }

  const parts: string[] = [
    "You create quiz question variants from flashcard content.",
    `Flashcard question: ${front.trim()}`,
    `Correct answer / fact: ${back.trim()}`,
    "",
  ];

  if (mcqContext) {
    parts.push(formatMcqContextForAiPrompt(mcqContext), "");
  } else {
    parts.push(
      "No stored multiple-choice distractors were found for this card. Ground variants only in the flashcard question and correct answer.",
      "",
    );
  }

  if (includeTrueFalse) {
    parts.push(
      "TRUE/FALSE: You MUST include a trueFalse object.",
      "Write one grammatically correct declarative sentence that is either true or false based on the fact.",
      mcqContext?.distractors.length
        ? "When correctAnswer is false, the statement MUST use one of the stored wrong options as the claimed value (not a new invented number or fact)."
        : "About half the time make the statement true (correctAnswer: true), half false (correctAnswer: false).",
      mcqContext?.distractors.length
        ? "When correctAnswer is true, the statement must match the stored correct answer."
        : "When false, the statement must be plausible but clearly wrong when you know the fact.",
      "Do not prefix with 'True or false:' — only the sentence.",
    );
  }

  if (includeFillInBlank) {
    parts.push(
      "FILL IN THE BLANK: You MUST include a fillInBlank object with segments.",
      "Build a single grammatically correct sentence with exactly one blank.",
      mcqContext
        ? "The blank's primary accepted answer must be the stored correct answer."
        : "The blank's primary accepted answer must be the flashcard correct answer / fact.",
      "Use segments with type 'text' or 'blank' only.",
      "For text segments: set text to the visible words and answers to [].",
      "For the blank segment: set text to '' and answers to 1–3 acceptable spellings of the correct answer.",
      "Example shape: [{ type: 'text', text: 'The capital of France is ', answers: [] }, { type: 'blank', text: '', answers: ['Paris'] }].",
      "Alternate text and blank segments so the sentence reads naturally with one blank.",
    );
  }

  if (includeTrueFalse && includeFillInBlank) {
    parts.push(
      "IMPORTANT: Return BOTH trueFalse and fillInBlank in the same response. Do not omit either field.",
    );
  }

  const schema = buildAiOutputSchema(includeTrueFalse, includeFillInBlank);
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const attemptParts =
      attempt === 1
        ? parts
        : [
            ...parts,
            "",
            `Attempt ${attempt}/${maxAttempts}: Previous output was missing required quiz formats.`,
            includeTrueFalse && includeFillInBlank
              ? "You must return both trueFalse and a valid fillInBlank.segments array with exactly one blank."
              : includeFillInBlank
                ? "You must return a valid fillInBlank.segments array with exactly one blank and non-empty answers."
                : "You must return a valid trueFalse statement and correctAnswer.",
          ];

    const { output } = await generateText({
      model: openai("gpt-4o"),
      output: Output.object({ schema }),
      prompt: attemptParts.join("\n"),
    });

    const parsed = schema.safeParse(output);
    if (!parsed.success) {
      if (attempt === maxAttempts) {
        throw new Error("AI returned invalid quiz variants");
      }
      continue;
    }

    const result: CardQuizVariants = {};
    const data = parsed.data as {
      trueFalse?: { statement: string; correctAnswer: boolean };
      fillInBlank?: { segments: z.infer<typeof aiFillInBlankSegmentSchema>[] };
    };

    if (includeTrueFalse && data.trueFalse?.statement?.trim()) {
      result.trueFalse = {
        statement: data.trueFalse.statement.trim(),
        correctAnswer: data.trueFalse.correctAnswer,
      };
    }

    if (includeFillInBlank && data.fillInBlank?.segments?.length) {
      const segments = normalizeAiFillInBlankSegments(data.fillInBlank.segments);
      if (segments) {
        result.fillInBlank = { segments };
      }
    }

    const missingTf = includeTrueFalse && !result.trueFalse;
    const missingFib = includeFillInBlank && !result.fillInBlank;
    if (missingTf || missingFib) {
      if (attempt === maxAttempts) {
        throw new Error(
          missingFib
            ? "AI did not create a valid fill-in-the-blank question. Try Generate again."
            : "AI did not create a valid true/false question. Try Generate again.",
        );
      }
      continue;
    }

    if (mcqContext && (result.trueFalse || result.fillInBlank)) {
      result.sourceMcq = mcqSnapshotFromContext(mcqContext);
    }

    return result;
  }

  throw new Error("AI could not create the requested quiz formats.");
}

export async function generateQuizVariantsBatch(
  cards: {
    id: number;
    front: string;
    back: string;
    choices?: string[] | null;
    correctChoiceIndex?: number | null;
    quizVariants?: CardQuizVariants | null;
  }[],
  formats: { trueFalse: boolean; fillInBlank: boolean },
  onProgress?: (done: number, total: number) => void,
): Promise<Map<number, CardQuizVariants>> {
  const out = new Map<number, CardQuizVariants>();
  let done = 0;
  for (const card of cards) {
    const front = card.front.trim();
    const back = card.back.trim();
    if (!front || !back) {
      done++;
      onProgress?.(done, cards.length);
      continue;
    }
    try {
      const mcqContext = resolveCardMcqContext(card);
      const variants = await generateQuizVariantsForCard({
        front,
        back,
        includeTrueFalse: formats.trueFalse,
        includeFillInBlank: formats.fillInBlank,
        mcqContext,
      });
      if (variants.trueFalse || variants.fillInBlank) {
        out.set(card.id, variants);
      }
    } catch {
      // Skip cards that fail AI generation — MC can still work.
    }
    done++;
    onProgress?.(done, cards.length);
  }
  return out;
}
