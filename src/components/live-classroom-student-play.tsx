"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Loader2, SkipForward, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  advanceLiveClassroomPlayerQuestionAction,
  controlLiveClassroomBattleAction,
  expireLiveClassroomQuestionTimeoutAction,
  getLiveClassroomRealtimeStateAction,
  heartbeatLiveClassroomAction,
  joinLiveClassroomSessionAction,
  leaveLiveClassroomPresenceAction,
  optOutLiveClassroomBattleAction,
  submitLiveClassroomAnswerAction,
  useLiveClassroomStrategyCardAction,
} from "@/actions/live-classroom";
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
  liveClassroomTeamTone,
  strategyCardLabel,
} from "@/lib/live-classroom-types";
import {
  liveClassroomLobbyPath,
  liveClassroomReportPath,
} from "@/lib/live-classroom-url";

type LiveClassroomStudentPlayProps = {
  sessionId: number;
  userId: string;
  /** Owner / team admin — can target reveal from the timer control. */
  canManage?: boolean;
};

export function LiveClassroomStudentPlay({
  sessionId,
  userId,
  canManage = false,
}: LiveClassroomStudentPlayProps) {
  const router = useRouter();
  // Faster poll so teammates / captains see advances without a long wait.
  const { state, error, setState } = useLiveClassroomRealtime(sessionId, 2000);
  const [pending, startTransition] = useTransition();
  const [submittedChoice, setSubmittedChoice] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<{
    correct: boolean;
    points: number;
  } | null>(null);
  const [tick, setTick] = useState(0);
  const [localFinished, setLocalFinished] = useState(false);
  const [aiHint, setAiHint] = useState<string | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const timeoutFiredForQuestionRef = useRef<number | null>(null);

  const sessionStatus = state?.session.status ?? null;
  const currentQuestionId = state?.currentQuestion?.id ?? null;

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
    }, 12_000);
    return () => {
      window.clearInterval(id);
      void leaveLiveClassroomPresenceAction(sessionId).catch(() => undefined);
    };
  }, [sessionId]);

  useEffect(() => {
    if (sessionStatus == null) return;
    if (sessionStatus === "lobby" || sessionStatus === "scheduled") {
      window.location.assign(liveClassroomLobbyPath(sessionId));
      return;
    }
    if (sessionStatus === "completed" || sessionStatus === "cancelled") {
      window.location.assign(liveClassroomReportPath(sessionId));
    }
  }, [sessionStatus, sessionId]);

  useEffect(() => {
    setSubmittedChoice(null);
    setLastResult(null);
    setAiHint(null);
    setHintLoading(false);
    timeoutFiredForQuestionRef.current = null;
  }, [currentQuestionId]);

  async function refreshBattleState() {
    const next = await getLiveClassroomRealtimeStateAction(sessionId);
    setState(next);
    return next;
  }
  const me = state?.participants.find((p) => p.userId === userId);
  const myTeam = state?.teams.find((t) => t.id === me?.liveTeamId);
  const teamTone = liveClassroomTeamTone(myTeam?.colorKey);
  const collaborative = state?.session.battleMode === "collaborative_team";
  const independent = Boolean(state?.session.independentBattle);
  const isCaptain =
    collaborative &&
    myTeam?.captainUserId != null &&
    myTeam.captainUserId === userId;
  const canAnswer = !collaborative || isCaptain;
  const personalFinished =
    localFinished ||
    Boolean(state?.session.personalFinished) ||
    state?.session.personalBattleStatus === "finished" ||
    state?.session.personalBattleStatus === "opted_out";
  const optedOut = state?.session.personalBattleStatus === "opted_out";
  const waitingForOthers =
    independent && personalFinished && state?.session.status === "active";
  const canNavigate =
    Boolean(state) &&
    state!.session.status === "active" &&
    !waitingForOthers &&
    ((independent && !personalFinished) || (collaborative && Boolean(isCaptain)));

  const teamCards = useMemo(() => {
    if (!state || !me?.liveTeamId) return [];
    return state.strategyCards.filter((c) => c.liveTeamId === me.liveTeamId);
  }, [state, me]);

  const unusedTeamCards = useMemo(
    () => teamCards.filter((c) => !c.usedAt),
    [teamCards],
  );

  const teammateScores = useMemo(() => {
    if (!state || !me?.liveTeamId) return [];
    return state.participants
      .filter((p) => p.liveTeamId === me.liveTeamId)
      .map((p) => ({
        userId: p.userId,
        displayName: p.displayName,
        score: p.score ?? 0,
        isSelf: p.userId === userId,
        battleStatus: p.battleStatus,
      }))
      .sort((a, b) => b.score - a.score);
  }, [state, me, userId]);

  const remaining = (() => {
    void tick;
    if (!state) return 0;
    return remainingQuestionSeconds({
      timePerQuestionSec: state.session.config.timePerQuestionSec,
      bonusSec: state.session.timerBonusSec ?? 0,
      startedAtIso: state.session.questionStartedAt,
      paused: state.session.status === "paused",
    });
  })();

  // Keep the tick subscription active so the timer re-renders; value unused directly.
  void tick;

  const questionNumber = independent
    ? (state?.session.personalQuestionIndex ?? 0) + 1
    : (state?.session.currentQuestionIndex ?? 0) + 1;

  // Auto-lock and advance (or end) when the question timer hits zero.
  useEffect(() => {
    if (!state || !canNavigate) return;
    if (state.session.status !== "active") return;
    const qid = state.currentQuestion?.id;
    if (qid == null) return;
    if (remaining > 0) return;
    if (timeoutFiredForQuestionRef.current === qid) return;
    timeoutFiredForQuestionRef.current = qid;

    startTransition(async () => {
      try {
        const result = await expireLiveClassroomQuestionTimeoutAction({
          sessionId,
          questionId: qid,
        });
        setSubmittedChoice(null);
        setLastResult(null);
        setAiHint(null);
        await refreshBattleState().catch(() => undefined);
        if (result.sessionCompleted) {
          toast.success("Time’s up — battle complete");
          router.push(liveClassroomReportPath(sessionId));
          return;
        }
        if (result.personalFinished) {
          setLocalFinished(true);
          toast.message("Time’s up — waiting for other players");
        } else if (!result.ignored) {
          toast.message("Time’s up — next question");
        }
      } catch (e) {
        timeoutFiredForQuestionRef.current = null;
        toast.error(
          e instanceof Error ? e.message : "Could not advance after timeout",
        );
      }
    });
  }, [
    remaining,
    canNavigate,
    state,
    sessionId,
    router,
  ]);

  if (!state) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Connecting…
        {error ? <span className="text-destructive">{error}</span> : null}
      </div>
    );
  }

  const q = waitingForOthers ? null : state.currentQuestion;
  const paused = state.session.status === "paused";
  const showRevealPanel = Boolean(
    q?.revealed && (q.explanation || q.correctIndex != null),
  );
  const showStrategySection =
    !waitingForOthers &&
    (showRevealPanel ||
      (state.session.config.allowStrategyCards &&
        (collaborative ? teamCards.length > 0 : unusedTeamCards.length > 0)));

  function answer(choiceIndex: number) {
    if (!state.currentQuestion || submittedChoice != null || !canAnswer) return;
    if (independent && personalFinished) return;
    startTransition(async () => {
      try {
        const result = await submitLiveClassroomAnswerAction({
          sessionId,
          questionId: state.currentQuestion!.id,
          choiceIndex,
        });
        setSubmittedChoice(choiceIndex);
        setLastResult({ correct: result.correct, points: result.points });
        if (result.personalFinished) {
          setLocalFinished(true);
          toast.success(
            result.sessionCompleted
              ? "Battle complete"
              : "You’re done — waiting for other players",
          );
        } else {
          toast.success(
            result.correct
              ? `Correct · +${result.points}`
              : `Incorrect · ${result.points} pts`,
          );
        }
        await refreshBattleState().catch(() => undefined);
        if (result.sessionCompleted) {
          router.push(liveClassroomReportPath(sessionId));
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not submit answer");
      }
    });
  }

  function optOut() {
    startTransition(async () => {
      try {
        const result = await optOutLiveClassroomBattleAction(sessionId);
        setLocalFinished(true);
        toast.success(
          result.sessionCompleted
            ? "Battle complete"
            : "You left the battle — waiting for other players",
        );
        await refreshBattleState().catch(() => undefined);
        if (result.sessionCompleted) {
          router.push(liveClassroomReportPath(sessionId));
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not leave battle");
      }
    });
  }

  function navigateQuestion(action: "skip" | "next") {
    if (!state.currentQuestion || !canNavigate) return;
    const questionId = state.currentQuestion.id;
    startTransition(async () => {
      try {
        const result = await advanceLiveClassroomPlayerQuestionAction({
          sessionId,
          questionId,
          action,
        });
        setSubmittedChoice(null);
        setLastResult(null);
        setAiHint(null);
        // Pull the next question immediately — don't wait for the 2s poll.
        await refreshBattleState();
        if (result.personalFinished) {
          setLocalFinished(true);
          toast.success(
            result.sessionCompleted
              ? "Battle complete"
              : "You’re done — waiting for other players",
          );
        } else if (result.skipped) {
          toast.message(action === "skip" ? "Question skipped" : "Next question");
        } else if (collaborative && !result.sessionCompleted) {
          toast.message("Waiting for other team captains…");
        }
        if (result.sessionCompleted) {
          router.push(liveClassroomReportPath(sessionId));
        }
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not change question",
        );
      }
    });
  }

  function useCard(
    strategyCardId: number,
    kind: Parameters<typeof strategyCardLabel>[0],
  ) {
    if (!state.currentQuestion || (independent && personalFinished)) return;
    startTransition(async () => {
      try {
        if (kind === "ai_hint") setHintLoading(true);
        const result = await useLiveClassroomStrategyCardAction({
          sessionId,
          strategyCardId,
          questionId: state.currentQuestion!.id,
        });
        if (kind === "ai_hint" && result.hint) {
          setAiHint(result.hint);
          toast.success("AI Hint ready");
        } else {
          toast.success(`${strategyCardLabel(kind)} activated`);
        }
        await refreshBattleState().catch(() => undefined);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not use card");
      } finally {
        setHintLoading(false);
      }
    });
  }

  return (
    <div className="relative mx-auto w-full max-w-2xl space-y-4">
      {(aiHint || hintLoading) && !waitingForOthers ? (
        <div
          className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center px-4"
          aria-live="polite"
        >
          <div
            className={cn(
              "pointer-events-auto max-w-lg rounded-xl border px-5 py-4 shadow-lg backdrop-blur-md",
              teamTone.surface,
            )}
          >
            <p className={cn("mb-2 text-xs font-semibold uppercase tracking-wide", teamTone.accent)}>
              AI Hint
            </p>
            {hintLoading && !aiHint ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Generating a hint…
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-foreground">{aiHint}</p>
            )}
          </div>
        </div>
      ) : null}

      <Card className={cn("shadow-sm", teamTone.surface)}>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg tracking-tight">
              {state.session.name}
            </CardTitle>
            <CardDescription>
              {waitingForOthers
                ? "Waiting for other players"
                : `Question ${Math.min(questionNumber, q?.totalQuestions ?? questionNumber)}${
                    q ? ` / ${q.totalQuestions}` : ""
                  }`}
              {myTeam ? (
                <>
                  {" · "}
                  <span className={cn("font-medium", teamTone.accent)}>
                    {myTeam.name}
                  </span>
                </>
              ) : null}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {independent ? (
              <Badge variant="secondary" className={teamTone.chip}>
                {state.session.activeBattlersRemaining} battling
              </Badge>
            ) : null}
            {canManage && !waitingForOthers && q ? (
              <LiveClassroomTeamTargetMenu
                label={paused ? "Paused" : `${remaining}s`}
                disabled={pending || paused}
                pending={pending}
                variant="outline"
                size="sm"
                className={cn(
                  "font-mono tabular-nums",
                  teamTone.chip,
                )}
                teams={state.teams
                  .filter((t) => !t.eliminated)
                  .map((t) => ({ id: t.id, name: t.name }))}
                onSelect={(target) => {
                  startTransition(async () => {
                    try {
                      await controlLiveClassroomBattleAction({
                        sessionId,
                        action: "reveal",
                        target,
                      });
                      await refreshBattleState();
                      toast.success(
                        target === "all"
                          ? "Answer revealed to all teams"
                          : "Answer revealed to selected team",
                      );
                    } catch (e) {
                      toast.error(
                        e instanceof Error ? e.message : "Could not reveal",
                      );
                    }
                  });
                }}
              />
            ) : (
              <Badge
                variant="outline"
                className={cn("font-mono tabular-nums", teamTone.chip)}
              >
                {paused ? "Paused" : waitingForOthers ? "Done" : `${remaining}s`}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {waitingForOthers ? (
            <div className="space-y-3">
              <p className="text-base font-medium text-foreground">
                {optedOut
                  ? "You opted out of this battle."
                  : "You’ve finished all questions."}
              </p>
              <p className="text-sm text-muted-foreground">
                The session ends when every team member finishes or leaves.
                {typeof state.session.activeBattlersRemaining === "number"
                  ? ` ${state.session.activeBattlersRemaining} player${
                      state.session.activeBattlersRemaining === 1 ? "" : "s"
                    } still battling.`
                  : null}
              </p>
            </div>
          ) : q ? (
            <>
              <p className="text-base font-medium text-foreground">{q.prompt}</p>
              {collaborative && !isCaptain ? (
                <p className="text-xs text-muted-foreground">
                  Collaborative mode — only your team captain can answer, skip,
                  or go to the next question. You can still watch and use shared
                  strategy cards.
                </p>
              ) : null}
              <div className="grid gap-2">
                {q.choices.map((choice, i) => {
                  const selected = submittedChoice === i;
                  const isCorrectReveal =
                    q.revealed && q.correctIndex === i;
                  return (
                    <Button
                      key={`${q.id}-${i}`}
                      type="button"
                      variant="outline"
                      disabled={
                        pending ||
                        submittedChoice != null ||
                        paused ||
                        !canAnswer ||
                        remaining <= 0
                      }
                      className={cn(
                        "h-auto justify-start whitespace-normal px-4 py-3 text-left",
                        isCorrectReveal
                          ? "border-primary bg-primary/15 text-foreground"
                          : selected
                            ? teamTone.choiceSelected
                            : teamTone.choiceIdle,
                      )}
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
                      ? cn("text-sm font-medium", teamTone.accent)
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
                <p
                  className={cn(
                    "rounded-md border p-3 text-sm text-muted-foreground",
                    teamTone.card,
                  )}
                >
                  {q.explanation}
                </p>
              ) : null}
              {canNavigate ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending || paused}
                    className={cn("gap-1.5", teamTone.choiceIdle)}
                    onClick={() => navigateQuestion("skip")}
                  >
                    <SkipForward className="size-3.5" aria-hidden />
                    Skip
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={pending || paused}
                    className={cn("gap-1.5", teamTone.choiceSelected)}
                    onClick={() => navigateQuestion("next")}
                  >
                    <ChevronRight className="size-3.5" aria-hidden />
                    Next
                  </Button>
                  {independent ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pending || paused}
                      onClick={optOut}
                    >
                      Leave battle
                    </Button>
                  ) : null}
                </div>
              ) : independent && canAnswer ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending || paused}
                  onClick={optOut}
                >
                  Leave battle
                </Button>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Waiting for the next question…
            </p>
          )}
        </CardContent>
      </Card>

      {showStrategySection ? (
        <Card className={cn("shadow-sm", teamTone.surface)}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles
                className={cn("size-4", teamTone.accent)}
                aria-hidden
              />
              {showRevealPanel ? "Answer reveal" : "Strategy cards"}
              {collaborative && !showRevealPanel ? (
                <span className="text-xs font-normal text-muted-foreground">
                  · Shared with your team
                </span>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {showRevealPanel && q ? (
              <div
                className={cn(
                  "rounded-lg border p-3 text-sm",
                  teamTone.card,
                )}
              >
                {q.correctIndex != null ? (
                  <p className="font-medium text-foreground">
                    Correct answer:{" "}
                    <span className={teamTone.accent}>
                      {String.fromCharCode(65 + q.correctIndex)}.{" "}
                      {q.choices[q.correctIndex]}
                    </span>
                  </p>
                ) : null}
                {q.explanation ? (
                  <p className="mt-2 text-muted-foreground">{q.explanation}</p>
                ) : null}
              </div>
            ) : null}
            {state.session.config.allowStrategyCards ? (
              <div className="flex flex-wrap gap-2">
                {(collaborative ? teamCards : unusedTeamCards).map((card) => {
                  const used = Boolean(card.usedAt);
                  const isAiHint = card.kind === "ai_hint";
                  return (
                    <Button
                      key={card.id}
                      type="button"
                      size="sm"
                      variant={used ? "outline" : "secondary"}
                      disabled={
                        pending ||
                        !q ||
                        paused ||
                        used ||
                        (isAiHint && hintLoading)
                      }
                      className={cn(
                        used && "opacity-50",
                        !used && teamTone.choiceSelected,
                      )}
                      onClick={() => useCard(card.id, card.kind)}
                    >
                      {isAiHint && hintLoading ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" aria-hidden />
                          Hint…
                        </>
                      ) : (
                        <>
                          {strategyCardLabel(card.kind)}
                          {used ? " · Used" : ""}
                        </>
                      )}
                    </Button>
                  );
                })}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card className={cn("shadow-sm", teamTone.surface)}>
        <CardHeader className="pb-2">
          <CardTitle className={cn("text-base", teamTone.accent)}>
            {myTeam ? `${myTeam.name} scores` : "Your team"}
          </CardTitle>
          <CardDescription>
            Only your team’s scores are shown here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {myTeam ? (
            <>
              <div className="flex justify-between text-sm font-medium text-foreground">
                <span>Team total</span>
                <span className={cn("tabular-nums", teamTone.accent)}>
                  {myTeam.score}
                </span>
              </div>
              <div className="space-y-1.5 border-t border-border/40 pt-2">
                {teammateScores.map((m) => (
                  <div
                    key={m.userId}
                    className={cn(
                      "flex justify-between gap-2 rounded-md px-2 py-1.5 text-sm",
                      m.isSelf ? teamTone.row : "text-foreground",
                    )}
                  >
                    <span className="truncate">
                      {m.displayName}
                      {m.isSelf ? " (you)" : ""}
                      {independent && m.battleStatus === "finished"
                        ? " · Done"
                        : null}
                      {independent && m.battleStatus === "opted_out"
                        ? " · Left"
                        : null}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {m.score}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              You are not assigned to a team.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
