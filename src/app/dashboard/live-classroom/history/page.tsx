import Link from "next/link";
import { listLiveClassroomSessionsForTeam } from "@/db/queries/live-classroom";
import { loadLiveClassroomPageContext } from "@/lib/load-live-classroom-page-context";
import {
  battleModeLabel,
  sessionTypeLabel,
} from "@/lib/live-classroom-types";
import {
  LIVE_CLASSROOM_HISTORY_PATH,
  liveClassroomReportPath,
} from "@/lib/live-classroom-url";
import { LiveClassroomShell } from "@/components/live-classroom-shell";
import { LiveClassroomUnlock } from "@/components/live-classroom-unlock";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function LiveClassroomHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const ctx = await loadLiveClassroomPageContext(searchParams, {
    path: LIVE_CLASSROOM_HISTORY_PATH,
  });

  if (!ctx.owns) {
    return <LiveClassroomUnlock teamName={ctx.team.name} />;
  }

  const sessions = await listLiveClassroomSessionsForTeam(ctx.teamId, {
    status: ["completed", "cancelled"],
    limit: 100,
  });

  return (
    <LiveClassroomShell teamId={ctx.teamId}>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Battle History
          </h1>
          <p className="text-sm text-muted-foreground">
            Completed and cancelled Live Classroom™ sessions
          </p>
        </div>

        <Card className="border-border/80 bg-card/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Past battles</CardTitle>
            <CardDescription>
              {sessions.length} session{sessions.length === 1 ? "" : "s"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No completed battles yet.
              </p>
            ) : (
              sessions.map((session) => (
                <Link
                  key={session.id}
                  href={liveClassroomReportPath(session.id)}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/50 px-3 py-2.5 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {session.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {sessionTypeLabel(session.sessionType)} ·{" "}
                      {battleModeLabel(session.battleMode)}
                      {session.endedAt
                        ? ` · ${session.endedAt.toLocaleString()}`
                        : ""}
                    </p>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {session.status}
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
