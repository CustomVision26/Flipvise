import { generateImage } from "ai";
import { openai } from "@ai-sdk/openai";

type DeckLike = { name: string };

export async function generateAnswerBackImage(
  deck: DeckLike,
  question: string,
  answer: string,
): Promise<{ data: Uint8Array; mediaType: string } | null> {
  try {
    const { image } = await generateImage({
      model: openai.image("gpt-image-1-mini"),
      prompt: `Educational flashcard illustration for a deck called "${deck.name}".
Front of card: ${question}
Back of card (answer): ${answer}

Create one clear, simple illustration that visually represents the answer concept. Use a clean neutral background. No text, words, labels, letters, numbers, logos, or watermarks in the image.`,
      size: "1024x1024",
      providerOptions: {
        openai: {
          output_format: "webp",
        },
      },
    });
    if (!image?.uint8Array?.length) return null;
    return {
      data: image.uint8Array,
      mediaType: image.mediaType || "image/webp",
    };
  } catch (error) {
    console.error("[generateAnswerBackImage]", error);
    return null;
  }
}
