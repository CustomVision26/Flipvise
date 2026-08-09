import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  getLiveBattleReportBySession,
  getLiveClassroomParticipant,
  getLiveClassroomSessionById,
  listLiveClassroomParticipants,
  listLiveClassroomTeams,
} from "@/db/queries/live-classroom";
import { loadLiveClassroomPageContext } from "@/lib/load-live-classroom-page-context";
import {
  buildLiveClassroomHref,
  LIVE_CLASSROOM_REPORTS_PATH,
} from "@/lib/live-classroom-url";
import { buildTeamWorkspaceQueryString } from "@/lib/team-workspace-url";
import { strategyCardLabel } from "@/lib/live-classroom-types";
import { Crown } from "lucide-react";
import { LiveClassroomAssignmentRequired } from "@/components/live-classroom-assignment-required";
import { LiveClassroomBackLink } from "@/components/live-classroom-back-link";
import { LiveClassroomShell } from "@/components/live-classroom-shell";
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
import { Separator } from "@/components/ui/separator";
import { LiveClassroomReportActions } from "@/components/live-classroom-report-actions";
import { cn } from "@/lib/utils";

export default async function LiveClassroomReportDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ team?: string }>;
}) {
  const { sessionId: sessionIdRaw } = await params;
  const sessionId = Number(sessionIdRaw);
  if (!Number.isFinite(sessionId) || sessionId <= 0) notFound();

  const session = await getLiveClassroomSessionById(sessionId);
  if (!session) notFound();

  const ctx = await loadLiveClassroomPageContext(searchParams, {
    path: `${LIVE_CLASSROOM_REPORTS_PATH}/${sessionId}`,
  });

  if (ctx.teamId !== session.teamId) {
    redirect(
      buildLiveClassroomHref(
        `${LIVE_CLASSROOM_REPORTS_PATH}/${sessionId}`,
        session.teamId,
      ),
    );
  }

  if (!ctx.owns) {
    return <LiveClassroomUnlock teamName={ctx.team.name} />;
  }
  if (!ctx.hasAccess) {
    return <LiveClassroomAssignmentRequired teamName={ctx.team.name} />;
  }

  const report = await getLiveBattleReportBySession(sessionId);
  if (!report) {
    return (
      <LiveClassroomShell teamId={ctx.teamId} canManage={ctx.canManage}>
        <Card className="border-border/80 bg-card/60 shadow-sm">
          <CardHeader>
            <CardTitle>Report not ready</CardTitle>
            <CardDescription>
              This session does not have a battle report yet.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
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
              Back to reports
            </Button>
            {!ctx.canManage ? (
              <Button
                nativeButton={false}
                variant="ghost"
                render={
                  <Link
                    href={`/dashboard?${buildTeamWorkspaceQueryString({
                      teamId: ctx.teamId,
                    })}`}
                  />
                }
              >
                Back to team dashboard
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </LiveClassroomShell>
    );
  }

  const { stats } = report;
  const isManager = ctx.canManage;
  /** Survival is every player for themselves — a regular player's report should show their own result, not a squad. */
  const isSurvivalMode = session.battleMode === "survival";

  const topTeamScore = stats.teamStats.reduce(
    (max, t) => Math.max(max, t.score),
    0,
  );
  const topTeams = stats.teamStats.filter((t) => t.score === topTeamScore);
  const outcomeBadge = report.winnerTeamName
    ? { label: `Winner: ${report.winnerTeamName}`, variant: "default" as const }
    : topTeamScore <= 0
      ? { label: "No winner — no points scored", variant: "outline" as const }
      : topTeams.length > 1
        ? { label: `Tied at ${topTeamScore} pts`, variant: "outline" as const }
        : null;

  const reportTeams = await listLiveClassroomTeams(sessionId);
  const captainUserIds = new Set(
    reportTeams
      .map((t) => t.captainUserId)
      .filter((id): id is string => id != null),
  );

  let myTeamName: string | null = null;
  let teammateUserIds: Set<string> | null = null;
  if (!isManager) {
    const participant = await getLiveClassroomParticipant(
      sessionId,
      ctx.userId,
    );
    if (participant?.liveTeamId != null) {
      myTeamName =
        reportTeams.find((t) => t.id === participant.liveTeamId)?.name ??
        null;
      const allParticipants = await listLiveClassroomParticipants(sessionId, {
        includeRemoved: true,
      });
      teammateUserIds = new Set(
        allParticipants
          .filter((p) => p.liveTeamId === participant.liveTeamId)
          .map((p) => p.userId),
      );
    } else {
      teammateUserIds = new Set([ctx.userId]);
    }
  }

  const mine =
    stats.individualStats.find((p) => p.userId === ctx.userId) ?? null;
  const myIndividualStats = isManager
    ? stats.individualStats
    : isSurvivalMode
      ? stats.individualStats.filter((p) => p.userId === ctx.userId)
      : stats.individualStats.filter((p) => teammateUserIds?.has(p.userId));
  const myTeamStats = isManager
    ? stats.teamStats
    : stats.teamStats.filter((t) => t.teamName === myTeamName);

  const visibleStats = isManager
    ? [
        { label: "Attendance", value: stats.attendance },
        { label: "Accuracy", value: `${stats.accuracyPercent}%` },
        {
          label: "Avg response",
          value: `${stats.averageResponseTimeSec}s`,
        },
        {
          label: "Review",
          value: `${stats.suggestedReviewMinutes} min`,
        },
      ]
    : [
        { label: "Attendance", value: mine ? "Present" : "Absent" },
        {
          label: "Accuracy",
          value: mine ? `${mine.accuracyPercent}%` : "—",
        },
        {
          label: "Avg response",
          value: mine ? `${mine.avgResponseTimeSec}s` : "—",
        },
        {
          label: "Review",
          value: `${stats.suggestedReviewMinutes} min`,
        },
      ];

  return (
    <LiveClassroomShell teamId={ctx.teamId} canManage={ctx.canManage}>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <LiveClassroomBackLink
              teamId={ctx.teamId}
              href={buildLiveClassroomHref(
                LIVE_CLASSROOM_REPORTS_PATH,
                ctx.teamId,
              )}
              label="Back to reports"
            />
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {report.sessionName}
            </h1>
            <p className="text-sm text-muted-foreground">
              Battle report · {report.createdAt.toLocaleString()}
              {!isManager ? " · Your results" : null}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {outcomeBadge ? (
              <Badge variant={outcomeBadge.variant} className="text-sm">
                {outcomeBadge.label}
              </Badge>
            ) : null}
            {!isManager ? (
              <Button
                nativeButton={false}
                variant="outline"
                size="sm"
                render={
                  <Link
                    href={`/dashboard?${buildTeamWorkspaceQueryString({
                      teamId: ctx.teamId,
                    })}`}
                  />
                }
              >
                Back to team dashboard
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {visibleStats.map((stat) => (
            <Card
              key={stat.label}
              className="border-border/80 bg-card/60 shadow-sm"
            >
              <CardHeader className="pb-2">
                <CardDescription>{stat.label}</CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {stat.value}
                </CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>

        {isManager ? (
          <LiveClassroomReportActions
            sessionId={sessionId}
            teamId={ctx.teamId}
            sessionName={report.sessionName}
            stats={stats}
            isOwner={ctx.role === "subscription_owner"}
          />
        ) : null}

        <Card className="border-border/80 bg-card/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">AI teacher summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p className="text-foreground">{stats.aiTeacherSummary}</p>
            {stats.strongestTopic || stats.weakestTopic ? (
              <>
                <Separator />
                <p>
                  Strongest topic: {stats.strongestTopic ?? "—"}
                  <br />
                  Weakest topic: {stats.weakestTopic ?? "—"}
                </p>
              </>
            ) : null}
            {stats.recommendations.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5">
                {stats.recommendations.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>

        <div className={cn("grid gap-4", isManager && "lg:grid-cols-2")}>
          {isManager || !isSurvivalMode ? (
            <Card className="border-border/80 bg-card/60 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">
                  {isManager ? "Team stats" : "Your team"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {myTeamStats.map((t) => (
                  <div
                    key={t.teamName}
                    className="flex justify-between gap-2 rounded-md border border-border/50 px-3 py-2 text-sm"
                  >
                    <span className="text-foreground">{t.teamName}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {t.score} pts · {t.accuracyPercent}%
                    </span>
                  </div>
                ))}
                {myTeamStats.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No team data available.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {isManager ? (
            <Card className="border-border/80 bg-card/60 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Question analysis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {stats.questionAnalysis.map((q, i) => (
                  <div
                    key={q.questionId}
                    className="rounded-md border border-border/50 px-3 py-2 text-sm"
                  >
                    <p className="text-foreground">
                      <span className="text-muted-foreground">{i + 1}.</span>{" "}
                      {q.prompt}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {q.correctCount} correct · {q.incorrectCount} incorrect ·{" "}
                      {q.accuracyPercent}%
                    </p>
                    {(q.strategyCardsUsed?.length ?? 0) > 0 ||
                    (q.extraTimeAddedSec ?? 0) > 0 ||
                    q.revealed ? (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {(q.strategyCardsUsed ?? []).map((c, i) => (
                          <Badge
                            key={`${q.questionId}-${c.kind}-${c.teamName}-${i}`}
                            variant="outline"
                            className="text-[11px] font-normal"
                          >
                            {strategyCardLabel(c.kind)} · {c.teamName}
                          </Badge>
                        ))}
                        {(q.extraTimeAddedSec ?? 0) > 0 ? (
                          <Badge
                            variant="outline"
                            className="text-[11px] font-normal"
                          >
                            +{q.extraTimeAddedSec}s extra time
                          </Badge>
                        ) : null}
                        {q.revealed ? (
                          <Badge
                            variant="outline"
                            className="text-[11px] font-normal"
                          >
                            Team Admin/Owner · Answer Revealed
                          </Badge>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <Card className="border-border/80 bg-card/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">
              {isManager
                ? "Individual results"
                : isSurvivalMode
                  ? "Your result"
                  : "Your team's results"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {myIndividualStats.map((p) => (
              <div
                key={p.userId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/50 px-3 py-2 text-sm"
              >
                <span className="flex min-w-0 items-center gap-1 text-foreground">
                  {captainUserIds.has(p.userId) ? (
                    <Crown
                      className="size-3.5 shrink-0 text-amber-400"
                      aria-hidden
                    />
                  ) : null}
                  {p.displayName}
                  {!isManager && p.userId === ctx.userId ? " (you)" : ""}
                  {p.teamName && !(isSurvivalMode && !isManager) ? (
                    <span className="text-xs font-normal text-muted-foreground">
                      · {p.teamName}
                    </span>
                  ) : null}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {p.correct}/{p.correct + p.incorrect} · {p.accuracyPercent}% ·{" "}
                  {p.avgResponseTimeSec}s
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </LiveClassroomShell>
  );
}
