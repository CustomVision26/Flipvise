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
    <Card className={cn(teamAdminCardClass, className)}>
      <CardHeader className="space-y-0 p-0">
        <Button
          type="button"
          variant="ghost"
          className="h-auto w-full justify-between gap-3 rounded-xl px-4 py-3 text-left sm:px-5 sm:py-4"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
        >
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Quick navigation
              </CardTitle>
              <span className="text-muted-foreground/50" aria-hidden>
                ·
              </span>
              <span className="text-xs font-medium text-foreground">{planLabel}</span>
            </div>
            {!open ? (
              <p className="text-xs text-muted-foreground">
                Personal dashboard
                {!isOwner ? " · Workspace dashboard" : ""}
                {showTeacherDashboard ? " · Teacher dashboard" : ""}
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
          />
        </CardContent>
      ) : null}
    </Card>
  );
}
