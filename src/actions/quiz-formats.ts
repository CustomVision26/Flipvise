"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getAccessContext } from "@/lib/access";
import {
  assertDeckInWorkspaceForFormats,
  resolveQuizFormatsForStudy,
  reshuffleDeckQuizFormatAssignments,
  updateDeckQuizFormats,
  updateTeamQuizFormats,
} from "@/db/queries/quiz-formats";
import { getCardsByDeckUnscoped, mergeCardQuizVariants } from "@/db/queries/cards";
import { generateQuizVariantsForCard } from "@/lib/generate-quiz-variants-ai";
import {
  countCardsReadyForQuizFormats,
  deckAiQuizContentReady,
  validateQuizFormatDistribution,
  type QuizFormatDistribution,
} from "@/lib/quiz-format-assignments";
import { parseCardQuizVariants } from "@/lib/card-quiz-variants";
import { getDeckWithViewerAccess } from "@/lib/team-deck-access";
import { canEditDeckContent } from "@/lib/team-deck-access";
import { deckHasTeamTierProFeatures } from "@/lib/team-deck-pro-features";

async function assertCanManageTeam(userId: string, teamId: number) {
  const { getTeamById, getMemberRecord } = await import("@/db/queries/teams");
  const team = await getTeamById(teamId);
  if (!team) throw new Error("Workspace not found");
  if (team.ownerUserId === userId) return team;
  const member = await getMemberRecord(teamId, userId);
  if (member?.role === "team_admin") return team;
  throw new Error("Forbidden");
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
  teamId: z.number().int().positive(),
  deckId: z.number().int().positive(),
  /** null clears per-deck override (inherit workspace). */
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
});

const reshuffleDeckQuizFormatsSchema = z.object({
  deckId: z.number().int().positive(),
  teamId: z.number().int().positive(),
  distribution: quizFormatDistributionSchema,
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
  const { userId } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = updateDeckQuizFormatsSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const team = await assertCanManageTeam(userId, parsed.data.teamId);
  await assertDeckInWorkspaceForFormats(
    parsed.data.teamId,
    team.ownerUserId,
    parsed.data.deckId,
  );

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
    team.ownerUserId,
    parsed.data.formats,
  );
  revalidatePath("/dashboard/team-admin/deck-manager/study-privileges");
}

/** AI-generate true/false and fill-in-the-blank variants for all cards in a deck. */
export async function generateDeckQuizVariantsAction(
  data: z.infer<typeof generateDeckQuizVariantsSchema>,
) {
  const { userId, hasAI } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = generateDeckQuizVariantsSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const bundle = await getDeckWithViewerAccess(parsed.data.deckId, userId);
  if (!bundle || !canEditDeckContent(bundle.access)) {
    throw new Error("Deck not found");
  }

  const teamTierPro = await deckHasTeamTierProFeatures(bundle.deck);
  if (!hasAI && !teamTierPro) {
    throw new Error("AI generation requires a Pro plan.");
  }

  const formats = await resolveQuizFormatsForStudy(
    parsed.data.deckId,
    parsed.data.teamId ?? bundle.deck.teamId,
  );

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

  let generated = 0;
  let failed = 0;
  let skipped = 0;
  let trueFalseReady = eligible.filter((c) => c.quizVariants?.trueFalse).length;
  let fillInBlankReady = eligible.filter((c) => c.quizVariants?.fillInBlank).length;

  for (const card of eligible) {
    const front = (card.front ?? "").trim();
    const back = (card.back ?? "").trim();
    if (!front || !back) {
      skipped++;
      continue;
    }

    const needsTf =
      formats.trueFalse &&
      distribution.trueFalse > 0 &&
      trueFalseReady < distribution.trueFalse &&
      !card.quizVariants?.trueFalse;
    const needsFib =
      formats.fillInBlank &&
      distribution.fillInBlank > 0 &&
      fillInBlankReady < distribution.fillInBlank &&
      !card.quizVariants?.fillInBlank;

    if (!needsTf && !needsFib) {
      skipped++;
      continue;
    }

    if (
      trueFalseReady >= distribution.trueFalse &&
      fillInBlankReady >= distribution.fillInBlank
    ) {
      skipped++;
      continue;
    }

    try {
      const variants = await generateQuizVariantsForCard({
        front,
        back,
        includeTrueFalse: needsTf,
        includeFillInBlank: needsFib,
      });
      if (variants.trueFalse || variants.fillInBlank) {
        await mergeCardQuizVariants(card.id, parsed.data.deckId, variants);
        generated++;
        if (variants.trueFalse) trueFalseReady++;
        if (variants.fillInBlank) fillInBlankReady++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  revalidatePath(`/decks/${parsed.data.deckId}`);
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

  return {
    generated,
    total: cards.length,
    failed,
    skipped,
    contentReady: deckAiQuizContentReady(formats, refreshedCounts, distribution),
  };
}

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}

/** Reshuffle which question format each card uses in team quizzes for this deck. */
export async function reshuffleDeckQuizFormatAssignmentsAction(
  data: z.infer<typeof reshuffleDeckQuizFormatsSchema>,
) {
  const { userId } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = reshuffleDeckQuizFormatsSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const team = await assertCanManageTeam(userId, parsed.data.teamId);
  await assertDeckInWorkspaceForFormats(
    parsed.data.teamId,
    team.ownerUserId,
    parsed.data.deckId,
  );

  const bundle = await getDeckWithViewerAccess(parsed.data.deckId, userId);
  if (!bundle || !canEditDeckContent(bundle.access)) {
    throw new Error("Deck not found");
  }

  const payload = await reshuffleDeckQuizFormatAssignments(
    parsed.data.deckId,
    team.ownerUserId,
    parsed.data.teamId,
    parsed.data.distribution,
  );

  revalidatePath(`/decks/${parsed.data.deckId}/study`);
  revalidatePath("/dashboard/team-admin/deck-manager/study-privileges");
  return {
    cardCount: Object.keys(payload.byCardId).length,
    shuffledAt: payload.shuffledAt,
  };
}
