"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Crown, Heart, Loader2, SkipForward, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import {
  advanceLiveClassroomPlayerQuestionAction,
  controlLiveClassroomBattleAction,
  expireLiveClassroomQuestionTimeoutAction,
  getLiveClassroomRealtimeStateAction,
  heartbeatLiveClassroomAction,
  joinLiveClassroomSessionAction,
  leaveLiveClassroomCollaborativeBattleAction,
  leaveLiveClassroomPresenceAction,
  optOutLiveClassroomBattleAction,
  submitLiveClassroomAnswerAction,
  useLiveClassroomStrategyCardAction,
} from "@/actions/live-classroom";
import { LiveClassroomTeamTargetMenu } from "@/components/live-classroom-team-target-menu";
import { useLiveClassroomRealtime } from "@/components/live-classroom-realtime-poller";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  resolveStrategyCardSetting,
  strategyCardAppliesToDeckCard,
  strategyCardLabel,
} from "@/lib/live-classroom-types";
import {
  liveClassroomLobbyPath,
  liveClassroomReportPath,
  liveClassroomSessionGonePath,
} from "@/lib/live-classroom-url";

type LiveClassroomStudentPlayProps = {
  sessionId: number;
  userId: string;
  teamId: number;
  /** Owner / team admin — can target reveal from the timer control. */
  canManage?: boolean;
};

