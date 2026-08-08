import Link from "next/link";
import { listLiveClassroomSessionsForTeam } from "@/db/queries/live-classroom";
import { loadLiveClassroomPageContext } from "@/lib/load-live-classroom-page-context";
import {
  battleModeLabel,
  sessionTypeLabel,
} from "@/lib/live-classroom-types";
import {
  buildLiveClassroomHref,
  LIVE_CLASSROOM_SCHEDULED_PATH,
  LIVE_CLASSROOM_START_PATH,
  liveClassroomLobbyPath,
} from "@/lib/live-classroom-url";
import { LiveClassroomShell } from "@/components/live-classroom-shell";
import { LiveClassroomAssignmentRequired } from "@/components/live-classroom-assignment-required";
import { LiveClassroomBackLink } from "@/components/live-classroom-back-link";
import { LiveClassroomUnlock } from "@/components/live-classroom-unlock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function LiveClassroomScheduledPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const ctx = await loadLiveClassroomPageContext(searchParams, {
    path: LIVE_CLASSROOM_SCHEDULED_PATH,
  });

  if (!ctx.owns) {
    return <LiveClassroomUnlock teamName={ctx.team.name} />;
  }

  if (!ctx.hasAccess) {
    return <LiveClassroomAssignmentRequired teamName={ctx.team.name} />;
  }

  const sessions = await listLiveClassroomSessionsForTeam(ctx.teamId, {
    status: ["scheduled", "lobby"],
  });

  return (
    <LiveClassroomShell teamId={ctx.teamId} canManage={ctx.canManage}>
      <div className="space-y-4">
        <LiveClassroomBackLink teamId={ctx.teamId} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Scheduled Sessions
            </h1>
            <p className="text-sm text-muted-foreground">
              Upcoming and lobby-ready battles for {ctx.team.name}
            </p>
          </div>
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
              Create Session
            </Button>
          ) : null}
        </div>

        <Card className="border-border/80 bg-card/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Queue</CardTitle>
            <CardDescription>
              {sessions.length} session{sessions.length === 1 ? "" : "s"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No scheduled or lobby sessions.
              </p>
            ) : (
              sessions.map((session) => (
                <Link
                  key={session.id}
                  href={liveClassroomLobbyPath(session.id)}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/50 px-3 py-2.5 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {session.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {sessionTypeLabel(session.sessionType)} ·{" "}
                      {battleModeLabel(session.battleMode)}
                      {session.scheduledFor
                        ? ` · ${session.scheduledFor.toLocaleString()}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono">
                      {session.joinCode}
                    </Badge>
                    <Badge variant="secondary" className="capitalize">
                      {session.status}
                    </Badge>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </LiveClassroomShell>
  );
}
