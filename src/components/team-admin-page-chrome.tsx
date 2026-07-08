import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader } from "@/components/ui/card";
import { TeamAdminQuickNavPanel } from "@/lib/team-admin-dynamic-components";
import { teamAdminCardClass } from "@/components/team-admin-panel-styles";
import { cn } from "@/lib/utils";

type TeamAdminPageChromeProps = {
  section: string;
  title: string;
  description: string;
  workspaceName: string;
  planLabel: string;
  quickNavDescription: string;
  mainDashboardHref: string;
  workspaceDashboardHref: string;
  workspaceTeamId: number;
  workspaceTeamMemberUrlParam: number;
  isOwner: boolean;
  workspacePlanSlug: string;
  showTeacherDashboard?: boolean;
  headerAside?: ReactNode;
  children?: ReactNode;
};

export function TeamAdminPageChrome({
  section,
  title,
  description,
  workspaceName,
  planLabel,
  quickNavDescription,
  mainDashboardHref,
  workspaceDashboardHref,
  workspaceTeamId,
  workspaceTeamMemberUrlParam,
  isOwner,
  workspacePlanSlug,
  showTeacherDashboard = false,
  headerAside,
  children,
}: TeamAdminPageChromeProps) {
  return (
    <div className="flex w-full flex-col gap-6">
      <Card className={cn(teamAdminCardClass, "overflow-visible backdrop-blur-md")}>
        <CardHeader className="gap-4 pb-4 sm:pb-5">
          <div className="flex w-full flex-col gap-4">
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1 space-y-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {section}
                </p>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    {title}
                  </h1>
                  <Badge variant="outline" className="h-6 px-2.5 text-xs font-medium">
                    {planLabel}
                  </Badge>
                </div>
                <p
                  className="truncate text-sm font-medium text-foreground"
                  title={workspaceName}
                >
                  {workspaceName}
                </p>
                <CardDescription className="max-w-3xl text-sm leading-relaxed sm:text-[0.9375rem]">
                  {description}
                </CardDescription>
              </div>
              {headerAside ? (
                <div className="flex shrink-0 justify-stretch sm:justify-end">{headerAside}</div>
              ) : null}
            </div>
            <TeamAdminQuickNavPanel
              className="w-full overflow-visible"
              planLabel={planLabel}
              description={quickNavDescription}
              mainDashboardHref={mainDashboardHref}
              workspaceDashboardHref={workspaceDashboardHref}
              workspaceTeamId={workspaceTeamId}
              workspaceTeamMemberUrlParam={workspaceTeamMemberUrlParam}
              isOwner={isOwner}
              workspacePlanSlug={workspacePlanSlug}
              showTeacherDashboard={showTeacherDashboard}
            />
          </div>
        </CardHeader>
      </Card>
      {children}
    </div>
  );
}
