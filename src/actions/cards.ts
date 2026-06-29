"use server";

import { auth } from "@/lib/clerk-auth";
import { revalidatePath } from "next/cache";
import { getAccessContext } from "@/lib/access";
import { z } from "zod";
import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { uploadToS3, deleteFromS3 } from "@/lib/s3";
import {
  createCard,
  updateCard,
  deleteCard,
  getCardById,
  getCardsByDeckUnscoped,
  bulkCreateCards,
  deleteAllCards,
  createMultipleChoiceCard,
  updateMultipleChoiceCard,
  updateCardChoices,
} from "@/db/queries/cards";
import { canEditDeckContent, getDeckWithViewerAccess } from "@/lib/team-deck-access";
import {
  AI_GENERATION_CAP_PER_DECK,
  CARDS_PER_DECK_LIMIT_FREE,
  CARDS_PER_DECK_LIMIT_PRO_PLUS,
  resolveDeckCardCap,
} from "@/lib/deck-limits";
import { deckHasTeamTierProFeatures } from "@/lib/team-deck-pro-features";
import { canUseAdvancedSourceImport } from "@/lib/source-import-access";
import {
  importedCardPreviewSchema,
  type GenerateCardsFromSourceResult,
} from "@/lib/source-import-types";

async function requireDeckEditor(userId: string, deckId: number) {
  const bundle = await getDeckWithViewerAccess(deckId, userId);
  if (!bundle || !canEditDeckContent(bundle.access)) {
    throw new Error("Deck not found");
  }
  return bundle.deck;
}

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

  if (!output?.distractors || output.distractors.length !== 3) {
    throw new Error("AI distractor generation failed. Please try again.");
  }

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
  distractors?: string[] | null;
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

  const deck = await requireDeckEditor(userId, deckId);

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
  const { userId, hasAI, maxCardsPerDeck } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = createCardSchema.safeParse(data);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    throw new Error(firstError?.message ?? "Invalid input");
  }

  const { deckId, front, frontImageUrl, back, backImageUrl, distractors } = parsed.data;

  const deck = await requireDeckEditor(userId, deckId);
  const teamTierPro = await deckHasTeamTierProFeatures(deck);
  const deckCardLimit = resolveDeckCardCap({
    teamTierProWorkspace: teamTierPro,
    personalMaxCardsPerDeck: maxCardsPerDeck,
  });
  const paidCardTier = deckCardLimit > CARDS_PER_DECK_LIMIT_FREE;
  const effectiveAI = hasAI || teamTierPro;

  const existingCards = await getCardsByDeckUnscoped(deckId);
  if (existingCards.length >= deckCardLimit) {
    throw new Error(
      paidCardTier
        ? `Plan limit: ${deckCardLimit} cards per deck for this workspace. Delete cards to add more.`
        : `Free plan limit: ${CARDS_PER_DECK_LIMIT_FREE} cards per deck. Upgrade on Pricing for higher limits (up to ${CARDS_PER_DECK_LIMIT_PRO_PLUS} on Pro Plus).`,
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
    effectiveAI &&
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
    distractors,
  } = parsed.data;

  const deck = await requireDeckEditor(userId, deckId);

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

  const backText = cleanUserText(back) || null;

  await updateCard(
    cardId,
    deckId,
    cleanUserText(front) || null,
    frontImageUrl ?? null,
    backText,
    backImageUrl ?? null,
  );

  const providedDistractors =
    Array.isArray(distractors) && distractors.length === 3 && backText
      ? [cleanAiText(distractors[0]), cleanAiText(distractors[1]), cleanAiText(distractors[2])]
      : null;
  if (
    backText &&
    providedDistractors &&
    providedDistractors.every((d) => d.length > 0)
  ) {
    await updateCardChoices(cardId, deckId, [backText, ...providedDistractors], 0);
  }

  revalidatePath(`/decks/${deckId}`);
}

export async function deleteCardAction(data: DeleteCardInput) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const parsed = deleteCardSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const { cardId, deckId } = parsed.data;

  const deck = await requireDeckEditor(userId, deckId);

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

  const deck = await requireDeckEditor(userId, deckId);

  await deleteAllCards(deckId);

  revalidatePath(`/decks/${deckId}`);
}

