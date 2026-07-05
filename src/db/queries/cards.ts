import type { CardQuizVariants } from "@/lib/card-quiz-variants";
import { db } from "@/db";
import { cards, decks, type DeckRow } from "@/db/schema";
import { resolveDeckViewerAccess } from "@/db/queries/teams";
import { and, desc, eq, getTableColumns, inArray } from "drizzle-orm";

type CardRow = typeof cards.$inferSelect;

/** Drizzle projection when DB is behind schema (missing `choiceImageUrls`). */
const cardRowSelectWithoutChoiceImages = {
  id: cards.id,
  deckId: cards.deckId,
  front: cards.front,
  frontImageUrl: cards.frontImageUrl,
  back: cards.back,
  backImageUrl: cards.backImageUrl,
  aiGenerated: cards.aiGenerated,
  cardType: cards.cardType,
  choices: cards.choices,
  correctChoiceIndex: cards.correctChoiceIndex,
  quizVariants: cards.quizVariants,
  createdAt: cards.createdAt,
  updatedAt: cards.updatedAt,
} as const;

export function isMissingChoiceImageUrlsColumnError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current && typeof current === "object"; depth++) {
    const o = current as Record<string, unknown>;
    if (o.code === "42703" || o.code === 42703) return true;
    const message = typeof o.message === "string" ? o.message : "";
    if (
      /choiceImageUrls|choice_image_urls/i.test(message) &&
      (/does not exist/i.test(message) || /undefined column/i.test(message))
    ) {
      return true;
    }
    current = o.cause;
  }
  const flat = String(error);
  if (
    /choiceImageUrls|choice_image_urls/i.test(flat) &&
    (/42703/.test(flat) || /does not exist/i.test(flat) || /column .* not exist/i.test(flat))
  ) {
    return true;
  }
  if (/Failed query:/i.test(flat) && /"choiceImageUrls"/i.test(flat)) {
    return true;
  }
  return false;
}

function withNullChoiceImages<T extends Omit<CardRow, "choiceImageUrls">>(row: T): CardRow {
  return { ...row, choiceImageUrls: null };
}

/** Postgres text arrays cannot store null elements — preserve choice index with empty strings. */
function normalizeChoiceImageUrlsForDb(
  urls: (string | null)[] | null | undefined,
): string[] | null {
  if (urls == null) return null;
  return urls.map((url) => url ?? "");
}

async function selectCardsByDeck(deckId: number, scopedUserId?: string) {
  const order = desc(cards.updatedAt);
  try {
    if (scopedUserId != null) {
      return await db
        .select(getTableColumns(cards))
        .from(cards)
        .innerJoin(decks, eq(cards.deckId, decks.id))
        .where(and(eq(cards.deckId, deckId), eq(decks.userId, scopedUserId)))
        .orderBy(order);
    }
    return await db
      .select(getTableColumns(cards))
      .from(cards)
      .where(eq(cards.deckId, deckId))
      .orderBy(order);
  } catch (e) {
    if (!isMissingChoiceImageUrlsColumnError(e)) throw e;
    if (scopedUserId != null) {
      const rows = await db
        .select(cardRowSelectWithoutChoiceImages)
        .from(cards)
        .innerJoin(decks, eq(cards.deckId, decks.id))
        .where(and(eq(cards.deckId, deckId), eq(decks.userId, scopedUserId)))
        .orderBy(order);
      return rows.map(withNullChoiceImages);
    }
    const rows = await db
      .select(cardRowSelectWithoutChoiceImages)
      .from(cards)
      .where(eq(cards.deckId, deckId))
      .orderBy(order);
    return rows.map(withNullChoiceImages);
  }
}

/**
 * Lists every card in a deck, enforcing ownership at the query level by
 * joining `decks` and requiring `decks.userId = userId`. This means callers
 * cannot accidentally leak another user's cards even if they forget to
 * call `getDeckById` first.
 */
export async function getCardsByDeck(deckId: number, userId: string) {
  return selectCardsByDeck(deckId, userId);
}

/** Call only after team/ownership access is verified elsewhere. */
export async function getCardsByDeckUnscoped(deckId: number) {
  return selectCardsByDeck(deckId);
}

/** Resolves team access then loads cards (owner, team admin, or assigned member). */
export async function getCardsForDeckViewer(deckId: number, userId: string) {
  const access = await resolveDeckViewerAccess(deckId, userId);
  if (!access) return [];
  return getCardsByDeckUnscoped(deckId);
}

/**
 * For each deck id, the `frontImageUrl` of the card that appears first in the
 * preview carousel (`getCardsByDeckUnscoped` order: `updatedAt` desc).
 */
export async function getFirstPreviewCardFrontByDeckIds(
  deckIds: number[],
): Promise<Map<number, string | null>> {
  const unique = [...new Set(deckIds)].filter((id) => Number.isFinite(id) && id > 0);
  const out = new Map<number, string | null>();
  for (const id of unique) out.set(id, null);
  if (unique.length === 0) return out;

  const rows = await db
    .select({
      deckId: cards.deckId,
      frontImageUrl: cards.frontImageUrl,
      updatedAt: cards.updatedAt,
    })
    .from(cards)
    .where(inArray(cards.deckId, unique));

  const best = new Map<number, { t: number; img: string | null }>();
  for (const id of unique) {
    best.set(id, { t: Number.NEGATIVE_INFINITY, img: null });
  }

  for (const r of rows) {
    const t = r.updatedAt.getTime();
    const b = best.get(r.deckId);
    if (!b) continue;
    if (t >= b.t) {
      best.set(r.deckId, { t, img: r.frontImageUrl });
    }
  }

  for (const id of unique) {
    out.set(id, best.get(id)?.img ?? null);
  }
  return out;
}

