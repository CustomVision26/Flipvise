"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { getAccessContext } from "@/lib/access";
import { z } from "zod";
import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { uploadToS3, deleteFromS3 } from "@/lib/s3";
import { getDeckById } from "@/db/queries/decks";
import { createCard, updateCard, deleteCard, getCardById, getCardsByDeck, bulkCreateCards, deleteAllCards } from "@/db/queries/cards";
import {
  AI_GENERATION_CAP_PER_DECK,
  CARDS_PER_DECK_LIMIT_FREE,
  CARDS_PER_DECK_LIMIT_PRO,
  getCardsPerDeckLimit,
} from "@/lib/deck-limits";

const createCardSchema = z
  .object({
    deckId: z.number().int().positive(),
    front: z.string(),
    frontImageUrl: z.string().url().nullable().optional(),
    back: z.string(),
    backImageUrl: z.string().url().nullable().optional(),
  })
  .refine((d) => d.front.trim().length > 0 || !!d.frontImageUrl, {
    message: "Front must have text or an image",
    path: ["front"],
  })
  .refine((d) => d.back.trim().length > 0 || !!d.backImageUrl, {
    message: "Back must have text or an image",
    path: ["back"],
  });

const updateCardSchema = z
  .object({
    cardId: z.number().int().positive(),
    deckId: z.number().int().positive(),
    front: z.string(),
    frontImageUrl: z.string().url().nullable().optional(),
    back: z.string(),
    backImageUrl: z.string().url().nullable().optional(),
    oldFrontImageUrl: z.string().url().nullable().optional(),
    oldBackImageUrl: z.string().url().nullable().optional(),
  })
  .refine((d) => d.front.trim().length > 0 || !!d.frontImageUrl, {
    message: "Front must have text or an image",
    path: ["front"],
  })
  .refine((d) => d.back.trim().length > 0 || !!d.backImageUrl, {
    message: "Back must have text or an image",
    path: ["back"],
  });

const uploadCardImageSchema = z.object({
  deckId: z.number().int().positive(),
});

const deleteCardSchema = z.object({
  cardId: z.number().int().positive(),
  deckId: z.number().int().positive(),
});

const generateCardsSchema = z.object({
  deckId: z.number().int().positive(),
  count: z
    .number()
    .int()
    .min(5)
    .max(75)
    .refine((n) => n % 5 === 0, "Count must be a multiple of 5"),
});

const generateAnswerSchema = z.object({
  deckId: z.number().int().positive(),
  question: z.string().min(1),
});

const validateQuestionRelevanceSchema = z.object({
  isRelevant: z.boolean(),
  warning: z.string().optional(),
});

type CreateCardInput = {
  deckId: number;
  front: string;
  frontImageUrl?: string | null;
  back: string;
  backImageUrl?: string | null;
};
type UpdateCardInput = {
  cardId: number;
  deckId: number;
  front: string;
  frontImageUrl?: string | null;
  back: string;
  backImageUrl?: string | null;
  oldFrontImageUrl?: string | null;
  oldBackImageUrl?: string | null;
};
type DeleteCardInput = z.infer<typeof deleteCardSchema>;
type GenerateCardsInput = z.infer<typeof generateCardsSchema>;
type GenerateAnswerInput = z.infer<typeof generateAnswerSchema>;
type UploadCardImageInput = z.infer<typeof uploadCardImageSchema>;

export async function uploadCardImageAction(
  data: UploadCardImageInput,
  formData: FormData,
): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const parsed = uploadCardImageSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const { deckId } = parsed.data;

  const deck = await getDeckById(deckId, userId);
  if (!deck) throw new Error("Deck not found");

  const file = formData.get("image");
  if (!(file instanceof File)) throw new Error("No image file provided");

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowedTypes.includes(file.type)) {
    throw new Error("Only JPEG, PNG, WebP, and GIF images are allowed");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Image must be under 5 MB");
  }

  const url = await uploadToS3({
    userId,
    deckId,
    file,
    addRandomSuffix: true,
  });

  return url;
}

export async function createCardAction(data: CreateCardInput) {
  const { userId, hasUnlimitedDecks } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = createCardSchema.safeParse(data);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    throw new Error(firstError?.message ?? "Invalid input");
  }

  const { deckId, front, frontImageUrl, back, backImageUrl } = parsed.data;

  const deck = await getDeckById(deckId, userId);
  if (!deck) throw new Error("Deck not found");

  const existingCards = await getCardsByDeck(deckId);
  const deckCardLimit = getCardsPerDeckLimit(hasUnlimitedDecks);
  if (existingCards.length >= deckCardLimit) {
    throw new Error(
      hasUnlimitedDecks
        ? `Pro plan limit: ${CARDS_PER_DECK_LIMIT_PRO} cards per deck. Delete cards to add more.`
        : `Free plan limit: ${CARDS_PER_DECK_LIMIT_FREE} cards per deck. Upgrade to Pro for up to ${CARDS_PER_DECK_LIMIT_PRO} cards per deck.`,
    );
  }

  await createCard(
    deckId,
    front.trim() || null,
    frontImageUrl ?? null,
    back.trim() || null,
    backImageUrl ?? null,
  );

  revalidatePath(`/decks/${deckId}`);
}

