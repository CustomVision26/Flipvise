import { getAccessContext } from "@/lib/access";
import { auth } from "@/lib/clerk-auth";
import { redirect } from "next/navigation";
import { getTeamsForTeamDashboard } from "@/db/queries/teams";
import { EDUCATION_PLAN_LABELS, isEducationTeamPlanId } from "@/lib/education-plans";
import { buildTeamAdminPath } from "@/lib/team-admin-url";
import { resolveTeacherWorkspaceContext } from "@/lib/resolve-teacher-workspace-url";
import { redirectIfPlanReconciliationPending } from "@/lib/plan-reconciliation-gate";
import { TeacherDashboardHome } from "@/components/teacher-dashboard-home";

type TeacherDashboardPageProps = {
  searchParams: Promise<{
    team?: string;
    teamMemberId?: string;
  }>;
};

export default async function TeacherDashboardPage({
  searchParams,
}: TeacherDashboardPageProps) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/");
  }

  await redirectIfPlanReconciliationPending(userId);

  const params = await searchParams;
  const workspace = await resolveTeacherWorkspaceContext(userId, "/teacher", params);

  const ctx = await getAccessContext();
  const planSlug = ctx.effectivePlanSlug ?? "education_plus";
  const planLabel = EDUCATION_PLAN_LABELS[planSlug as keyof typeof EDUCATION_PLAN_LABELS] ?? "Education";

  const workspaceNote =
    ctx.activeEducationTeamPlan != null
      ? "Team admins on Education Gold and Education Enterprise can create decks for assigned workspaces. Decks appear on the plan owner's personal dashboard, grouped by workspace."
      : "Education Plus teachers create decks from their personal dashboard. Link decks here to build lesson plans, quizzes, and classroom materials.";

  let teamAdminHref: string | null = null;
  const manageTeams = await getTeamsForTeamDashboard(userId);

  if (workspace.teamId != null) {
    const canManageWorkspace = manageTeams.some((team) => team.id === workspace.teamId);
    if (canManageWorkspace) {
      teamAdminHref = buildTeamAdminPath(workspace.teamId, workspace.teamMemberId);
    }
  } else {
    const pick =
      manageTeams.find((team) => team.ownerUserId === userId) ?? manageTeams[0] ?? null;
    if (
      pick &&
      (ctx.activeEducationTeamPlan != null || isEducationTeamPlanId(pick.planSlug))
    ) {
      teamAdminHref = buildTeamAdminPath(
        pick.id,
        pick.ownerUserId === userId ? 0 : workspace.teamMemberId,
      );
    }
  }

  return (
    <TeacherDashboardHome
      planLabel={planLabel}
      workspaceNote={workspaceNote}
      teamAdminHref={teamAdminHref}
    />
  );
}
