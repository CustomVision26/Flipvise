import { getAccessContext } from "@/lib/access";
import { getSavedHomeworkForPicker } from "@/db/queries/saved-homework";
import { getSavedLessonPlansForQuizPicker } from "@/db/queries/saved-lesson-plans";
import { loadTeacherPageContext } from "@/lib/resolve-teacher-workspace-url";
import { canUseAdvancedSourceImport } from "@/lib/source-import-access";
import { TeacherStudyGuidesForm } from "@/components/teacher-study-guides-form";

type TeacherStudyGuidesPageProps = {
  searchParams: Promise<{
    team?: string;
    teamMemberId?: string;
    lessonPlanId?: string;
  }>;
};

export default async function TeacherStudyGuidesPage({
  searchParams,
}: TeacherStudyGuidesPageProps) {
  const params = await searchParams;
  const { userId, workspace, backHref } = await loadTeacherPageContext(
    "/teacher/study-guides",
    params,
  );

  const initialLessonPlanId = params.lessonPlanId
    ? Number.parseInt(params.lessonPlanId, 10)
    : undefined;

  const ctx = await getAccessContext();
  const hasAdvancedSourceImport = canUseAdvancedSourceImport({
    hasAiReading: ctx.hasAiReading,
    teamTierProWorkspace: ctx.activeEducationTeamPlan !== null,
  });

  const [savedLessonPlans, savedHomework] = await Promise.all([
    getSavedLessonPlansForQuizPicker(userId),
    getSavedHomeworkForPicker(userId),
  ]);

  return (
    <TeacherStudyGuidesForm
      savedLessonPlans={savedLessonPlans}
      savedHomework={savedHomework}
      hasAdvancedSourceImport={hasAdvancedSourceImport}
      initialLessonPlanId={
        Number.isFinite(initialLessonPlanId) ? initialLessonPlanId : undefined
      }
      backHref={backHref}
      teacherWorkspace={workspace}
    />
  );
}
