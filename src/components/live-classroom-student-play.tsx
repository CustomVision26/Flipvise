"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  heartbeatLiveClassroomAction,
  joinLiveClassroomSessionAction,
  submitLiveClassroomAnswerAction,
  useLiveClassroomStrategyCardAction,
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
import { strategyCardLabel } from "@/lib/live-classroom-types";
import {
  liveClassroomLobbyPath,
  liveClassroomReportPath,
} from "@/lib/live-classroom-url";

type LiveClassroomStudentPlayProps = {
  sessionId: number;
  userId: string;
};

export function LiveClassroomStudentPlay({
  sessionId,
  userId,
}: LiveClassroomStudentPlayProps) {
  const router = useRouter();
  const { state, error } = useLiveClassroomRealtime(sessionId);
  const [pending, startTransition] = useTransition();
  const [submittedChoice, setSubmittedChoice] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<{
    correct: boolean;
    points: number;
  } | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    void joinLiveClassroomSessionAction({ sessionId }).catch(() => undefined);
  }, [sessionId]);

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

  useEffect(() => {
    setSubmittedChoice(null);
    setLastResult(null);
  }, [state?.currentQuestion?.id]);

  const me = state?.participants.find((p) => p.userId === userId);
  const myCards = useMemo(() => {
    if (!state || !me?.liveTeamId) return [];
    return state.strategyCards.filter(
      (c) => c.liveTeamId === me.liveTeamId && !c.usedAt,
    );
  }, [state, me]);

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

  function answer(choiceIndex: number) {
    if (!state?.currentQuestion || submittedChoice != null) return;
    startTransition(async () => {
      try {
        const result = await submitLiveClassroomAnswerAction({
          sessionId,
          questionId: state.currentQuestion!.id,
          choiceIndex,
        });
        setSubmittedChoice(choiceIndex);
        setLastResult({ correct: result.correct, points: result.points });
        toast.success(
          result.correct
            ? `Correct · +${result.points}`
            : `Incorrect · ${result.points} pts`,
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not submit answer");
      }
    });
  }

  function useCard(
    strategyCardId: number,
    kind: Parameters<typeof strategyCardLabel>[0],
  ) {
    if (!state?.currentQuestion) return;
    startTransition(async () => {
      try {
        await useLiveClassroomStrategyCardAction({
          sessionId,
          strategyCardId,
          questionId: state.currentQuestion!.id,
        });
        toast.success(`${strategyCardLabel(kind)} activated`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not use card");
      }
    });
  }

  if (!state) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Connecting…
        {error ? <span className="text-destructive">{error}</span> : null}
      </div>
    );
  }

  const q = state.currentQuestion;
  const paused = state.session.status === "paused";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <Card className="border-border/80 bg-card/60 shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg tracking-tight">
              {state.session.name}
            </CardTitle>
            <CardDescription>
              Question {(state.session.currentQuestionIndex ?? 0) + 1}
              {q ? ` / ${q.totalQuestions}` : ""}
            </CardDescription>
          </div>
          <Badge variant="outline" className="font-mono tabular-nums">
            {paused ? "Paused" : `${remaining}s`}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {q ? (
            <>
              <p className="text-base font-medium text-foreground">{q.prompt}</p>
              <div className="grid gap-2">
                {q.choices.map((choice, i) => {
                  const selected = submittedChoice === i;
                  return (
                    <Button
                      key={`${q.id}-${i}`}
                      type="button"
                      variant={selected ? "default" : "outline"}
                      disabled={pending || submittedChoice != null || paused}
                      className="h-auto justify-start whitespace-normal px-4 py-3 text-left"
                      onClick={() => answer(i)}
                    >
                      <span className="mr-2 font-semibold">
                        {String.fromCharCode(65 + i)}.
                      </span>
                      {choice}
                    </Button>
                  );
                })}
              </div>
              {lastResult ? (
                <p
                  className={
                    lastResult.correct
                      ? "text-sm text-primary"
                      : "text-sm text-muted-foreground"
                  }
                >
                  {lastResult.correct ? "Nice!" : "Keep going."} +
                  {lastResult.points} points
                </p>
              ) : submittedChoice != null ? (
                <p className="text-sm text-muted-foreground">Answer locked in.</p>
              ) : null}
              {q.revealed && q.explanation ? (
                <p className="rounded-md border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
                  {q.explanation}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Waiting for the next question…
            </p>
          )}
        </CardContent>
      </Card>

      {state.session.config.allowStrategyCards && myCards.length > 0 ? (
        <Card className="border-border/80 bg-card/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-primary" aria-hidden />
              Strategy cards
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {myCards.map((card) => (
              <Button
                key={card.id}
                type="button"
                size="sm"
                variant="secondary"
                disabled={pending || !q || paused}
                onClick={() => useCard(card.id, card.kind)}
              >
                {strategyCardLabel(card.kind)}
              </Button>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-border/80 bg-card/60 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Leaderboard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {state.leaderboard.map((team, i) => (
            <div
              key={team.id}
              className="flex justify-between text-sm text-foreground"
            >
              <span>
                #{i + 1} {team.name}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {team.score}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
