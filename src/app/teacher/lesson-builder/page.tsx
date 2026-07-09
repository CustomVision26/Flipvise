import { getAccessContext } from "@/lib/access";
import { canUseAdvancedSourceImport } from "@/lib/source-import-access";
import { loadTeacherDeckContext } from "@/lib/load-teacher-deck-quota";
import { loadOwnerTeamAdminDeckPicker } from "@/db/queries/teacher-owner-pickers";
import { getDeckIdsWithSavedLessonPlans } from "@/db/queries/saved-lesson-plans";
import {
  filterDecksWithoutLessonPlans,
  filterOwnerDeckPickerWithoutLessonPlans,
} from "@/lib/filter-decks-without-lesson-plans";
import { loadTeacherPageContext } from "@/lib/resolve-teacher-workspace-url";
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
  const initialDeckId = Number.isFinite(parsedDeckId) ? parsedDeckId : undefined;

  const [deckContext, ownerDeckPickerRaw, ctx, deckIdsWithLessonPlans] =
    await Promise.all([
      loadTeacherDeckContext(userId),
      loadOwnerTeamAdminDeckPicker(userId, workspace.teamId),
      getAccessContext(),
      getDeckIdsWithSavedLessonPlans(),
    ]);

  const decks = filterDecksWithoutLessonPlans(
    deckContext.decks,
    deckIdsWithLessonPlans,
    initialDeckId,
  );
  const ownerDeckPicker = filterOwnerDeckPickerWithoutLessonPlans(
    ownerDeckPickerRaw,
    deckIdsWithLessonPlans,
    initialDeckId,
  );

  const initialDeck =
    initialDeckId != null
      ? decks.find((deck) => deck.id === initialDeckId) ??
        deckContext.decks.find((deck) => deck.id === initialDeckId) ??
        null
      : null;

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
