import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getQuizResultInboxForUser } from "@/db/queries/quiz-results";
import { getTeamsByIds, listTeamMembersByTeamIds } from "@/db/queries/teams";
import { getClerkUserFieldDisplaysByIds } from "@/lib/clerk-user-display";
import { CheckCircle, XCircle, CircleHelp, BookCheck } from "lucide-react";
import { ViewQuizResultDialog, type QuizResultSummary } from "@/components/view-quiz-result-dialog";

function formatDate(value: Date): string {
  return value.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatClock(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const mm = Math.floor(clamped / 60).toString().padStart(2, "0");
  const ss = (clamped % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export async function QuizResultInboxSection({ userId }: { userId: string }) {
  const entries = await getQuizResultInboxForUser(userId);

  // ── Batch resolve user + workspace context ───────────────────────────────
  const uniqueTeamIds = [
    ...new Set(
      entries.map((e) => e.quizResult.teamId).filter((id): id is number => id !== null),
    ),
  ];

  const [teamsRows, memberRows] = await Promise.all([
    getTeamsByIds(uniqueTeamIds),
    listTeamMembersByTeamIds(uniqueTeamIds),
  ]);

  const teamMap = new Map(teamsRows.map((t) => [t.id, t]));

  // key: `${teamId}-${userId}` → role
  const memberRoleMap = new Map(
    memberRows.map((m) => [`${m.teamId}-${m.userId}`, m.role as string]),
  );

  // Collect all Clerk user IDs we need display info for
  const allUserIds = [
    ...new Set([
      ...entries.map((e) => e.quizResult.userId),
      ...teamsRows.map((t) => t.ownerUserId),
    ]),
  ];

  const userDisplayById = await getClerkUserFieldDisplaysByIds(allUserIds);

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookCheck className="size-5 shrink-0" aria-hidden />
            Quiz results
          </CardTitle>
          <CardDescription>
            Saved quiz results — yours and any submitted by team members you manage.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No saved quiz results yet.</p>
        ) : (
          entries.map((entry) => {
            const r = entry.quizResult;
            const isTeam = r.teamId !== null;
            const tierColor =
              r.percent >= 90
                ? "text-yellow-500"
                : r.percent >= 50
                  ? "text-blue-400"
                  : "text-purple-400";

            // ── User context ─────────────────────────────────────────────
            const takerDisplay = userDisplayById[r.userId];
            const userName = takerDisplay?.primaryLine ?? null;
            const userEmail = takerDisplay?.primaryEmail ?? null;

            // ── Workspace context ────────────────────────────────────────
            const team = r.teamId !== null ? teamMap.get(r.teamId) ?? null : null;
            const teamName = team?.name ?? null;

            let memberRole: QuizResultSummary["memberRole"] = null;
            if (team) {
              if (r.userId === team.ownerUserId) {
                memberRole = "owner";
              } else {
                const role = memberRoleMap.get(`${team.id}-${r.userId}`);
                memberRole =
                  role === "team_admin"
                    ? "team_admin"
                    : role === "team_member"
                      ? "team_member"
                      : null;
              }
            }

            const ownerDisplay = team ? userDisplayById[team.ownerUserId] : null;
            const ownerName = ownerDisplay?.primaryLine ?? null;
            const ownerEmail = ownerDisplay?.primaryEmail ?? null;

            const summary: QuizResultSummary = {
              id: r.id,
              deckName: r.deckName,
              correct: r.correct,
              incorrect: r.incorrect,
              unanswered: r.unanswered,
              total: r.total,
              percent: r.percent,
              elapsedSeconds: r.elapsedSeconds,
              savedAt: r.savedAt,
              perCard: r.perCard ?? null,
              userName,
              userEmail,
              teamName,
              memberRole,
              ownerName,
              ownerEmail,
            };

            return (
              <div
                key={entry.id}
                className="flex flex-col gap-3 rounded-lg border border-border bg-card/50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground truncate">{r.deckName}</p>
                    {isTeam && (
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        Team deck
                      </Badge>
                    )}
                    {!entry.read && (
                      <Badge
                        variant="outline"
                        className="shrink-0 text-xs border-primary/40 text-primary"
                      >
                        New
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className={`font-semibold tabular-nums ${tierColor}`}>
                      {r.percent}%
                    </span>
                    <span className="flex items-center gap-1 text-emerald-500">
                      <CheckCircle className="size-3.5" aria-hidden />
                      {r.correct} correct
                    </span>
                    <span className="flex items-center gap-1 text-rose-500">
                      <XCircle className="size-3.5" aria-hidden />
                      {r.incorrect} incorrect
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <CircleHelp className="size-3.5" aria-hidden />
                      {r.unanswered} unanswered
                    </span>
                  </div>

                  {(userName || userEmail) && (
                    <p className="text-xs text-muted-foreground">
                      {[userName, userEmail].filter(Boolean).join(" · ")}
                    </p>
                  )}

                  <p className="text-xs text-muted-foreground">
                    {r.total} card{r.total !== 1 ? "s" : ""} &middot;{" "}
                    {formatClock(r.elapsedSeconds)} &middot; {formatDate(r.savedAt)}
                  </p>
                </div>

                <div className="shrink-0">
                  <ViewQuizResultDialog result={summary} />
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
