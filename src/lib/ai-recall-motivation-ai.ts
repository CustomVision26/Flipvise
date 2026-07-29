import "server-only";

import { Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { trackedGenerateText } from "@/lib/ai-usage/track";
import {
  isAiAccessDisabledError,
  isAiUsageLimitError,
} from "@/lib/ai-usage/errors";
import { z } from "zod";
import {
  fallbackAiRecallMotivation,
  resolveMotivationTier,
  type AiRecallMotivation,
  type AiRecallMotivationTier,
} from "@/lib/ai-recall-motivation";

const motivationOutputSchema = z.object({
  title: z.string(),
  message: z.string(),
  author: z.string().nullable(),
});

const TIER_PROMPT: Record<AiRecallMotivationTier, string> = {
  improve:
    "The learner scored below 50%. Encourage them warmly to improve without sounding harsh. Emphasize growth, practice, and that mistakes are part of learning.",
  encourage:
    "The learner scored between 50% and 90%. Encourage them on the work they put in. Celebrate progress and motivate continued practice.",
  excellence:
    "The learner scored over 90% (up to 100%). Give them a celebratory “flower of excellence” moment — vivid, warm praise for outstanding recall mastery. Mentions of blooming, flourishing, or a flower of excellence are welcome.",
};

export async function generateAiRecallMotivation(input: {
  percentCorrect: number;
  correct: number;
  reviewed: number;
  deckName?: string | null;
}): Promise<AiRecallMotivation> {
  const percentCorrect = Math.min(
    100,
    Math.max(0, Math.round(input.percentCorrect)),
  );
  const tier = resolveMotivationTier(percentCorrect);
  const fallback = fallbackAiRecallMotivation(percentCorrect);

  try {
    const { output } = await trackedGenerateText({
      model: openai("gpt-4o"),
      output: Output.object({ schema: motivationOutputSchema }),
      prompt: [
        "You write short motivational quotes for Flipvise AI Recall™ study sessions.",
        "Return: title (max 6 words), message (1–2 sentences, max 220 characters), and author.",
        "Prefer a real, well-known short quote that fits the tier — only if you are confident the attribution is accurate.",
        "If using a real quote: set message to the quote text and author to the person's common name (e.g. \"Nelson Mandela\", \"Maya Angelou\").",
        "If writing an original line instead: set author to \"Flipvise\". Never invent a fake famous author.",
        "Tone: supportive, study/recall oriented, no emojis, no hashtags, no medical claims.",
        `Tier guidance: ${TIER_PROMPT[tier]}`,
        `Accuracy: ${percentCorrect}% (${input.correct} correct of ${input.reviewed} reviewed).`,
        input.deckName?.trim()
          ? `Deck name (optional flavor only): ${input.deckName.trim()}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
    });

    if (!output?.title?.trim() || !output?.message?.trim()) {
      return fallback;
    }

    const authorRaw = output.author?.trim() || null;

    return {
      tier,
      percentCorrect,
      title: output.title.trim().slice(0, 80),
      message: output.message.trim().slice(0, 280),
      author: authorRaw ? authorRaw.slice(0, 80) : "Flipvise",
    };
  } catch (error) {
    if (isAiUsageLimitError(error) || isAiAccessDisabledError(error)) {
      throw error;
    }
    return fallback;
  }
}
