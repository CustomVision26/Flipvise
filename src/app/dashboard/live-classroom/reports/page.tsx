import Link from "next/link";
import { listLiveBattleReportsForTeam } from "@/db/queries/live-classroom";
import { loadLiveClassroomPageContext } from "@/lib/load-live-classroom-page-context";
import {
  buildLiveClassroomHref,
  LIVE_CLASSROOM_REPORTS_PATH,
  liveClassroomReportPath,
} from "@/lib/live-classroom-url";
import { buildTeamWorkspaceQueryString } from "@/lib/team-workspace-url";
import { LiveClassroomShell } from "@/components/live-classroom-shell";
import { LiveClassroomAssignmentRequired } from "@/components/live-classroom-assignment-required";
import { LiveClassroomBackLink } from "@/components/live-classroom-back-link";
import { LiveClassroomUnlock } from "@/components/live-classroom-unlock";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function LiveClassroomReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const ctx = await loadLiveClassroomPageContext(searchParams, {
    path: LIVE_CLASSROOM_REPORTS_PATH,
  });

  if (!ctx.owns) {
    return <LiveClassroomUnlock teamName={ctx.team.name} />;
  }

  if (!ctx.hasAccess) {
    return <LiveClassroomAssignmentRequired teamName={ctx.team.name} />;
  }

  const reports = await listLiveBattleReportsForTeam(ctx.teamId, 50);

  return (
    <LiveClassroomShell teamId={ctx.teamId} canManage={ctx.canManage}>
      <div className="space-y-4">
        <div>
          <LiveClassroomBackLink
            teamId={ctx.teamId}
            label={ctx.canManage ? "Back to Live Classroom" : "Back to team dashboard"}
            href={
              ctx.canManage
                ? undefined
                : `/dashboard?${buildTeamWorkspaceQueryString({ teamId: ctx.teamId })}`
            }
          />
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Reports
          </h1>
          <p className="text-sm text-muted-foreground">
            Post-battle analytics and AI teacher summaries
          </p>
        </div>

        <Card className="border-border/80 bg-card/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Battle reports</CardTitle>
            <CardDescription>
              {reports.length} report{reports.length === 1 ? "" : "s"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {reports.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Reports appear after a session ends.
              </p>
            ) : (
              reports.map((report) => (
                <Link
                  key={report.id}
                  href={buildLiveClassroomHref(
                    liveClassroomReportPath(report.sessionId),
                    ctx.teamId,
                  )}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/50 px-3 py-2.5 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {report.sessionName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Attendance {report.stats.attendance} · Accuracy{" "}
                      {report.stats.accuracyPercent}%
                      {report.winnerTeamName
                        ? ` · Winner ${report.winnerTeamName}`
                        : ""}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {report.createdAt.toLocaleDateString()}
                  </Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </LiveClassroomShell>
  );
}