export async function createCard(
  deckId: number,
  front: string | null,
  frontImageUrl: string | null,
  back: string | null,
  backImageUrl: string | null,
  aiGenerated = false,
  choices: string[] | null = null,
  correctChoiceIndex: number | null = null,
) {
  const [inserted] = await db
    .insert(cards)
    .values({
      deckId,
      front,
      frontImageUrl,
      back,
      backImageUrl,
      aiGenerated,
      choices,
      correctChoiceIndex,
    })
    .returning({ id: cards.id });
  return inserted;
}

/**
 * Update only the `choices` + `correctChoiceIndex` on a card. Used for
 * back-filling AI-generated distractors onto a standard card after it has
 * already been created (so the user doesn't have to wait for AI).
 */
export async function updateCardChoices(
  cardId: number,
  deckId: number,
  choices: string[],
  correctChoiceIndex: number,
) {
  return db
    .update(cards)
    .set({ choices, correctChoiceIndex, updatedAt: new Date() })
    .where(and(eq(cards.id, cardId), eq(cards.deckId, deckId)));
}

export async function updateCard(
  cardId: number,
  deckId: number,
  front: string | null,
  frontImageUrl: string | null,
  back: string | null,
  backImageUrl: string | null,
) {
  return db
    .update(cards)
    .set({ front, frontImageUrl, back, backImageUrl, updatedAt: new Date() })
    .where(and(eq(cards.id, cardId), eq(cards.deckId, deckId)));
}

export async function getCardById(cardId: number, deckId: number) {
  try {
    const result = await db
      .select()
      .from(cards)
      .where(and(eq(cards.id, cardId), eq(cards.deckId, deckId)));
    return result[0] ?? null;
  } catch (e) {
    if (!isMissingChoiceImageUrlsColumnError(e)) throw e;
    const result = await db
      .select(cardRowSelectWithoutChoiceImages)
      .from(cards)
      .where(and(eq(cards.id, cardId), eq(cards.deckId, deckId)));
    const row = result[0];
    return row ? withNullChoiceImages(row) : null;
  }
}

export async function deleteCard(cardId: number, deckId: number) {
  return db
    .delete(cards)
    .where(and(eq(cards.id, cardId), eq(cards.deckId, deckId)));
}

export async function bulkCreateCards(
  deckId: number,
  cardList: { front: string; back: string; distractors?: string[] | null }[],
  aiGenerated: boolean,
) {
  return db.insert(cards).values(
    cardList.map((c) => {
      const hasDistractors = Array.isArray(c.distractors) && c.distractors.length === 3;
      return {
        deckId,
        front: c.front,
        frontImageUrl: null,
        back: c.back,
        backImageUrl: null,
        aiGenerated,
        choices: hasDistractors ? [c.back, ...(c.distractors as string[])] : null,
        correctChoiceIndex: hasDistractors ? 0 : null,
      };
    }),
  );
}

export async function deleteAllCards(deckId: number) {
  return db.delete(cards).where(eq(cards.deckId, deckId));
}

export async function createMultipleChoiceCard(
  deckId: number,
  question: string,
  questionImageUrl: string | null,
  choices: string[],
  correctChoiceIndex: number,
  aiGenerated = false,
  choiceImageUrls: (string | null)[] | null = null,
) {
  const values = {
    deckId,
    front: question,
    frontImageUrl: questionImageUrl,
    back: choices[correctChoiceIndex] ?? null,
    backImageUrl: null,
    cardType: 'multiple_choice' as const,
    choices,
    choiceImageUrls: normalizeChoiceImageUrlsForDb(choiceImageUrls),
    correctChoiceIndex,
    aiGenerated,
  };
  try {
    return await db.insert(cards).values(values);
  } catch (e) {
    if (!isMissingChoiceImageUrlsColumnError(e)) throw e;
    const { choiceImageUrls: _omit, ...legacyValues } = values;
    return db.insert(cards).values(legacyValues);
  }
}

export async function updateMultipleChoiceCard(
  cardId: number,
  deckId: number,
  question: string,
  questionImageUrl: string | null,
  choices: string[],
  correctChoiceIndex: number,
  choiceImageUrls: (string | null)[] | null = null,
) {
  const patch = {
    front: question,
    frontImageUrl: questionImageUrl,
    back: choices[correctChoiceIndex] ?? null,
    backImageUrl: null,
    choices,
    choiceImageUrls: normalizeChoiceImageUrlsForDb(choiceImageUrls),
    correctChoiceIndex,
    updatedAt: new Date(),
  };
  try {
    return await db
      .update(cards)
      .set(patch)
      .where(and(eq(cards.id, cardId), eq(cards.deckId, deckId)));
  } catch (e) {
    if (!isMissingChoiceImageUrlsColumnError(e)) throw e;
    const { choiceImageUrls: _omit, ...legacyPatch } = patch;
    return db
      .update(cards)
      .set(legacyPatch)
      .where(and(eq(cards.id, cardId), eq(cards.deckId, deckId)));
  }
}

export async function updateCardQuizVariants(
  cardId: number,
  deckId: number,
  quizVariants: CardQuizVariants | null,
) {
  return db
    .update(cards)
    .set({ quizVariants, updatedAt: new Date() })
    .where(and(eq(cards.id, cardId), eq(cards.deckId, deckId)));
}

export async function mergeCardQuizVariants(
  cardId: number,
  deckId: number,
  patch: CardQuizVariants,
) {
  const existing = await getCardById(cardId, deckId);
  if (!existing) return null;
  const merged: CardQuizVariants = {
    ...(existing.quizVariants ?? {}),
    ...patch,
  };
  await updateCardQuizVariants(cardId, deckId, merged);
  return merged;
}
