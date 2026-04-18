"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { getAccessContext } from "@/lib/access";
import { z } from "zod";
import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { uploadToS3, deleteFromS3 } from "@/lib/s3";
import { getDeckById } from "@/db/queries/decks";
import { createCard, updateCard, deleteCard, getCardById, getCardsByDeck, bulkCreateCards, deleteAllCards, createMultipleChoiceCard, updateMultipleChoiceCard, updateCardChoices } from "@/db/queries/cards";
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
    /**
     * Optional 3 AI-generated wrong answers captured during the AI "generate
     * answer" flow. If provided, they are stored on the card but never shown
     * in the normal front/back preview or during study.
     */
    distractors: z
      .array(z.string().min(1))
      .length(3)
      .nullable()
      .optional(),
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
  warning: z.string().nullable(),
});

/**
 * Maximum number of existing cards to feed back into the AI as context.
 * Higher = better style/scope matching, but more tokens per request.
 * Most-recent first.
 */
const AI_CONTEXT_CARD_SAMPLE_SIZE = 12;

/**
 * Models occasionally prefix their output with the role label that appeared
 * in the prompt (e.g. "Q: ", "Front: ", "Answer: "). We strip those leading
 * labels so the saved card text is just the actual content. Conservative —
 * only strips known label prefixes followed by a separator, never arbitrary
 * single words.
 */
const AI_LABEL_PREFIX_REGEX =
  /^\s*(?:q|a|question|answer|front|back|correct\s*answer|correct|term|definition|prompt|fact|distractor|wrong\s*answer)\s*[:\-–—]+\s+/i;

function stripAiLabelPrefix(text: string): string {
  let cleaned = text;
  // Strip up to a few stacked prefixes defensively (e.g. "Q: Front: ...").
  for (let i = 0; i < 3; i++) {
    const next = cleaned.replace(AI_LABEL_PREFIX_REGEX, "");
    if (next === cleaned) break;
    cleaned = next;
  }
  return cleaned;
}

/**
 * Capitalize the first alphabetic character of the string. Leaves the rest
 * untouched so abbreviations / mixed casing the user actually wrote are
 * preserved (only the very first letter is forced to upper case).
 */
function capitalizeFirstLetter(text: string): string {
  const trimmed = text.replace(/^\s+/, "");
  if (!trimmed) return trimmed;
  // Find the first character that has a distinct upper-case form (skips
  // leading punctuation, quotes, emojis, etc.) and upper-case just that one.
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    const upper = ch.toUpperCase();
    if (upper !== ch.toLowerCase()) {
      return trimmed.slice(0, i) + upper + trimmed.slice(i + 1);
    }
  }
  return trimmed;
}

/**
 * Normalize text coming straight from the AI: strip role-label prefixes
 * (e.g. "Q: ", "Front: ") and capitalize the first letter.
 */
function cleanAiText(text: string): string {
  return capitalizeFirstLetter(stripAiLabelPrefix(text.trim())).trimEnd();
}

/**
 * Normalize text coming from the user (manual create/update). We don't strip
 * label prefixes here (a user might genuinely want "A: 5" as a card front),
 * but we still capitalize the first letter for display consistency.
 */
function cleanUserText(text: string): string {
  return capitalizeFirstLetter(text.trim()).trimEnd();
}

type DeckLike = { name: string; description: string | null };
type ExistingCardLike = {
  front: string | null;
  back: string | null;
  cardType?: "standard" | "multiple_choice";
  choices?: string[] | null;
  correctChoiceIndex?: number | null;
};

/**
 * Build a consistent context block for the AI describing the deck (name +
 * description) and a representative sample of existing cards. The sample is
 * what lets the model match the established style, scope, and difficulty of
 * the deck and avoid duplicating cards the user already has.
 */
