import { MainDashboardButton } from "@/components/main-dashboard-button";
import { cn } from "@/lib/utils";

type TeamAdminDashboardNavActionsProps = {
  /** Personal dashboard URL (includes `userid=` and usually `plan=`). */
  mainDashboardHref: string;
  /** Workspace-scoped main dashboard: `team`, `userid` (owner), `plan`, `teamMemberId`. */
  workspaceDashboardHref: string;
  workspaceTeamId: number;
  /** Hide "To workspace" when the signed-in user owns this workspace. */
  isOwner: boolean;
  /** `teams.planSlug` for the selected workspace — shown in the card header. */
  workspacePlanSlug: string;
  className?: string;
};

export function TeamAdminDashboardNavActions({
  mainDashboardHref,
  workspaceDashboardHref,
  workspaceTeamId,
  isOwner,
  className,
}: TeamAdminDashboardNavActionsProps) {
  return (
    <div
      className={cn(
        "grid gap-2 sm:grid-cols-2 sm:gap-3",
        !isOwner && "sm:max-w-xl",
        className,
      )}
    >
      <MainDashboardButton
        teamId={null}
        href={mainDashboardHref}
        label="Personal dashboard"
        leadingArrow
        variant="outline"
        className="h-10 w-full justify-center font-medium"
      />
      {!isOwner ? (
        <MainDashboardButton
          teamId={workspaceTeamId}
          href={workspaceDashboardHref}
          label="Workspace dashboard"
          trailingArrow
          variant="outline"
          className="h-10 w-full justify-center font-medium"
        />
      ) : null}
    </div>
  );
}
