import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
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
}): Promise<CardQuizVariants> {
  const { front, back, includeTrueFalse, includeFillInBlank } = input;
  if (!includeTrueFalse && !includeFillInBlank) {
    return {};
  }

  const parts: string[] = [
    "You create quiz question variants from flashcard content.",
    `Flashcard question: ${front.trim()}`,
    `Correct answer / fact: ${back.trim()}`,
    "",
  ];

  if (includeTrueFalse) {
    parts.push(
      "TRUE/FALSE: Write one grammatically correct declarative sentence that is either true or false based on the fact.",
      "About half the time make the statement true (correctAnswer: true), half false (correctAnswer: false).",
      "When false, the statement must be plausible but clearly wrong when you know the fact.",
      "Do not prefix with 'True or false:' — only the sentence.",
    );
  }

  if (includeFillInBlank) {
    parts.push(
      "FILL IN THE BLANK: Build a single grammatically correct sentence with exactly one blank.",
      "Use segments with type 'text' or 'blank'.",
      "For text segments: set text to the visible words and answers to [].",
      "For the blank segment: set text to '' and answers to 1–3 acceptable spellings.",
      "Alternate text and blank segments so the sentence reads naturally with one blank.",
    );
  }

  const schema = buildAiOutputSchema(includeTrueFalse, includeFillInBlank);

  const { output } = await generateText({
    model: openai("gpt-4o"),
    output: Output.object({ schema }),
    prompt: parts.join("\n"),
  });

  const parsed = schema.safeParse(output);
  if (!parsed.success) {
    throw new Error("AI returned invalid quiz variants");
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

  return result;
}

export async function generateQuizVariantsBatch(
  cards: { id: number; front: string; back: string }[],
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
      const variants = await generateQuizVariantsForCard({
        front,
        back,
        includeTrueFalse: formats.trueFalse,
        includeFillInBlank: formats.fillInBlank,
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
