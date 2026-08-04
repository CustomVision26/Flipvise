import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  getLiveBattleReportBySession,
  getLiveClassroomSessionById,
} from "@/db/queries/live-classroom";
import { loadLiveClassroomPageContext } from "@/lib/load-live-classroom-page-context";
import {
  buildLiveClassroomHref,
  LIVE_CLASSROOM_REPORTS_PATH,
} from "@/lib/live-classroom-url";
import { LiveClassroomAssignmentRequired } from "@/components/live-classroom-assignment-required";
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
      <LiveClassroomShell teamId={ctx.teamId}>
        <Card className="border-border/80 bg-card/60 shadow-sm">
          <CardHeader>
            <CardTitle>Report not ready</CardTitle>
            <CardDescription>
              This session does not have a battle report yet.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </LiveClassroomShell>
    );
  }

  const { stats } = report;

  return (
    <LiveClassroomShell teamId={ctx.teamId}>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {report.sessionName}
            </h1>
            <p className="text-sm text-muted-foreground">
              Battle report · {report.createdAt.toLocaleString()}
            </p>
          </div>
          {report.winnerTeamName ? (
            <Badge className="text-sm">Winner: {report.winnerTeamName}</Badge>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
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
          ].map((stat) => (
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

        <LiveClassroomReportActions
          teamId={ctx.teamId}
          sessionName={report.sessionName}
          stats={stats}
        />

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

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-border/80 bg-card/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Team stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {stats.teamStats.map((t) => (
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
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Question analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {stats.questionAnalysis.map((q) => (
                <div
                  key={q.questionId}
                  className="rounded-md border border-border/50 px-3 py-2 text-sm"
                >
                  <p className="text-foreground">{q.prompt}</p>
                  <p className="text-xs text-muted-foreground">
                    {q.correctCount} correct · {q.incorrectCount} incorrect ·{" "}
                    {q.accuracyPercent}%
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/80 bg-card/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Individual results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.individualStats.map((p) => (
              <div
                key={p.userId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/50 px-3 py-2 text-sm"
              >
                <span className="text-foreground">{p.displayName}</span>
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
