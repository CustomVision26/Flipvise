import type { QuizFormatsSettings } from "@/lib/quiz-formats";
import type { QuizCardInput, QuizQuestionType } from "@/lib/quiz-questions";
import { getAvailableQuestionTypesForCard } from "@/lib/quiz-questions";

export type QuizFormatDistribution = {
  multipleChoice: number;
  trueFalse: number;
  fillInBlank: number;
};

export type DeckQuizFormatAssignments = {
  distribution?: QuizFormatDistribution;
  byCardId: Record<number, QuizQuestionType>;
  shuffledAt: string;
};

export const EMPTY_QUIZ_FORMAT_DISTRIBUTION: QuizFormatDistribution = {
  multipleChoice: 0,
  trueFalse: 0,
  fillInBlank: 0,
};

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function parseDistribution(raw: unknown): QuizFormatDistribution | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const mc = Number(o.multipleChoice);
  const tf = Number(o.trueFalse);
  const fib = Number(o.fillInBlank);
  if (![mc, tf, fib].every((n) => Number.isFinite(n) && n >= 0 && Number.isInteger(n))) {
    return null;
  }
  return { multipleChoice: mc, trueFalse: tf, fillInBlank: fib };
}

export function parseDeckQuizFormatAssignments(
  raw: unknown,
): DeckQuizFormatAssignments | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const byCardIdRaw = o.byCardId;
  if (!byCardIdRaw || typeof byCardIdRaw !== "object") return null;

  const byCardId: Record<number, QuizQuestionType> = {};
  for (const [key, value] of Object.entries(byCardIdRaw as Record<string, unknown>)) {
    const cardId = Number(key);
    if (
      !Number.isFinite(cardId) ||
      (value !== "multiple_choice" && value !== "true_false" && value !== "fill_in_blank")
    ) {
      continue;
    }
    byCardId[cardId] = value;
  }

  const distribution = parseDistribution(o.distribution);
  if (Object.keys(byCardId).length === 0 && !distribution) return null;

  return {
    distribution: distribution ?? undefined,
    byCardId,
    shuffledAt: typeof o.shuffledAt === "string" ? o.shuffledAt : new Date().toISOString(),
  };
}

export function enabledQuizQuestionTypes(formats: QuizFormatsSettings): QuizQuestionType[] {
  const types: QuizQuestionType[] = [];
  if (formats.multipleChoice) types.push("multiple_choice");
  if (formats.trueFalse) types.push("true_false");
  if (formats.fillInBlank) types.push("fill_in_blank");
  return types;
}

export function countCardsReadyForQuizFormats(
  cards: QuizCardInput[],
  formats: QuizFormatsSettings,
): { multipleChoice: number; trueFalse: number; fillInBlank: number; total: number } {
  let multipleChoice = 0;
  let trueFalse = 0;
  let fillInBlank = 0;
  let total = 0;

  for (const card of cards) {
    const front = (card.front ?? "").trim();
    const back = (card.back ?? "").trim();
    if (!front || !back) continue;
    total++;
    const available = getAvailableQuestionTypesForCard(card, cards, formats);
    if (available.includes("multiple_choice")) multipleChoice++;
    if (available.includes("true_false")) trueFalse++;
    if (available.includes("fill_in_blank")) fillInBlank++;
  }

  return { multipleChoice, trueFalse, fillInBlank, total };
}