function buildDeckContext(
  deck: DeckLike,
  existingCards: ExistingCardLike[],
  options: { sampleSize?: number; includeForDuplicateCheck?: boolean } = {},
): string {
  const sampleSize = options.sampleSize ?? AI_CONTEXT_CARD_SAMPLE_SIZE;

  const deckHeader = deck.description
    ? `Deck Name: ${deck.name}\nDescription: ${deck.description}`
    : `Deck Name: ${deck.name}`;

  if (existingCards.length === 0) {
    return `${deckHeader}\n\n(This deck has no cards yet — establish a coherent style on your own based on the deck name and description.)`;
  }

  const sample = existingCards.slice(0, sampleSize);
  const formatted = sample
    .map((c, i) => {
      const front = c.front?.trim() || "[image only]";
      if (c.cardType === "multiple_choice" && c.choices && c.choices.length > 0) {
        const correctIdx = c.correctChoiceIndex ?? 0;
        const correct = c.choices[correctIdx] ?? "";
        const wrong = c.choices.filter((_, idx) => idx !== correctIdx).join(" | ");
        return `${i + 1}. [Multiple Choice] Q: ${front} | Correct: ${correct} | Distractors: ${wrong}`;
      }
      const back = c.back?.trim() || "[image only]";
      return `${i + 1}. Front: ${front} | Back: ${back}`;
    })
    .join("\n");

  const guidanceLine = options.includeForDuplicateCheck
    ? `\n\nMatch the established style, format, length, and difficulty of these cards. Stay strictly within the same subject matter and scope. Do NOT duplicate or paraphrase any of the existing cards above — generate genuinely new material.`
    : `\n\nMatch the established style, format, length, and difficulty of these cards. Stay strictly within the same subject matter and scope.`;

  return `${deckHeader}\n\nExisting cards in this deck (${existingCards.length} total, showing ${sample.length} most recent — use these to learn the deck's style and scope):\n${formatted}${guidanceLine}`;
}

/**
 * Generate exactly 3 plausible but definitively incorrect distractors for a
 * standard (Q&A) flashcard. Used both by the AI "generate answer" flow and
 * silently (background) when a user manually adds a standard card on an AI
 * plan — so every standard card ends up with a stored set of wrong answers
 * even if they are never displayed.
 *
 * Pure helper — does NOT perform auth checks. Only call from actions that
 * have already authed the user and verified deck ownership.
 */
async function generateStandardDistractors(
  deck: DeckLike,
  existingCards: ExistingCardLike[],
  question: string,
  correctAnswer: string,
): Promise<[string, string, string]> {
  const fullContext = buildDeckContext(deck, existingCards);

  const { output } = await generateText({
    model: openai("gpt-4o"),
    output: Output.object({
      schema: z.object({
        distractors: z.array(z.string().min(1)).length(3),
      }),
    }),
    system: `You generate 3 plausible but definitively incorrect wrong answers ("distractors") for a standard Q&A flashcard.

You will receive a deck context (name, description, and existing cards), the card's question/front, and the correct answer. Produce exactly 3 wrong answers that:
- Are clearly incorrect to someone who knows the subject
- Are plausible enough to make a student think (similar length, tone, category, and format to the correct answer)
- Are distinct from each other and from the correct answer
- Match the style, depth, and tone of the existing cards in the deck

Rules:
- NEVER use markdown formatting (no **, no *, no #, no backticks)
- Keep each distractor concise — same approximate length as the correct answer
- Return exactly 3 distractors, no more, no less
- Stay strictly within the subject matter and scope of the deck`,
    prompt: `${fullContext}

Question / Front: ${question}
Correct answer / Back: ${correctAnswer}

Generate exactly 3 plausible wrong answers that match the deck's style and scope.`,
  });

  const [d1, d2, d3] = output.distractors.map((d) => cleanAiText(d));
  return [d1, d2, d3];
}

