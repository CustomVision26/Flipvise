import { getAccessContext } from "@/lib/access";
import { canUseAdvancedSourceImport } from "@/lib/source-import-access";
import { loadTeacherPageContext } from "@/lib/resolve-teacher-workspace-url";
import { TeacherLessonBuilderForm } from "./teacher-lesson-builder-form";

type TeacherLessonBuilderPageProps = {
  searchParams: Promise<{
    team?: string;
    teamMemberId?: string;
  }>;
};

export default async function TeacherLessonBuilderPage({
  searchParams,
}: TeacherLessonBuilderPageProps) {
  const params = await searchParams;
  const { workspace, backHref } = await loadTeacherPageContext(
    "/teacher/lesson-builder",
    params,
  );

  const ctx = await getAccessContext();
  const hasAdvancedSourceImport = canUseAdvancedSourceImport({
    hasAiReading: ctx.hasAiReading,
    teamTierProWorkspace: ctx.activeEducationTeamPlan !== null,
  });

  return (
    <TeacherLessonBuilderForm
      hasAdvancedSourceImport={hasAdvancedSourceImport}
      backHref={backHref}
      teacherWorkspace={workspace}
    />
  );
}
