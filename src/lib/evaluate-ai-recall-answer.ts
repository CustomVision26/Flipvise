import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import type {
  RecallAnswerModality,
  RecallEvaluationResult,
} from "@/lib/ai-recall-types";

/**
 * OpenAI structured output requires every property in `required`.
 * Use `.nullable()` rather than `.optional()`.
 */
export const aiRecallEvaluationSchema = z.object({
  correct: z.boolean(),
  score: z.number().min(0).max(100),
  confidence: z.number().min(0).max(100),
  feedback: z.string(),
  explanation: z.string(),
});

export type EvaluateAiRecallAnswerInput = {
  question: string;
  correctAnswer: string;
  studentAnswer: string;
  modality?: RecallAnswerModality;
  /** JPEG/PNG data URL for drawing answers (vision). */
  drawingImageDataUrl?: string | null;
  deckSubject?: string | null;
  difficulty?: string | null;
  cardMetadata?: string | null;
};

const DATA_URL_RE = /^data:image\/(png|jpeg|jpg|webp);base64,/i;

export async function evaluateAiRecallAnswer(
  input: EvaluateAiRecallAnswerInput,
): Promise<RecallEvaluationResult> {
  const question = input.question.trim();
  const correctAnswer = input.correctAnswer.trim();
  const studentAnswer = input.studentAnswer.trim();
  const modality = input.modality ?? "text";
  const drawing = input.drawingImageDataUrl?.trim() || null;

  if (!question || !correctAnswer) {
    return {
      correct: false,
      score: 0,
      confidence: 100,
      feedback: "This card is missing a question or answer.",
      explanation: "Add content to the card before using AI Recall™.",
    };
  }

  const hasDrawing = Boolean(drawing && DATA_URL_RE.test(drawing));
  if (!studentAnswer && !hasDrawing) {
    return {
      correct: false,
      score: 0,
      confidence: 100,
      feedback: "No answer was provided.",
      explanation: correctAnswer,
    };
  }

  if (drawing && drawing.length > 1_800_000) {
    return {
      correct: false,
      score: 0,
      confidence: 100,
      feedback: "Drawing is too large to evaluate. Clear and try a simpler sketch.",
      explanation: correctAnswer,
    };
  }

  const metaLines = [
    input.deckSubject?.trim()
      ? `Deck subject / topic: ${input.deckSubject.trim()}`
      : null,
    input.difficulty?.trim() ? `Difficulty: ${input.difficulty.trim()}` : null,
    input.cardMetadata?.trim()
      ? `Card metadata: ${input.cardMetadata.trim()}`
      : null,
    `Answer modality: ${modality}`,
  ].filter(Boolean);

  const system = [
    "You evaluate Active Recall answers for a flashcard study app (AI Recall™).",
    "Decide whether the student's answer demonstrates understanding of the correct answer.",
    "Accept synonyms, equivalent wording, minor spelling mistakes, and alternate phrasing.",
    "For spoken (voice) answers, tolerate ASR transcription errors when the intended meaning is clear.",
    "For drawings, interpret diagrams, labeled figures, plotted points, equations, and handwritten words.",
    "Reject factually incorrect answers.",
    "Return JSON only matching the schema. Keep feedback concise (1–2 short sentences).",
    "explanation should teach or clarify using the correct answer; do not invent unrelated facts.",
  ].join(" ");

  const textPrompt = [
    `Question: ${question}`,
    `Correct answer: ${correctAnswer}`,
    studentAnswer
      ? `Student answer (text/transcript): ${studentAnswer}`
      : "Student answer (text/transcript): (none — evaluate the drawing image)",
    ...metaLines,
  ].join("\n");

  const { output } = hasDrawing
    ? await generateText({
        model: openai("gpt-4o"),
        output: Output.object({ schema: aiRecallEvaluationSchema }),
        system,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: textPrompt },
              { type: "image", image: drawing! },
            ],
          },
        ],
      })
    : await generateText({
        model: openai("gpt-4o"),
        output: Output.object({ schema: aiRecallEvaluationSchema }),
        system,
        prompt: textPrompt,
      });

  if (!output) {
    return {
      correct: false,
      score: 0,
      confidence: 0,
      feedback: "We could not evaluate that answer right now. Try again.",
      explanation: correctAnswer,
    };
  }

  return {
    correct: Boolean(output.correct),
    score: Math.round(Math.min(100, Math.max(0, Number(output.score) || 0))),
    confidence: Math.round(
      Math.min(100, Math.max(0, Number(output.confidence) || 0)),
    ),
    feedback:
      String(output.feedback || "").trim() ||
      (output.correct ? "Excellent." : "Not quite."),
    explanation: String(output.explanation || "").trim() || correctAnswer,
  };
}
