import {
  getSavedLessonPlansForQuizPicker,
  loadOwnerQuizLessonPlanPicker,
} from "@/db/queries/saved-lesson-plans";
import { loadTeacherDeckContext } from "@/lib/load-teacher-deck-quota";
import { loadTeacherPageContext } from "@/lib/resolve-teacher-workspace-url";
import { getAssignedDeckIdsForTeam } from "@/db/queries/teams";
import { TeacherQuizzesForm } from "@/components/teacher-quizzes-form";

type TeacherQuizzesPageProps = {
  searchParams: Promise<{
    team?: string;
    teamMemberId?: string;
    lessonPlanId?: string;
  }>;
};

export default async function TeacherQuizzesPage({
  searchParams,
}: TeacherQuizzesPageProps) {
  const params = await searchParams;
  const { userId, workspace, backHref } = await loadTeacherPageContext(
    "/teacher/quizzes",
    params,
  );

  const initialLessonPlanId = params.lessonPlanId
    ? Number.parseInt(params.lessonPlanId, 10)
    : undefined;

  const [savedLessonPlans, ownerPicker, deckContext, assignedDeckIds] = await Promise.all([
    getSavedLessonPlansForQuizPicker(userId, workspace.teamId),
    loadOwnerQuizLessonPlanPicker(userId, workspace.teamId),
    loadTeacherDeckContext(userId, workspace.teamId),
    workspace.teamId != null
      ? getAssignedDeckIdsForTeam(workspace.teamId)
      : Promise.resolve([]),
  ]);

  return (
    <TeacherQuizzesForm
      savedLessonPlans={savedLessonPlans}
      ownerPicker={ownerPicker}
      decks={deckContext.decks}
      assignedDeckIds={assignedDeckIds}
      deckQuota={deckContext.quota}
      viewerUserId={userId}
      initialLessonPlanId={
        Number.isFinite(initialLessonPlanId) ? initialLessonPlanId : undefined
      }
      backHref={backHref}
      teacherWorkspace={workspace}
    />
  );
}
