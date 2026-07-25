import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

export type AiRecallMotivationTier = "improve" | "encourage" | "excellence";

export type AiRecallMotivation = {
  tier: AiRecallMotivationTier;
  percentCorrect: number;
  title: string;
  message: string;
  /** Quote attribution when available (famous author or Flipvise). */
  author: string | null;
};

const motivationOutputSchema = z.object({
  title: z.string(),
  message: z.string(),
  author: z.string().nullable(),
});

/** Session accuracy = correct ÷ reviewed (forced unlocks count as not correct). */
export function computeSessionAccuracyPercent(
  correct: number,
  reviewed: number,
): number {
  if (reviewed <= 0) return 0;
  return Math.round((correct / reviewed) * 100);
}

export function resolveMotivationTier(
  percentCorrect: number,
): AiRecallMotivationTier {
  if (percentCorrect > 90) return "excellence";
  if (percentCorrect >= 50) return "encourage";
  return "improve";
}

export function fallbackAiRecallMotivation(
  percentCorrect: number,
): AiRecallMotivation {
  const tier = resolveMotivationTier(percentCorrect);
  if (tier === "excellence") {
    return {
      tier,
      percentCorrect,
      title: "Your flower of excellence",
      message:
        "Outstanding work — you bloomed through this session with near-perfect recall. Keep watering that mastery.",
      author: "Flipvise",
    };
  }
  if (tier === "encourage") {
    return {
      tier,
      percentCorrect,
      title: "Solid progress",
      message:
        "Nice work this session. Your effort is paying off — keep practicing and those tough cards will stick.",
      author: "Flipvise",
    };
  }
  return {
    tier,
    percentCorrect,
    title: "Keep going",
    message:
      "Every attempt builds stronger recall. Review the tough cards again soon — improvement is within reach.",
    author: "Flipvise",
  };
}

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
    const { output } = await generateText({
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
  } catch {
    return fallback;
  }
}