export function validateQuizFormatDistribution(
  formats: QuizFormatsSettings,
  distribution: QuizFormatDistribution,
  eligibleCardCount: number,
): { valid: true } | { valid: false; error: string } {
  const { multipleChoice, trueFalse, fillInBlank } = distribution;

  if (
    multipleChoice < 0 ||
    trueFalse < 0 ||
    fillInBlank < 0 ||
    !Number.isInteger(multipleChoice) ||
    !Number.isInteger(trueFalse) ||
    !Number.isInteger(fillInBlank)
  ) {
    return { valid: false, error: "Question counts must be whole numbers of 0 or greater." };
  }

  if (!formats.multipleChoice && multipleChoice > 0) {
    return { valid: false, error: "Multiple choice is disabled — set its count to 0." };
  }
  if (!formats.trueFalse && trueFalse > 0) {
    return { valid: false, error: "True / false is disabled — set its count to 0." };
  }
  if (!formats.fillInBlank && fillInBlank > 0) {
    return { valid: false, error: "Fill in the blank is disabled — set its count to 0." };
  }

  const sum = multipleChoice + trueFalse + fillInBlank;
  if (eligibleCardCount === 0) {
    return { valid: false, error: "This deck has no cards with front and back text." };
  }
  if (sum !== eligibleCardCount) {
    return {
      valid: false,
      error: `Question counts must add up to ${eligibleCardCount} (currently ${sum}).`,
    };
  }

  const formatsWithCount =
    (formats.multipleChoice && multipleChoice > 0 ? 1 : 0) +
    (formats.trueFalse && trueFalse > 0 ? 1 : 0) +
    (formats.fillInBlank && fillInBlank > 0 ? 1 : 0);

  if (formatsWithCount < 1) {
    return { valid: false, error: "Assign at least one question to an enabled format." };
  }

  return { valid: true };
}

export function deckAiQuizContentReady(
  formats: QuizFormatsSettings,
  counts: ReturnType<typeof countCardsReadyForQuizFormats>,
  distribution?: QuizFormatDistribution | null,
): boolean {
  if (counts.total === 0) return false;

  if (distribution) {
    const validation = validateQuizFormatDistribution(formats, distribution, counts.total);
    if (!validation.valid) return false;
    if (formats.trueFalse && distribution.trueFalse > 0 && counts.trueFalse < distribution.trueFalse) {
      return false;
    }
    if (
      formats.fillInBlank &&
      distribution.fillInBlank > 0 &&
      counts.fillInBlank < distribution.fillInBlank
    ) {
      return false;
    }
    return true;
  }

  if (formats.trueFalse && counts.trueFalse < counts.total) return false;
  if (formats.fillInBlank && counts.fillInBlank < counts.total) return false;
  return true;
}

export function canReshuffleQuizFormats(
  formats: QuizFormatsSettings,
  counts: ReturnType<typeof countCardsReadyForQuizFormats>,
  distribution?: QuizFormatDistribution | null,
  cards?: QuizCardInput[],
): boolean {
  if (counts.total === 0) return false;

  if (!distribution) {
    const enabled = enabledQuizQuestionTypes(formats);
    if (enabled.length < 2) return false;
    for (const type of enabled) {
      if (type === "multiple_choice" && counts.multipleChoice === 0) return false;
      if (type === "true_false" && counts.trueFalse === 0) return false;
      if (type === "fill_in_blank" && counts.fillInBlank === 0) return false;
    }
    return true;
  }

  const validation = validateQuizFormatDistribution(formats, distribution, counts.total);
  if (!validation.valid) return false;

  const formatTypesInDistribution =
    (distribution.multipleChoice > 0 ? 1 : 0) +
    (distribution.trueFalse > 0 ? 1 : 0) +
    (distribution.fillInBlank > 0 ? 1 : 0);
  if (formatTypesInDistribution < 2) return false;

  if (!deckAiQuizContentReady(formats, counts, distribution)) return false;

  if (cards) {
    return canAssignDistributionToCards(cards, formats, distribution).ok;
  }

  return true;
}

function canAssignDistributionToCards(
  cards: QuizCardInput[],
  formats: QuizFormatsSettings,
  distribution: QuizFormatDistribution,
): { ok: true } | { ok: false; error: string } {
  const eligible = cards.filter((c) => (c.front ?? "").trim() && (c.back ?? "").trim());
  const validation = validateQuizFormatDistribution(formats, distribution, eligible.length);
  if (!validation.valid) return { ok: false, error: validation.error };

  const typeSlots: QuizQuestionType[] = [
    ...Array(distribution.multipleChoice).fill("multiple_choice" as const),
    ...Array(distribution.trueFalse).fill("true_false" as const),
    ...Array(distribution.fillInBlank).fill("fill_in_blank" as const),
  ];

  const unassigned = new Set(eligible.map((c) => c.id));
  const sortedSlots = [...typeSlots].sort((a, b) => {
    const countA = eligible.filter(
      (c) => unassigned.has(c.id) && getAvailableQuestionTypesForCard(c, cards, formats).includes(a),
    ).length;
    const countB = eligible.filter(
      (c) => unassigned.has(c.id) && getAvailableQuestionTypesForCard(c, cards, formats).includes(b),
    ).length;
    return countA - countB;
  });

  for (const type of sortedSlots) {
    const candidates = eligible.filter(
      (c) =>
        unassigned.has(c.id) &&
        getAvailableQuestionTypesForCard(c, cards, formats).includes(type),
    );
    if (candidates.length === 0) {
      const label =
        type === "multiple_choice"
          ? "multiple choice"
          : type === "true_false"
            ? "true / false"
            : "fill in the blank";
      return {
        ok: false,
        error: `Not enough cards support ${label} for the requested count. Generate AI content or adjust counts.`,
      };
    }
    unassigned.delete(candidates[0]!.id);
  }

  return { ok: true };
}

