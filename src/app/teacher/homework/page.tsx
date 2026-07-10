import { redirect } from "next/navigation";
import { getSavedLessonPlansForQuizPicker } from "@/db/queries/saved-lesson-plans";
import {
  resolveSavedHomeworkForViewer,
  mapSavedHomeworkRowToEditItem,
} from "@/db/queries/saved-homework";
import {
  loadOwnerTeamAdminDeckPicker,
  loadOwnerTeamAdminLessonPlanPicker,
} from "@/db/queries/teacher-owner-pickers";
import { loadTeacherDeckContext } from "@/lib/load-teacher-deck-quota";
import { loadTeacherPageContext } from "@/lib/resolve-teacher-workspace-url";
import { buildTeacherSubPath } from "@/lib/teacher-url";
import { TeacherHomeworkForm } from "@/components/teacher-homework-form";

type TeacherHomeworkPageProps = {
  searchParams: Promise<{
    team?: string;
    teamMemberId?: string;
    deckId?: string;
    lessonPlanId?: string;
    homeworkId?: string;
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
  const parsedHomeworkId = params.homeworkId
    ? Number.parseInt(params.homeworkId, 10)
    : Number.NaN;
  const initialHomeworkId = Number.isFinite(parsedHomeworkId)
    ? parsedHomeworkId
    : undefined;
  const initialSourceType =
    params.sourceType === "deck"
      ? ("deck" as const)
      : params.sourceType === "lesson_plan"
        ? ("lesson_plan" as const)
        : undefined;

  const savedHomework =
    initialHomeworkId != null
      ? await resolveSavedHomeworkForViewer(
          userId,
          initialHomeworkId,
          workspace.teamId,
        )
      : null;

  if (initialHomeworkId != null && !savedHomework) {
    redirect(
      buildTeacherSubPath("/resources", workspace.teamId, workspace.teamMemberId),
    );
  }

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
      initialSavedHomework={
        savedHomework ? mapSavedHomeworkRowToEditItem(savedHomework) : undefined
      }
    />
  );
}
