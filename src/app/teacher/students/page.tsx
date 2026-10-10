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
import { AiRecallTeacherStatsPanel } from "@/components/ai-recall-teacher-stats-panel";
import { getTeacherAiRecallStatsForWorkspace } from "@/db/queries/ai-recall";
import {
  getClerkUserFieldDisplaysByIds,
  looksLikeClerkUserId,
} from "@/lib/clerk-user-display";

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

  const [progress, registeredStudents, workspaceInvitees, manualGrades, personalClasses, savedHomeworkAssignments, savedQuizOptions, aiRecallStats] =
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
    getTeacherAiRecallStatsForWorkspace(userId, workspace.teamId),
  ]);

  const learnerIds = [
    ...new Set(aiRecallStats.monitor.members.map((member) => member.userId)),
  ];
  const recallDisplays =
    learnerIds.length > 0
      ? await getClerkUserFieldDisplaysByIds(learnerIds)
      : {};
  const registeredNameByEmail = new Map(
    registeredStudents
      .map((student) => [student.email.trim().toLowerCase(), student.fullName.trim()] as const)
      .filter(([email, name]) => email !== "" && name !== ""),
  );
  const inviteeByUserId = new Map(
    workspaceInvitees.map((invitee) => [invitee.memberUserId, invitee]),
  );

  function recallPersonLabel(userId: string): string {
    const display = recallDisplays[userId];
    const invitee = inviteeByUserId.get(userId);
    const email = (display?.primaryEmail ?? invitee?.email ?? "").trim();
    const registeredName = email
      ? registeredNameByEmail.get(email.toLowerCase())
      : undefined;
    if (registeredName) return registeredName;
    const inviteeLabel = invitee?.label?.trim() ?? "";
    if (inviteeLabel && !looksLikeClerkUserId(inviteeLabel)) return inviteeLabel;
    const line = display?.primaryLine?.trim() ?? "";
    if (line && !looksLikeClerkUserId(line)) return line;
    if (email) return email;
    return "Student";
  }

  const labeledAiRecallStats = {
    ...aiRecallStats,
    monitor: {
      ...aiRecallStats.monitor,
      members: aiRecallStats.monitor.members.map((member) => ({
        ...member,
        memberLabel: recallPersonLabel(member.userId),
      })),
      sessions: aiRecallStats.monitor.sessions.map((session) => ({
        ...session,
        memberLabel: recallPersonLabel(session.userId),
      })),
      topLearners: aiRecallStats.monitor.topLearners.map((learner) => ({
        ...learner,
        memberLabel: recallPersonLabel(learner.userId),
      })),
    },
  };

  const isWorkspaceOwner = team != null && team.ownerUserId === userId;
  const canDeleteResults =
    workspace.teamId != null &&
    (isWorkspaceOwner ||
      progress.memberMetaByUserId[userId]?.role === "team_admin");

  return (
    <div className="flex flex-col gap-4">
      <AiRecallTeacherStatsPanel stats={labeledAiRecallStats} />
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
    </div>
  );
}
