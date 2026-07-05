import { getSavedLessonPlansForQuizPicker } from "@/db/queries/saved-lesson-plans";
import { loadTeacherDeckContext } from "@/lib/load-teacher-deck-quota";
import { loadTeacherPageContext } from "@/lib/resolve-teacher-workspace-url";
import { TeacherHomeworkForm } from "@/components/teacher-homework-form";

type TeacherHomeworkPageProps = {
  searchParams: Promise<{
    team?: string;
    teamMemberId?: string;
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

  const [savedLessonPlans, deckContext] = await Promise.all([
    getSavedLessonPlansForQuizPicker(userId),
    loadTeacherDeckContext(userId),
  ]);

  return (
    <TeacherHomeworkForm
      savedLessonPlans={savedLessonPlans}
      decks={deckContext.decks}
      backHref={backHref}
      teacherWorkspace={workspace}
    />
  );
}
