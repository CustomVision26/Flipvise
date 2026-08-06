"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  Loader2,
  Pause,
  Play,
  SkipForward,
  Timer,
  Volume2,
  VolumeX,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  controlLiveClassroomBattleAction,
  heartbeatLiveClassroomAction,
} from "@/actions/live-classroom";
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
import { Separator } from "@/components/ui/separator";
import {
  liveClassroomLobbyPath,
  liveClassroomProjectorPath,
  liveClassroomReportPath,
} from "@/lib/live-classroom-url";

type LiveClassroomHostDashboardProps = {
  sessionId: number;
};

export function LiveClassroomHostDashboard({
  sessionId,
}: LiveClassroomHostDashboardProps) {
  const router = useRouter();
  const { state, error } = useLiveClassroomRealtime(sessionId);
  const [pending, startTransition] = useTransition();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      void heartbeatLiveClassroomAction(sessionId).catch(() => undefined);
    }, 8000);
    return () => window.clearInterval(id);
  }, [sessionId]);

  useEffect(() => {
    if (!state) return;
    if (state.session.status === "lobby" || state.session.status === "scheduled") {
      router.push(liveClassroomLobbyPath(sessionId));
    }
    if (state.session.status === "completed" || state.session.status === "cancelled") {
      router.push(liveClassroomReportPath(sessionId));
    }
  }, [state, sessionId, router]);

  void tick;
  const remaining = (() => {
    if (!state) return 0;
    const limit = state.session.config.timePerQuestionSec;
    if (!state.session.questionStartedAt || state.session.status === "paused") {
      return limit;
    }
    const started = new Date(state.session.questionStartedAt).getTime();
    const elapsed = Math.floor((Date.now() - started) / 1000);
    return Math.max(0, limit - elapsed);
  })();

  function control(
    action: Parameters<typeof controlLiveClassroomBattleAction>[0]["action"],
    extraSeconds?: number,
  ) {
    startTransition(async () => {
      try {
        const result = await controlLiveClassroomBattleAction({
          sessionId,
          action,
          extraSeconds,
        });
        if (result.returnedToLobby) {
          toast.success("Returned to lobby");
          router.push(liveClassroomLobbyPath(sessionId));
          return;
        }
        if (result.ended) {
          toast.success("Session ended");
          router.push(liveClassroomReportPath(sessionId));
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Control failed");
      }
    });
  }

  if (!state) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading host dashboard…
        {error ? <span className="text-destructive">{error}</span> : null}
      </div>
    );
  }

  const q = state.currentQuestion;
  const total = q?.totalQuestions ?? 0;
  const index = state.session.currentQuestionIndex + 1;

  return (
    <div className="space-y-4">
      <Card className="border-border/80 bg-card/60 shadow-sm">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-xl tracking-tight">
              {state.session.name}
            </CardTitle>
            <CardDescription>
              Host controls · Question {Math.min(index, total)} / {total}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{state.session.status}</Badge>
            <Badge variant="outline" className="gap-1 font-mono">
              <Timer className="size-3" aria-hidden />
              {remaining}s
            </Badge>
            <Button
              nativeButton={false}
              size="sm"
              variant="secondary"
              render={
                <a
                  href={liveClassroomProjectorPath(sessionId)}
                  target="_blank"
                  rel="noreferrer"
                />
              }
            >
              Projector
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {state.session.status === "paused" ? (
            <Button
              type="button"
              disabled={pending}
              className="gap-1.5"
              onClick={() => control("resume")}
            >
              <Play className="size-3.5" aria-hidden />
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
              <Pause className="size-3.5" aria-hidden />
              Pause
            </Button>
          )}
          <Button
            type="button"
            disabled={pending}
            variant="outline"
            className="gap-1.5"
            onClick={() => control("add_time", 15)}
          >
            <Timer className="size-3.5" aria-hidden />
            +15s
          </Button>
          <Button
            type="button"
            disabled={pending}
            variant="outline"
            className="gap-1.5"
            onClick={() => control("reveal")}
          >
            <Eye className="size-3.5" aria-hidden />
            Reveal
          </Button>
          <Button
            type="button"
            disabled={pending}
            variant="outline"
            className="gap-1.5"
            onClick={() => control("skip")}
          >
            <SkipForward className="size-3.5" aria-hidden />
            Skip / Next
          </Button>
          <Button
            type="button"
            disabled={pending}
            variant="outline"
            className="gap-1.5"
            onClick={() =>
              control(state.session.musicMuted ? "unmute_music" : "mute_music")
            }
          >
            {state.session.musicMuted ? (
              <Volume2 className="size-3.5" aria-hidden />
            ) : (
              <VolumeX className="size-3.5" aria-hidden />
            )}
            {state.session.musicMuted ? "Unmute" : "Mute"}
          </Button>
          <Button
            type="button"
            disabled={pending}
            variant="destructive"
            className="gap-1.5"
            onClick={() => control("end")}
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <XCircle className="size-3.5" aria-hidden />
            )}
            Back to lobby
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Connected", value: state.connectedCount },
          { label: "Answered", value: state.answeredCount },
          { label: "Accuracy", value: `${state.averageAccuracy}%` },
          {
            label: "Avg response",
            value: `${state.averageResponseTimeSec}s`,
          },
        ].map((stat) => (
          <Card
            key={stat.label}
            className="border-border/80 bg-card/60 shadow-sm"
          >
            <CardHeader className="pb-1">
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{stat.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/80 bg-card/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Current question</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {q ? (
              <>
                <p className="text-sm font-medium text-foreground">{q.prompt}</p>
                <ul className="space-y-1.5">
                  {q.choices.map((choice, i) => (
                    <li
                      key={`${q.id}-${i}`}
                      className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                        q.revealed && q.correctIndex === i
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border/60 text-muted-foreground"
                      }`}
                    >
                      {String.fromCharCode(65 + i)}. {choice}
                    </li>
                  ))}
                </ul>
                {q.revealed && q.explanation ? (
                  <>
                    <Separator />
                    <p className="text-sm text-muted-foreground">{q.explanation}</p>
                  </>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No active question.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Leaderboard</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {state.leaderboard.map((team, i) => (
              <div
                key={team.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border/50 px-3 py-2 text-sm"
              >
                <span className="truncate text-foreground">
                  #{i + 1} {team.name}
                  {team.eliminated ? " (out)" : ""}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {team.score}
                  {state.session.battleMode === "survival"
                    ? ` · ♥ ${team.hearts}`
                    : ""}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