type CreateCardInput = {
  deckId: number;
  front: string;
  frontImageUrl?: string | null;
  back: string;
  backImageUrl?: string | null;
  distractors?: string[] | null;
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
  const { userId, hasAI, has75CardsPerDeck } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = createCardSchema.safeParse(data);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    throw new Error(firstError?.message ?? "Invalid input");
  }

  const { deckId, front, frontImageUrl, back, backImageUrl, distractors } = parsed.data;

  const deck = await getDeckById(deckId, userId);
  if (!deck) throw new Error("Deck not found");

  const existingCards = await getCardsByDeck(deckId, userId);
  const deckCardLimit = getCardsPerDeckLimit(has75CardsPerDeck);
  if (existingCards.length >= deckCardLimit) {
    throw new Error(
      has75CardsPerDeck
        ? `Pro plan limit: ${CARDS_PER_DECK_LIMIT_PRO} cards per deck. Delete cards to add more.`
        : `Free plan limit: ${CARDS_PER_DECK_LIMIT_FREE} cards per deck. Upgrade to Pro for up to ${CARDS_PER_DECK_LIMIT_PRO} cards per deck.`,
    );
  }

  const frontText = cleanUserText(front) || null;
  const backText = cleanUserText(back) || null;

  // If the client already fetched AI distractors during the "Generate answer"
  // flow, persist them on insert — no second AI round-trip needed.
  const providedDistractors =
    Array.isArray(distractors) && distractors.length === 3 && backText
      ? [cleanAiText(distractors[0]), cleanAiText(distractors[1]), cleanAiText(distractors[2])]
      : null;

  const initialChoices = providedDistractors && backText
    ? [backText, ...providedDistractors]
    : null;

  const inserted = await createCard(
    deckId,
    frontText,
    frontImageUrl ?? null,
    backText,
    backImageUrl ?? null,
    false,
    initialChoices,
    initialChoices ? 0 : null,
  );

  // Manual path on a Pro plan: the user typed the question + correct answer
  // themselves. Silently generate 3 AI distractors in the same request and
  // back-fill them onto the card. Only when both sides are real text (we can't
  // meaningfully distract an image-only card).
  if (
    !initialChoices &&
    hasAI &&
    frontText &&
    backText &&
    inserted?.id
  ) {
    try {
      const aiDistractors = await generateStandardDistractors(
        deck,
        existingCards,
        frontText,
        backText,
      );
      await updateCardChoices(inserted.id, deckId, [backText, ...aiDistractors], 0);
    } catch {
      // Distractor generation is a best-effort enhancement — never fail the
      // card creation because of an AI hiccup.
    }
  }

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
    cleanUserText(front) || null,
    frontImageUrl ?? null,
    cleanUserText(back) || null,
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
  const { userId, hasAI, has75CardsPerDeck } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  if (!hasAI) throw new Error("AI flashcard generation requires a Pro plan.");

  const parsed = generateCardsSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const { deckId, count } = parsed.data;

  const deck = await getDeckById(deckId, userId);
  if (!deck) throw new Error("Deck not found");

  const existingCards = await getCardsByDeck(deckId, userId);
  const aiGeneratedSoFar = existingCards.filter((c) => c.aiGenerated).length;
  const remainingAiSlots = AI_GENERATION_CAP_PER_DECK - aiGeneratedSoFar;
  if (count > remainingAiSlots) {
    throw new Error(
      `This deck can receive at most ${AI_GENERATION_CAP_PER_DECK} AI-generated cards (${remainingAiSlots} slot${remainingAiSlots !== 1 ? "s" : ""} left).`,
    );
  }

  const deckCardLimit = getCardsPerDeckLimit(has75CardsPerDeck);
  const remainingDeckSlots = deckCardLimit - existingCards.length;
  if (count > remainingDeckSlots) {
    throw new Error(
      has75CardsPerDeck
        ? `Not enough room in this deck (${remainingDeckSlots} card slot${remainingDeckSlots !== 1 ? "s" : ""} left; max ${CARDS_PER_DECK_LIMIT_PRO} per deck).`
        : `Not enough room in this deck on the Free plan (${remainingDeckSlots} card slot${remainingDeckSlots !== 1 ? "s" : ""} left).`,
    );
  }

  const deckContext = buildDeckContext(deck, existingCards, {
    includeForDuplicateCheck: true,
  });

  const { output } = await generateText({
    model: openai("gpt-4o"),
    output: Output.object({
      schema: z.object({
        cards: z.array(
          z.object({
            front: z.string(),
            back: z.string(),
            /**
             * 3 plausible but incorrect alternatives for this card's answer.
             * Stored on the card but hidden from the regular front/back
             * preview and study view.
             */
            distractors: z.array(z.string().min(1)).length(3),
          }),
        ),
      }),
    }),
    system: `You are a flashcard generation assistant. Infer the subject matter and purpose of the deck from its name, description, AND the existing cards already in the deck. Use the existing cards as the authoritative reference for the deck's style, format, depth, and scope — your generated cards must feel like they belong in the same deck.

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

For EVERY card, also produce exactly 3 "distractors" — plausible but definitively incorrect alternative answers to the card's back. Distractors must:
- Be clearly wrong to someone who knows the subject
- Be plausible enough to make a student hesitate (similar length, tone, and category to the correct back)
- Be distinct from each other and from the correct back
- Match the style, depth, and tone of the existing cards in the deck
- Follow the same "no markdown" rules as the rest of the card

For a step-by-step/problem-solving back, each distractor should be a short plausible final-answer-style string (NOT a full multi-line solution) — roughly matching what a student might mistakenly compute.

Rules:
- NEVER use markdown formatting (no **, no *, no #, no backticks) in any card or distractor
- NEVER use bullet points or dashes in step-by-step cards
- Use the step-by-step format ONLY when the topic genuinely requires working through a process
- When existing cards are provided, treat them as the source of truth for tone, length, and format — match them
- NEVER duplicate or trivially rephrase any of the existing cards
- Stay strictly within the subject matter and scope established by the deck
- Always return exactly 3 distractors per card — no more, no less`,
    prompt: `${deckContext}

Generate exactly ${count} new flashcards for this deck. They must be genuinely new (no duplicates of the existing cards above), match the established style, and stay within the deck's topic. For each card also return 3 plausible wrong-answer distractors.`,
  });

  const trimmed = output.cards.slice(0, count).map((c) => ({
    front: cleanAiText(c.front),
    back: cleanAiText(c.back),
    distractors: [
      cleanAiText(c.distractors[0]),
      cleanAiText(c.distractors[1]),
      cleanAiText(c.distractors[2]),
    ],
  }));
  if (trimmed.length === 0) {
    throw new Error("The model did not return any cards. Please try again.");
  }

  await bulkCreateCards(deckId, trimmed, true);

  revalidatePath(`/decks/${deckId}`);
}

