"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  Eye,
  Heart,
  Loader2,
  Pause,
  Play,
  SkipForward,
  Timer,
  Trophy,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { controlLiveClassroomBattleAction, getLiveClassroomRealtimeStateAction } from "@/actions/live-classroom";
import { LiveClassroomTeamTargetMenu } from "@/components/live-classroom-team-target-menu";
import { useLiveClassroomRealtime } from "@/components/live-classroom-realtime-poller";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { remainingQuestionSeconds } from "@/lib/live-classroom-question-clock";
import { cn } from "@/lib/utils";
import {
  liveClassroomLobbyPath,
  liveClassroomReportPath,
} from "@/lib/live-classroom-url";

type LiveClassroomProjectorProps = {
  sessionId: number;
};

const ZOOM_STEPS = [1, 1.15, 1.3, 1.45] as const;

export function LiveClassroomProjector({
  sessionId,
}: LiveClassroomProjectorProps) {
  const { state, error, setState } = useLiveClassroomRealtime(sessionId, 1500);
  const [tick, setTick] = useState(0);
  const [celebration, setCelebration] = useState<string | null>(null);
  const [prevLeader, setPrevLeader] = useState<number | null>(null);
  const [zoomIdx, setZoomIdx] = useState(1);
  const [pending, startTransition] = useTransition();

  const zoom = ZOOM_STEPS[zoomIdx] ?? 1.15;

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!error) return;
    if (/not available|already ended|completed/i.test(error)) {
      window.location.assign(liveClassroomReportPath(sessionId));
    }
  }, [error, sessionId]);

  useEffect(() => {
    const leader = state?.leaderboard[0];
    if (!leader) return;
    const leaderId = leader.id;
    if (prevLeader != null && prevLeader !== leaderId) {
      setCelebration(`${leader.name} takes the lead!`);
      const t = window.setTimeout(() => setCelebration(null), 2800);
      return () => window.clearTimeout(t);
    }
    setPrevLeader(leaderId);
  }, [state?.leaderboard, prevLeader]);

  const remaining = useMemo(() => {
    void tick;
    if (!state) return null;
    return remainingQuestionSeconds({
      timePerQuestionSec: state.session.config.timePerQuestionSec,
      bonusSec: state.session.timerBonusSec ?? 0,
      startedAtIso: state.session.questionStartedAt,
      paused: state.session.status === "paused",
    });
  }, [state, tick]);

  function control(
    action: Parameters<typeof controlLiveClassroomBattleAction>[0]["action"],
    opts?: { extraSeconds?: number; target?: "all" | number },
  ) {
    startTransition(async () => {
      try {
        const result = await controlLiveClassroomBattleAction({
          sessionId,
          action,
          extraSeconds: opts?.extraSeconds,
          target: opts?.target,
        });
        if (result.returnedToLobby) {
          toast.success("Returned to lobby");
          window.location.assign(liveClassroomLobbyPath(sessionId));
          return;
        }
        if ("atEnd" in result && result.atEnd) {
          toast.message("Last question — open the report from Host when ready.");
        } else if (action === "add_time") {
          toast.success(
            opts?.target === "all" || opts?.target == null
              ? "Added 15s for all teams"
              : "Added 15s for selected team",
          );
        } else if (action === "reveal") {
          toast.success(
            opts?.target === "all" || opts?.target == null
              ? "Answer revealed to all teams"
              : "Answer revealed to selected team",
          );
        }
        const next = await getLiveClassroomRealtimeStateAction(sessionId);
        setState(next);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Control failed");
      }
    });
  }

  if (!state) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <div className="flex items-center gap-2">
          <Loader2 className="size-5 animate-spin" />
          Loading projector…
        </div>
        {error ? (
          <div className="flex flex-col items-center gap-2">
            <span className="text-destructive">{error}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                window.location.assign(
                  /not available|ended|completed/i.test(error)
                    ? liveClassroomReportPath(sessionId)
                    : liveClassroomLobbyPath(sessionId),
                )
              }
            >
              {/not available|ended|completed/i.test(error)
                ? "Open report"
                : "Back to lobby"}
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  const q = state.currentQuestion;
  const progress =
    q && q.totalQuestions > 0
      ? ((state.session.currentQuestionIndex + 1) / q.totalQuestions) * 100
      : 0;
  const paused = state.session.status === "paused";
  const independent = Boolean(state.session.independentBattle);

  return (
    <div className="min-h-screen overflow-x-auto bg-background">
      <div
        className="mx-auto flex min-h-screen w-full max-w-[110rem] origin-top flex-col gap-5 px-4 py-5 sm:px-8 sm:py-6"
        style={{
          transform: zoom === 1 ? undefined : `scale(${zoom})`,
          width: zoom === 1 ? undefined : `${100 / zoom}%`,
        }}
      >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Button
            nativeButton={false}
            variant="ghost"
            size="sm"
            className="mb-1 -ml-2 gap-1.5 text-muted-foreground hover:text-foreground"
            render={<Link href={liveClassroomLobbyPath(sessionId)} />}
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Back to lobby
          </Button>
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Live Classroom™ · Projector
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            {state.session.name}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-card/50 p-1">
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              disabled={zoomIdx <= 0}
              aria-label="Zoom out"
              onClick={() => setZoomIdx((i) => Math.max(0, i - 1))}
            >
              <ZoomOut className="size-4" aria-hidden />
            </Button>
            <span className="min-w-12 text-center text-xs tabular-nums text-muted-foreground">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              disabled={zoomIdx >= ZOOM_STEPS.length - 1}
              aria-label="Zoom in"
              onClick={() =>
                setZoomIdx((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))
              }
            >
              <ZoomIn className="size-4" aria-hidden />
            </Button>
          </div>
          <Badge className="px-3 py-1.5 text-base">Live</Badge>
          <Badge variant="secondary" className="px-3 py-1.5 text-base capitalize">
            {state.session.status}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "px-4 font-mono tabular-nums",
              remaining != null ? "py-1.5 text-3xl" : "py-1.5 text-xl",
            )}
          >
            {remaining != null ? `${remaining}s` : "No timer"}
          </Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {paused ? (
          <Button
            type="button"
            disabled={pending}
            className="gap-1.5"
            onClick={() => control("resume")}
          >
            <Play className="size-4" aria-hidden />
            Resume
          </Button>
        ) : (
          <Button
            type="button"
            disabled={pending}
            variant="outline"
            className="gap-1.5"
            onClick={() => control("pause")}
          >
            <Pause className="size-4" aria-hidden />
            Pause
          </Button>
        )}
        <LiveClassroomTeamTargetMenu
          label="+15s"
          icon={<Timer className="size-4" aria-hidden />}
          disabled={
            pending || !q || state.session.config.timePerQuestionSec == null
          }
          pending={pending}
          teams={state.teams
            .filter((t) => !t.eliminated)
            .map((t) => ({ id: t.id, name: t.name }))}
          onSelect={(target) =>
            control("add_time", { extraSeconds: 15, target })
          }
        />
        <LiveClassroomTeamTargetMenu
          label="Reveal"
          icon={<Eye className="size-4" aria-hidden />}
          disabled={pending || !q}
          pending={pending}
          teams={state.teams
            .filter((t) => !t.eliminated)
            .map((t) => ({ id: t.id, name: t.name }))}
          onSelect={(target) => control("reveal", { target })}
        />
        <Button
          type="button"
          disabled={pending || !q}
          variant="outline"
          className="gap-1.5"
          onClick={() => control("skip")}
        >
          <SkipForward className="size-4" aria-hidden />
          Skip
        </Button>
        <Button
          type="button"
          disabled={pending || !q}
          className="gap-1.5"
          onClick={() => control("next_question")}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <ChevronRight className="size-4" aria-hidden />
          )}
          Next question
        </Button>
        {independent ? (
          <p className="self-center text-xs text-muted-foreground">
            Students advance on their devices — Next moves the classroom board.
          </p>
        ) : null}
      </div>

      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {celebration ? (
        <div className="animate-in fade-in-0 zoom-in-95 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-center text-xl font-medium text-foreground duration-300">
          <Trophy className="mr-2 inline size-6 text-primary" aria-hidden />
          {celebration}
        </div>
      ) : null}

      <Card className="flex-1 border-border/80 bg-card/70 shadow-sm">
        <CardHeader className="space-y-3 pb-4">
          <CardDescription className="text-base sm:text-lg">
            Question {state.session.currentQuestionIndex + 1}
            {q ? ` of ${q.totalQuestions}` : ""}
            {" · "}
            {state.answeredCount} answered · {state.connectedCount} connected
          </CardDescription>
          <CardTitle className="text-3xl leading-snug tracking-tight sm:text-4xl lg:text-5xl">
            {q?.prompt ?? "Waiting for the host…"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {q ? (
            <ul className="grid gap-4 sm:grid-cols-2">
              {q.choices.map((choice, i) => {
                const isCorrect = q.revealed && q.correctIndex === i;
                return (
                  <li
                    key={`${q.id}-${i}`}
                    className={cn(
                      "rounded-2xl border px-5 py-6 text-xl transition-all duration-300 sm:text-2xl",
                      isCorrect
                        ? "scale-[1.02] border-primary bg-primary/15 text-foreground"
                        : "border-border/70 bg-background/40 text-foreground",
                    )}
                  >
                    <span className="mr-3 font-semibold text-muted-foreground">
                      {String.fromCharCode(65 + i)}.
                    </span>
                    {choice}
                  </li>
                );
              })}
            </ul>
          ) : null}
          {q?.revealed && q.explanation ? (
            <p className="mt-8 text-lg text-muted-foreground sm:text-xl">
              {q.explanation}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {state.leaderboard.map((team, i) => (
          <Card
            key={team.id}
            className={cn(
              "border-border/80 bg-card/60 shadow-sm transition-transform duration-300",
              i === 0 ? "ring-2 ring-primary/30" : "",
            )}
          >
            <CardHeader className="pb-2">
              <CardDescription className="text-sm">#{i + 1}</CardDescription>
              <CardTitle className="truncate text-xl">{team.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-2">
              <span className="text-3xl font-semibold tabular-nums text-foreground">
                {team.score}
              </span>
              {state.session.battleMode === "survival" ? (
                <span className="flex items-center gap-0.5 text-primary">
                  {Array.from({ length: team.hearts }).map((_, hi) => (
                    <Heart
                      key={hi}
                      className="size-5 fill-current"
                      aria-hidden
                    />
                  ))}
                </span>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Projector view — student names are hidden for privacy.
      </p>
      </div>
    </div>
  );
}
