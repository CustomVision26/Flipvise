"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { FormattedCardFront } from "@/components/formatted-card-front";
import { FormattedCardAnswer } from "@/components/formatted-card-answer";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Lock,
  Unlock,
  Sparkles,
  RotateCcw,
  ArrowRight,
  HelpCircle,
} from "lucide-react";
import { ImageEnlargeOverlay } from "@/components/image-enlarge-overlay";
import { getGradientBySlug } from "@/lib/deck-gradients";
import { cn } from "@/lib/utils";
import { isNetworkOnlineForAiRecall } from "@/lib/ai-recall-network";
import {
  evaluateAiRecallAnswerAction,
  saveAiRecallSessionAction,
} from "@/actions/ai-recall";
import type {
  AiRecallPerCardSnapshot,
  RecallEvaluationResult,
} from "@/lib/ai-recall-types";

type CardData = {
  id: number;
  front: string | null;
  frontImageUrl?: string | null;
  back: string | null;
  backImageUrl?: string | null;
};

type Phase =
  | "prompt"
  | "checking"
  | "unlocking"
  | "revealed"
  | "complete";

export interface AiRecallStudyProps {
  cards: CardData[];
  deckId: number;
  deckName: string;
  deckDescription?: string | null;
  teamId: number | null;
  deckGradient?: string | null;
  hasAiRecall: boolean;
  /** Called when user chooses Standard Review from offline / upgrade gates. */
  onSwitchToStandardReview?: () => void;
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function insertForReviewAgain<T>(queue: T[], item: T, fromIndex: number): T[] {
  const next = [...queue];
  const offset = Math.min(3, Math.max(1, next.length - fromIndex - 1));
  const insertAt = Math.min(fromIndex + 1 + offset, next.length);
  next.splice(insertAt, 0, item);
  return next;
}

export function AiRecallStudy({
  cards,
  deckId,
  deckName,
  deckDescription = null,
  teamId,
  deckGradient,
  hasAiRecall,
  onSwitchToStandardReview,
}: AiRecallStudyProps) {
  const cardGradient = getGradientBySlug(deckGradient);
  const hasGradient = cardGradient.slug !== "none";

  const [online, setOnline] = useState(true);
  const [queue, setQueue] = useState(() => shuffleArray(cards));
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("prompt");
  const [studentAnswer, setStudentAnswer] = useState("");
  const [evaluation, setEvaluation] = useState<RecallEvaluationResult | null>(
    null,
  );
  const [outcome, setOutcome] = useState<
    "correct" | "incorrect" | "forced_unlock" | null
  >(null);
  const [snapshots, setSnapshots] = useState<AiRecallPerCardSnapshot[]>([]);
  const [answerRevealKey, setAnswerRevealKey] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [enlargedImage, setEnlargedImage] = useState<{
    src: string;
    title: string;
    alt: string;
  } | null>(null);

  const sessionStartRef = useRef(Date.now());
  const cardStartRef = useRef(Date.now());
  const savedRef = useRef(false);
  const unlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current);
    };
  }, []);

  const current = queue[index];
  const total = queue.length;
  const progressPercent = total > 0 ? ((index + 1) / total) * 100 : 0;

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const ok = await isNetworkOnlineForAiRecall();
      if (!cancelled) setOnline(ok);
    }
    void check();
    function onOnline() {
      void check();
    }
    function onOffline() {
      setOnline(false);
    }
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    cardStartRef.current = Date.now();
    setStudentAnswer("");
    setEvaluation(null);
    setOutcome(null);
    setPhase("prompt");
    setEnlargedImage(null);
  }, [index, current?.id]);

  async function persistIfNeeded(finalSnapshots: AiRecallPerCardSnapshot[]) {
    if (savedRef.current || finalSnapshots.length === 0) return;
    savedRef.current = true;
    const result = await saveAiRecallSessionAction({
      deckId,
      deckName,
      teamId,
      sessionDurationMs: Date.now() - sessionStartRef.current,
      perCard: finalSnapshots,
    });
    if (!result.ok) {
      savedRef.current = false;
      setSaveError("Session progress could not be saved. You can keep studying.");
    }
  }

  function recordSnapshot(
    nextOutcome: "correct" | "incorrect" | "forced_unlock",
    evalResult: RecallEvaluationResult | null,
    answer: string | null,
  ): AiRecallPerCardSnapshot {
    return {
      cardId: current.id,
      question: current.front?.trim() || "",
      correctAnswer: current.back?.trim() || "",
      studentAnswer: answer,
      outcome: nextOutcome,
      score: evalResult?.score ?? null,
      confidence: evalResult?.confidence ?? null,
      feedback: evalResult?.feedback ?? null,
      explanation: evalResult?.explanation ?? null,
      recallTimeMs: Math.max(0, Date.now() - cardStartRef.current),
      modality: "text",
    };
  }

  function goNext(updatedSnapshots: AiRecallPerCardSnapshot[], newQueue?: CardData[]) {
    const q = newQueue ?? queue;
    if (index >= q.length - 1) {
      setSnapshots(updatedSnapshots);
      setPhase("complete");
      void persistIfNeeded(updatedSnapshots);
      return;
    }
    setSnapshots(updatedSnapshots);
    setIndex((i) => i + 1);
  }

  function handleSubmit() {
    if (!current || phase !== "prompt" || isPending) return;
    const answer = studentAnswer.trim();
    if (!answer) return;

    setPhase("checking");
    startTransition(async () => {
      const result = await evaluateAiRecallAnswerAction({
        deckId,
        cardId: current.id,
        question: current.front?.trim() || "",
        correctAnswer: current.back?.trim() || "",
        studentAnswer: answer,
        modality: "text",
        teamId,
      });

      if (!result.ok) {
        // Soft failure — reveal without crashing.
        setEvaluation({
          correct: false,
          score: 0,
          confidence: 0,
          feedback: "We could not reach AI evaluation. Showing the answer.",
          explanation: current.back?.trim() || "",
        });
        setOutcome("forced_unlock");
        setPhase("unlocking");
        setAnswerRevealKey((k) => k + 1);
        if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current);
        unlockTimerRef.current = setTimeout(() => setPhase("revealed"), 700);
        return;
      }

      setEvaluation(result.evaluation);
      setOutcome(result.evaluation.correct ? "correct" : "incorrect");
      setPhase("unlocking");
      setAnswerRevealKey((k) => k + 1);
      if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current);
      unlockTimerRef.current = setTimeout(() => setPhase("revealed"), 700);
    });
  }

  function handleIDontKnow() {
    if (!current || phase !== "prompt") return;
    setEvaluation({
      correct: false,
      score: 0,
      confidence: 100,
      feedback: "Forced unlock — take a moment to study this answer.",
      explanation: current.back?.trim() || "",
    });
    setOutcome("forced_unlock");
    setPhase("unlocking");
    setAnswerRevealKey((k) => k + 1);
    if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current);
    unlockTimerRef.current = setTimeout(() => setPhase("revealed"), 700);
  }

  function handleContinue() {
    if (!current || !outcome) return;
    const snap = recordSnapshot(
      outcome,
      evaluation,
      outcome === "forced_unlock" && !studentAnswer.trim()
        ? null
        : studentAnswer.trim() || null,
    );
    goNext([...snapshots, snap]);
  }

  function handleReviewAgain() {
    if (!current || !outcome) return;
    const snap = recordSnapshot(
      outcome,
      evaluation,
      studentAnswer.trim() || null,
    );
    const updated = [...snapshots, snap];
    const newQueue = insertForReviewAgain(queue, current, index);
    setQueue(newQueue);
    goNext(updated, newQueue);
  }

  function handleRestart() {
    savedRef.current = false;
    setSaveError(null);
    setQueue(shuffleArray(cards));
    setIndex(0);
    setSnapshots([]);
    setPhase("prompt");
    sessionStartRef.current = Date.now();
  }

  if (!hasAiRecall) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-4 rounded-2xl border border-border bg-card/60 p-6 text-center sm:p-8">
        <Sparkles className="h-8 w-8 text-primary" aria-hidden />
        <h2 className="text-xl font-semibold tracking-tight">AI Recall™</h2>
        <p className="text-sm text-muted-foreground">Available with</p>
        <ul className="space-y-1 text-sm text-foreground">
          <li>• Pro Plus</li>
          <li>• Education Plus</li>
          <li>• Team Plans</li>
        </ul>
        <p className="text-sm text-muted-foreground">Upgrade to continue.</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button render={<Link href="/pricing" />}>Upgrade</Button>
          {onSwitchToStandardReview ? (
            <Button variant="outline" onClick={onSwitchToStandardReview}>
              Continue with Standard Review
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  if (!online) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-4 rounded-2xl border border-border bg-card/60 p-6 text-center sm:p-8">
        <Lock className="h-8 w-8 text-muted-foreground" aria-hidden />
        <h2 className="text-xl font-semibold tracking-tight">AI Recall™</h2>
        <p className="text-sm text-muted-foreground">
          Internet connection required.
        </p>
        <p className="text-sm text-muted-foreground">
          Continue studying using Standard Review.
        </p>
        {onSwitchToStandardReview ? (
          <Button onClick={onSwitchToStandardReview}>
            Continue with Standard Review
          </Button>
        ) : (
          <Button variant="outline" render={<Link href={`/decks/${deckId}`} />}>
            Back to deck
          </Button>
        )}
      </div>
    );
  }

  if (!current) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        No cards available for AI Recall™.
      </p>
    );
  }

  if (phase === "complete") {
    const correct = snapshots.filter((s) => s.outcome === "correct").length;
    const incorrect = snapshots.filter((s) => s.outcome === "incorrect").length;
    const forced = snapshots.filter((s) => s.outcome === "forced_unlock").length;
    const scores = snapshots
      .map((s) => s.score)
      .filter((s): s is number => s != null);
    const avgScore =
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : null;

    return (
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-4 rounded-2xl border border-border bg-card/60 p-6 text-center sm:p-8">
        <Sparkles className="h-8 w-8 text-primary" aria-hidden />
        <h2 className="text-xl font-semibold">AI Recall™ session complete</h2>
        <p className="text-sm text-muted-foreground">{deckName}</p>
        <div className="grid w-full grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Stat label="Reviewed" value={String(snapshots.length)} />
          <Stat label="Correct" value={String(correct)} />
          <Stat label="Incorrect" value={String(incorrect)} />
          <Stat label="Forced unlocks" value={String(forced)} />
        </div>
        {avgScore != null ? (
          <p className="text-sm">
            Average AI score:{" "}
            <span className="font-semibold text-foreground">{avgScore}%</span>
          </p>
        ) : null}
        {saveError ? (
          <p className="text-xs text-amber-500">{saveError}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Session analytics saved for your progress dashboards.
          </p>
        )}
        <Button onClick={handleRestart} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Study again
        </Button>
      </div>
    );
  }

  const showAnswer = phase === "revealed" || phase === "unlocking";

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 sm:gap-5">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="secondary" className="gap-1 text-xs">
            <Sparkles className="h-3 w-3" />
            AI Recall™
          </Badge>
          <span className="text-xs text-muted-foreground">
            Card {Math.min(index + 1, total)} of {total}
          </span>
        </div>
        <Progress value={progressPercent} className="h-1.5" />
        {deckDescription?.trim() ? (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {deckDescription.trim()}
          </p>
        ) : null}
      </div>

      <div
        className={cn(
          "relative flex min-h-[220px] flex-col overflow-hidden rounded-2xl border border-border shadow-sm sm:min-h-[280px]",
          hasGradient ? cn("text-white", cardGradient.classes) : "bg-card",
        )}
      >
        <div className="flex items-center justify-between px-3 pt-3 sm:px-5 sm:pt-4">
          <Badge
            variant="outline"
            className={cn(
              "text-xs",
              hasGradient && "border-white/30 bg-white/20 text-white",
            )}
          >
            Question
          </Badge>
          {!showAnswer ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs",
                hasGradient ? "text-white/80" : "text-muted-foreground",
              )}
            >
              <Lock className="h-3.5 w-3.5" />
              Answer Locked
            </span>
          ) : phase === "unlocking" ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs animate-pulse",
                hasGradient ? "text-white/90" : "text-primary",
              )}
            >
              <Unlock className="h-3.5 w-3.5" />
              Unlocking...
            </span>
          ) : (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs",
                hasGradient ? "text-white/90" : "text-primary",
              )}
            >
              <Unlock className="h-3.5 w-3.5" />
              Answer revealed
            </span>
          )}
        </div>

        {current.frontImageUrl ? (
          <div className="mx-3 mt-2 shrink-0 sm:mx-5">
            <button
              type="button"
              className="relative h-28 w-full cursor-zoom-in overflow-hidden rounded-lg border border-border/50 bg-muted/20 transition-[box-shadow] hover:ring-2 hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-36"
              title="Double-click to enlarge"
              aria-label="Double-click to enlarge question image"
              onDoubleClick={(event) => {
                event.preventDefault();
                setEnlargedImage({
                  src: current.frontImageUrl!,
                  title: "Question image",
                  alt: "Card question image",
                });
              }}
            >
              <Image
                src={current.frontImageUrl}
                alt="Card question image"
                fill
                className="object-contain p-2 pointer-events-none"
                draggable={false}
              />
            </button>
          </div>
        ) : null}

        <div className="flex flex-1 flex-col justify-center px-4 py-4 sm:px-8">
          {current.front ? (
            <FormattedCardFront
              text={current.front}
              variant="study"
              hasGradient={hasGradient}
            />
          ) : (
            <p className="text-sm text-muted-foreground">No question text.</p>
          )}
        </div>
      </div>

      {phase === "prompt" ? (
        <div className="flex flex-col gap-3">
          <label htmlFor="ai-recall-answer" className="sr-only">
            Type your answer
          </label>
          <Textarea
            id="ai-recall-answer"
            placeholder="Type your answer..."
            value={studentAnswer}
            onChange={(e) => setStudentAnswer(e.target.value)}
            rows={3}
            className="min-h-[88px] resize-y"
            disabled={isPending}
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              className="gap-1.5 text-muted-foreground"
              onClick={handleIDontKnow}
              disabled={isPending}
            >
              <HelpCircle className="h-4 w-4" />
              I Don&apos;t Know
            </Button>
            <Button
              type="button"
              className="gap-2"
              onClick={handleSubmit}
              disabled={!studentAnswer.trim() || isPending}
            >
              Submit
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Voice and drawing answers are coming soon — text answers are
            supported today.
          </p>
        </div>
      ) : null}

      {phase === "checking" ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card/50 p-6 text-center">
          <p className="text-sm font-medium">Checking Answer...</p>
          <Progress value={66} className="h-2 w-full max-w-xs animate-pulse" />
          <p className="text-xs text-muted-foreground">AI is evaluating...</p>
        </div>
      ) : null}

      {showAnswer ? (
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-card/60 p-4 sm:p-5">
          {outcome === "correct" ? (
            <div className="space-y-1">
              <p className="text-lg font-semibold text-emerald-500">
                {evaluation?.feedback?.trim() || "Excellent!"}
              </p>
              <div className="flex flex-wrap gap-3 text-sm">
                <span>
                  AI Score{" "}
                  <strong>{evaluation?.score ?? 0}%</strong>
                </span>
                <span>
                  Confidence{" "}
                  <strong>{evaluation?.confidence ?? 0}%</strong>
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-lg font-semibold text-destructive">
                {outcome === "forced_unlock" ? "Answer revealed" : "Incorrect"}
              </p>
              {studentAnswer.trim() ? (
                <p className="text-sm">
                  <span className="text-muted-foreground">Your Answer </span>
                  {studentAnswer.trim()}
                </p>
              ) : null}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Correct Answer
            </p>
            {current.backImageUrl ? (
              <button
                type="button"
                className="relative h-28 w-full cursor-zoom-in overflow-hidden rounded-lg border border-border bg-muted/20 transition-[box-shadow] hover:ring-2 hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-36"
                title="Double-click to enlarge"
                aria-label="Double-click to enlarge correct answer image"
                onDoubleClick={(event) => {
                  event.preventDefault();
                  setEnlargedImage({
                    src: current.backImageUrl!,
                    title: "Correct answer image",
                    alt: "Correct answer image",
                  });
                }}
              >
                <Image
                  src={current.backImageUrl}
                  alt="Correct answer image"
                  fill
                  className="object-contain p-2 pointer-events-none"
                  draggable={false}
                />
              </button>
            ) : null}
            {current.back ? (
              <FormattedCardAnswer
                text={current.back}
                variant="study"
                hasGradient={false}
                revealKey={answerRevealKey}
              />
            ) : null}
          </div>

          {evaluation?.explanation ? (
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Explanation
              </p>
              <p className="text-sm leading-relaxed text-foreground/90">
                {evaluation.explanation}
              </p>
            </div>
          ) : null}

          {phase === "revealed" ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={handleReviewAgain}>
                Review Again
              </Button>
              <Button onClick={handleContinue} className="gap-2">
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {enlargedImage ? (
        <ImageEnlargeOverlay
          open
          onClose={() => setEnlargedImage(null)}
          src={enlargedImage.src}
          alt={enlargedImage.alt}
          title={enlargedImage.title}
        />
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-base font-semibold">{value}</p>
    </div>
  );
}