export async function getCardsForPreviewAction(deckId: number) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const deck = await getDeckById(deckId, userId);
  if (!deck) throw new Error("Deck not found");

  return getCardsByDeck(deckId, userId);
}

export async function generateAnswerAction(
  data: GenerateAnswerInput,
): Promise<{ answer: string; distractors: [string, string, string] }> {
  const { userId, hasAI } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  if (!hasAI) throw new Error("AI answer generation requires a Pro plan.");

  const parsed = generateAnswerSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const { deckId, question } = parsed.data;

  const deck = await getDeckById(deckId, userId);
  if (!deck) throw new Error("Deck not found");

  const existingCards = await getCardsByDeck(deckId, userId);
  const fullContext = buildDeckContext(deck, existingCards);

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
    throw new Error(`${validationOutput.warning} You can still add this card manually if you'd like.`);
  }

  const { output } = await generateText({
    model: openai("gpt-4o"),
    output: Output.object({
      schema: z.object({
        answer: z.string(),
      }),
    }),
    system: `You are a flashcard assistant helping users complete flashcards. Given a question or term on the front of a flashcard, generate an appropriate answer or definition for the back.

Use the deck name, description, AND existing cards as your guide — your answer must match the established style, format, length, and depth of the existing cards in the deck.

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
- When existing cards are provided, treat them as the source of truth for tone, length, and format
- Stay strictly within the subject matter and scope established by the deck`,
    prompt: `${fullContext}

Question/Term: ${question}

Generate an appropriate answer for the back of this flashcard, matching the style of the existing cards.`,
  });

  const answer = cleanAiText(output.answer);

  // Always also generate 3 distractors so the client can persist them when
  // the user saves the card. They are not displayed in the back field —
  // only the correct `answer` is surfaced to the UI.
  let distractors: [string, string, string];
  try {
    distractors = await generateStandardDistractors(deck, existingCards, question, answer);
  } catch {
    distractors = ["", "", ""];
  }

  return { answer, distractors };
}

