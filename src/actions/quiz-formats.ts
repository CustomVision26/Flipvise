"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getAccessContext } from "@/lib/access";
import {
  assertDeckInWorkspaceForFormats,
  getDeckQuizFormatAssignmentsForStudy,
  resolveQuizFormatsForStudy,
  reshuffleDeckQuizFormatAssignments,
  updateDeckQuizDurationMinutes,
  updateDeckQuizFormats,
  updateTeamQuizFormats,
} from "@/db/queries/quiz-formats";
import { getCardsByDeckUnscoped, mergeCardQuizVariants } from "@/db/queries/cards";
import { generateQuizVariantsForCard } from "@/lib/generate-quiz-variants-ai";
import {
  countCardsReadyForQuizFormats,
  explainQuizFormatContentBlock,
  validateQuizFormatDistribution,
  type QuizFormatDistribution,
} from "@/lib/quiz-format-assignments";
import { parseCardQuizVariants, fillInBlankSegmentSchema } from "@/lib/card-quiz-variants";
import { resolveCardMcqContext } from "@/lib/card-mcq-context";
import { getAvailableQuestionTypesForCard } from "@/lib/quiz-questions";
import {
  buildQuizFormatPreviewItems,
  resolvePreviewAssignments,
  type QuizFormatPreviewItem,
} from "@/lib/quiz-format-preview";
import { getDeckWithViewerAccess } from "@/lib/team-deck-access";
import { canEditDeckContent } from "@/lib/team-deck-access";
import { deckHasTeamTierProFeatures } from "@/lib/team-deck-pro-features";
import { canUseDeckAiFeatures, DECK_AI_PLAN_REQUIREMENT } from "@/lib/deck-ai-access";
import { canConfigurePersonalDeckQuizFormats } from "@/lib/education-plans";
import {
  MAX_TEAM_QUIZ_DURATION_MINUTES,
  MIN_TEAM_QUIZ_DURATION_MINUTES,
  resolveTeamQuizDurationMinutes,
} from "@/lib/team-quiz-duration";

async function assertCanManageTeam(userId: string, teamId: number) {
  const { getTeamById, getMemberRecord } = await import("@/db/queries/teams");
  const team = await getTeamById(teamId);
  if (!team) throw new Error("Workspace not found");
  if (team.ownerUserId === userId) return team;
  const member = await getMemberRecord(teamId, userId);
  if (member?.role === "team_admin") return team;
  throw new Error("Forbidden");
}

/** Team admin path, or personal Pro Plus / Education Plus deck owner. */
async function assertCanManageDeckQuizFormats(
  userId: string,
  deckId: number,
  teamId: number | undefined,
  effectivePlanSlug: string | null,
): Promise<{ ownerUserId: string; teamId: number | null }> {
  if (teamId != null) {
    const team = await assertCanManageTeam(userId, teamId);
    await assertDeckInWorkspaceForFormats(teamId, team.ownerUserId, deckId);
    return { ownerUserId: team.ownerUserId, teamId };
  }

  if (!canConfigurePersonalDeckQuizFormats(effectivePlanSlug)) {
    throw new Error(
      "Pro Plus or Education Plus is required to configure quiz question formats.",
    );
  }

  const bundle = await getDeckWithViewerAccess(deckId, userId);
  if (!bundle || !canEditDeckContent(bundle.access)) {
    throw new Error("Deck not found");
  }
  if (bundle.deck.userId !== userId) {
    throw new Error("Only the deck owner can configure quiz formats for this deck.");
  }

  return { ownerUserId: userId, teamId: null };
}

const quizFormatsSchema = z.object({
  multipleChoice: z.boolean(),
  trueFalse: z.boolean(),
  fillInBlank: z.boolean(),
});

const updateTeamQuizFormatsSchema = z.object({
  teamId: z.number().int().positive(),
  formats: quizFormatsSchema,
});

const updateDeckQuizFormatsSchema = z.object({
  teamId: z.number().int().positive().optional(),
  deckId: z.number().int().positive(),
  /** null clears per-deck override (inherit workspace). Personal decks must pass settings. */
  formats: quizFormatsSchema.nullable(),
});

