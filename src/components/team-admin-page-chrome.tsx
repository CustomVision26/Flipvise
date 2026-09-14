import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader } from "@/components/ui/card";
import { TeamWorkspaceInfoButton } from "@/components/team-workspace-info-button";
import { teamAdminCardClass } from "@/components/team-admin-panel-styles";
import { cn } from "@/lib/utils";
import type { TeamWorkspaceInfo } from "@/lib/workspace-creation-profile";

type TeamAdminPageChromeProps = {
  section: string;
  title: string;
  description: string;
  workspaceName: string;
  planLabel: string;
  workspaceInfo?: TeamWorkspaceInfo;
  headerAside?: ReactNode;
  children?: ReactNode;
};

export function TeamAdminPageChrome({
  section,
  title,
  description,
  workspaceName,
  planLabel,
  workspaceInfo,
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
              {workspaceInfo || headerAside ? (
                <div className="flex shrink-0 flex-wrap items-center justify-stretch gap-2 sm:justify-end">
                  {workspaceInfo ? (
                    <TeamWorkspaceInfoButton info={workspaceInfo} />
                  ) : null}
                  {headerAside}
                </div>
              ) : null}
            </div>
          </div>
        </CardHeader>
      </Card>
      {children}
    </div>
  );
}
