import {
  getLiveClassroomDeckSummariesByIds,
  listLiveClassroomSessionsForTeam,
} from "@/db/queries/live-classroom";
import { loadLiveClassroomPageContext } from "@/lib/load-live-classroom-page-context";
import { LIVE_CLASSROOM_HISTORY_PATH } from "@/lib/live-classroom-url";
import { LiveClassroomBackLink } from "@/components/live-classroom-back-link";
import { LiveClassroomShell } from "@/components/live-classroom-shell";
import { LiveClassroomAssignmentRequired } from "@/components/live-classroom-assignment-required";
import { LiveClassroomUnlock } from "@/components/live-classroom-unlock";
import { LiveClassroomRecentSessionsList } from "@/components/live-classroom-recent-sessions-list";
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

  if (!ctx.hasAccess) {
    return <LiveClassroomAssignmentRequired teamName={ctx.team.name} />;
  }

  const sessions = await listLiveClassroomSessionsForTeam(ctx.teamId, {
    status: ["completed", "cancelled"],
    limit: 100,
  });
  const deckSummaries = await getLiveClassroomDeckSummariesByIds(
    sessions
      .map((session) => session.deckId)
      .filter((id): id is number => id != null),
  );

  return (
    <LiveClassroomShell teamId={ctx.teamId} canManage={ctx.canManage}>
      <div className="space-y-4">
        <div>
          <LiveClassroomBackLink teamId={ctx.teamId} label="Back to Sessions Pool" />
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
          <CardContent>
            <LiveClassroomRecentSessionsList
              canManage={ctx.canManage}
              emptyMessage="No completed battles yet."
              showEndedAt
              sessions={sessions.map((session) => {
                const deck =
                  session.deckId != null
                    ? deckSummaries[session.deckId]
                    : undefined;
                return {
                  id: session.id,
                  name: session.name,
                  status: session.status,
                  sessionType: session.sessionType,
                  battleMode: session.battleMode,
                  endedAt: session.endedAt?.toISOString() ?? null,
                  deckName: deck?.name ?? null,
                  deckCardCount: deck?.cardCount ?? null,
                };
              })}
            />
          </CardContent>
        </Card>
      </div>
    </LiveClassroomShell>
  );
}
