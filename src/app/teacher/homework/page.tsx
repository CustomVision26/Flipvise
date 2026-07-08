import { getSavedLessonPlansForQuizPicker } from "@/db/queries/saved-lesson-plans";
import {
  loadOwnerTeamAdminDeckPicker,
  loadOwnerTeamAdminLessonPlanPicker,
} from "@/db/queries/teacher-owner-pickers";
import { loadTeacherDeckContext } from "@/lib/load-teacher-deck-quota";
import { loadTeacherPageContext } from "@/lib/resolve-teacher-workspace-url";
import { TeacherHomeworkForm } from "@/components/teacher-homework-form";

type TeacherHomeworkPageProps = {
  searchParams: Promise<{
    team?: string;
    teamMemberId?: string;
    deckId?: string;
    lessonPlanId?: string;
    sourceType?: string;
  }>;
};

export default async function TeacherHomeworkPage({
  searchParams,
}: TeacherHomeworkPageProps) {
  const params = await searchParams;
  const { userId, workspace, backHref } = await loadTeacherPageContext(
    "/teacher/homework",
    params,
  );

  const parsedDeckId = params.deckId ? Number.parseInt(params.deckId, 10) : Number.NaN;
  const initialDeckId = Number.isFinite(parsedDeckId) ? parsedDeckId : undefined;
  const parsedLessonPlanId = params.lessonPlanId
    ? Number.parseInt(params.lessonPlanId, 10)
    : Number.NaN;
  const initialLessonPlanId = Number.isFinite(parsedLessonPlanId)
    ? parsedLessonPlanId
    : undefined;
  const initialSourceType =
    params.sourceType === "deck"
      ? ("deck" as const)
      : params.sourceType === "lesson_plan"
        ? ("lesson_plan" as const)
        : undefined;

  const [savedLessonPlans, ownerLessonPlanPicker, ownerDeckPicker, deckContext] =
    await Promise.all([
      getSavedLessonPlansForQuizPicker(userId),
      loadOwnerTeamAdminLessonPlanPicker(userId, workspace.teamId),
      loadOwnerTeamAdminDeckPicker(userId, workspace.teamId),
      loadTeacherDeckContext(userId),
    ]);

  return (
    <TeacherHomeworkForm
      savedLessonPlans={savedLessonPlans}
      ownerLessonPlanPicker={ownerLessonPlanPicker}
      ownerDeckPicker={ownerDeckPicker}
      decks={deckContext.decks}
      backHref={backHref}
      teacherWorkspace={workspace}
      initialDeckId={initialDeckId}
      initialLessonPlanId={initialLessonPlanId}
      initialSourceType={initialSourceType}
    />
  );
}
