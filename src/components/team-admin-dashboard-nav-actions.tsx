import { MainDashboardButton } from "@/components/main-dashboard-button";
import { Badge } from "@/components/ui/badge";
import { labelForTeamPlanSlug } from "@/lib/team-plans";
import { cn } from "@/lib/utils";

type TeamAdminDashboardNavActionsProps = {
  /** Personal dashboard URL (includes `userid=` and usually `plan=`). */
  mainDashboardHref: string;
  /** Workspace-scoped main dashboard: `team`, `userid` (owner), `plan`, `teamMemberId`. */
  workspaceDashboardHref: string;
  workspaceTeamId: number;
  /** Hide "To workspace" when the signed-in user owns this workspace. */
  isOwner: boolean;
  /** `teams.planSlug` for the selected workspace — shown next to Personal dashboard. */
  workspacePlanSlug: string;
  className?: string;
};

export function TeamAdminDashboardNavActions({
  mainDashboardHref,
  workspaceDashboardHref,
  workspaceTeamId,
  isOwner,
  workspacePlanSlug,
  className,
}: TeamAdminDashboardNavActionsProps) {
  const planLabel = labelForTeamPlanSlug(workspacePlanSlug) ?? workspacePlanSlug;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <MainDashboardButton
        teamId={null}
        href={mainDashboardHref}
        label="Personal dashboard"
        leadingArrow
        variant="secondary"
        className="h-9 w-full justify-center font-medium sm:w-auto sm:min-w-[11.5rem]"
      />
      <Badge
        variant="outline"
        className="h-9 shrink-0 border-border px-3 py-0 text-xs font-medium leading-none text-muted-foreground"
      >
        {planLabel}
      </Badge>
      {!isOwner ? (
        <MainDashboardButton
          teamId={workspaceTeamId}
          href={workspaceDashboardHref}
          label="To workspace"
          trailingArrow
          variant="outline"
          className="h-9 w-full justify-center font-medium sm:w-auto sm:min-w-[11.5rem]"
        />
      ) : null}
    </div>
  );
}