export function LiveClassroomStudentPlay({
  sessionId,
  userId,
  teamId,
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
  const [leaveBattleOpen, setLeaveBattleOpen] = useState(false);
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
    if (sessionStatus === "cancelled") {
      window.location.assign(
        liveClassroomSessionGonePath({ canManage, teamId }),
      );
      return;
    }
    if (sessionStatus === "completed") {
      window.location.assign(liveClassroomReportPath(sessionId));
    }
  }, [sessionStatus, sessionId, canManage, teamId]);

  useEffect(() => {
    if (!error) return;
    if (/completed/i.test(error)) {
      window.location.assign(liveClassroomReportPath(sessionId));
      return;
    }
    if (/cancelled|not available|not found/i.test(error)) {
      window.location.assign(
        liveClassroomSessionGonePath({ canManage, teamId }),
      );
    }
  }, [error, canManage, teamId, sessionId]);

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
  /** Survival — every player for themselves, no team identity or shared team scores. */
  const isSurvivalMode = state?.session.battleMode === "survival";
  const myLivesRemaining = me?.survivalLives ?? null;
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
  /** Collaborative Team — captain ended the battle early for the whole team. */
  const collaborativeTeamEnded = collaborative && Boolean(myTeam?.eliminated);
  const waitingForOthers =
    (independent && personalFinished && state?.session.status === "active") ||
    (collaborativeTeamEnded && state?.session.status === "active");
  const canNavigate =
    Boolean(state) &&
    state!.session.status === "active" &&
    !waitingForOthers &&
    ((independent && !personalFinished) || (collaborative && Boolean(isCaptain)));

  const teamCards = useMemo(() => {
    if (!state || !me?.liveTeamId) return [];
    return state.strategyCards.filter((c) => c.liveTeamId === me.liveTeamId);
  }, [state, me]);

  const eliminatedChoiceIndexes = useMemo(() => {
    if (currentQuestionId == null) return new Set<number>();
    const out = new Set<number>();
    for (const c of teamCards) {
      if (
        c.kind === "fifty_fifty" &&
        c.usedAt &&
        c.questionId === currentQuestionId &&
        c.eliminatedChoices
      ) {
        for (const idx of c.eliminatedChoices) out.add(idx);
      }
    }
    return out;
  }, [teamCards, currentQuestionId]);

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

  // `null` means this battle has no per-question time limit.
  const remaining = (() => {
    void tick;
    if (!state) return null;
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
    if (remaining == null) return; // untimed battle — no auto-advance
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

  const battle = state;
  const q = waitingForOthers ? null : battle.currentQuestion;
  const paused = battle.session.status === "paused";
  const showRevealPanel = Boolean(
    q?.revealed && (q.explanation || q.correctIndex != null),
  );
  // Double Points / Score Boost inform which question grants a bonus rather
  // than being click-to-use actions — auto-applied at answer time. Shown
  // right under the question prompt instead of the Strategy cards panel.
  const bonusCards = teamCards.filter(
    (c) => c.kind === "double_points" || c.kind === "score_boost",
  );
  const actionCards = teamCards.filter(
    (c) => c.kind !== "double_points" && c.kind !== "score_boost",
  );
  const showStrategySection =
    !waitingForOthers &&
    (showRevealPanel ||
      (battle.session.config.allowStrategyCards && actionCards.length > 0));

  function answer(choiceIndex: number) {
    if (!battle.currentQuestion || submittedChoice != null || !canAnswer) return;
    if (independent && personalFinished) return;
    const questionId = battle.currentQuestion.id;
    startTransition(async () => {
      try {
        const result = await submitLiveClassroomAnswerAction({
          sessionId,
          questionId,
          choiceIndex,
        });
        setSubmittedChoice(choiceIndex);
        setLastResult({ correct: result.correct, points: result.points });
        if (result.personalFinished) {
          setLocalFinished(true);
          toast.success(
            result.sessionCompleted
              ? "Battle complete"
              : result.survivalOutOfLives
                ? "Out of lives — your battle has ended"
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

  function leaveCollaborativeBattle() {
    setLeaveBattleOpen(false);
    startTransition(async () => {
      try {
        const result = await leaveLiveClassroomCollaborativeBattleAction(
          sessionId,
        );
        setLocalFinished(true);
        toast.success(
          result.sessionCompleted
            ? "Battle complete"
            : "Battle ended for your team — waiting for other teams",
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
    if (!battle.currentQuestion || !canNavigate) return;
    const questionId = battle.currentQuestion.id;
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
    if (!battle.currentQuestion || (independent && personalFinished)) return;
    const questionId = battle.currentQuestion.id;
    startTransition(async () => {
      try {
        if (kind === "ai_hint") setHintLoading(true);
        const result = await useLiveClassroomStrategyCardAction({
          sessionId,
          strategyCardId,
          questionId,
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
              "pointer-events-auto relative max-w-lg rounded-xl border px-5 py-4 pr-10 shadow-lg backdrop-blur-md",
              teamTone.surface,
            )}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close hint"
              onClick={() => {
                setAiHint(null);
                setHintLoading(false);
              }}
              className="absolute right-2 top-2 size-7 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" aria-hidden />
            </Button>
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
              {isSurvivalMode ? (
                <>
                  {" · "}
                  <span className={cn("font-medium", teamTone.accent)}>
                    Score: {me?.score ?? 0}
                  </span>
                </>
              ) : myTeam ? (
                <>
                  {" · "}
                  <span className={cn("font-medium", teamTone.accent)}>
                    {myTeam.name}
                  </span>
                  {isCaptain ? (
                    <span
                      className="ml-1 inline-flex items-center gap-0.5 align-middle text-amber-400"
                      title="You are the team captain"
                    >
                      <Crown className="inline size-3.5" aria-hidden />
                      <span className="text-xs font-medium">Captain</span>
                    </span>
                  ) : null}
                </>
              ) : null}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Live</Badge>
            {independent ? (
              <Badge variant="secondary" className={teamTone.chip}>
                {state.session.activeBattlersRemaining} battling
              </Badge>
            ) : null}
            {!canManage &&
            waitingForOthers &&
            state.session.battleMode === "individual_team" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn("font-medium", teamTone.chip)}
                onClick={() =>
                  router.push(
                    `${liveClassroomReportPath(sessionId)}?team=${teamId}`,
                  )
                }
              >
                View report
              </Button>
            ) : null}
            {canManage && !waitingForOthers && q ? (
              <LiveClassroomTeamTargetMenu
                label={
                  paused
                    ? "Paused"
                    : remaining != null
                      ? `${remaining}s`
                      : "No timer"
                }
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
                {paused
                  ? "Paused"
                  : waitingForOthers
                    ? "Done"
                    : remaining != null
                      ? `${remaining}s`
                      : "No timer"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {waitingForOthers ? (
            <div className="space-y-3">
              <p className="text-base font-medium text-foreground">
                {collaborativeTeamEnded
                  ? "Your team captain ended the battle."
                  : optedOut
                    ? "You opted out of this battle."
                    : "You’ve finished all questions."}
              </p>
              <p className="text-sm text-muted-foreground">
                {collaborativeTeamEnded
                  ? "Your team's battle is over. Waiting for the other teams to finish."
                  : "The session ends when every team member finishes or leaves."}
                {!collaborativeTeamEnded &&
                typeof state.session.activeBattlersRemaining === "number"
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
                  Collaborative mode — read along and follow the question at
                  your own pace. Only your team captain can select and submit
                  answers, activate strategy cards, and move to the next
                  question.
                </p>
              ) : null}
              {bonusCards.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  {bonusCards.map((card) => {
                    const used = Boolean(card.usedAt);
                    const setting = resolveStrategyCardSetting(
                      state.session.config.strategyCardSettings,
                      card.kind,
                    );
                    const appliesNow = strategyCardAppliesToDeckCard(
                      setting,
                      q.cardId,
                    );
                    if (!used && !appliesNow) return null;
                    const captainBlocked = collaborative && !isCaptain;
                    return (
                      <Badge
                        key={card.id}
                        variant={used ? "outline" : "default"}
                        className={cn(
                          "gap-1 px-2.5 py-1 text-xs font-semibold",
                          used || captainBlocked
                            ? "opacity-50"
                            : cn(teamTone.choiceSelected, "border-transparent"),
                        )}
                      >
                        {strategyCardLabel(card.kind)}
                        {used
                          ? " · Used"
                          : ` · +${setting.value} pts this question`}
                      </Badge>
                    );
                  })}
                </div>
              ) : null}
              <div className="grid gap-2">
                {q.choices.map((choice, i) => {
                  const selected = submittedChoice === i;
                  const isCorrectReveal =
                    q.revealed && q.correctIndex === i;
                  const eliminated = eliminatedChoiceIndexes.has(i);
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
                        (remaining != null && remaining <= 0) ||
                        eliminated
                      }
                      className={cn(
                        "h-auto justify-start whitespace-normal px-4 py-3 text-left",
                        eliminated
                          ? "border-destructive/40 text-muted-foreground/70 line-through decoration-destructive decoration-[3px]"
                          : isCorrectReveal
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
                  ) : collaborative && isCaptain ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      disabled={pending || paused}
                      onClick={() => setLeaveBattleOpen(true)}
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
              <div className="flex flex-wrap items-center gap-2">
                {actionCards.map((card) => {
                  const used = Boolean(card.usedAt);
                  const isAiHint = card.kind === "ai_hint";
                  const timerBlocked =
                    card.kind === "extra_time" &&
                    state.session.config.timePerQuestionSec == null;
                  const captainBlocked = collaborative && !isCaptain;
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
                        timerBlocked ||
                        captainBlocked ||
                        (isAiHint && hintLoading)
                      }
                      title={
                        captainBlocked
                          ? "Only your team captain can activate strategy cards"
                          : timerBlocked
                            ? "This battle has no time limit"
                            : undefined
                      }
                      className={cn(
                        (used || timerBlocked || captainBlocked) && "opacity-50",
                        !used && !timerBlocked && !captainBlocked && teamTone.choiceSelected,
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
            {isSurvivalMode ? "Your lives" : myTeam ? `${myTeam.name} scores` : "Your team"}
          </CardTitle>
          <CardDescription>
            {isSurvivalMode
              ? "Survival is every player for themselves — a wrong answer costs a life. Run out before the questions end and your battle ends early."
              : "Only your team’s scores are shown here."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {isSurvivalMode ? (
            myLivesRemaining != null ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground">
                  Lives remaining
                </span>
                <span className="flex items-center gap-1">
                  {myLivesRemaining > 0 ? (
                    Array.from({ length: myLivesRemaining }).map((_, i) => (
                      <Heart
                        key={i}
                        className="size-4 fill-current text-rose-400"
                        aria-hidden
                      />
                    ))
                  ) : (
                    <span className="text-sm font-medium text-muted-foreground">
                      Out of lives
                    </span>
                  )}
                </span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                You are not assigned to this battle.
              </p>
            )
          ) : myTeam ? (
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
                    <span className="flex min-w-0 items-center gap-1 truncate">
                      {collaborative && myTeam.captainUserId === m.userId ? (
                        <Crown
                          className="size-3.5 shrink-0 text-amber-400"
                          aria-hidden
                        />
                      ) : null}
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

      <AlertDialog open={leaveBattleOpen} onOpenChange={setLeaveBattleOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave battle for your whole team?</AlertDialogTitle>
            <AlertDialogDescription>
              As team captain, leaving now ends the battle for every member of{" "}
              {myTeam?.name ?? "your team"} — no one on your team will be able
              to answer any more questions this battle.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay in battle</AlertDialogCancel>
            <AlertDialogAction onClick={leaveCollaborativeBattle}>
              Leave battle
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