export async function generateCardsAction(data: GenerateCardsInput) {
  const { userId, hasAI, maxCardsPerDeck } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = generateCardsSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const { deckId, count } = parsed.data;

  const deck = await requireDeckEditor(userId, deckId);
  const teamTierPro = await deckHasTeamTierProFeatures(deck);
  const effectiveAI = hasAI || teamTierPro;
  const deckCardLimit = resolveDeckCardCap({
    teamTierProWorkspace: teamTierPro,
    personalMaxCardsPerDeck: maxCardsPerDeck,
  });
  const paidCardTier = deckCardLimit > CARDS_PER_DECK_LIMIT_FREE;

  if (!effectiveAI) throw new Error("AI flashcard generation requires a Pro plan.");

  const existingCards = await getCardsByDeckUnscoped(deckId);
  const aiGeneratedSoFar = existingCards.filter((c) => c.aiGenerated).length;
  const remainingAiSlots = AI_GENERATION_CAP_PER_DECK - aiGeneratedSoFar;
  if (count > remainingAiSlots) {
    throw new Error(
      `This deck can receive at most ${AI_GENERATION_CAP_PER_DECK} AI-generated cards (${remainingAiSlots} slot${remainingAiSlots !== 1 ? "s" : ""} left).`,
    );
  }

  const remainingDeckSlots = deckCardLimit - existingCards.length;
  if (count > remainingDeckSlots) {
    throw new Error(
      paidCardTier
        ? `Not enough room in this deck (${remainingDeckSlots} card slot${remainingDeckSlots !== 1 ? "s" : ""} left; max ${deckCardLimit} per deck).`
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

  await requireDeckEditor(userId, deckId);

  return getCardsByDeckUnscoped(deckId);
}

const deckViewerPreviewSchema = z.object({
  deckId: z.number().int().positive(),
});

export type DeckViewerPreviewInput = z.infer<typeof deckViewerPreviewSchema>;

/** Preview carousel for any user who can view the deck (including assigned `team_member`). */
export async function getCardsForDeckViewerPreviewAction(
  data: DeckViewerPreviewInput,
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const parsed = deckViewerPreviewSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const bundle = await getDeckWithViewerAccess(parsed.data.deckId, userId);
  if (!bundle) throw new Error("Deck not found");

  return getCardsByDeckUnscoped(parsed.data.deckId);
}

export async function generateAnswerAction(
  data: GenerateAnswerInput,
): Promise<{ answer: string; distractors: [string, string, string] }> {
  const { userId, hasAI } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = generateAnswerSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const { deckId, question } = parsed.data;

  const deck = await requireDeckEditor(userId, deckId);
  const teamTierPro = await deckHasTeamTierProFeatures(deck);
  if (!(hasAI || teamTierPro)) throw new Error("AI answer generation requires a Pro plan.");

  const existingCards = await getCardsByDeckUnscoped(deckId);
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

  if (
    validationOutput &&
    !validationOutput.isRelevant &&
    validationOutput.warning
  ) {
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

  if (!output?.answer?.trim()) {
    throw new Error("AI answer generation failed. Please try again.");
  }

  const answer = cleanAiText(output.answer);

  // Back illustration is fetched separately via /api/ai/card-back-image so the
  // binary payload is not limited by server-action response size.
  let distractors: [string, string, string];
  try {
    distractors = await generateStandardDistractors(
      deck,
      existingCards,
      question,
      answer,
    );
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
  const { userId, maxCardsPerDeck } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = createMultipleChoiceCardSchema.safeParse(data);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    throw new Error(firstError?.message ?? "Invalid input");
  }

  const { deckId, question, questionImageUrl, correctAnswer, distractors } = parsed.data;

  const deck = await requireDeckEditor(userId, deckId);
  const teamTierPro = await deckHasTeamTierProFeatures(deck);
  const deckCardLimit = resolveDeckCardCap({
    teamTierProWorkspace: teamTierPro,
    personalMaxCardsPerDeck: maxCardsPerDeck,
  });
  const paidCardTier = deckCardLimit > CARDS_PER_DECK_LIMIT_FREE;

  if (!paidCardTier) {
    throw new Error(
      "Multiple-choice cards require Pro. Upgrade your personal plan on the Pricing page.",
    );
  }

  const existingCards = await getCardsByDeckUnscoped(deckId);
  if (existingCards.length >= deckCardLimit) {
    throw new Error(
      paidCardTier
        ? `Plan limit: ${deckCardLimit} cards per deck for this workspace. Delete cards to add more.`
        : `Free plan limit: ${CARDS_PER_DECK_LIMIT_FREE} cards per deck. Upgrade on Pricing for higher limits (up to ${CARDS_PER_DECK_LIMIT_PRO_PLUS} on Pro Plus).`,
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

  const deck = await requireDeckEditor(userId, deckId);

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
  const { userId, hasAI, maxCardsPerDeck } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = generateMultipleChoiceSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const { deckId, question, correctAnswer } = parsed.data;

  const deck = await requireDeckEditor(userId, deckId);
  const teamTierPro = await deckHasTeamTierProFeatures(deck);
  const deckCardLimit = resolveDeckCardCap({
    teamTierProWorkspace: teamTierPro,
    personalMaxCardsPerDeck: maxCardsPerDeck,
  });
  const paidCardTier = deckCardLimit > CARDS_PER_DECK_LIMIT_FREE;
  const effectiveAI = hasAI || teamTierPro;

  if (!paidCardTier) {
    throw new Error(
      "Multiple-choice cards require Pro. Upgrade your personal plan on the Pricing page.",
    );
  }
  if (!effectiveAI) throw new Error("AI multiple-choice generation requires a Pro plan.");

  const existingCards = await getCardsByDeckUnscoped(deckId);
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

  if (
    validationOutput &&
    !validationOutput.isRelevant &&
    validationOutput.warning
  ) {
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

  if (!output?.distractors || output.distractors.length !== 3) {
    throw new Error("AI multiple-choice generation failed. Please try again.");
  }

  const finalCorrect = hasCorrect
    ? cleanUserText(correctAnswer!)
    : cleanAiText(output.correctAnswer);
  if (!finalCorrect) {
    throw new Error("AI multiple-choice generation failed. Please try again.");
  }
  const [d1, d2, d3] = output.distractors.map((d) => cleanAiText(d));

  return {
    correctAnswer: finalCorrect,
    distractors: [d1, d2, d3],
  };
}

const commitImportedCardsSchema = z.object({
  deckId: z.number().int().positive(),
  cards: z
    .array(
      z.object({
        front: z.string().min(1),
        back: z.string().min(1),
        /** Original AI question — used for quiz distractor generation when front/back are swapped. */
        distractorQuestion: z.string().min(1).optional(),
        /** Original AI answer — paired with distractorQuestion for quiz distractor generation. */
        distractorAnswer: z.string().min(1).optional(),
      }),
    )
    .min(1),
});

type CommitImportedCardsInput = z.infer<typeof commitImportedCardsSchema>;

const validateSourceRelevanceSchema = z.object({
  isRelevant: z.boolean(),
  warning: z.string().nullable(),
});

const FLASHCARD_GENERATION_SYSTEM_PROMPT = `You are a flashcard generation assistant. Infer the subject matter and purpose of the deck from its name, description, AND the existing cards already in the deck. Use the existing cards as the authoritative reference for the deck's style, format, depth, and scope — your generated cards must feel like they belong in the same deck.

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
- Always return exactly 3 distractors per card — no more, no less`;

async function assertSourceImportLimits(
  deckId: number,
  count: number,
  maxCardsPerDeck: number,
  teamTierPro: boolean,
) {
  const deckCardLimit = resolveDeckCardCap({
    teamTierProWorkspace: teamTierPro,
    personalMaxCardsPerDeck: maxCardsPerDeck,
  });
  const paidCardTier = deckCardLimit > CARDS_PER_DECK_LIMIT_FREE;
  const existingCards = await getCardsByDeckUnscoped(deckId);
  const aiGeneratedSoFar = existingCards.filter((c) => c.aiGenerated).length;
  const remainingAiSlots = AI_GENERATION_CAP_PER_DECK - aiGeneratedSoFar;
  if (count > remainingAiSlots) {
    throw new Error(
      `This deck can receive at most ${AI_GENERATION_CAP_PER_DECK} AI-generated cards (${remainingAiSlots} slot${remainingAiSlots !== 1 ? "s" : ""} left).`,
    );
  }
  const remainingDeckSlots = deckCardLimit - existingCards.length;
  if (count > remainingDeckSlots) {
    throw new Error(
      paidCardTier
        ? `Not enough room in this deck (${remainingDeckSlots} card slot${remainingDeckSlots !== 1 ? "s" : ""} left; max ${deckCardLimit} per deck).`
        : `Not enough room in this deck on the Free plan (${remainingDeckSlots} card slot${remainingDeckSlots !== 1 ? "s" : ""} left).`,
    );
  }
  return { existingCards, deckCardLimit, paidCardTier };
}

/**
 * Extract text from a URL or uploaded file (ephemeral — nothing is stored) and
 * generate flashcards for user review. Pro: URL + TXT. Pro Plus: + enabled document types.
 */
export async function generateCardsFromSourceAction(
  formData: FormData,
): Promise<GenerateCardsFromSourceResult> {
  const { userId, hasAI, hasAiReading, maxCardsPerDeck } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const deckId = Number(formData.get("deckId"));
  const count = Number(formData.get("count"));
  const urlRaw = String(formData.get("url") ?? "").trim();
  const file = formData.get("file");
  const skipRelevanceCheck = formData.get("skipRelevanceCheck") === "true";

  if (!Number.isInteger(deckId) || deckId <= 0) throw new Error("Invalid deck.");
  if (!Number.isInteger(count) || count < 1 || count > AI_GENERATION_CAP_PER_DECK) {
    throw new Error(`Enter a card count between 1 and ${AI_GENERATION_CAP_PER_DECK}.`);
  }

  const deck = await requireDeckEditor(userId, deckId);
  const teamTierPro = await deckHasTeamTierProFeatures(deck);
  const effectiveAI = hasAI || teamTierPro;
  if (!effectiveAI) {
    throw new Error("Import and AI generation from sources requires a Pro plan.");
  }

  const advancedImport = canUseAdvancedSourceImport({
    hasAiReading,
    teamTierProWorkspace: teamTierPro,
  });

  const hasFile = file instanceof File && file.size > 0;
  const hasUrl = urlRaw.length > 0;
  if (hasFile === hasUrl) {
    throw new Error("Provide either a website URL or one file — not both.");
  }

  const {
    assertFormatAllowedForPlan,
    extractTextFromFile,
    extractTextFromUrl,
    resolveFileSourceFormat,
  } = await import("@/lib/document-extract");

  let extracted;
  if (hasUrl) {
    extracted = await extractTextFromUrl(urlRaw);
  } else {
    const uploadFile = file as File;
    const format = resolveFileSourceFormat(uploadFile);
    assertFormatAllowedForPlan(format, advancedImport);
    extracted = await extractTextFromFile(uploadFile);
  }

  const { existingCards } = await assertSourceImportLimits(
    deckId,
    count,
    maxCardsPerDeck,
    teamTierPro,
  );

  const deckContext = buildDeckContext(deck, existingCards, {
    includeForDuplicateCheck: true,
  });

  const { output: relevance } = await generateText({
    model: openai("gpt-4o"),
    output: Output.object({ schema: validateSourceRelevanceSchema }),
    system: `You validate whether uploaded or linked study material fits a flashcard deck's topic.

Use the deck name, description, and existing cards to understand the deck scope. Compare the source excerpt to that scope.

Return isRelevant=false only when the material is clearly unrelated (wrong subject, wrong language course, etc.). Return a short, helpful warning when false.`,
    prompt: `${deckContext}

Source material excerpt (first portion):
${extracted.text.slice(0, 4000)}

Is this source material appropriate for generating flashcards in this deck?`,
  });

  if (!relevance?.isRelevant && !skipRelevanceCheck) {
    return {
      status: "relevance_warning",
      warning:
        relevance?.warning ??
        "This source does not appear to match your deck topic. Try a different file or URL, or generate anyway if you are sure.",
    };
  }

  const { output } = await generateText({
    model: openai("gpt-4o"),
    output: Output.object({
      schema: z.object({
        cards: z.array(importedCardPreviewSchema),
      }),
    }),
    system: `${FLASHCARD_GENERATION_SYSTEM_PROMPT}

You will also receive an excerpt of source material (notes, article, document, etc.). Ground every card in facts from that source while matching the deck's established style and scope. Prefer the most important concepts from the source.`,
    prompt: `${deckContext}

Source material:
${extracted.text}

Generate exactly ${count} new flashcards from the source material above. They must be genuinely new (no duplicates of existing cards), match the deck style, and stay within the deck topic. For each card return front, back, and 3 distractors.`,
  });

  const trimmed = (output?.cards ?? []).slice(0, count).map((c) => ({
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

  return { status: "ok", cards: trimmed };
}

/** Persist user-approved cards from the source-import review step. */
export async function commitImportedCardsAction(
  data: CommitImportedCardsInput,
): Promise<{ added: number }> {
  const { userId, hasAI, maxCardsPerDeck } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = commitImportedCardsSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const { deckId, cards } = parsed.data;
  const deck = await requireDeckEditor(userId, deckId);
  const teamTierPro = await deckHasTeamTierProFeatures(deck);
  const effectiveAI = hasAI || teamTierPro;
  if (!effectiveAI) {
    throw new Error("Import and AI generation from sources requires a Pro plan.");
  }

  await assertSourceImportLimits(deckId, cards.length, maxCardsPerDeck, teamTierPro);

  const existingCards = await getCardsByDeckUnscoped(deckId);
  const payload: { front: string; back: string; distractors: string[] }[] = [];

  for (const card of cards) {
    const front = card.front.trim();
    const back = card.back.trim();
    const distractorQuestion = card.distractorQuestion?.trim() ?? front;
    const distractorAnswer = card.distractorAnswer?.trim() ?? back;
    const [d1, d2, d3] = await generateStandardDistractors(
      deck,
      existingCards,
      distractorQuestion,
      distractorAnswer,
    );
    payload.push({ front, back, distractors: [d1, d2, d3] });
  }

  await bulkCreateCards(deckId, payload, true);
  revalidatePath(`/decks/${deckId}`);
  return { added: payload.length };
}
