"use client";

import { useEffect, useMemo, useState } from "react";
import { Heart, Loader2, Trophy } from "lucide-react";
import { useLiveClassroomRealtime } from "@/components/live-classroom-realtime-poller";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type LiveClassroomProjectorProps = {
  sessionId: number;
};

export function LiveClassroomProjector({
  sessionId,
}: LiveClassroomProjectorProps) {
  const { state, error } = useLiveClassroomRealtime(sessionId, 1500);
  const [tick, setTick] = useState(0);
  const [celebration, setCelebration] = useState<string | null>(null);
  const [prevLeader, setPrevLeader] = useState<number | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!state?.leaderboard[0]) return;
    const leaderId = state.leaderboard[0].id;
    if (prevLeader != null && prevLeader !== leaderId) {
      setCelebration(`${state.leaderboard[0].name} takes the lead!`);
      const t = window.setTimeout(() => setCelebration(null), 2800);
      return () => window.clearTimeout(t);
    }
    setPrevLeader(leaderId);
  }, [state?.leaderboard, prevLeader]);

  const remaining = useMemo(() => {
    void tick;
    if (!state?.session.questionStartedAt || state.session.status === "paused") {
      return state?.session.config.timePerQuestionSec ?? 30;
    }
    const started = new Date(state.session.questionStartedAt).getTime();
    const elapsed = Math.floor((Date.now() - started) / 1000);
    return Math.max(0, state.session.config.timePerQuestionSec - elapsed);
  }, [state, tick]);

  if (!state) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        Loading projector…
        {error ? <span className="text-destructive">{error}</span> : null}
      </div>
    );
  }

  const q = state.currentQuestion;
  const progress =
    q && q.totalQuestions > 0
      ? ((state.session.currentQuestionIndex + 1) / q.totalQuestions) * 100
      : 0;

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-5xl flex-col gap-6 px-2 py-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Live Classroom™
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {state.session.name}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="px-3 py-1 text-base capitalize">
            {state.session.status}
          </Badge>
          <Badge
            variant="outline"
            className="px-3 py-1 font-mono text-2xl tabular-nums"
          >
            {remaining}s
          </Badge>
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {celebration ? (
        <div className="animate-in fade-in-0 zoom-in-95 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-center text-lg font-medium text-foreground duration-300">
          <Trophy className="mr-2 inline size-5 text-primary" aria-hidden />
          {celebration}
        </div>
      ) : null}

      <Card className="flex-1 border-border/80 bg-card/70 shadow-sm">
        <CardHeader>
          <CardDescription>
            Question {state.session.currentQuestionIndex + 1}
            {q ? ` of ${q.totalQuestions}` : ""}
            {" · "}
            {state.answeredCount} answered · {state.connectedCount} connected
          </CardDescription>
          <CardTitle className="text-2xl leading-snug tracking-tight sm:text-3xl">
            {q?.prompt ?? "Waiting for the host…"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {q ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {q.choices.map((choice, i) => {
                const isCorrect = q.revealed && q.correctIndex === i;
                return (
                  <li
                    key={`${q.id}-${i}`}
                    className={`rounded-xl border px-4 py-4 text-lg transition-all duration-300 ${
                      isCorrect
                        ? "border-primary bg-primary/15 text-foreground scale-[1.02]"
                        : "border-border/70 bg-background/40 text-foreground"
                    }`}
                  >
                    <span className="mr-2 font-semibold text-muted-foreground">
                      {String.fromCharCode(65 + i)}.
                    </span>
                    {choice}
                  </li>
                );
              })}
            </ul>
          ) : null}
          {q?.revealed && q.explanation ? (
            <p className="mt-6 text-base text-muted-foreground">{q.explanation}</p>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {state.leaderboard.map((team, i) => (
          <Card
            key={team.id}
            className={`border-border/80 bg-card/60 shadow-sm transition-transform duration-300 ${
              i === 0 ? "ring-2 ring-primary/30" : ""
            }`}
          >
            <CardHeader className="pb-2">
              <CardDescription>#{i + 1}</CardDescription>
              <CardTitle className="truncate text-lg">{team.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-2">
              <span className="text-2xl font-semibold tabular-nums text-foreground">
                {team.score}
              </span>
              {state.session.battleMode === "survival" ? (
                <span className="flex items-center gap-0.5 text-primary">
                  {Array.from({ length: team.hearts }).map((_, hi) => (
                    <Heart
                      key={hi}
                      className="size-4 fill-current"
                      aria-hidden
                    />
                  ))}
                </span>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Projector view — student names are hidden for privacy.
      </p>
    </div>
  );
}