const quizFormatDistributionSchema = z.object({
  multipleChoice: z.number().int().min(0),
  trueFalse: z.number().int().min(0),
  fillInBlank: z.number().int().min(0),
});

const generateDeckQuizVariantsSchema = z.object({
  deckId: z.number().int().positive(),
  teamId: z.number().int().positive().optional(),
  distribution: quizFormatDistributionSchema,
  /** Draft formats for personal Format Quiz Question — not written until Publish. */
  formats: quizFormatsSchema.optional(),
});

const reshuffleDeckQuizFormatsSchema = z.object({
  deckId: z.number().int().positive(),
  teamId: z.number().int().positive().optional(),
  distribution: quizFormatDistributionSchema,
});

const publishDeckQuizFormatsSchema = z.object({
  deckId: z.number().int().positive(),
  teamId: z.number().int().positive().optional(),
  formats: quizFormatsSchema,
  distribution: quizFormatDistributionSchema,
  /** Timed quiz length in minutes. Required for personal Format Quiz Question publish. */
  durationMinutes: z
    .number()
    .int()
    .min(MIN_TEAM_QUIZ_DURATION_MINUTES)
    .max(MAX_TEAM_QUIZ_DURATION_MINUTES),
});

const previewDeckQuizFormatsSchema = z.object({
  deckId: z.number().int().positive(),
  teamId: z.number().int().positive().optional(),
  distribution: quizFormatDistributionSchema,
});

const saveQuizFormatVariantEditSchema = z.object({
  deckId: z.number().int().positive(),
  teamId: z.number().int().positive().optional(),
  cardId: z.number().int().positive(),
  trueFalse: z
    .object({
      statement: z.string().min(1),
      correctAnswer: z.boolean(),
    })
    .optional(),
  fillInBlank: z
    .object({
      segments: z.array(fillInBlankSegmentSchema).min(1),
    })
    .optional(),
});

export async function updateTeamQuizFormatsAction(
  data: z.infer<typeof updateTeamQuizFormatsSchema>,
) {
  const { userId } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = updateTeamQuizFormatsSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const team = await assertCanManageTeam(userId, parsed.data.teamId);
  if (
    !parsed.data.formats.multipleChoice &&
    !parsed.data.formats.trueFalse &&
    !parsed.data.formats.fillInBlank
  ) {
    throw new Error("Enable at least one quiz question format.");
  }

  await updateTeamQuizFormats(parsed.data.teamId, team.ownerUserId, parsed.data.formats);
  revalidatePath("/dashboard/team-admin/deck-manager/study-privileges");
}

export async function updateDeckQuizFormatsAction(
  data: z.infer<typeof updateDeckQuizFormatsSchema>,
) {
  const access = await getAccessContext();
  if (!access.userId) throw new Error("Unauthorized");

  const parsed = updateDeckQuizFormatsSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const { ownerUserId, teamId } = await assertCanManageDeckQuizFormats(
    access.userId,
    parsed.data.deckId,
    parsed.data.teamId,
    access.effectivePlanSlug,
  );

  if (teamId == null && parsed.data.formats == null) {
    throw new Error("Enable at least one quiz question format.");
  }

  if (
    parsed.data.formats &&
    !parsed.data.formats.multipleChoice &&
    !parsed.data.formats.trueFalse &&
    !parsed.data.formats.fillInBlank
  ) {
    throw new Error("Enable at least one quiz question format.");
  }

  await updateDeckQuizFormats(
    parsed.data.deckId,
    ownerUserId,
    parsed.data.formats,
  );
  revalidatePath(`/decks/${parsed.data.deckId}/study`);
  revalidatePath("/dashboard/team-admin/deck-manager/study-privileges");
}