export async function updateCardAction(data: UpdateCardInput) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const parsed = updateCardSchema.safeParse(data);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    throw new Error(firstError?.message ?? "Invalid input");
  }

  const {
    cardId,
    deckId,
    front,
    frontImageUrl,
    back,
    backImageUrl,
    oldFrontImageUrl,
    oldBackImageUrl,
  } = parsed.data;

  const deck = await getDeckById(deckId, userId);
  if (!deck) throw new Error("Deck not found");

  if (oldFrontImageUrl && oldFrontImageUrl !== frontImageUrl) {
    try {
      await deleteFromS3(oldFrontImageUrl);
    } catch {
      // Silently ignore deletion errors — card update should still succeed
    }
  }

  if (oldBackImageUrl && oldBackImageUrl !== backImageUrl) {
    try {
      await deleteFromS3(oldBackImageUrl);
    } catch {
      // Silently ignore deletion errors — card update should still succeed
    }
  }

  await updateCard(
    cardId,
    deckId,
    front.trim() || null,
    frontImageUrl ?? null,
    back.trim() || null,
    backImageUrl ?? null,
  );

  revalidatePath(`/decks/${deckId}`);
}

export async function deleteCardAction(data: DeleteCardInput) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const parsed = deleteCardSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const { cardId, deckId } = parsed.data;

  const deck = await getDeckById(deckId, userId);
  if (!deck) throw new Error("Deck not found");

  const card = await getCardById(cardId, deckId);
  if (card?.frontImageUrl) {
    try {
      await deleteFromS3(card.frontImageUrl);
    } catch {
      // Silently ignore deletion errors
    }
  }
  if (card?.backImageUrl) {
    try {
      await deleteFromS3(card.backImageUrl);
    } catch {
      // Silently ignore deletion errors
    }
  }

  await deleteCard(cardId, deckId);

  revalidatePath(`/decks/${deckId}`);
}

const deleteAllCardsSchema = z.object({
  deckId: z.number().int().positive(),
});

type DeleteAllCardsInput = z.infer<typeof deleteAllCardsSchema>;

export async function deleteAllCardsAction(data: DeleteAllCardsInput) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const parsed = deleteAllCardsSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const { deckId } = parsed.data;

  const deck = await getDeckById(deckId, userId);
  if (!deck) throw new Error("Deck not found");

  await deleteAllCards(deckId);

  revalidatePath(`/decks/${deckId}`);
}

export async function generateCardsAction(data: GenerateCardsInput) {
  const { userId, hasAI, hasUnlimitedDecks } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  if (!hasAI) throw new Error("AI flashcard generation requires a Pro plan.");

  const parsed = generateCardsSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const { deckId, count } = parsed.data;

  const deck = await getDeckById(deckId, userId);
  if (!deck) throw new Error("Deck not found");

  const existingCards = await getCardsByDeck(deckId);
  const aiGeneratedSoFar = existingCards.filter((c) => c.aiGenerated).length;
  const remainingAiSlots = AI_GENERATION_CAP_PER_DECK - aiGeneratedSoFar;
  if (count > remainingAiSlots) {
    throw new Error(
      `This deck can receive at most ${AI_GENERATION_CAP_PER_DECK} AI-generated cards (${remainingAiSlots} slot${remainingAiSlots !== 1 ? "s" : ""} left).`,
    );
  }

  const deckCardLimit = getCardsPerDeckLimit(hasUnlimitedDecks);
  const remainingDeckSlots = deckCardLimit - existingCards.length;
  if (count > remainingDeckSlots) {
    throw new Error(
      hasUnlimitedDecks
        ? `Not enough room in this deck (${remainingDeckSlots} card slot${remainingDeckSlots !== 1 ? "s" : ""} left; max ${CARDS_PER_DECK_LIMIT_PRO} per deck).`
        : `Not enough room in this deck on the Free plan (${remainingDeckSlots} card slot${remainingDeckSlots !== 1 ? "s" : ""} left).`,
    );
  }

  const topic = deck.description
    ? `${deck.name}: ${deck.description}`
    : deck.name;

  const { output } = await generateText({
    model: openai("gpt-4o"),
    output: Output.object({
      schema: z.object({
        cards: z.array(
          z.object({
            front: z.string(),
            back: z.string(),
          }),
        ),
      }),
    }),
    system: `You are a flashcard generation assistant. Infer the subject matter and purpose of the deck from its name and description, then generate cards in the format that best suits the topic.

For **problem-solving, mathematical, or computational topics** (e.g. algebra, calculus, geometry, trigonometry, statistics, physics, chemistry, programming algorithms, logic puzzles, financial calculations):
- Put a clear problem or question on the front
- On the back, show the complete step-by-step working out using EXACTLY this uniform format (use plain newlines between each element, no markdown, no bullet points):

Step 1: [Brief label describing the action]
[The computation or reasoning for this step]
Step 2: [Brief label describing the action]
[The computation or reasoning for this step]
(continue for as many steps as needed)
Answer: [The final result]

For **non-problem-solving topics** (vocabulary, definitions, historical facts, concepts, language learning):
- A term or concept on the front with a concise definition or explanation on the back
- Keep both sides brief and direct

Rules:
- NEVER use markdown formatting (no **, no *, no #, no backticks) in any card
- NEVER use bullet points or dashes in step-by-step cards
- Use the step-by-step format ONLY when the topic genuinely requires working through a process
- Let the deck name and description determine which format to use`,
    prompt: `Generate exactly ${count} flashcards for the following deck: ${topic}`,
  });

  const trimmed = output.cards.slice(0, count);
  if (trimmed.length === 0) {
    throw new Error("The model did not return any cards. Please try again.");
  }

  await bulkCreateCards(deckId, trimmed, true);

  revalidatePath(`/decks/${deckId}`);
}

