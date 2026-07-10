import { redirect } from "next/navigation";
import { getAccessContext } from "@/lib/access";
import { canUseAdvancedSourceImport } from "@/lib/source-import-access";
import { loadTeacherDeckContext } from "@/lib/load-teacher-deck-quota";
import { loadOwnerTeamAdminDeckPicker } from "@/db/queries/teacher-owner-pickers";
import { resolveLessonPlanDeckUsage, resolveSavedLessonPlanForViewer } from "@/db/queries/saved-lesson-plans";
import {
  filterDecksWithoutLessonPlans,
  filterOwnerDeckPickerWithoutLessonPlans,
} from "@/lib/filter-decks-without-lesson-plans";
import { loadTeacherPageContext } from "@/lib/resolve-teacher-workspace-url";
import { buildTeacherSubPath } from "@/lib/teacher-url";
import { deckToHomeworkDefaults } from "@/lib/homework-source-context";
import { LESSON_DIFFICULTY_LEVELS } from "@/lib/lesson-plan-difficulty";
import { TeacherLessonBuilderForm } from "./teacher-lesson-builder-form";

function lessonDifficultyFromDeck(deckDefaults: ReturnType<typeof deckToHomeworkDefaults>) {
  if (
    LESSON_DIFFICULTY_LEVELS.includes(
      deckDefaults.difficultyLevel as (typeof LESSON_DIFFICULTY_LEVELS)[number],
    )
  ) {
    return deckDefaults.difficultyLevel;
  }
  return deckDefaults.difficultyLevel === "On-level" ? "Intermediate" : "Intermediate";
}

type TeacherLessonBuilderPageProps = {
  searchParams: Promise<{
    team?: string;
    teamMemberId?: string;
    deckId?: string;
    lessonPlanId?: string;
  }>;
};

export default async function TeacherLessonBuilderPage({
  searchParams,
}: TeacherLessonBuilderPageProps) {
  const params = await searchParams;
  const { userId, workspace, backHref } = await loadTeacherPageContext(
    "/teacher/lesson-builder",
    params,
  );

  const parsedDeckId = params.deckId ? Number.parseInt(params.deckId, 10) : Number.NaN;
  const parsedLessonPlanId = params.lessonPlanId
    ? Number.parseInt(params.lessonPlanId, 10)
    : Number.NaN;
  const initialLessonPlanId = Number.isFinite(parsedLessonPlanId)
    ? parsedLessonPlanId
    : undefined;
  const initialDeckIdFromParams = Number.isFinite(parsedDeckId) ? parsedDeckId : undefined;

  const savedPlan =
    initialLessonPlanId != null
      ? await resolveSavedLessonPlanForViewer(
          userId,
          initialLessonPlanId,
          workspace.teamId,
        )
      : null;

  if (initialLessonPlanId != null && !savedPlan) {
    redirect(
      buildTeacherSubPath("/resources", workspace.teamId, workspace.teamMemberId),
    );
  }

  const keepDeckId = savedPlan?.deckId ?? initialDeckIdFromParams;

  const [deckContext, ownerDeckPickerRaw, ctx] = await Promise.all([
    loadTeacherDeckContext(userId),
    loadOwnerTeamAdminDeckPicker(userId, workspace.teamId),
    getAccessContext(),
  ]);

  const creatorUserIds = ownerDeckPickerRaw.isWorkspaceOwner
    ? Object.keys(ownerDeckPickerRaw.itemsByAdminUserId)
    : [userId];
  const decksForUsage = ownerDeckPickerRaw.isWorkspaceOwner
    ? Object.values(ownerDeckPickerRaw.itemsByAdminUserId).flat()
    : deckContext.decks;

  const deckUsage = await resolveLessonPlanDeckUsage(
    creatorUserIds,
    decksForUsage,
  );

  const decks = filterDecksWithoutLessonPlans(
    deckContext.decks,
    deckUsage.usedDeckIds,
    keepDeckId,
  );
  const ownerDeckPicker = filterOwnerDeckPickerWithoutLessonPlans(
    ownerDeckPickerRaw,
    deckUsage,
    keepDeckId,
  );

  const initialDeck =
    keepDeckId != null
      ? decks.find((deck) => deck.id === keepDeckId) ??
        deckContext.decks.find((deck) => deck.id === keepDeckId) ??
        null
      : null;

  const initialDeckAdminUserId =
    initialDeck != null
      ? (initialDeck.createdByUserId ?? initialDeck.userId)
      : undefined;

  const hasAdvancedSourceImport = canUseAdvancedSourceImport({
    hasAiReading: ctx.hasAiReading,
    teamTierProWorkspace: ctx.activeEducationTeamPlan !== null,
  });

  return (
    <TeacherLessonBuilderForm
      hasAdvancedSourceImport={hasAdvancedSourceImport}
      backHref={backHref}
      teacherWorkspace={workspace}
      decks={decks}
      ownerDeckPicker={ownerDeckPicker}
      deckQuota={deckContext.quota}
      initialDeckId={initialDeck?.id}
      initialDeckAdminUserId={initialDeckAdminUserId}
      initialSavedPlan={
        savedPlan
          ? {
              id: savedPlan.id,
              input: savedPlan.input,
              result: savedPlan.result,
              deckId: savedPlan.deckId,
              sourceDeckName: savedPlan.sourceDeckName,
              lessonTitle: savedPlan.lessonTitle,
            }
          : undefined
      }
      initialDeckDefaults={
        initialDeck
          ? {
              ...deckToHomeworkDefaults(initialDeck),
              difficultyLevel: lessonDifficultyFromDeck(
                deckToHomeworkDefaults(initialDeck),
              ),
            }
          : undefined
      }
    />
  );
}