/** AI-generate true/false and fill-in-the-blank variants for all cards in a deck. */
export async function generateDeckQuizVariantsAction(
  data: z.infer<typeof generateDeckQuizVariantsSchema>,
) {
  const access = await getAccessContext();
  if (!access.userId) throw new Error("Unauthorized");
  const { userId } = access;

  const parsed = generateDeckQuizVariantsSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const bundle = await getDeckWithViewerAccess(parsed.data.deckId, userId);
  if (!bundle || !canEditDeckContent(bundle.access)) {
    throw new Error("Deck not found");
  }

  const teamTierPro = await deckHasTeamTierProFeatures(bundle.deck);
  if (!canUseDeckAiFeatures(access, teamTierPro)) {
    throw new Error(DECK_AI_PLAN_REQUIREMENT);
  }

  const formats =
    parsed.data.formats ??
    (await resolveQuizFormatsForStudy(
      parsed.data.deckId,
      parsed.data.teamId ?? bundle.deck.teamId,
    ));

  if (!formats.trueFalse && !formats.fillInBlank) {
    throw new Error("Enable true/false or fill-in-the-blank formats first.");
  }

  const cards = await getCardsByDeckUnscoped(parsed.data.deckId);
  const prepared = cards.map((card) => ({
    id: card.id,
    front: card.front,
    back: card.back,
    choices: card.choices,
    correctChoiceIndex: card.correctChoiceIndex,
    quizVariants: parseCardQuizVariants(card.quizVariants),
  }));
  const counts = countCardsReadyForQuizFormats(prepared, formats);
  const distribution = parsed.data.distribution as QuizFormatDistribution;
  const distributionCheck = validateQuizFormatDistribution(
    formats,
    distribution,
    counts.total,
  );
  if (!distributionCheck.valid) {
    throw new Error(distributionCheck.error);
  }

  const eligible = prepared.filter((c) => (c.front ?? "").trim() && (c.back ?? "").trim());
  shuffleInPlace(eligible);

  const cardSupportsTrueFalse = (card: (typeof prepared)[number]) =>
    getAvailableQuestionTypesForCard(card, prepared, formats).includes("true_false");
  const cardSupportsFillInBlank = (card: (typeof prepared)[number]) =>
    getAvailableQuestionTypesForCard(card, prepared, formats).includes("fill_in_blank");

  const syncPreparedVariants = (
    cardId: number,
    variants: import("@/lib/card-quiz-variants").CardQuizVariants,
  ) => {
    const idx = prepared.findIndex((c) => c.id === cardId);
    if (idx < 0) return;
    const current = prepared[idx]!;
    prepared[idx] = {
      ...current,
      quizVariants: {
        ...(current.quizVariants ?? {}),
        ...variants,
      },
    };
    const eligibleIdx = eligible.findIndex((c) => c.id === cardId);
    if (eligibleIdx >= 0) {
      eligible[eligibleIdx] = prepared[idx]!;
    }
  };

  let generated = 0;
  let failed = 0;
  let skipped = 0;

  // Keep generating until the mix can actually be assigned to distinct cards
  // (count thresholds alone are not enough when T/F and FIB share the same cards).
  for (const card of eligible) {
    const readyCounts = countCardsReadyForQuizFormats(prepared, formats);
    if (
      explainQuizFormatContentBlock(formats, readyCounts, distribution, prepared) === null
    ) {
      break;
    }

    const front = (card.front ?? "").trim();
    const back = (card.back ?? "").trim();
    if (!front || !back) {
      skipped++;
      continue;
    }

    const needsTf =
      formats.trueFalse &&
      distribution.trueFalse > 0 &&
      !cardSupportsTrueFalse(card);
    const needsFib =
      formats.fillInBlank &&
      distribution.fillInBlank > 0 &&
      !cardSupportsFillInBlank(card);

    if (!needsTf && !needsFib) {
      skipped++;
      continue;
    }

    try {
      const mcqContext = resolveCardMcqContext(card);
      const variants = await generateQuizVariantsForCard({
        front,
        back,
        includeTrueFalse: needsTf,
        includeFillInBlank: needsFib,
        mcqContext,
      });
      if (
        (needsTf && !variants.trueFalse) ||
        (needsFib && !variants.fillInBlank)
      ) {
        failed++;
        continue;
      }
      await mergeCardQuizVariants(card.id, parsed.data.deckId, variants);
      syncPreparedVariants(card.id, variants);
      generated++;
    } catch {
      failed++;
    }
  }

  revalidatePath(`/decks/${parsed.data.deckId}`);
  revalidatePath(`/decks/${parsed.data.deckId}/study`);
  revalidatePath("/dashboard/team-admin/deck-manager/study-privileges");

  const afterCards = await getCardsByDeckUnscoped(parsed.data.deckId);
  const afterPrepared = afterCards.map((card) => ({
    id: card.id,
    front: card.front,
    back: card.back,
    choices: card.choices,
    correctChoiceIndex: card.correctChoiceIndex,
    quizVariants: parseCardQuizVariants(card.quizVariants),
  }));
  const refreshedCounts = countCardsReadyForQuizFormats(afterPrepared, formats);

  const contentBlockReason = explainQuizFormatContentBlock(
    formats,
    refreshedCounts,
    distribution,
    afterPrepared,
  );

  return {
    generated,
    total: cards.length,
    failed,
    skipped,
    contentReady: contentBlockReason === null,
    contentBlockReason,
    formatReadyCounts: refreshedCounts,
  };
}

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}

