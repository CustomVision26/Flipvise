"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getAccessContext } from "@/lib/access";
import {
  assertDeckInWorkspaceForFormats,
  resolveQuizFormatsForStudy,
  updateDeckQuizFormats,
  updateTeamQuizFormats,
} from "@/db/queries/quiz-formats";
import {
  getCardsByDeckUnscoped,
  mergeCardQuizVariants,
} from "@/db/queries/cards";
import { generateQuizVariantsForCard } from "@/lib/generate-quiz-variants-ai";
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

const generateDeckQuizVariantsSchema = z.object({
  deckId: z.number().int().positive(),
  teamId: z.number().int().positive().optional(),
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
  let generated = 0;
  let failed = 0;
  let skipped = 0;

  for (const card of cards) {
    const front = (card.front ?? "").trim();
    const back = (card.back ?? "").trim();
    if (!front || !back) {
      skipped++;
      continue;
    }

    const needsTf = formats.trueFalse && !card.quizVariants?.trueFalse;
    const needsFib = formats.fillInBlank && !card.quizVariants?.fillInBlank;
    if (!needsTf && !needsFib) {
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
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  revalidatePath(`/decks/${parsed.data.deckId}`);
  revalidatePath("/dashboard/team-admin/deck-manager/study-privileges");
  return { generated, total: cards.length, failed, skipped };
}
