import { getAccessContext } from "@/lib/access";
import { getTeamById } from "@/db/queries/teams";
import { listTeacherStudentProgressForWorkspace } from "@/db/queries/teacher-student-progress";
import { listTeacherRegisteredStudentsForUser } from "@/db/queries/teacher-registered-students";
import { listTeacherManualGradesForWorkspace } from "@/db/queries/teacher-manual-grades";
import { listTeacherClassesForUser } from "@/db/queries/teacher-classes";
import { loadTeacherPageContext } from "@/lib/resolve-teacher-workspace-url";
import { isEducationTeamPlanId } from "@/lib/education-plans";
import { TeacherStudentProgressView } from "@/components/teacher-student-progress-view";

type TeacherStudentsPageProps = {
  searchParams: Promise<{
    team?: string;
    teamMemberId?: string;
  }>;
};

export default async function TeacherStudentsPage({
  searchParams,
}: TeacherStudentsPageProps) {
  const params = await searchParams;
  const { userId, workspace, backHref } = await loadTeacherPageContext(
    "/teacher/students",
    params,
  );

  const ctx = await getAccessContext();
  const isEducationPlus = ctx.effectivePlanSlug === "education_plus";
  const showRegisterStudentTab = isEducationPlus;
  const workspacePlanSlug =
    workspace.teamId != null
      ? (await getTeamById(workspace.teamId))?.planSlug ?? null
      : ctx.activeEducationTeamPlan;
  const showQuizResultsTab =
    workspacePlanSlug != null && isEducationTeamPlanId(workspacePlanSlug);
  const showGradesAndReportsTabs = isEducationPlus || showQuizResultsTab;

  const [progress, team, registeredStudents, manualGrades, personalClasses] =
    await Promise.all([
    listTeacherStudentProgressForWorkspace(userId, workspace.teamId),
    workspace.teamId != null ? getTeamById(workspace.teamId) : Promise.resolve(null),
    showRegisterStudentTab
      ? listTeacherRegisteredStudentsForUser(userId)
      : Promise.resolve([]),
    showGradesAndReportsTabs
      ? listTeacherManualGradesForWorkspace(userId, workspace.teamId)
      : Promise.resolve([]),
    showRegisterStudentTab
      ? listTeacherClassesForUser(userId, null)
      : Promise.resolve([]),
  ]);

  const isWorkspaceOwner = team != null && team.ownerUserId === userId;
  const canDeleteResults =
    workspace.teamId != null &&
    (isWorkspaceOwner ||
      progress.memberMetaByUserId[userId]?.role === "team_admin");

  return (
    <TeacherStudentProgressView
      rows={progress.rows}
      teamId={workspace.teamId}
      canDeleteResults={canDeleteResults}
      ownerUserId={progress.ownerUserId}
      ownerName={progress.ownerName}
      ownerEmail={progress.ownerEmail}
      memberMetaByUserId={progress.memberMetaByUserId}
      workspaceLabel={team?.name ?? null}
      backHref={backHref}
      isWorkspaceOwner={isWorkspaceOwner}
      showRegisterStudentTab={showRegisterStudentTab}
      showQuizResultsTab={showQuizResultsTab}
      showGradesAndReportsTabs={showGradesAndReportsTabs}
      registeredStudents={registeredStudents}
      personalClasses={personalClasses}
      manualGrades={manualGrades}
    />
  );
}
