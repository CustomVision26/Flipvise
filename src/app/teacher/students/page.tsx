import { getAccessContext } from "@/lib/access";
import { getTeamById } from "@/db/queries/teams";
import { listTeacherStudentProgressForWorkspace } from "@/db/queries/teacher-student-progress";
import { listTeacherRegisteredStudentsForUser } from "@/db/queries/teacher-registered-students";
import { listWorkspaceStudentInviteesForTeam } from "@/db/queries/teacher-workspace-student-invitees";
import { listTeacherManualGradesForWorkspace, listTeacherManualGradeQuizOptionsForUser } from "@/db/queries/teacher-manual-grades";
import { listTeacherClassesForUser } from "@/db/queries/teacher-classes";
import { listSavedHomeworkAssignmentOptionsForUser, listSavedHomeworkAssignmentOptionsForWorkspace } from "@/db/queries/saved-homework";
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

  const team =
    workspace.teamId != null ? await getTeamById(workspace.teamId) : null;
  const workspacePlanSlug = team?.planSlug ?? ctx.activeEducationTeamPlan ?? null;
  const isEducationTeamWorkspace =
    workspacePlanSlug != null && isEducationTeamPlanId(workspacePlanSlug);
  const showRegisterStudentTab = isEducationPlus || isEducationTeamWorkspace;
  const showQuizResultsTab = isEducationTeamWorkspace;
  const showGradesAndReportsTabs = isEducationPlus || showQuizResultsTab;

  const [progress, registeredStudents, workspaceInvitees, manualGrades, personalClasses, savedHomeworkAssignments, savedQuizOptions] =
    await Promise.all([
    listTeacherStudentProgressForWorkspace(userId, workspace.teamId),
    showRegisterStudentTab
      ? listTeacherRegisteredStudentsForUser(userId)
      : Promise.resolve([]),
    isEducationTeamWorkspace && workspace.teamId != null
      ? listWorkspaceStudentInviteesForTeam(workspace.teamId)
      : Promise.resolve([]),
    showGradesAndReportsTabs
      ? listTeacherManualGradesForWorkspace(userId, workspace.teamId)
      : Promise.resolve([]),
    showRegisterStudentTab
      ? listTeacherClassesForUser(
          userId,
          isEducationTeamWorkspace ? workspace.teamId : null,
        )
      : Promise.resolve([]),
    showRegisterStudentTab && isEducationPlus
      ? listSavedHomeworkAssignmentOptionsForUser(userId)
      : isEducationTeamWorkspace && workspace.teamId != null
        ? listSavedHomeworkAssignmentOptionsForWorkspace(userId, workspace.teamId)
        : Promise.resolve([]),
    showRegisterStudentTab && isEducationPlus
      ? listTeacherManualGradeQuizOptionsForUser(userId)
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
      teamMemberId={workspace.teamMemberId}
      canDeleteResults={canDeleteResults}
      ownerUserId={progress.ownerUserId}
      ownerName={progress.ownerName}
      ownerEmail={progress.ownerEmail}
      memberMetaByUserId={progress.memberMetaByUserId}
      workspaceLabel={team?.name ?? null}
      workspacePlanSlug={workspacePlanSlug}
      backHref={backHref}
      isWorkspaceOwner={isWorkspaceOwner}
      showRegisterStudentTab={showRegisterStudentTab}
      isPersonalEducation={isEducationPlus}
      isEducationTeamWorkspace={isEducationTeamWorkspace}
      workspaceInvitees={workspaceInvitees}
      showQuizResultsTab={showQuizResultsTab}
      showGradesAndReportsTabs={showGradesAndReportsTabs}
      registeredStudents={registeredStudents}
      personalClasses={personalClasses}
      savedHomeworkAssignments={savedHomeworkAssignments}
      savedQuizOptions={savedQuizOptions}
      manualGrades={manualGrades}
    />
  );
}
