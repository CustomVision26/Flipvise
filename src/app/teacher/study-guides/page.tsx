import { getAccessContext } from "@/lib/access";
import { getSavedHomeworkForPicker } from "@/db/queries/saved-homework";
import { getSavedLessonPlansForQuizPicker } from "@/db/queries/saved-lesson-plans";
import {
  loadOwnerTeamAdminHomeworkPicker,
  loadOwnerTeamAdminLessonPlanPicker,
} from "@/db/queries/teacher-owner-pickers";
import { loadTeacherPageContext } from "@/lib/resolve-teacher-workspace-url";
import { canUseAdvancedSourceImport } from "@/lib/source-import-access";
import { TeacherStudyGuidesForm } from "@/components/teacher-study-guides-form";

type TeacherStudyGuidesPageProps = {
  searchParams: Promise<{
    team?: string;
    teamMemberId?: string;
    lessonPlanId?: string;
    homeworkId?: string;
    deckId?: string;
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
  const initialHomeworkId = params.homeworkId
    ? Number.parseInt(params.homeworkId, 10)
    : undefined;

  const ctx = await getAccessContext();
  const hasAdvancedSourceImport = canUseAdvancedSourceImport({
    hasAiReading: ctx.hasAiReading,
    teamTierProWorkspace: ctx.activeEducationTeamPlan !== null,
  });

  const [savedLessonPlans, savedHomework, ownerLessonPlanPicker, ownerHomeworkPicker] =
    await Promise.all([
      getSavedLessonPlansForQuizPicker(userId),
      getSavedHomeworkForPicker(userId),
      loadOwnerTeamAdminLessonPlanPicker(userId, workspace.teamId),
      loadOwnerTeamAdminHomeworkPicker(userId, workspace.teamId),
    ]);

  return (
    <TeacherStudyGuidesForm
      savedLessonPlans={savedLessonPlans}
      savedHomework={savedHomework}
      ownerLessonPlanPicker={ownerLessonPlanPicker}
      ownerHomeworkPicker={ownerHomeworkPicker}
      hasAdvancedSourceImport={hasAdvancedSourceImport}
      initialLessonPlanId={
        Number.isFinite(initialLessonPlanId) ? initialLessonPlanId : undefined
      }
      initialHomeworkId={
        Number.isFinite(initialHomeworkId) ? initialHomeworkId : undefined
      }
      backHref={backHref}
      teacherWorkspace={workspace}
    />
  );
}
