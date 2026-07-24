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
  getOldestCardInDeck,
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
import {
  canUseDeckAiFeatures,
  DECK_AI_PLAN_REQUIREMENT,
} from "@/lib/deck-ai-access";
import { canUseAdvancedSourceImport } from "@/lib/source-import-access";
import {
  importedCardPreviewSchema,
  type GenerateCardsFromSourceResult,
} from "@/lib/source-import-types";
import type { ExtractedSource } from "@/lib/document-extract";
import { cleanReadingPassageFront, READING_PASSAGE_MC_GENERATION_PROMPT } from "@/lib/source-import-reading-passage";
import {
  isRenderableMathDiagram,
  mathDiagramRequiredAiOutputSchema,
  normalizeMathDiagram,
  parseMathDiagramAi,
  type MathDiagram,
} from "@/lib/math-diagrams";

async function requireDeckEditor(userId: string, deckId: number) {
  const bundle = await getDeckWithViewerAccess(deckId, userId);
  if (!bundle || !canEditDeckContent(bundle.access)) {
    throw new Error("Deck not found");
  }
  return bundle.deck;
}

/** Empty string → null so saves never fail Zod with "Invalid URL". */
const nullableImageUrl = z.preprocess(
  (value) => (value === "" || value === undefined ? null : value),
  z.union([z.string().url(), z.null()]),
);

const optionalPersistedImageUrl = z.preprocess(
  (value) => {
    if (value === "" || value === undefined) return null;
    if (typeof value === "string" && (value.startsWith("blob:") || value.startsWith("data:"))) {
      return null;
    }
    return value;
  },
  z.union([z.string().url(), z.null()]).optional(),
);

const createCardSchema = z
  .object({
    deckId: z.number().int().positive(),
    front: z.string(),
    frontImageUrl: optionalPersistedImageUrl,
    back: z.string(),
    backImageUrl: optionalPersistedImageUrl,
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
    frontImageUrl: optionalPersistedImageUrl,
    back: z.string(),
    backImageUrl: optionalPersistedImageUrl,
    oldFrontImageUrl: optionalPersistedImageUrl,
    oldBackImageUrl: optionalPersistedImageUrl,
    distractors: z
      .array(z.string())
      .length(3)
      .nullable()
      .optional(),
    choiceImageUrls: z
      .tuple([nullableImageUrl, nullableImageUrl, nullableImageUrl, nullableImageUrl])
      .optional(),
    oldChoiceImageUrls: z
      .tuple([nullableImageUrl, nullableImageUrl, nullableImageUrl, nullableImageUrl])
      .optional(),
  })
  .refine((d) => d.front.trim().length > 0 || !!d.frontImageUrl, {
    message: "Front must have text or an image",
    path: ["front"],
  })
  .refine((d) => d.back.trim().length > 0 || !!d.backImageUrl, {
    message: "Back must have text or an image",
    path: ["back"],
  })
  .refine(
    (d) => {
      if (!d.distractors) return true;
      return d.distractors.every((text, index) => {
        const image = d.choiceImageUrls?.[index + 1] ?? null;
        return text.trim().length > 0 || !!image;
      });
    },
    {
      message: "Each wrong answer needs text or an image.",
      path: ["distractors"],
    },
  );

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
  /** When true, also return a structured math diagram spec (retry if omitted). */
  includeDiagram: z.boolean().optional(),
  /**
   * Which card side will receive the diagram.
   * front → question figure (no answer values); back → solution figure (with answers).
   */
  diagramSide: z.enum(["front", "back"]).optional(),
});

const validateQuestionRelevanceSchema = z.object({
  isRelevant: z.boolean(),
  warning: z.string().nullable(),
});

/**
 * Shared relevance gate for Generate answer / MC AI.
 * Intentionally lenient — only block clearly wrong subjects (same bar as From source).
 */