export async function generateAnswerAction(data: GenerateAnswerInput): Promise<string> {
  const { userId, hasAI } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  if (!hasAI) throw new Error("AI answer generation requires a Pro plan.");

  const parsed = generateAnswerSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const { deckId, question } = parsed.data;

  const deck = await getDeckById(deckId, userId);
  if (!deck) throw new Error("Deck not found");

  const existingCards = await getCardsByDeck(deckId);
  const sampleCards = existingCards.slice(0, 5);

  const deckContext = deck.description
    ? `Deck Name: ${deck.name}\nDescription: ${deck.description}`
    : `Deck Name: ${deck.name}`;

  const sampleCardsContext = sampleCards.length > 0
    ? `\n\nExisting cards in this deck (for reference):\n${sampleCards.map((c, i) => `${i + 1}. Front: ${c.front || '[image only]'} | Back: ${c.back || '[image only]'}`).join('\n')}`
    : '';

  const fullContext = deckContext + sampleCardsContext;

  const { output: validationOutput } = await generateText({
    model: openai("gpt-4o"),
    output: Output.object({
      schema: validateQuestionRelevanceSchema,
    }),
    system: `You are a flashcard validation assistant. Determine if a given question matches the topic and scope of a flashcard deck.

Analyze the deck's name, description, and existing cards to understand its topic and scope. Then determine if the user's question is relevant to this deck.

Return:
- isRelevant: true if the question fits the deck's topic, false if it seems off-topic
- warning: If isRelevant is false, provide a brief, helpful message (1-2 sentences) explaining why the question seems unrelated and suggesting the user verify they're in the right deck. If isRelevant is true, omit this field.`,
    prompt: `${fullContext}

User's Question: ${question}

Does this question match the deck's topic and scope?`,
  });

  if (!validationOutput.isRelevant && validationOutput.warning) {
    throw new Error(validationOutput.warning);
  }

  const { output } = await generateText({
    model: openai("gpt-4o"),
    output: Output.object({
      schema: z.object({
        answer: z.string(),
      }),
    }),
    system: `You are a flashcard assistant helping users complete flashcards. Given a question or term on the front of a flashcard, generate an appropriate answer or definition for the back.

For **problem-solving, mathematical, or computational questions** (e.g. math problems, physics calculations, programming challenges):
- Provide a complete step-by-step solution using this uniform format:

Step 1: [Brief label describing the action]
[The computation or reasoning for this step]
Step 2: [Brief label describing the action]
[The computation or reasoning for this step]
(continue for as many steps as needed)
Answer: [The final result]

For **non-problem-solving questions** (definitions, facts, concepts, language learning):
- Provide a concise, accurate answer or definition
- Keep it brief and direct

Rules:
- NEVER use markdown formatting (no **, no *, no #, no backticks)
- NEVER use bullet points or dashes in step-by-step solutions
- Use plain newlines between steps
- Infer the appropriate format from the question type`,
    prompt: `${fullContext}

Question/Term: ${question}

Generate an appropriate answer for the back of this flashcard.`,
  });

  return output.answer;
}