/** Reshuffle which question format each card uses in quizzes for this deck. */
export async function reshuffleDeckQuizFormatAssignmentsAction(
  data: z.infer<typeof reshuffleDeckQuizFormatsSchema>,
) {
  const access = await getAccessContext();
  if (!access.userId) throw new Error("Unauthorized");

  const parsed = reshuffleDeckQuizFormatsSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const { ownerUserId, teamId } = await assertCanManageDeckQuizFormats(
    access.userId,
    parsed.data.deckId,
    parsed.data.teamId,
    access.effectivePlanSlug,
  );

  const bundle = await getDeckWithViewerAccess(parsed.data.deckId, access.userId);
  if (!bundle || !canEditDeckContent(bundle.access)) {
    throw new Error("Deck not found");
  }

  const payload = await reshuffleDeckQuizFormatAssignments(
    parsed.data.deckId,
    ownerUserId,
    teamId,
    parsed.data.distribution,
  );

  revalidatePath(`/decks/${parsed.data.deckId}/study`);
  revalidatePath("/dashboard/team-admin/deck-manager/study-privileges");
  return {
    cardCount: Object.keys(payload.byCardId).length,
    shuffledAt: payload.shuffledAt,
  };
}

/**
 * Persist format settings and publish the question mix to quiz in one step.
 * Personal Format Quiz Question drafts are not applied to the lobby until this runs.
 */
export async function publishDeckQuizFormatsAction(
  data: z.infer<typeof publishDeckQuizFormatsSchema>,
) {
  const access = await getAccessContext();
  if (!access.userId) throw new Error("Unauthorized");

  const parsed = publishDeckQuizFormatsSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  if (
    !parsed.data.formats.multipleChoice &&
    !parsed.data.formats.trueFalse &&
    !parsed.data.formats.fillInBlank
  ) {
    throw new Error("Enable at least one quiz question format.");
  }

  const { ownerUserId, teamId } = await assertCanManageDeckQuizFormats(
    access.userId,
    parsed.data.deckId,
    parsed.data.teamId,
    access.effectivePlanSlug,
  );

  const bundle = await getDeckWithViewerAccess(parsed.data.deckId, access.userId);
  if (!bundle || !canEditDeckContent(bundle.access)) {
    throw new Error("Deck not found");
  }

  await updateDeckQuizFormats(
    parsed.data.deckId,
    ownerUserId,
    parsed.data.formats,
  );

  await updateDeckQuizDurationMinutes(
    parsed.data.deckId,
    ownerUserId,
    resolveTeamQuizDurationMinutes(parsed.data.durationMinutes),
  );

  const payload = await reshuffleDeckQuizFormatAssignments(
    parsed.data.deckId,
    ownerUserId,
    teamId,
    parsed.data.distribution,
  );

  revalidatePath(`/decks/${parsed.data.deckId}/study`);
  revalidatePath(`/decks/${parsed.data.deckId}`);
  revalidatePath("/dashboard/team-admin/deck-manager/study-privileges");
  return {
    cardCount: Object.keys(payload.byCardId).length,
    shuffledAt: payload.shuffledAt,
  };
}

