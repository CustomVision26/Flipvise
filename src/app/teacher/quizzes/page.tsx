import {
  getSavedLessonPlansForQuizPicker,
  loadOwnerQuizLessonPlanPicker,
} from "@/db/queries/saved-lesson-plans";
import { loadTeacherDeckContext } from "@/lib/load-teacher-deck-quota";
import { loadTeacherPageContext } from "@/lib/resolve-teacher-workspace-url";
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

  const [savedLessonPlans, ownerPicker, deckContext] = await Promise.all([
    getSavedLessonPlansForQuizPicker(userId),
    loadOwnerQuizLessonPlanPicker(userId, workspace.teamId),
    loadTeacherDeckContext(userId),
  ]);

  return (
    <TeacherQuizzesForm
      savedLessonPlans={savedLessonPlans}
      ownerPicker={ownerPicker}
      decks={deckContext.decks}
      deckQuota={deckContext.quota}
      initialLessonPlanId={
        Number.isFinite(initialLessonPlanId) ? initialLessonPlanId : undefined
      }
      backHref={backHref}
      teacherWorkspace={workspace}
    />
  );
}
