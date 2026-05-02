import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/clerk-auth";
import { getAccessContext } from "@/lib/access";
import { buttonVariants } from "@/components/ui/button";
import { ManageWorkspacesPanel } from "@/components/manage-workspaces-panel";
import { cn } from "@/lib/utils";
import { listTeamWorkspaceEventsForOwner } from "@/db/queries/team-workspace-events";
import { getTeamsByOwner } from "@/db/queries/teams";
import { isTeamPlanId, limitsForPlan, type TeamPlanId } from "@/lib/team-plans";
import { buildTeamAdminPath } from "@/lib/team-admin-url";

export default async function ManageWorkspacesPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const ownedTeams = await getTeamsByOwner(userId);
  if (ownedTeams.length === 0) {
    redirect("/dashboard");
  }

  const { activeTeamPlan } = await getAccessContext();

  const planForNewTeam: TeamPlanId | null =
    activeTeamPlan ??
    (ownedTeams.find((t) => isTeamPlanId(t.planSlug))?.planSlug as TeamPlanId | undefined) ??
    null;

  if (!planForNewTeam) {
    redirect("/dashboard");
  }

  const limits = limitsForPlan(planForNewTeam);
  const isAtTeamLimit = ownedTeams.length >= limits.maxTeams;

  const events = await listTeamWorkspaceEventsForOwner(userId);

  const defaultTeamForAdminLink = [...ownedTeams].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  )[0]!;
  const teamAdminBackHref = buildTeamAdminPath(defaultTeamForAdminLink.id);

  return (
    <div className="flex flex-1 flex-col gap-8 p-4 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 space-y-2">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Manage workspaces</h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-2xl">
            Add, rename, or delete team workspaces you own. History below lists creates, renames, and
            deletes.
          </p>
        </div>
        <Link
          href={teamAdminBackHref}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "w-full gap-2 sm:w-auto shrink-0",
          )}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to workspace dashboard
        </Link>
      </div>

      <ManageWorkspacesPanel
        teams={ownedTeams.map((t) => ({
          id: t.id,
          name: t.name,
          planSlug: t.planSlug,
        }))}
        events={events}
        addTeamPlanSlug={planForNewTeam}
        isAtTeamLimit={isAtTeamLimit}
      />
    </div>
  );
}