/** Preview quiz format questions before or after publish (T/F and FIB edits save to quizVariants only). */
export async function previewDeckQuizFormatsAction(
  data: z.infer<typeof previewDeckQuizFormatsSchema>,
): Promise<{
  items: QuizFormatPreviewItem[];
  usesPublishedAssignments: boolean;
}> {
  const access = await getAccessContext();
  if (!access.userId) throw new Error("Unauthorized");

  const parsed = previewDeckQuizFormatsSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const { teamId } = await assertCanManageDeckQuizFormats(
    access.userId,
    parsed.data.deckId,
    parsed.data.teamId,
    access.effectivePlanSlug,
  );

  const bundle = await getDeckWithViewerAccess(parsed.data.deckId, access.userId);
  if (!bundle || !canEditDeckContent(bundle.access)) {
    throw new Error("Deck not found");
  }

  const formats = await resolveQuizFormatsForStudy(parsed.data.deckId, teamId);
  const cardRows = await getCardsByDeckUnscoped(parsed.data.deckId);
  const prepared = cardRows.map((c) => ({
    id: c.id,
    front: c.front,
    back: c.back,
    choices: c.choices,
    correctChoiceIndex: c.correctChoiceIndex,
    quizVariants: parseCardQuizVariants(c.quizVariants),
  }));

  const saved = await getDeckQuizFormatAssignmentsForStudy(parsed.data.deckId);
  const { byCardId, usesPublishedAssignments } = resolvePreviewAssignments(
    prepared,
    formats,
    parsed.data.distribution,
    saved,
  );

  if (Object.keys(byCardId).length === 0) {
    throw new Error(
      "Could not build a preview for this mix. Generate AI content and verify counts first.",
    );
  }

  return {
    items: buildQuizFormatPreviewItems(prepared, formats, byCardId),
    usesPublishedAssignments,
  };
}

/**
 * Save an edited T/F or FIB quiz variant. Overwrites the quiz-facing format only —
 * the original card question, answer, and MCQ choices are never modified.
 */
export async function saveQuizFormatVariantEditAction(
  data: z.infer<typeof saveQuizFormatVariantEditSchema>,
): Promise<{ ok: true }> {
  const access = await getAccessContext();
  if (!access.userId) throw new Error("Unauthorized");

  const parsed = saveQuizFormatVariantEditSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  if (!parsed.data.trueFalse && !parsed.data.fillInBlank) {
    throw new Error("Nothing to save.");
  }

  await assertCanManageDeckQuizFormats(
    access.userId,
    parsed.data.deckId,
    parsed.data.teamId,
    access.effectivePlanSlug,
  );

  const bundle = await getDeckWithViewerAccess(parsed.data.deckId, access.userId);
  if (!bundle || !canEditDeckContent(bundle.access)) {
    throw new Error("Deck not found");
  }

  const patch: import("@/lib/card-quiz-variants").CardQuizVariants = {};
  if (parsed.data.trueFalse) {
    patch.trueFalse = {
      statement: parsed.data.trueFalse.statement.trim(),
      correctAnswer: parsed.data.trueFalse.correctAnswer,
    };
  }
  if (parsed.data.fillInBlank) {
    patch.fillInBlank = { segments: parsed.data.fillInBlank.segments };
  }

  const merged = await mergeCardQuizVariants(
    parsed.data.cardId,
    parsed.data.deckId,
    patch,
  );
  if (!merged) throw new Error("Card not found");

  revalidatePath(`/decks/${parsed.data.deckId}/study`);
  revalidatePath("/dashboard/team-admin/deck-manager/study-privileges");
  return { ok: true };
}
