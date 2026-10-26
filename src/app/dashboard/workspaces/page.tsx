import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/clerk-auth";
import { getAccessContext } from "@/lib/access";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ManageWorkspacesPanel } from "@/components/manage-workspaces-panel";
import { cn } from "@/lib/utils";
import { listTeamWorkspaceEventsForOwner } from "@/db/queries/team-workspace-events";
import { getTeamsByOwner } from "@/db/queries/teams";
import { limitsForPlan } from "@/lib/team-plans";
import { buildTeamAdminPath } from "@/lib/team-admin-url";
import {
  isWorkspaceSubscriptionPlanSlug,
  type WorkspaceCreatePlanId,
} from "@/lib/education-plans";

export default async function ManageWorkspacesPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const ownedTeams = await getTeamsByOwner(userId);
  if (ownedTeams.length === 0) {
    redirect("/dashboard");
  }

  const { activeTeamPlan, activeEducationTeamPlan } = await getAccessContext();

  const ownedPlan = ownedTeams.find((t) =>
    isWorkspaceSubscriptionPlanSlug(t.planSlug),
  )?.planSlug;
  const planForNewTeam: WorkspaceCreatePlanId | null =
    activeTeamPlan ??
    activeEducationTeamPlan ??
    (ownedPlan && isWorkspaceSubscriptionPlanSlug(ownedPlan) ? ownedPlan : null);

  if (!planForNewTeam) {
    redirect("/dashboard");
  }

  const limits = limitsForPlan(planForNewTeam);
  const isAtTeamLimit = ownedTeams.length >= limits.maxTeams;

  const events = await listTeamWorkspaceEventsForOwner(userId);

  const defaultTeamForAdminLink = [...ownedTeams].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  )[0]!;
  const teamAdminBackHref = buildTeamAdminPath(defaultTeamForAdminLink.id, 0);

  return (
    <div className="manage-workspaces-page flex flex-1 flex-col gap-6 p-4 sm:p-8">
      <Card className="manage-workspaces-card manage-workspaces-hero shadow-none ring-0">
        <div className="manage-workspaces-hero-header">
          <div className="min-w-0 space-y-2">
            <h1>Manage workspaces</h1>
            <p>
              Add, rename, or delete team workspaces you own. History below lists creates, renames,
              and deletes.
            </p>
          </div>
          <div className="manage-workspaces-hero-tools">
            <Image
              src="/artwork/home/workspace-robot.png"
              alt=""
              width={320}
              height={320}
              className="manage-workspaces-robot"
            />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Link
                      href={teamAdminBackHref}
                      className={cn(
                        buttonVariants({ variant: "outline" }),
                        "manage-workspaces-back w-full gap-2 sm:w-auto shrink-0",
                      )}
                    />
                  }
                >
                  <ArrowLeft className="size-4" aria-hidden />
                  Back To Team Dashboard
                </TooltipTrigger>
                <TooltipContent>Return to the team admin dashboard</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </Card>

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
