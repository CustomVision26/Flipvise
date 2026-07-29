import "server-only";

import { Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { trackedGenerateText } from "@/lib/ai-usage/track";
import {
  isAiAccessDisabledError,
  isAiUsageLimitError,
} from "@/lib/ai-usage/errors";
import type { cards } from "@/db/schema";
import type { WorksheetItem } from "@/lib/teacher-worksheet-schema";
import {
  buildWorksheetItemsFromCards,
  renumberWorksheetItems,
} from "@/lib/worksheet-from-deck";

type CardRow = typeof cards.$inferSelect;

const aiWorksheetQuestionsSchema = z.object({
  questions: z
    .array(
      z.object({
        prompt: z.string().min(1),
        answer: z.string().min(1),
      }),
    )
    .min(1)
    .max(50),
});

function formatDeckCardsForPrompt(cardRows: CardRow[], maxCards = 24): string {
  const sample = cardRows.slice(0, maxCards);
  return sample
    .map((card, index) => {
      const front = card.front?.trim() || "(image prompt)";
      const back = card.back?.trim() || "(see answer image)";
      const choices =
        card.cardType === "multiple_choice" && card.choices?.length
          ? `\n  Choices: ${card.choices.join(" | ")}`
          : "";
      return `${index + 1}. Front: ${front}\n  Back: ${back}${choices}`;
    })
    .join("\n");
}

/** Offline fallback: cycle deck cards into the requested count. */
export function expandWorksheetItemsFromCards(
  cardRows: CardRow[],
  numberOfQuestions: number,
): WorksheetItem[] {
  const base = buildWorksheetItemsFromCards(cardRows);
  if (base.length === 0) return [];
  if (numberOfQuestions <= base.length) {
    return renumberWorksheetItems(base.slice(0, numberOfQuestions));
  }

  const items: WorksheetItem[] = [];
  for (let index = 0; index < numberOfQuestions; index++) {
    const source = base[index % base.length]!;
    const cycle = Math.floor(index / base.length);
    items.push({
      questionNumber: index + 1,
      prompt:
        cycle === 0
          ? source.prompt
          : `Using this deck idea, practice again (variation ${cycle + 1}): ${source.prompt}`,
      promptImageUrl: cycle === 0 ? source.promptImageUrl : null,
      answer: source.answer,
      answerImageUrl: cycle === 0 ? source.answerImageUrl : null,
      frontImageUrl: cycle === 0 ? source.frontImageUrl : null,
      backImageUrl: cycle === 0 ? source.backImageUrl : null,
    });
  }
  return items;
}

/**
 * When more questions are requested than deck cards, ask AI to create
 * additional practice items grounded in the deck content.
 */
export async function resolveWorksheetItemsForCount(input: {
  cardRows: CardRow[];
  numberOfQuestions: number;
  subject: string;
  gradeLevel: string;
  topic: string;
  worksheetType: string;
  difficultyLevel: string;
  deckName: string;
}): Promise<WorksheetItem[]> {
  const { cardRows, numberOfQuestions } = input;
  if (cardRows.length === 0) return [];

  if (numberOfQuestions <= cardRows.length) {
    return renumberWorksheetItems(
      buildWorksheetItemsFromCards(cardRows.slice(0, numberOfQuestions)),
    );
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return expandWorksheetItemsFromCards(cardRows, numberOfQuestions);
  }

  try {
    const { output } = await trackedGenerateText({
      model: openai("gpt-4o"),
      output: Output.object({
        schema: aiWorksheetQuestionsSchema,
      }),
      system: `You are an expert K–12 teacher creating worksheet practice questions with answer keys from flashcard deck content.

Requirements:
- Generate exactly ${numberOfQuestions} distinct worksheet questions.
- Ground every question in the deck flashcards (front/back content and any multiple-choice choices).
- Expand beyond a 1:1 card copy: create varied practice (rephrased prompts, application, short response, identify, explain, or solve) while staying on the same skills/vocabulary.
- Match subject, grade, topic, worksheet type, and difficulty.
- Do NOT prefix prompts or answers with numbers, bullets, or labels.
- Answers must be concise and classroom-ready (one clear correct answer per question).
- Do not use markdown formatting.
- Prefer plain text prompts (no image dependencies).`,
      prompt: [
        `Deck: ${input.deckName}`,
        `Subject: ${input.subject}`,
        `Grade level: ${input.gradeLevel}`,
        `Topic: ${input.topic}`,
        `Worksheet type: ${input.worksheetType}`,
        `Difficulty: ${input.difficultyLevel}`,
        `Requested questions: ${numberOfQuestions}`,
        `Deck has ${cardRows.length} card(s); create ${numberOfQuestions} practice questions from this material.`,
        "",
        "Deck flashcards:",
        formatDeckCardsForPrompt(cardRows),
      ].join("\n"),
    });

    if (!output?.questions?.length) {
      throw new Error("AI worksheet expansion returned no questions.");
    }

    const questions = output.questions.slice(0, numberOfQuestions);
    if (questions.length < numberOfQuestions) {
      throw new Error(
        `AI worksheet expansion returned ${questions.length} of ${numberOfQuestions} questions.`,
      );
    }

    return renumberWorksheetItems(
      questions.map((question) => ({
        questionNumber: 1,
        prompt: question.prompt.trim(),
        promptImageUrl: null,
        answer: question.answer.trim(),
        answerImageUrl: null,
        frontImageUrl: null,
        backImageUrl: null,
      })),
    );
  } catch (error) {
    if (isAiUsageLimitError(error) || isAiAccessDisabledError(error)) {
      throw error;
    }
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[resolveWorksheetItemsForCount] AI expansion failed; using card expansion fallback.",
        error,
      );
    }
    return expandWorksheetItemsFromCards(cardRows, numberOfQuestions);
  }
}
