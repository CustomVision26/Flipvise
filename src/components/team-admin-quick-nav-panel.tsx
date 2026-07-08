"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TeamAdminDashboardNavActions } from "@/components/team-admin-dashboard-nav-actions";
import { teamAdminCardClass } from "@/components/team-admin-panel-styles";
import { cn } from "@/lib/utils";

type TeamAdminQuickNavPanelProps = {
  planLabel: string;
  description: string;
  mainDashboardHref: string;
  workspaceDashboardHref: string;
  workspaceTeamId: number;
  workspaceTeamMemberUrlParam?: number;
  isOwner: boolean;
  workspacePlanSlug: string;
  showTeacherDashboard?: boolean;
  className?: string;
  /** Start collapsed to save vertical space. */
  defaultOpen?: boolean;
};

export function TeamAdminQuickNavPanel({
  planLabel,
  description,
  mainDashboardHref,
  workspaceDashboardHref,
  workspaceTeamId,
  workspaceTeamMemberUrlParam = 0,
  isOwner,
  showTeacherDashboard = false,
  className,
  defaultOpen = false,
}: TeamAdminQuickNavPanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className={cn(teamAdminCardClass, "overflow-visible", className)}>
      <CardHeader className="space-y-0 p-0">
        <Button
          type="button"
          variant="ghost"
          className="h-auto w-full items-start justify-between gap-3 whitespace-normal rounded-xl px-4 py-3 text-left sm:px-5 sm:py-4"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
        >
          <div className="min-w-0 flex-1 space-y-1.5 text-pretty">
            <CardTitle className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Quick navigation
            </CardTitle>
            <p className="text-xs font-medium leading-snug text-foreground">{planLabel}</p>
            {!open ? (
              <p className="text-xs leading-relaxed text-muted-foreground">
                <span className="block sm:inline">Personal dashboard</span>
                {!isOwner ? (
                  <span className="block sm:inline">
                    <span className="hidden sm:inline"> · </span>
                    Workspace dashboard
                  </span>
                ) : null}
                {showTeacherDashboard ? (
                  <span className="block sm:inline">
                    <span className="hidden sm:inline"> · </span>
                    Teacher dashboard
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
          {open ? (
            <ChevronUp className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          ) : (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          )}
        </Button>
      </CardHeader>

      {open ? (
        <CardContent className="space-y-4 border-t border-border/60 px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
          <CardDescription className="text-sm leading-relaxed">{description}</CardDescription>
          <TeamAdminDashboardNavActions
            mainDashboardHref={mainDashboardHref}
            workspaceDashboardHref={workspaceDashboardHref}
            workspaceTeamId={workspaceTeamId}
            workspaceTeamMemberUrlParam={workspaceTeamMemberUrlParam}
            isOwner={isOwner}
            showTeacherDashboard={showTeacherDashboard}
            className="grid-cols-1 sm:grid-cols-1 lg:grid-cols-1"
          />
        </CardContent>
      ) : null}
    </Card>
  );
}