/** Assigns formats across cards using the requested per-format counts. */
export function reshuffleQuizFormatAssignments(
  cards: QuizCardInput[],
  formats: QuizFormatsSettings,
  distribution?: QuizFormatDistribution | null,
): Record<number, QuizQuestionType> {
  if (distribution) {
    const eligible = cards.filter((c) => (c.front ?? "").trim() && (c.back ?? "").trim());
    const feasibility = canAssignDistributionToCards(cards, formats, distribution);
    if (!feasibility.ok || eligible.length === 0) return {};

    const typeSlots: QuizQuestionType[] = [
      ...Array(distribution.multipleChoice).fill("multiple_choice" as const),
      ...Array(distribution.trueFalse).fill("true_false" as const),
      ...Array(distribution.fillInBlank).fill("fill_in_blank" as const),
    ];
    shuffleArray(typeSlots);

    const unassigned = new Set(eligible.map((c) => c.id));
    const assignments: Record<number, QuizQuestionType> = {};

    const sortedSlots = [...typeSlots].sort((a, b) => {
      const countA = eligible.filter(
        (c) =>
          unassigned.has(c.id) &&
          getAvailableQuestionTypesForCard(c, cards, formats).includes(a),
      ).length;
      const countB = eligible.filter(
        (c) =>
          unassigned.has(c.id) &&
          getAvailableQuestionTypesForCard(c, cards, formats).includes(b),
      ).length;
      return countA - countB;
    });

    for (const type of sortedSlots) {
      const candidates = shuffleArray(
        eligible.filter(
          (c) =>
            unassigned.has(c.id) &&
            getAvailableQuestionTypesForCard(c, cards, formats).includes(type),
        ),
      );
      const card = candidates[0];
      if (!card) continue;
      assignments[card.id] = type;
      unassigned.delete(card.id);
    }

    return assignments;
  }

  const enabled = enabledQuizQuestionTypes(formats);
  if (enabled.length === 0) return {};

  const eligible = cards.filter((c) => (c.front ?? "").trim() && (c.back ?? "").trim());
  if (eligible.length === 0) return {};

  const typePool: QuizQuestionType[] = [];
  for (let i = 0; i < eligible.length; i++) {
    typePool.push(enabled[i % enabled.length]!);
  }
  shuffleArray(typePool);

  const shuffledCards = shuffleArray(eligible);
  const assignments: Record<number, QuizQuestionType> = {};

  for (let i = 0; i < shuffledCards.length; i++) {
    const card = shuffledCards[i]!;
    const available = getAvailableQuestionTypesForCard(card, cards, formats);
    if (available.length === 0) continue;

    let chosen = typePool[i]!;
    if (!available.includes(chosen)) {
      chosen =
        typePool.find((t) => available.includes(t)) ??
        available[Math.floor(Math.random() * available.length)]!;
    }
    assignments[card.id] = chosen;
  }

  return assignments;
}

export function distributionFromQuestionTypes(
  types: QuizQuestionType[],
): QuizFormatDistribution {
  return {
    multipleChoice: types.filter((t) => t === "multiple_choice").length,
    trueFalse: types.filter((t) => t === "true_false").length,
    fillInBlank: types.filter((t) => t === "fill_in_blank").length,
  };
}
