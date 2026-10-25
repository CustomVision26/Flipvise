import { generateImage } from "ai";
import { openai } from "@ai-sdk/openai";
import { trackRawAiCall } from "@/lib/ai-usage/track";
import {
  isAiAccessDisabledError,
  isAiUsageLimitError,
} from "@/lib/ai-usage/errors";
import sharp from "sharp";
import { matchIllustratedReference } from "@/lib/illustrated-reference-bank";
import { readIllustratedReferenceTile } from "@/lib/illustrated-reference-bank-file";
import { planAllowsIllustratedDesign } from "@/lib/illustrated-appearance";

type DeckLike = { name: string };

export async function generateAnswerBackImage(
  deck: DeckLike,
  question: string,
  answer: string,
  usage: {
    userId: string;
    teamId?: number | null;
    subscriptionPlan?: string | null;
    isPlatformAdmin?: boolean;
    planSlug?: string | null;
  },
): Promise<{ data: Uint8Array; mediaType: string } | null> {
  try {
    const cartoonAllowed = planAllowsIllustratedDesign(usage.planSlug);
    if (cartoonAllowed) {
      const bankMatch = matchIllustratedReference(`${question}\n${answer}`, {
        specificOnly: true,
      });
      if (bankMatch) {
        const bankImage = await readIllustratedReferenceTile(bankMatch);
        if (bankImage) {
          const meta = await sharp(bankImage.data).metadata();
          const width = meta.width ?? 0;
          const height = meta.height ?? 0;
          if (width >= 512 && height >= 512) return bankImage;
        }
      }
    }

    return await trackRawAiCall(
      {
        userId: usage.userId,
        feature: "image_generation",
        teamId: usage.teamId ?? null,
        subscriptionPlan: usage.subscriptionPlan,
        isPlatformAdmin: usage.isPlatformAdmin,
        model: "gpt-image-1-mini",
        imageCount: 1,
      },
      async () => {
        const { image } = await generateImage({
          model: openai.image("gpt-image-1-mini"),
          prompt: `Educational flashcard illustration for a deck called "${deck.name}".
Front of card: ${question}
Back of card (answer): ${answer}

Create one clear, simple illustration that visually represents the answer concept. Use a clean neutral background. No text, words, labels, letters, numbers, logos, or watermarks in the image.${
            cartoonAllowed
              ? " Style: friendly dimensional cartoon, matching the Flipvise deck reference bank (soft shadows, rich controlled color, rounded forms). The local reference bank was checked first and has no scene for this answer."
              : ""
          }`,
          size: "1024x1024",
          providerOptions: {
            openai: {
              output_format: "webp",
            },
          },
        });
        if (!image?.uint8Array?.length) {
          return { value: null };
        }
        return {
          value: {
            data: image.uint8Array,
            mediaType: image.mediaType || "image/webp",
          },
        };
      },
    );
  } catch (error) {
    if (isAiUsageLimitError(error) || isAiAccessDisabledError(error)) {
      throw error;
    }
    console.error("[generateAnswerBackImage]", error);
    return null;
  }
}