const createMultipleChoiceCardSchema = z
  .object({
    deckId: z.number().int().positive(),
    question: z.string(),
    questionImageUrl: z.string().url().nullable().optional(),
    correctAnswer: z.string().min(1, "Correct answer is required"),
    distractors: z
      .array(z.string().min(1, "All wrong answers are required"))
      .length(3, "Exactly 3 wrong answers are required"),
  })
  .refine((d) => d.question.trim().length > 0 || !!d.questionImageUrl, {
    message: "Question must have text or an image",
    path: ["question"],
  });

const updateMultipleChoiceCardSchema = z
  .object({
    cardId: z.number().int().positive(),
    deckId: z.number().int().positive(),
    question: z.string(),
    questionImageUrl: z.string().url().nullable().optional(),
    oldQuestionImageUrl: z.string().url().nullable().optional(),
    correctAnswer: z.string().min(1, "Correct answer is required"),
    distractors: z
      .array(z.string().min(1, "All wrong answers are required"))
      .length(3, "Exactly 3 wrong answers are required"),
  })
  .refine((d) => d.question.trim().length > 0 || !!d.questionImageUrl, {
    message: "Question must have text or an image",
    path: ["question"],
  });

const generateMultipleChoiceSchema = z.object({
  deckId: z.number().int().positive(),
  question: z.string().min(1),
  correctAnswer: z.string().optional().nullable(),
});

type CreateMultipleChoiceCardInput = {
  deckId: number;
  question: string;
  questionImageUrl?: string | null;
  correctAnswer: string;
  distractors: string[];
};
type UpdateMultipleChoiceCardInput = {
  cardId: number;
  deckId: number;
  question: string;
  questionImageUrl?: string | null;
  oldQuestionImageUrl?: string | null;
  correctAnswer: string;
  distractors: string[];
};
type GenerateMultipleChoiceInput = z.infer<typeof generateMultipleChoiceSchema>;

export async function createMultipleChoiceCardAction(data: CreateMultipleChoiceCardInput) {
  const { userId, has75CardsPerDeck } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = createMultipleChoiceCardSchema.safeParse(data);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    throw new Error(firstError?.message ?? "Invalid input");
  }

  const { deckId, question, questionImageUrl, correctAnswer, distractors } = parsed.data;

  const deck = await getDeckById(deckId, userId);
  if (!deck) throw new Error("Deck not found");

  const existingCards = await getCardsByDeck(deckId, userId);
  const deckCardLimit = getCardsPerDeckLimit(has75CardsPerDeck);
  if (existingCards.length >= deckCardLimit) {
    throw new Error(
      has75CardsPerDeck
        ? `Pro plan limit: ${CARDS_PER_DECK_LIMIT_PRO} cards per deck. Delete cards to add more.`
        : `Free plan limit: ${CARDS_PER_DECK_LIMIT_FREE} cards per deck. Upgrade to Pro for up to ${CARDS_PER_DECK_LIMIT_PRO} cards per deck.`,
    );
  }

  const choices = [
    cleanUserText(correctAnswer),
    ...distractors.map((d) => cleanUserText(d)),
  ];

  await createMultipleChoiceCard(
    deckId,
    cleanUserText(question),
    questionImageUrl ?? null,
    choices,
    0,
  );

  revalidatePath(`/decks/${deckId}`);
}

