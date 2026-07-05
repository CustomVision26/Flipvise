"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MainDashboardButton } from "@/components/main-dashboard-button";
import { buttonVariants } from "@/components/ui/button";
import { buildTeacherPath } from "@/lib/teacher-url";
import { cn } from "@/lib/utils";

type TeamAdminDashboardNavActionsProps = {
  /** Personal dashboard URL (includes `userid=` and usually `plan=`). */
  mainDashboardHref: string;
  /** Workspace-scoped main dashboard: `team`, `userid` (owner), `plan`, `teamMemberId`. */
  workspaceDashboardHref: string;
  workspaceTeamId: number;
  workspaceTeamMemberUrlParam?: number;
  /** Hide "To workspace" when the signed-in user owns this workspace. */
  isOwner: boolean;
  /** Show Teacher Dashboard link for education workspaces. */
  showTeacherDashboard?: boolean;
  className?: string;
};

export function TeamAdminDashboardNavActions({
  mainDashboardHref,
  workspaceDashboardHref,
  workspaceTeamId,
  workspaceTeamMemberUrlParam = 0,
  isOwner,
  showTeacherDashboard = false,
  className,
}: TeamAdminDashboardNavActionsProps) {
  return (
    <div
      className={cn(
        "grid gap-2 sm:grid-cols-2 sm:gap-3",
        !isOwner && !showTeacherDashboard && "sm:max-w-xl",
        showTeacherDashboard && "sm:grid-cols-2 lg:grid-cols-3",
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
      {showTeacherDashboard ? (
        <Link
          href={buildTeacherPath(workspaceTeamId, workspaceTeamMemberUrlParam)}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "inline-flex h-10 w-full items-center justify-center gap-2 font-medium",
            isOwner && "sm:col-span-2 lg:col-span-1",
          )}
        >
          Teacher Dashboard
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}
