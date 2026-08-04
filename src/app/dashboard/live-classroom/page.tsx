import Link from "next/link";
import {
  getDashboardLiveClassroomStats,
  listLiveClassroomSessionsForTeam,
} from "@/db/queries/live-classroom";
import { getClerkUserFieldDisplaysByIds } from "@/lib/clerk-user-display";
import { loadLiveClassroomPageContext } from "@/lib/load-live-classroom-page-context";
import {
  battleModeLabel,
  sessionTypeLabel,
} from "@/lib/live-classroom-types";
import {
  buildLiveClassroomHref,
  LIVE_CLASSROOM_HISTORY_PATH,
  LIVE_CLASSROOM_JOIN_PATH,
  LIVE_CLASSROOM_REPORTS_PATH,
  LIVE_CLASSROOM_ROOT_PATH,
  LIVE_CLASSROOM_SCHEDULED_PATH,
  LIVE_CLASSROOM_START_PATH,
  liveClassroomLobbyPath,
  liveClassroomReportPath,
} from "@/lib/live-classroom-url";
import { LiveClassroomShell } from "@/components/live-classroom-shell";
import { LiveClassroomAssignmentRequired } from "@/components/live-classroom-assignment-required";
import { LiveClassroomUnlock } from "@/components/live-classroom-unlock";
import { LiveClassroomJoinCodeForm } from "@/components/live-classroom-join-code-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function LiveClassroomDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const ctx = await loadLiveClassroomPageContext(searchParams, {
    path: LIVE_CLASSROOM_ROOT_PATH,
  });

  if (!ctx.owns) {
    return <LiveClassroomUnlock teamName={ctx.team.name} />;
  }

  if (!ctx.hasAccess) {
    return <LiveClassroomAssignmentRequired teamName={ctx.team.name} />;
  }

  const [stats, recentSessions] = await Promise.all([
    getDashboardLiveClassroomStats(ctx.teamId),
    listLiveClassroomSessionsForTeam(ctx.teamId, { limit: 8 }),
  ]);

  const teacherDisplays = stats.mostActiveTeacherUserId
    ? await getClerkUserFieldDisplaysByIds([stats.mostActiveTeacherUserId])
    : {};
  const mostActiveTeacher =
    stats.mostActiveTeacherUserId != null
      ? (teacherDisplays[stats.mostActiveTeacherUserId]?.primaryLine ??
        "Teacher")
      : "—";

  const statCards = [
    { label: "Today's Sessions", value: stats.todaySessions },
    { label: "Upcoming", value: stats.upcoming },
    { label: "Previous", value: stats.previous },
    { label: "Total Sessions", value: stats.totalSessions },
    { label: "Average Attendance", value: stats.averageAttendance },
    { label: "Average Accuracy", value: `${stats.averageAccuracy}%` },
    { label: "Most Active Teacher", value: mostActiveTeacher },
  ];

  return (
    <LiveClassroomShell teamId={ctx.teamId}>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Live Classroom™
            </h1>
            <p className="text-sm text-muted-foreground">
              {ctx.team.name} · {ctx.licensedSeats} licensed seats
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {ctx.canHost ? (
              <Button
                nativeButton={false}
                render={
                  <Link
                    href={buildLiveClassroomHref(
                      LIVE_CLASSROOM_START_PATH,
                      ctx.teamId,
                    )}
                  />
                }
              >
                Start session
              </Button>
            ) : null}
            <Button
              nativeButton={false}
              variant="outline"
              render={
                <Link
                  href={buildLiveClassroomHref(
                    LIVE_CLASSROOM_JOIN_PATH,
                    ctx.teamId,
                  )}
                />
              }
            >
              Join with code
            </Button>
            <Button
              nativeButton={false}
              variant="outline"
              render={
                <Link
                  href={buildLiveClassroomHref(
                    LIVE_CLASSROOM_SCHEDULED_PATH,
                    ctx.teamId,
                  )}
                />
              }
            >
              Schedule
            </Button>
            <Button
              nativeButton={false}
              variant="outline"
              render={
                <Link
                  href={buildLiveClassroomHref(
                    LIVE_CLASSROOM_REPORTS_PATH,
                    ctx.teamId,
                  )}
                />
              }
            >
              Reports
            </Button>
          </div>
        </div>

        <Card className="border-border/80 bg-card/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Join with code</CardTitle>
            <CardDescription>
              Enter the host’s lobby code to join. You must be assigned to the
              Live Classroom™ team. No lobby link is used.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LiveClassroomJoinCodeForm compact />
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => (
            <Card
              key={stat.label}
              className="border-border/80 bg-card/60 shadow-sm"
            >
              <CardHeader className="pb-2">
                <CardDescription>{stat.label}</CardDescription>
                <CardTitle className="truncate text-2xl tabular-nums">
                  {stat.value}
                </CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>

        <Card className="border-border/80 bg-card/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Recent sessions</CardTitle>
              <CardDescription>Lobby, live, and completed battles</CardDescription>
            </div>
            <Button
              nativeButton={false}
              size="sm"
              variant="ghost"
              render={
                <Link
                  href={buildLiveClassroomHref(
                    LIVE_CLASSROOM_HISTORY_PATH,
                    ctx.teamId,
                  )}
                />
              }
            >
              View history
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No sessions yet. Start one to open a lobby.
              </p>
            ) : (
              recentSessions.map((session) => {
                const href =
                  session.status === "completed" ||
                  session.status === "cancelled"
                    ? liveClassroomReportPath(session.id)
                    : liveClassroomLobbyPath(session.id);
                return (
                  <Link
                    key={session.id}
                    href={href}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/50 px-3 py-2.5 transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {session.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {sessionTypeLabel(session.sessionType)} ·{" "}
                        {battleModeLabel(session.battleMode)}
                      </p>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {session.status}
                    </Badge>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </LiveClassroomShell>
  );
}