export async function updateMultipleChoiceCardAction(data: UpdateMultipleChoiceCardInput) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const parsed = updateMultipleChoiceCardSchema.safeParse(data);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    throw new Error(firstError?.message ?? "Invalid input");
  }

  const {
    cardId,
    deckId,
    question,
    questionImageUrl,
    oldQuestionImageUrl,
    correctAnswer,
    distractors,
  } = parsed.data;

  const deck = await getDeckById(deckId, userId);
  if (!deck) throw new Error("Deck not found");

  if (oldQuestionImageUrl && oldQuestionImageUrl !== questionImageUrl) {
    try {
      await deleteFromS3(oldQuestionImageUrl);
    } catch {
      // Silently ignore deletion errors — card update should still succeed
    }
  }

  const choices = [
    cleanUserText(correctAnswer),
    ...distractors.map((d) => cleanUserText(d)),
  ];

  await updateMultipleChoiceCard(
    cardId,
    deckId,
    cleanUserText(question),
    questionImageUrl ?? null,
    choices,
    0,
  );

  revalidatePath(`/decks/${deckId}`);
}

export async function generateMultipleChoiceAction(
  data: GenerateMultipleChoiceInput,
): Promise<{ correctAnswer: string; distractors: [string, string, string] }> {
  const { userId, hasAI } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  if (!hasAI) throw new Error("AI multiple-choice generation requires a Pro plan.");

  const parsed = generateMultipleChoiceSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const { deckId, question, correctAnswer } = parsed.data;

  const deck = await getDeckById(deckId, userId);
  if (!deck) throw new Error("Deck not found");

  const existingCards = await getCardsByDeck(deckId, userId);
  const fullContext = buildDeckContext(deck, existingCards);

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
    throw new Error(`${validationOutput.warning} You can still add this card manually if you'd like.`);
  }

  const hasCorrect = !!correctAnswer && correctAnswer.trim().length > 0;

  const systemPrompt = hasCorrect
    ? `You generate plausible but definitively incorrect multiple-choice distractors for a flashcard.

You will receive a deck context (name, description, and existing cards), a question, and the correct answer. Produce exactly 3 wrong answers that:
- Are clearly incorrect to someone who knows the subject
- Are plausible enough to make a student think (similar length, tone, and category to the correct answer)
- Are distinct from each other and from the correct answer
- Do NOT contradict each other in ways that make the correct one obvious
- Match the style, depth, and tone of the existing cards in the deck

Rules:
- NEVER use markdown formatting (no **, no *, no #, no backticks)
- Keep each distractor concise — same approximate length as the correct answer
- Return exactly 3 distractors, no more, no less
- The "correctAnswer" field in your response MUST be the exact correct answer the user provided, unchanged
- Stay strictly within the subject matter and scope of the deck`
    : `You generate a multiple-choice flashcard answer set.

You will receive a deck context (name, description, and existing cards) and a question. Produce:
- correctAnswer: the accurate, concise answer to the question, matching the style and depth of the existing cards
- distractors: exactly 3 plausible but definitively incorrect wrong answers that:
  - Are clearly incorrect to someone who knows the subject
  - Are plausible enough to make a student think (similar length, tone, and category to the correct answer)
  - Are distinct from each other and from the correct answer

Rules:
- NEVER use markdown formatting (no **, no *, no #, no backticks)
- Keep the correct answer and distractors roughly similar in length and style
- Match the established style of the existing cards in the deck
- Return exactly 3 distractors
- Stay strictly within the subject matter and scope of the deck`;

  const userPrompt = hasCorrect
    ? `${fullContext}

Question: ${question}
Correct answer: ${correctAnswer!.trim()}

Generate 3 plausible wrong answers that match the deck's style and scope.`
    : `${fullContext}

Question: ${question}

Generate the correct answer and 3 plausible wrong answers that match the deck's style and scope.`;

  const { output } = await generateText({
    model: openai("gpt-4o"),
    output: Output.object({
      schema: z.object({
        correctAnswer: z.string(),
        distractors: z.array(z.string()).length(3),
      }),
    }),
    system: systemPrompt,
    prompt: userPrompt,
  });

  const finalCorrect = hasCorrect
    ? cleanUserText(correctAnswer!)
    : cleanAiText(output.correctAnswer);
  const [d1, d2, d3] = output.distractors.map((d) => cleanAiText(d));

  return {
    correctAnswer: finalCorrect,
    distractors: [d1, d2, d3],
  };
}
