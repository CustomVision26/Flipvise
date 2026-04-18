"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
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
import {
  CheckCircle,
  XCircle,
  RotateCcw,
  ArrowLeft,
  Trophy,
  Sparkles,
  HeartHandshake,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  CircleHelp,
} from "lucide-react";
import { submitQuizResultAction, type QuizResult } from "@/actions/study";

type CardData = {
  id: number;
  front: string | null;
  frontImageUrl?: string | null;
  back: string | null;
  backImageUrl?: string | null;
  choices?: string[] | null;
  correctChoiceIndex?: number | null;
};

type QuizQuestion = {
  cardId: number;
  question: string | null;
  questionImageUrl: string | null;
  options: string[];
  correctIndex: number;
};

interface QuizStudyProps {
  cards: CardData[];
  deckId: number;
  deckName: string;
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Quiz time budget — 10 minutes for the first 25 cards, +10 for every
 * additional tier up to 50 cards, +10 more beyond 50.
 */
function getQuizDurationSeconds(cardCount: number): number {
  if (cardCount <= 25) return 10 * 60;
  if (cardCount <= 50) return 20 * 60;
  return 30 * 60;
}

function formatClock(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const mm = Math.floor(clamped / 60)
    .toString()
    .padStart(2, "0");
  const ss = (clamped % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

/**
 * Converts a deck of cards into multiple-choice questions.
 *
 * - Cards that already have stored `choices` + `correctChoiceIndex` use
 *   them directly (and we shuffle the options).
 * - Cards without stored choices fall back to a "correct + 3 sampled
 *   backs" construction using other cards in the deck as distractors.
 * - Cards whose back is empty *and* have no stored choices are skipped
 *   because there is no correct answer to compare against.
 */
function buildQuestions(cards: CardData[]): QuizQuestion[] {
  const textBacks = cards
    .map((c) => (c.back ?? "").trim())
    .filter((t) => t.length > 0);

  const questions: QuizQuestion[] = [];

  for (const card of cards) {
    // Must match the server-side check in `submitQuizResultAction` exactly,
    // otherwise a borderline card could be shown as free-response here but
    // scored as multiple-choice on the server, mis-grading the user.
    const hasStoredChoices =
      Array.isArray(card.choices) &&
      card.choices.length >= 2 &&
      card.correctChoiceIndex !== null &&
      card.correctChoiceIndex !== undefined &&
      card.correctChoiceIndex >= 0 &&
      card.correctChoiceIndex < card.choices.length;

    if (hasStoredChoices) {
      const correctText = (card.choices as string[])[card.correctChoiceIndex as number];
      if (!correctText || !correctText.trim()) continue;
      const shuffled = shuffleArray(card.choices as string[]);
      const correctIndex = shuffled.findIndex(
        (text) => normalizeText(text) === normalizeText(correctText),
      );
      questions.push({
        cardId: card.id,
        question: card.front,
        questionImageUrl: card.frontImageUrl ?? null,
        options: shuffled,
        correctIndex: correctIndex === -1 ? 0 : correctIndex,
      });
      continue;
    }

    const back = (card.back ?? "").trim();
    if (!back) continue;

    const correctNorm = normalizeText(back);
    const distractorPool = Array.from(
      new Set(
        textBacks
          .map((t) => t.trim())
          .filter((t) => normalizeText(t) !== correctNorm),
      ),
    );
    const distractors = shuffleArray(distractorPool).slice(0, 3);

    if (distractors.length === 0) continue;

    const options = shuffleArray([back, ...distractors]);
    const correctIndex = options.findIndex((o) => normalizeText(o) === correctNorm);

    questions.push({
      cardId: card.id,
      question: card.front,
      questionImageUrl: card.frontImageUrl ?? null,
      options,
      correctIndex: correctIndex === -1 ? 0 : correctIndex,
    });
  }

  return shuffleArray(questions);
}

export function QuizStudy({ cards, deckId, deckName }: QuizStudyProps) {
  const router = useRouter();

  const [questions, setQuestions] = useState<QuizQuestion[]>(() => buildQuestions(cards));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedByIndex, setSelectedByIndex] = useState<(number | null)[]>(() =>
    Array(questions.length).fill(null),
  );

  const totalSeconds = useMemo(
    () => getQuizDurationSeconds(questions.length),
    [questions.length],
  );
  const [remainingSeconds, setRemainingSeconds] = useState(totalSeconds);
  const startTimeRef = useRef<number>(Date.now());

  const [result, setResult] = useState<QuizResult | null>(null);
  const [submitting, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const totalQuestions = questions.length;
  const answeredCount = selectedByIndex.filter((x) => x !== null).length;
  const unansweredCount = totalQuestions - answeredCount;
  const progressPercent =
    totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

  const submitQuiz = useCallback(
    (reason: { timedOut: boolean }) => {
      if (result || submitting) return;
      const elapsed = Math.min(
        totalSeconds,
        Math.floor((Date.now() - startTimeRef.current) / 1000),
      );
      const answers = questions.map((q, i) => {
        const sel = selectedByIndex[i];
        return {
          cardId: q.cardId,
          selectedText: sel !== null && sel !== undefined ? q.options[sel] : null,
        };
      });
      setSubmitError(null);
      startTransition(async () => {
        try {
          const res = await submitQuizResultAction({
            deckId,
            answers,
            elapsedSeconds: elapsed,
            timedOut: reason.timedOut,
          });
          setResult(res);
        } catch (err) {
          setSubmitError(err instanceof Error ? err.message : "Failed to submit quiz");
        }
      });
    },
    [result, submitting, totalSeconds, questions, selectedByIndex, deckId],
  );

  useEffect(() => {
    if (result || totalQuestions === 0) return;
    const id = window.setInterval(() => {
      setRemainingSeconds((s) => {
        if (s <= 1) {
          window.clearInterval(id);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [result, totalQuestions]);

  useEffect(() => {
    if (remainingSeconds === 0 && !result && totalQuestions > 0) {
      submitQuiz({ timedOut: true });
    }
  }, [remainingSeconds, result, totalQuestions, submitQuiz]);

  function handleSelect(optionIndex: number) {
    setSelectedByIndex((prev) => {
      const next = [...prev];
      next[currentIndex] = optionIndex;
      return next;
    });
  }

  function goPrev() {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  }
  function goNext() {
    if (currentIndex < totalQuestions - 1) setCurrentIndex((i) => i + 1);
  }

  function handleFinishRequest() {
    if (unansweredCount > 0) {
      setConfirmOpen(true);
      return;
    }
    submitQuiz({ timedOut: false });
  }

  function handleRetake() {
    const fresh = buildQuestions(cards);
    setQuestions(fresh);
    setSelectedByIndex(Array(fresh.length).fill(null));
    setCurrentIndex(0);
    setResult(null);
    setSubmitError(null);
    startTimeRef.current = Date.now();
    setRemainingSeconds(getQuizDurationSeconds(fresh.length));
  }

  if (result) {
    return (
      <QuizResultCard
        result={result}
        questions={questions}
        selectedByIndex={selectedByIndex}
        deckName={deckName}
        onRetake={handleRetake}
        onBack={() => router.push(`/decks/${deckId}`)}
      />
    );
  }

  if (totalQuestions === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-md text-center flex flex-col gap-3">
          <CircleHelp className="h-10 w-10 text-muted-foreground mx-auto" />
          <h3 className="text-lg font-semibold">No quiz questions available</h3>
          <p className="text-sm text-muted-foreground">
            Quiz mode needs cards with a text answer. Add a few cards with a
            written back, or generate multiple-choice cards, then come back.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="self-center gap-2"
            onClick={() => router.push(`/decks/${deckId}`)}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Deck
          </Button>
        </div>
      </div>
    );
  }

  const current = questions[currentIndex];
  const selectedForCurrent = selectedByIndex[currentIndex];
  const timerWarning = remainingSeconds <= 60;
  const timerCritical = remainingSeconds <= 30;

  return (
    <div className="flex flex-1 flex-col items-center gap-4 sm:gap-6">
      <div className="w-full max-w-2xl flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-sm sm:text-base ${
              timerCritical
                ? "border-rose-500/50 bg-rose-500/10 text-rose-400 animate-pulse"
                : timerWarning
                  ? "border-amber-500/50 bg-amber-500/10 text-amber-400"
                  : "border-border bg-muted/30 text-foreground"
            }`}
            aria-label="Time remaining"
          >
            <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            {formatClock(remainingSeconds)}
          </div>
          <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground">
            <span>
              Question{" "}
              <span className="font-semibold text-foreground">{currentIndex + 1}</span> of{" "}
              {totalQuestions}
            </span>
            <span className="hidden sm:inline">·</span>
            <span>
              <span className="font-semibold text-foreground">{answeredCount}</span>{" "}
              answered
            </span>
          </div>
        </div>
        <Progress value={progressPercent} className="h-2" />
        <div className="flex flex-wrap gap-1.5">
          {questions.map((_, i) => {
            const isCurrent = i === currentIndex;
            const isAnswered = selectedByIndex[i] !== null;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setCurrentIndex(i)}
                className={`h-6 w-6 sm:h-7 sm:w-7 rounded-md border text-[10px] sm:text-xs font-semibold transition-colors ${
                  isCurrent
                    ? "border-primary bg-primary text-primary-foreground"
                    : isAnswered
                      ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                      : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
                }`}
                aria-label={`Go to question ${i + 1}${isAnswered ? " (answered)" : ""}`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>

      <div className="w-full max-w-2xl rounded-xl sm:rounded-2xl border bg-card shadow-md overflow-hidden">
        <div className="flex items-center justify-between px-3 sm:px-5 pt-3 sm:pt-4 pb-2">
          <Badge variant="secondary" className="text-xs">
            Question {currentIndex + 1}
          </Badge>
          <span className="text-muted-foreground text-xs">Select the best answer</span>
        </div>
        {current.questionImageUrl && (
          <div className="px-3 sm:px-6 pb-2">
            <div className="relative w-full h-40 sm:h-60 md:h-72 rounded-lg overflow-hidden border border-border bg-muted/20 shadow-inner">
              <Image
                src={current.questionImageUrl}
                alt="Question image"
                fill
                className="object-contain p-2 sm:p-3"
              />
            </div>
          </div>
        )}
        <div className="px-4 sm:px-8 py-5 sm:py-6">
          {current.question ? (
            <p className="text-center text-base sm:text-xl font-semibold leading-relaxed break-words">
              {current.question}
            </p>
          ) : (
            <p className="text-center text-muted-foreground text-sm">(Image only)</p>
          )}
        </div>
      </div>

      <div
        className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3"
        role="radiogroup"
        aria-label="Answer options"
      >
        {current.options.map((text, i) => {
          const isSelected = selectedForCurrent === i;
          return (
            <Button
              key={`${current.cardId}-${i}`}
              variant={isSelected ? "default" : "outline"}
              role="radio"
              aria-checked={isSelected}
              className={`justify-start text-left h-auto py-3 px-4 whitespace-normal break-words ${
                isSelected ? "" : "hover:bg-muted/50"
              }`}
              onClick={() => handleSelect(i)}
            >
              <span className="flex items-start gap-2.5 w-full">
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold ${
                    isSelected
                      ? "border-primary-foreground bg-primary-foreground text-primary"
                      : "border-muted-foreground/40 bg-transparent"
                  }`}
                >
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="break-words">{text}</span>
              </span>
            </Button>
          );
        })}
      </div>

      <div className="w-full max-w-2xl flex items-center justify-between gap-2 sm:gap-3 flex-wrap">
        <Button
          variant="outline"
          size="default"
          className="gap-1 sm:gap-2 h-10 sm:h-11 px-3 sm:px-4 text-xs sm:text-sm"
          onClick={goPrev}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline">Previous</span>
        </Button>

        <Button
          size="default"
          className="gap-2 h-10 sm:h-11 px-4 sm:px-6 text-sm"
          onClick={handleFinishRequest}
          disabled={submitting}
        >
          <Flag className="h-4 w-4" />
          {submitting ? "Submitting…" : "Finish Quiz"}
        </Button>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-md mx-4 sm:mx-auto">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-base sm:text-lg">
                Submit with {unansweredCount} unanswered{" "}
                {unansweredCount === 1 ? "question" : "questions"}?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs sm:text-sm">
                Unanswered questions will be counted as incorrect. You can go
                back and answer them first, or submit now to see your score.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
              <AlertDialogCancel className="w-full sm:w-auto">
                Keep answering
              </AlertDialogCancel>
              <AlertDialogAction
                className="w-full sm:w-auto"
                disabled={submitting}
                onClick={() => {
                  setConfirmOpen(false);
                  submitQuiz({ timedOut: false });
                }}
              >
                {submitting ? "Submitting…" : "Submit anyway"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Button
          variant="outline"
          size="default"
          className="gap-1 sm:gap-2 h-10 sm:h-11 px-3 sm:px-4 text-xs sm:text-sm"
          onClick={goNext}
          disabled={currentIndex === totalQuestions - 1}
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </Button>
      </div>

      {submitError && (
        <div className="w-full max-w-2xl flex flex-col items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-center">
          <p className="text-sm text-destructive">{submitError}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => submitQuiz({ timedOut: false })}
            disabled={submitting}
          >
            Retry submission
          </Button>
        </div>
      )}
    </div>
  );
}

function QuizResultCard({
  result,
  questions,
  selectedByIndex,
  deckName,
  onRetake,
  onBack,
}: {
  result: QuizResult;
  questions: QuizQuestion[];
  selectedByIndex: (number | null)[];
  deckName: string;
  onRetake: () => void;
  onBack: () => void;
}) {
  const { percent, correct, incorrect, unanswered, total, tier, quote, elapsedSeconds, timedOut } =
    result;

  const tierStyles: Record<
    typeof tier,
    { heading: string; color: string; accent: string; Icon: typeof Trophy }
  > = {
    low: {
      heading: "Keep Going — You're Building It",
      color: "text-purple-400",
      accent: "from-purple-500/10 to-purple-500/0",
      Icon: HeartHandshake,
    },
    mid: {
      heading: "Nice Progress!",
      color: "text-blue-400",
      accent: "from-blue-500/10 to-blue-500/0",
      Icon: Sparkles,
    },
    high: {
      heading: "Outstanding — Victory!",
      color: "text-yellow-500",
      accent: "from-yellow-500/15 to-yellow-500/0",
      Icon: Trophy,
    },
  };
  const style = tierStyles[tier];
  const Icon = style.Icon;
  const perCardMap = new Map(result.perCard.map((c) => [c.cardId, c]));

  return (
    <div className="flex flex-1 flex-col items-center gap-6 px-2 sm:px-4 py-2 sm:py-4">
      <div
        className={`w-full max-w-xl flex flex-col items-center gap-4 sm:gap-6 rounded-xl sm:rounded-2xl border bg-gradient-to-b ${style.accent} bg-card p-6 sm:p-10 shadow-md text-center`}
      >
        <div className="flex flex-col items-center gap-2">
          <Icon className={`h-10 w-10 sm:h-12 sm:w-12 ${style.color}`} />
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{style.heading}</h2>
          <p className="text-muted-foreground text-sm break-words max-w-full">{deckName}</p>
          {timedOut && (
            <Badge variant="outline" className="mt-1 text-xs gap-1 border-amber-500/40 text-amber-400">
              <Clock className="h-3 w-3" />
              Time ran out
            </Badge>
          )}
        </div>

        <div className="w-full flex flex-col gap-2">
          <div className="flex justify-between text-sm text-muted-foreground mb-1">
            <span>Score</span>
            <span className={`font-semibold ${style.color}`}>{percent} / 100</span>
          </div>
          <Progress value={percent} className="h-3" />
        </div>

        <div className="w-full grid grid-cols-3 gap-2 sm:gap-3">
          <div className="flex flex-col items-center gap-1 rounded-xl border bg-emerald-500/10 border-emerald-500/20 py-3">
            <CheckCircle className="h-5 w-5 text-emerald-500" />
            <span className="text-lg sm:text-xl font-bold text-emerald-500">{correct}</span>
            <span className="text-[10px] sm:text-xs text-muted-foreground">Correct</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-xl border bg-rose-500/10 border-rose-500/20 py-3">
            <XCircle className="h-5 w-5 text-rose-500" />
            <span className="text-lg sm:text-xl font-bold text-rose-500">{incorrect}</span>
            <span className="text-[10px] sm:text-xs text-muted-foreground">Incorrect</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-xl border bg-muted/30 border-border py-3">
            <CircleHelp className="h-5 w-5 text-muted-foreground" />
            <span className="text-lg sm:text-xl font-bold text-foreground">{unanswered}</span>
            <span className="text-[10px] sm:text-xs text-muted-foreground">Unanswered</span>
          </div>
        </div>

        <p className="text-muted-foreground text-xs sm:text-sm">
          {total} question{total !== 1 ? "s" : ""} · finished in {formatClock(elapsedSeconds)}
        </p>

        <figure className="w-full rounded-xl border bg-background/50 p-4 text-left">
          <blockquote className={`text-sm sm:text-base italic leading-relaxed ${style.color}`}>
            “{quote.text}”
          </blockquote>
          <figcaption className="mt-2 text-xs text-muted-foreground">
            — {quote.author}
          </figcaption>
        </figure>

        <div className="w-full flex flex-col gap-3">
          <Button size="default" className="w-full gap-2 h-10 sm:h-11" onClick={onRetake}>
            <RotateCcw className="h-4 w-4" />
            Retake Quiz
          </Button>
          <Button
            variant="outline"
            size="default"
            className="w-full gap-2 h-10 sm:h-11"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Deck
          </Button>
        </div>
      </div>

      <div className="w-full max-w-xl flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground px-1">Review</h3>
        <ol className="flex flex-col gap-2">
          {questions.map((q, i) => {
            const perCard = perCardMap.get(q.cardId);
            const sel = selectedByIndex[i];
            const selectedText = sel !== null && sel !== undefined ? q.options[sel] : null;
            const wasCorrect = perCard?.correct ?? false;
            const wasAnswered = perCard?.answered ?? false;
            const correctText = perCard?.correctText ?? q.options[q.correctIndex];
            return (
              <li
                key={`${q.cardId}-${i}`}
                className={`rounded-lg border p-3 text-left ${
                  wasCorrect
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : wasAnswered
                      ? "border-rose-500/30 bg-rose-500/5"
                      : "border-border bg-muted/20"
                }`}
              >
                <div className="flex items-start gap-2">
                  {wasCorrect ? (
                    <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  ) : wasAnswered ? (
                    <XCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                  ) : (
                    <CircleHelp className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <p className="text-xs text-muted-foreground">
                      Question {i + 1}
                    </p>
                    <p className="text-sm font-medium break-words">
                      {q.question ?? "(Image only)"}
                    </p>
                    <p className="text-xs break-words">
                      <span className="text-muted-foreground">Your answer: </span>
                      <span
                        className={
                          wasCorrect
                            ? "text-emerald-400"
                            : wasAnswered
                              ? "text-rose-400"
                              : "text-muted-foreground italic"
                        }
                      >
                        {selectedText ?? "Unanswered"}
                      </span>
                    </p>
                    {!wasCorrect && (
                      <p className="text-xs break-words">
                        <span className="text-muted-foreground">Correct answer: </span>
                        <span className="text-emerald-400">{correctText}</span>
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