const QUESTION_RELEVANCE_SYSTEM = `You are a flashcard validation assistant. Decide whether a user question belongs in a deck.

Use the deck name, description, and existing cards for scope.

Return isRelevant=true when the question is reasonably related, including neighboring subtopics of the same subject. Examples:
- A Math or Geometry deck may include geometry, measurement, coordinate graphs, statistics/charts, and 3D shapes.
- An Algebra deck may include equations, graphs, and word problems.
- A Science deck may include adjacent lab or quantitative skills for that science.

Return isRelevant=false ONLY when the question is clearly a different subject (for example Spanish vocabulary in a Geometry deck, or history in a Biology deck).

Return:
- isRelevant: boolean
- warning: a brief helpful message (1-2 sentences) only when isRelevant is false; otherwise null`;

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
  choiceImageUrls?: [string | null, string | null, string | null, string | null];
  oldChoiceImageUrls?: [string | null, string | null, string | null, string | null];
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
  const access = await getAccessContext();
  if (!access.userId) throw new Error("Unauthorized");
  const { userId, maxCardsPerDeck } = access;

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
  const effectiveAI = canUseDeckAiFeatures(access, teamTierPro);

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

  let resolvedDistractors: [string, string, string] | null = null;

  if (Array.isArray(distractors) && distractors.length === 3 && backText) {
    const normalized: [string, string, string] = [
      cleanAiText(distractors[0]),
      cleanAiText(distractors[1]),
      cleanAiText(distractors[2]),
    ];
    if (normalized.every((d) => d.length > 0)) {
      resolvedDistractors = normalized;
    }
  }

  if (
    !resolvedDistractors &&
    effectiveAI &&
    frontText &&
    backText
  ) {
    try {
      resolvedDistractors = await generateStandardDistractors(
        deck,
        existingCards,
        frontText,
        backText,
      );
    } catch {
      // Best-effort — card still saves without stored wrong answers.
    }
  }

  const choices =
    resolvedDistractors && backText ? [backText, ...resolvedDistractors] : null;

  await createCard(
    deckId,
    frontText,
    frontImageUrl ?? null,
    backText,
    backImageUrl ?? null,
    false,
    choices,
    choices ? 0 : null,
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
    distractors,
    choiceImageUrls,
    oldChoiceImageUrls,
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

  if (oldChoiceImageUrls && choiceImageUrls) {
    for (let i = 0; i < oldChoiceImageUrls.length; i++) {
      const oldUrl = oldChoiceImageUrls[i];
      const nextUrl = choiceImageUrls[i] ?? null;
      if (oldUrl && oldUrl !== nextUrl) {
        try {
          await deleteFromS3(oldUrl);
        } catch {
          // ignore
        }
      }
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
      ? [
          cleanUserText(distractors[0]) || "",
          cleanUserText(distractors[1]) || "",
          cleanUserText(distractors[2]) || "",
        ]
      : null;
  const distractorsValid =
    providedDistractors != null &&
    providedDistractors.every((text, index) => {
      const image = choiceImageUrls?.[index + 1] ?? null;
      return text.length > 0 || !!image;
    });
  if (backText && providedDistractors && distractorsValid) {
    await updateCardChoices(
      cardId,
      deckId,
      [backText, ...providedDistractors],
      0,
      choiceImageUrls ?? null,
    );
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

const deckFirstCardFrontSchema = z.object({
  deckId: z.number().int().positive(),
});

export type DeckFirstCardFrontState = {
  cardId: number | null;
  frontImageUrl: string | null;
};

/** Oldest card’s front image — for Edit deck “First card front image”. */
export async function getDeckFirstCardFrontStateAction(
  data: z.infer<typeof deckFirstCardFrontSchema>,
): Promise<DeckFirstCardFrontState> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const parsed = deckFirstCardFrontSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const { deckId } = parsed.data;
  await requireDeckEditor(userId, deckId);

  const card = await getOldestCardInDeck(deckId);
  return {
    cardId: card?.id ?? null,
    frontImageUrl: card?.frontImageUrl ?? null,
  };
}

/**
 * Upload/replace the oldest card’s front image (creates a card if the deck is empty).
 * Mirrors Create deck “First card front image”.
 */
export async function setDeckFirstCardFrontImageAction(
  data: z.infer<typeof deckFirstCardFrontSchema>,
  formData: FormData,
): Promise<DeckFirstCardFrontState> {
  const access = await getAccessContext();
  if (!access.userId) throw new Error("Unauthorized");
  const { userId, maxCardsPerDeck } = access;

  const parsed = deckFirstCardFrontSchema.safeParse(data);
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

  const existing = await getOldestCardInDeck(deckId);
  if (existing) {
    if (existing.frontImageUrl && existing.frontImageUrl !== url) {
      try {
        await deleteFromS3(existing.frontImageUrl);
      } catch {
        // keep going — card update should still succeed
      }
    }
    await updateCard(
      existing.id,
      deckId,
      existing.front,
      url,
      existing.back,
      existing.backImageUrl,
    );
    revalidatePath(`/decks/${deckId}`);
    revalidatePath("/dashboard");
    return { cardId: existing.id, frontImageUrl: url };
  }

  const teamTierPro = await deckHasTeamTierProFeatures(deck);
  const deckCardLimit = resolveDeckCardCap({
    teamTierProWorkspace: teamTierPro,
    personalMaxCardsPerDeck: maxCardsPerDeck,
  });
  const existingCards = await getCardsByDeckUnscoped(deckId);
  if (existingCards.length >= deckCardLimit) {
    try {
      await deleteFromS3(url);
    } catch {
      // ignore
    }
    throw new Error(
      `Card limit reached (${deckCardLimit} per deck). Delete a card before adding a front image.`,
    );
  }

  const inserted = await createCard(
    deckId,
    null,
    url,
    "Add the answer on this side",
    null,
  );
  if (!inserted) throw new Error("Failed to create first card");

  revalidatePath(`/decks/${deckId}`);
  revalidatePath("/dashboard");
  return { cardId: inserted.id, frontImageUrl: url };
}

/** Clear the oldest card’s front image (keeps the card; adds placeholder text if needed). */
export async function clearDeckFirstCardFrontImageAction(
  data: z.infer<typeof deckFirstCardFrontSchema>,
): Promise<DeckFirstCardFrontState> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const parsed = deckFirstCardFrontSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const { deckId } = parsed.data;
  await requireDeckEditor(userId, deckId);

  const existing = await getOldestCardInDeck(deckId);
  if (!existing?.frontImageUrl) {
    return { cardId: existing?.id ?? null, frontImageUrl: null };
  }

  try {
    await deleteFromS3(existing.frontImageUrl);
  } catch {
    // ignore
  }

  const front =
    existing.front?.trim() ||
    "Add a question on this side";

  await updateCard(
    existing.id,
    deckId,
    front,
    null,
    existing.back,
    existing.backImageUrl,
  );

  revalidatePath(`/decks/${deckId}`);
  revalidatePath("/dashboard");
  return { cardId: existing.id, frontImageUrl: null };
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
  const access = await getAccessContext();
  if (!access.userId) throw new Error("Unauthorized");
  const { userId, maxCardsPerDeck } = access;

  const parsed = generateCardsSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const { deckId, count } = parsed.data;

  const deck = await requireDeckEditor(userId, deckId);
  const teamTierPro = await deckHasTeamTierProFeatures(deck);
  const effectiveAI = canUseDeckAiFeatures(access, teamTierPro);
  const deckCardLimit = resolveDeckCardCap({
    teamTierProWorkspace: teamTierPro,
    personalMaxCardsPerDeck: maxCardsPerDeck,
  });
  const paidCardTier = deckCardLimit > CARDS_PER_DECK_LIMIT_FREE;

  if (!effectiveAI) throw new Error(DECK_AI_PLAN_REQUIREMENT);

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

const DIAGRAM_TYPE_RULES = `diagram.type must be one of: geometry_2d, coordinate_graph, stats_chart, measurement, shape_3d — never "none".
Set unused payload fields (geometry, coordinateGraph, statsChart, measurement, shape3d) to null.
Fill only the payload that matches type:
- geometry_2d → geometry: points/polygons/segments/circles/angles on a 0–100 canvas (x right, y down).
- coordinate_graph → coordinateGraph: xMin/xMax/yMin/yMax plus points, lines (slope/intercept), segments.
- stats_chart → statsChart: chart (bar|line|pie), categories, values.
- measurement → measurement: shape (rectangle|triangle|line_segment), dimensions (e.g. "8 cm").
- shape_3d → shape3d: solid (cube|rectangular_prism|cylinder|sphere|cone|pyramid), labels.`;

const FRONT_DIAGRAM_RULES = `This is a FRONT-OF-CARD question figure (learner has not seen the answer yet):
- Show the figure needed to solve the problem.
- Include ONLY given information from the question (vertex labels, given lengths/angles, raw data categories/values stated in the question).
- For pie/bar charts: include EVERY category from the question with its given value (e.g. Rent 40, Food 25, Transport 15, Other 20). Do not collapse categories.
- title must be null or a neutral title like "Budget" — NEVER put the computed answer (e.g. "65%", "x = 110") in title or on any label.
- Do NOT reveal the unknown, computed result, or final answer.
- Set diagram.side to "front".`;

const BACK_DIAGRAM_RULES = `This is a BACK-OF-CARD / correct-answer solution figure:
- Use the same figure geometry as the question figure when possible.
- Include the correct answer values/labels on the figure (e.g. title or label "65%", CD = 8 cm, highlighted combined sector).
- For pie/bar charts: keep all given categories; you may also emphasize the answered quantity.
- Set diagram.side to "back".`;

/** Strip answer-like titles from question figures (common AI leak, e.g. title "65%"). */
function sanitizeFrontDiagram(diagram: MathDiagram): MathDiagram {
  const title = diagram.title?.trim();
  if (!title) return { ...diagram, side: "front", title: undefined };
  const looksLikeAnswer =
    /^\d+(\.\d+)?\s*%?$/.test(title) ||
    /^(answer|result|solution)\b/i.test(title) ||
    /=\s*\d/.test(title) ||
    /^\d+(\.\d+)?\s*(cm|m|°|degrees)?$/i.test(title);
  if (looksLikeAnswer) {
    return { ...diagram, side: "front", title: undefined };
  }
  return { ...diagram, side: "front" };
}

function parseRenderableDiagram(
  raw: unknown,
  side: "front" | "back",
): MathDiagram | null {
  const parsed = parseMathDiagramAi(raw);
  if (!isRenderableMathDiagram(parsed)) return null;
  const normalized = normalizeMathDiagram(parsed);
  if (!normalized) return null;
  const withSide = { ...normalized, side };
  return side === "front" ? sanitizeFrontDiagram(withSide) : withSide;
}

async function generateDiagramPairOnly(args: {
  fullContext: string;
  question: string;
  answer: string;
}): Promise<{ front: MathDiagram | null; back: MathDiagram | null }> {
  const { output } = await generateText({
    model: openai("gpt-4o"),
    output: Output.object({
      schema: z.object({
        frontDiagram: mathDiagramRequiredAiOutputSchema,
        backDiagram: mathDiagramRequiredAiOutputSchema,
      }),
    }),
    system: `You create paired math diagrams for flashcards.
${DIAGRAM_TYPE_RULES}
Return frontDiagram and backDiagram (never type "none").
${FRONT_DIAGRAM_RULES}
${BACK_DIAGRAM_RULES}
Never invent numbers that contradict the question or answer.`,
    prompt: `${args.fullContext}

Question/Term: ${args.question}

Answer:
${args.answer}

Produce:
1) frontDiagram — full question figure with NO correct-answer labels (title null or neutral).
2) backDiagram — same figure WITH the correct answer labeled (e.g. 65%).`,
  });

  return {
    front: parseRenderableDiagram(output?.frontDiagram, "front"),
    back: parseRenderableDiagram(output?.backDiagram, "back"),
  };
}

async function generateDistractorDiagramsOnly(args: {
  fullContext: string;
  question: string;
  correctAnswer: string;
  distractors: [string, string, string];
}): Promise<[MathDiagram | null, MathDiagram | null, MathDiagram | null]> {
  const { output } = await generateText({
    model: openai("gpt-4o"),
    output: Output.object({
      schema: z.object({
        distractorDiagrams: z.tuple([
          mathDiagramRequiredAiOutputSchema,
          mathDiagramRequiredAiOutputSchema,
          mathDiagramRequiredAiOutputSchema,
        ]),
      }),
    }),
    system: `You create three wrong-answer diagrams for a quiz flashcard.
${DIAGRAM_TYPE_RULES}
Each diagram illustrates one incorrect answer (not the correct answer).
Keep the same chart/figure style as the question when possible.
Put the wrong answer value in the title or on a clear label.
Set each diagram.side to "back".
Never invent numbers that contradict the given wrong-answer texts.`,
    prompt: `${args.fullContext}

Question/Term: ${args.question}

Correct answer (do NOT use): ${args.correctAnswer}

Wrong answer 1: ${args.distractors[0]}
Wrong answer 2: ${args.distractors[1]}
Wrong answer 3: ${args.distractors[2]}

Return distractorDiagrams[0..2] matching those three wrong answers.`,
  });

  const raw = output?.distractorDiagrams;
  return [
    parseRenderableDiagram(raw?.[0], "back"),
    parseRenderableDiagram(raw?.[1], "back"),
    parseRenderableDiagram(raw?.[2], "back"),
  ];
}

export async function generateAnswerAction(
  data: GenerateAnswerInput,
): Promise<{
  answer: string;
  distractors: [string, string, string];
  /** @deprecated Prefer frontDiagram / backDiagram. Kept as the solution figure when present. */
  diagram: MathDiagram | null;
  /** Question figure (no answer values) for the front of the card. */
  frontDiagram: MathDiagram | null;
  /** Solution figure (with answer labels) for the back / correct answer. */
  backDiagram: MathDiagram | null;
  /** Optional figures illustrating each wrong answer (quiz distractors). */
  distractorDiagrams: [MathDiagram | null, MathDiagram | null, MathDiagram | null];
  /** Soft tip when the question may be outside the deck focus — generation still runs. */
  relevanceWarning: string | null;
}> {
  const access = await getAccessContext();
  if (!access.userId) throw new Error("Unauthorized");
  const { userId } = access;

  const parsed = generateAnswerSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const { deckId, question, includeDiagram } = parsed.data;

  const deck = await requireDeckEditor(userId, deckId);
  const teamTierPro = await deckHasTeamTierProFeatures(deck);
  if (!canUseDeckAiFeatures(access, teamTierPro)) {
    throw new Error(DECK_AI_PLAN_REQUIREMENT);
  }

  const existingCards = await getCardsByDeckUnscoped(deckId);
  const fullContext = buildDeckContext(deck, existingCards);

  const { output: validationOutput } = await generateText({
    model: openai("gpt-4o"),
    output: Output.object({
      schema: validateQuestionRelevanceSchema,
    }),
    system: QUESTION_RELEVANCE_SYSTEM,
    prompt: `${fullContext}

User's Question: ${question}

Is this question clearly off-topic for this deck, or reasonably related (including neighboring math/science subtopics)?`,
  });

  // Soft warning only — do not block AI generation (user can still save the card).
  const relevanceWarning =
    validationOutput &&
    !validationOutput.isRelevant &&
    validationOutput.warning?.trim()
      ? validationOutput.warning.trim()
      : null;

  const diagramAddendum = includeDiagram
    ? `

Also return frontDiagram and backDiagram (never type "none").
${DIAGRAM_TYPE_RULES}
${FRONT_DIAGRAM_RULES}
${BACK_DIAGRAM_RULES}
Never invent numeric data that contradicts the question or answer.`
    : "";

  const answerSchema = includeDiagram
    ? z.object({
        answer: z.string(),
        frontDiagram: mathDiagramRequiredAiOutputSchema,
        backDiagram: mathDiagramRequiredAiOutputSchema,
      })
    : z.object({
        answer: z.string(),
      });

  const { output } = await generateText({
    model: openai("gpt-4o"),
    output: Output.object({
      schema: answerSchema,
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
- Stay strictly within the subject matter and scope established by the deck${diagramAddendum}`,
    prompt: `${fullContext}

Question/Term: ${question}

Generate an appropriate answer for the back of this flashcard, matching the style of the existing cards.${
      includeDiagram
        ? " Also include frontDiagram (question figure, NO answer labels) and backDiagram (solution figure WITH the correct answer labeled)."
        : ""
    }`,
  });

  if (!output?.answer?.trim()) {
    throw new Error("AI answer generation failed. Please try again.");
  }

  const answer = cleanAiText(output.answer);

  let frontDiagram: MathDiagram | null = null;
  let backDiagram: MathDiagram | null = null;
  if (includeDiagram) {
    if (output && "frontDiagram" in output) {
      frontDiagram = parseRenderableDiagram(
        (output as { frontDiagram?: unknown }).frontDiagram,
        "front",
      );
    }
    if (output && "backDiagram" in output) {
      backDiagram = parseRenderableDiagram(
        (output as { backDiagram?: unknown }).backDiagram,
        "back",
      );
    }
    if (!frontDiagram || !backDiagram) {
      try {
        const pair = await generateDiagramPairOnly({ fullContext, question, answer });
        frontDiagram = frontDiagram ?? pair.front;
        backDiagram = backDiagram ?? pair.back;
      } catch {
        // Keep whatever we already parsed.
      }
    }
  }

  const diagram = backDiagram ?? frontDiagram;

  // Decorative back illustration is fetched separately via /api/ai/card-back-image
  // so the binary payload is not limited by server-action response size.
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

  let distractorDiagrams: [MathDiagram | null, MathDiagram | null, MathDiagram | null] = [
    null,
    null,
    null,
  ];
  if (
    includeDiagram &&
    distractors.every((d) => d.trim().length > 0)
  ) {
    try {
      distractorDiagrams = await generateDistractorDiagramsOnly({
        fullContext,
        question,
        correctAnswer: answer,
        distractors,
      });
    } catch {
      distractorDiagrams = [null, null, null];
    }
  }

  return {
    answer,
    distractors,
    diagram,
    frontDiagram,
    backDiagram,
    distractorDiagrams,
    relevanceWarning,
  };
}

const multipleChoiceAnswerRefine = (data: {
  question: string;
  questionImageUrl?: string | null;
  correctAnswer: string;
  distractors: string[];
  choiceImageUrls?: [string | null, string | null, string | null, string | null] | null;
}) => {
  if (!(data.question.trim().length > 0 || !!data.questionImageUrl)) return false;
  const correctImage = data.choiceImageUrls?.[0] ?? null;
  const correctOk = data.correctAnswer.trim().length > 0 || !!correctImage;
  const distractorsOk = data.distractors.every((text, index) => {
    const image = data.choiceImageUrls?.[index + 1] ?? null;
    return text.trim().length > 0 || !!image;
  });
  return correctOk && distractorsOk;
};

const createMultipleChoiceCardSchema = z
  .object({
    deckId: z.number().int().positive(),
    question: z.string(),
    questionImageUrl: nullableImageUrl.optional(),
    correctAnswer: z.string(),
    distractors: z.array(z.string()).length(3, "Exactly 3 wrong answers are required"),
    choiceImageUrls: z
      .tuple([nullableImageUrl, nullableImageUrl, nullableImageUrl, nullableImageUrl])
      .optional(),
  })
  .refine((d) => d.question.trim().length > 0 || !!d.questionImageUrl, {
    message: "Question must have text or an image",
    path: ["question"],
  })
  .refine(multipleChoiceAnswerRefine, {
    message: "Correct answer needs text or an image; each wrong answer needs text.",
    path: ["correctAnswer"],
  });

const updateMultipleChoiceCardSchema = z
  .object({
    cardId: z.number().int().positive(),
    deckId: z.number().int().positive(),
    question: z.string(),
    questionImageUrl: nullableImageUrl.optional(),
    oldQuestionImageUrl: nullableImageUrl.optional(),
    correctAnswer: z.string(),
    distractors: z.array(z.string()).length(3, "Exactly 3 wrong answers are required"),
    choiceImageUrls: z
      .tuple([nullableImageUrl, nullableImageUrl, nullableImageUrl, nullableImageUrl])
      .optional(),
    oldChoiceImageUrls: z
      .tuple([nullableImageUrl, nullableImageUrl, nullableImageUrl, nullableImageUrl])
      .optional(),
  })
  .refine((d) => d.question.trim().length > 0 || !!d.questionImageUrl, {
    message: "Question must have text or an image",
    path: ["question"],
  })
  .refine(multipleChoiceAnswerRefine, {
    message: "Correct answer needs text or an image; each wrong answer needs text.",
    path: ["correctAnswer"],
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
  choiceImageUrls?: [string | null, string | null, string | null, string | null];
};
type UpdateMultipleChoiceCardInput = {
  cardId: number;
  deckId: number;
  question: string;
  questionImageUrl?: string | null;
  oldQuestionImageUrl?: string | null;
  correctAnswer: string;
  distractors: string[];
  choiceImageUrls?: [string | null, string | null, string | null, string | null];
  oldChoiceImageUrls?: [string | null, string | null, string | null, string | null];
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

  const { deckId, question, questionImageUrl, correctAnswer, distractors, choiceImageUrls } =
    parsed.data;

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
    false,
    choiceImageUrls ?? null,
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
    choiceImageUrls,
    oldChoiceImageUrls,
  } = parsed.data;

  const deck = await requireDeckEditor(userId, deckId);

  if (oldQuestionImageUrl && oldQuestionImageUrl !== questionImageUrl) {
    try {
      await deleteFromS3(oldQuestionImageUrl);
    } catch {
      // Silently ignore deletion errors — card update should still succeed
    }
  }

  if (oldChoiceImageUrls && choiceImageUrls) {
    for (let i = 0; i < oldChoiceImageUrls.length; i++) {
      const oldUrl = oldChoiceImageUrls[i];
      const nextUrl = choiceImageUrls[i] ?? null;
      if (oldUrl && oldUrl !== nextUrl) {
        try {
          await deleteFromS3(oldUrl);
        } catch {
          // ignore
        }
      }
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
    choiceImageUrls ?? null,
  );

  revalidatePath(`/decks/${deckId}`);
}

export async function generateMultipleChoiceAction(
  data: GenerateMultipleChoiceInput,
): Promise<{
  correctAnswer: string;
  distractors: [string, string, string];
  /** Soft tip when the question may be outside the deck focus — generation still runs. */
  relevanceWarning: string | null;
}> {
  const access = await getAccessContext();
  if (!access.userId) throw new Error("Unauthorized");
  const { maxCardsPerDeck } = access;
  const userId = access.userId;

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
  const effectiveAI = canUseDeckAiFeatures(access, teamTierPro);

  if (!paidCardTier) {
    throw new Error(
      "Multiple-choice cards require Pro. Upgrade your personal plan on the Pricing page.",
    );
  }
  if (!effectiveAI) throw new Error(DECK_AI_PLAN_REQUIREMENT);

  const existingCards = await getCardsByDeckUnscoped(deckId);
  const fullContext = buildDeckContext(deck, existingCards);

  const { output: validationOutput } = await generateText({
    model: openai("gpt-4o"),
    output: Output.object({
      schema: validateQuestionRelevanceSchema,
    }),
    system: QUESTION_RELEVANCE_SYSTEM,
    prompt: `${fullContext}

User's Question: ${question}

Is this question clearly off-topic for this deck, or reasonably related (including neighboring math/science subtopics)?`,
  });

  // Soft warning only — do not block AI generation (user can still save the card).
  const relevanceWarning =
    validationOutput &&
    !validationOutput.isRelevant &&
    validationOutput.warning?.trim()
      ? validationOutput.warning.trim()
      : null;

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
    relevanceWarning,
  };
}

const previewImportDistractorsSchema = z.object({
  deckId: z.number().int().positive(),
  distractorQuestion: z.string().min(1),
  distractorAnswer: z.string().min(1),
});

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
        /** User-reviewed quiz wrong answers from the import review step. */
        distractors: z.array(z.string().min(1)).length(3).optional(),
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

/** Generate flashcards from already-extracted source text (used by API routes and the form action). */
export async function generateCardsFromExtractedSource(
  userId: string,
  input: {
    deckId: number;
    count: number;
    extracted: ExtractedSource;
    skipRelevanceCheck: boolean;
    readingPassageMultipleChoice?: boolean;
  },
): Promise<GenerateCardsFromSourceResult> {
  const access = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");
  const { maxCardsPerDeck } = access;

  const { deckId, count, extracted, skipRelevanceCheck, readingPassageMultipleChoice = false } =
    input;

  if (!Number.isInteger(deckId) || deckId <= 0) throw new Error("Invalid deck.");
  if (!Number.isInteger(count) || count < 1 || count > AI_GENERATION_CAP_PER_DECK) {
    throw new Error(`Enter a card count between 1 and ${AI_GENERATION_CAP_PER_DECK}.`);
  }

  const deck = await requireDeckEditor(userId, deckId);
  const teamTierPro = await deckHasTeamTierProFeatures(deck);
  const effectiveAI = canUseDeckAiFeatures(access, teamTierPro);
  if (!effectiveAI) {
    throw new Error(DECK_AI_PLAN_REQUIREMENT);
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
${readingPassageMultipleChoice ? `\n\n${READING_PASSAGE_MC_GENERATION_PROMPT}` : ""}

You will also receive an excerpt of source material (notes, article, document, etc.). Ground every card in facts from that source while matching the deck's established style and scope. Prefer the most important concepts from the source.`,
    prompt: `${deckContext}

Source material:
${extracted.text}

Generate exactly ${count} new flashcards from the source material above. They must be genuinely new (no duplicates of existing cards), match the deck style, and stay within the deck topic. For each card return front, back, and 3 distractors.${
      readingPassageMultipleChoice
        ? " Use reading passage + multiple choice format on every card (Passage and Question only on front; back = correct answer text; distractors = three wrong answer texts — no A–D labels on front)."
        : ""
    }`,
  });

  const trimmed = (output?.cards ?? []).slice(0, count).map((c) => ({
    front: cleanAiText(
      readingPassageMultipleChoice ? cleanReadingPassageFront(c.front) : c.front,
    ),
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

/**
 * Extract text from a URL or uploaded file (ephemeral — nothing is stored) and
 * generate flashcards for user review. Pro: URL + TXT. Pro Plus: + enabled document types.
 */
export async function generateCardsFromSourceAction(
  formData: FormData,
): Promise<GenerateCardsFromSourceResult> {
  const access = await getAccessContext();
  if (!access.userId) throw new Error("Unauthorized");
  const { userId, hasAiReading } = access;

  const deckId = Number(formData.get("deckId"));
  const count = Number(formData.get("count"));
  const urlRaw = String(formData.get("url") ?? "").trim();
  const file = formData.get("file");
  const skipRelevanceCheck = formData.get("skipRelevanceCheck") === "true";
  const readingPassageMultipleChoice =
    formData.get("readingPassageMultipleChoice") === "true";

  if (!Number.isInteger(deckId) || deckId <= 0) throw new Error("Invalid deck.");
  if (!Number.isInteger(count) || count < 1 || count > AI_GENERATION_CAP_PER_DECK) {
    throw new Error(`Enter a card count between 1 and ${AI_GENERATION_CAP_PER_DECK}.`);
  }

  const deck = await requireDeckEditor(userId, deckId);
  const teamTierPro = await deckHasTeamTierProFeatures(deck);
  const effectiveAI = canUseDeckAiFeatures(access, teamTierPro);
  if (!effectiveAI) {
    throw new Error(DECK_AI_PLAN_REQUIREMENT);
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

  let extracted: ExtractedSource;
  if (hasUrl) {
    extracted = await extractTextFromUrl(urlRaw);
  } else {
    const uploadFile = file as File;
    const format = resolveFileSourceFormat(uploadFile);
    assertFormatAllowedForPlan(format, advancedImport);
    extracted = await extractTextFromFile(uploadFile);
  }

  return generateCardsFromExtractedSource(userId, {
    deckId,
    count,
    extracted,
    skipRelevanceCheck,
    readingPassageMultipleChoice,
  });
}

/** Preview or regenerate quiz wrong answers during source-import review. */
export async function previewImportDistractorsAction(
  data: z.infer<typeof previewImportDistractorsSchema>,
): Promise<{ distractors: [string, string, string] }> {
  const access = await getAccessContext();
  if (!access.userId) throw new Error("Unauthorized");
  const { userId } = access;

  const parsed = previewImportDistractorsSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const { deckId, distractorQuestion, distractorAnswer } = parsed.data;
  const deck = await requireDeckEditor(userId, deckId);
  const teamTierPro = await deckHasTeamTierProFeatures(deck);
  if (!canUseDeckAiFeatures(access, teamTierPro)) {
    throw new Error(DECK_AI_PLAN_REQUIREMENT);
  }

  const existingCards = await getCardsByDeckUnscoped(deckId);
  const distractors = await generateStandardDistractors(
    deck,
    existingCards,
    distractorQuestion.trim(),
    distractorAnswer.trim(),
  );
  return { distractors };
}

/** Persist user-approved cards from the source-import review step. */
export async function commitImportedCardsAction(
  data: CommitImportedCardsInput,
): Promise<{ added: number }> {
  const access = await getAccessContext();
  if (!access.userId) throw new Error("Unauthorized");
  const { userId, maxCardsPerDeck } = access;

  const parsed = commitImportedCardsSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const { deckId, cards } = parsed.data;
  const deck = await requireDeckEditor(userId, deckId);
  const teamTierPro = await deckHasTeamTierProFeatures(deck);
  const effectiveAI = canUseDeckAiFeatures(access, teamTierPro);
  if (!effectiveAI) {
    throw new Error(DECK_AI_PLAN_REQUIREMENT);
  }

  await assertSourceImportLimits(deckId, cards.length, maxCardsPerDeck, teamTierPro);

  const existingCards = await getCardsByDeckUnscoped(deckId);
  const payload: { front: string; back: string; distractors: string[] }[] = [];

  for (const card of cards) {
    const front = card.front.trim();
    const back = card.back.trim();
    let distractors: [string, string, string];
    if (card.distractors?.length === 3) {
      distractors = [
        cleanAiText(card.distractors[0]),
        cleanAiText(card.distractors[1]),
        cleanAiText(card.distractors[2]),
      ];
    } else {
      const distractorQuestion = card.distractorQuestion?.trim() ?? front;
      const distractorAnswer = card.distractorAnswer?.trim() ?? back;
      distractors = await generateStandardDistractors(
        deck,
        existingCards,
        distractorQuestion,
        distractorAnswer,
      );
    }
    payload.push({ front, back, distractors: [...distractors] });
  }

  await bulkCreateCards(deckId, payload, true);
  revalidatePath(`/decks/${deckId}`);
  return { added: payload.length };
}
