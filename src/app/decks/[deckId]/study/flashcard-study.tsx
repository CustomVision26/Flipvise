"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ChevronLeft,
  ChevronRight,
  Shuffle,
  RefreshCw,
  CheckCircle,
  XCircle,
  RotateCcw,
  ArrowLeft,
  Trophy,
} from "lucide-react";


type CardData = {
  id: number;
  front: string | null;
  frontImageUrl?: string | null;
  back: string | null;
  backImageUrl?: string | null;
};

function FormattedCardBack({ text }: { text: string }) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  if (lines.length <= 1) {
    return (
      <p className="text-center text-xl font-semibold leading-relaxed">{text}</p>
    );
  }

  return (
    <div className="w-full space-y-1.5 text-left">
      {lines.map((line, i) => {
        if (/^Step\s*\d+:/i.test(line)) {
          return (
            <p key={i} className="font-semibold text-sm text-primary pt-2 first:pt-0">
              {line}
            </p>
          );
        }
        if (/^(Answer|Result|Solution|∴)[\s:]*/i.test(line)) {
          return (
            <p key={i} className="font-bold text-sm text-emerald-400 pt-3 mt-1 border-t border-border">
              {line}
            </p>
          );
        }
        return (
          <p key={i} className="text-xs font-mono text-foreground pl-3 leading-relaxed">
            {line}
          </p>
        );
      })}
    </div>
  );
}

interface FlashcardStudyProps {
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

const FLIP_DURATION_MS = 560;

export function FlashcardStudy({ cards, deckId, deckName }: FlashcardStudyProps) {
  const router = useRouter();
  const [deck, setDeck] = useState<CardData[]>(cards);
  const [currentIndex, setCurrentIndex] = useState(0);
  // visibleIndex tracks which card's content is rendered — lags behind
  // currentIndex when navigating while flipped so the new card's answer
  // is never shown during the unflip animation.
  const [visibleIndex, setVisibleIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [sessionComplete, setSessionComplete] = useState(false);
  const pendingNavRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const total = deck.length;
  const currentCard = deck[visibleIndex];
  const progressPercent = ((currentIndex + 1) / total) * 100;

  function navigateTo(newIndex: number) {
    if (pendingNavRef.current) clearTimeout(pendingNavRef.current);
    setCurrentIndex(newIndex);
    if (isFlipped) {
      setIsFlipped(false);
      pendingNavRef.current = setTimeout(() => {
        setVisibleIndex(newIndex);
      }, FLIP_DURATION_MS);
    } else {
      setVisibleIndex(newIndex);
    }
  }

  useEffect(() => {
    return () => {
      if (pendingNavRef.current) clearTimeout(pendingNavRef.current);
    };
  }, []);

  function handleFlip() {
    setIsFlipped((prev) => !prev);
  }

  function handlePrevious() {
    if (currentIndex === 0) return;
    navigateTo(currentIndex - 1);
  }

  function handleNext() {
    if (currentIndex === total - 1) return;
    navigateTo(currentIndex + 1);
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") handlePrevious();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === " ") {
        e.preventDefault();
        handleFlip();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, total]);

  function handleShuffle() {
    if (pendingNavRef.current) clearTimeout(pendingNavRef.current);
    setDeck(shuffleArray(cards));
    setCurrentIndex(0);
    setVisibleIndex(0);
    setIsFlipped(false);
  }

  function handleCorrect() {
    setCorrectCount((c) => c + 1);
    if (currentIndex < total - 1) {
      navigateTo(currentIndex + 1);
    } else {
      setIsFlipped(false);
      pendingNavRef.current = setTimeout(() => setSessionComplete(true), FLIP_DURATION_MS);
    }
  }

  function handleIncorrect() {
    setIncorrectCount((c) => c + 1);
    if (currentIndex < total - 1) {
      navigateTo(currentIndex + 1);
    } else {
      setIsFlipped(false);
      pendingNavRef.current = setTimeout(() => setSessionComplete(true), FLIP_DURATION_MS);
    }
  }

  function handleStudyAgain() {
    if (pendingNavRef.current) clearTimeout(pendingNavRef.current);
    setDeck(cards);
    setCurrentIndex(0);
    setVisibleIndex(0);
    setIsFlipped(false);
    setCorrectCount(0);
    setIncorrectCount(0);
    setSessionComplete(false);
  }

  if (sessionComplete) {
    const scorePercent = total > 0 ? Math.round((correctCount / total) * 100) : 0;

    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-8">
        <div className="w-full max-w-md flex flex-col items-center gap-6 rounded-2xl border bg-card p-10 shadow-md text-center">
          <div className="flex flex-col items-center gap-2">
            <Trophy className="h-12 w-12 text-yellow-500" />
            <h2 className="text-2xl font-bold tracking-tight">Session Complete!</h2>
            <p className="text-muted-foreground text-sm">{deckName}</p>
          </div>

          <div className="w-full flex flex-col gap-2">
            <div className="flex justify-between text-sm text-muted-foreground mb-1">
              <span>Score</span>
              <span className="font-semibold text-foreground">{scorePercent}%</span>
            </div>
            <Progress value={scorePercent} className="h-3" />
          </div>

          <div className="w-full grid grid-cols-2 gap-4">
            <div className="flex flex-col items-center gap-1 rounded-xl border bg-emerald-500/10 border-emerald-500/20 py-4">
              <CheckCircle className="h-6 w-6 text-emerald-500" />
              <span className="text-2xl font-bold text-emerald-500">{correctCount}</span>
              <span className="text-xs text-muted-foreground">Correct</span>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-xl border bg-rose-500/10 border-rose-500/20 py-4">
              <XCircle className="h-6 w-6 text-rose-500" />
              <span className="text-2xl font-bold text-rose-500">{incorrectCount}</span>
              <span className="text-xs text-muted-foreground">Incorrect</span>
            </div>
          </div>

          <p className="text-muted-foreground text-sm">
            {total} card{total !== 1 ? "s" : ""} studied
          </p>

          <div className="w-full flex flex-col gap-3">
            <Button size="lg" className="w-full gap-2" onClick={handleStudyAgain}>
              <RotateCcw className="h-4 w-4" />
              Study Again
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="w-full gap-2"
              onClick={() => router.push(`/decks/${deckId}`)}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Deck
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-8">
      {/* Progress bar */}
      <div className="w-full max-w-2xl flex flex-col gap-2">
        {/* Deck title */}
        <h1 className="text-2xl font-bold tracking-tight">{deckName}</h1>
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>
            Card {currentIndex + 1} of {total}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto gap-1.5 px-2 py-0 text-sm text-muted-foreground hover:text-foreground"
            onClick={handleShuffle}
          >
            <Shuffle className="h-3.5 w-3.5" />
            Shuffle
          </Button>
        </div>
        <Progress value={progressPercent} className="h-2" />
        <div className="flex items-center gap-4 mt-1">
          <div className="flex items-center gap-1.5 text-sm text-emerald-500">
            <CheckCircle className="h-4 w-4" />
            <span className="font-semibold">{correctCount}</span>
            <span className="text-muted-foreground">correct</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-rose-500">
            <XCircle className="h-4 w-4" />
            <span className="font-semibold">{incorrectCount}</span>
            <span className="text-muted-foreground">incorrect</span>
          </div>
        </div>
      </div>

      {/* Keyboard hint */}
      <p className="text-muted-foreground text-sm">
        Use <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">←</kbd>{" "}
        <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">→</kbd>{" "}
        arrow keys to navigate and{" "}
        <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">Space</kbd>{" "}
        to flip
      </p>

      {/* Flashcard */}
      <div
        className="w-full max-w-2xl cursor-pointer select-none"
        style={{ perspective: "1200px" }}
        onClick={handleFlip}
        role="button"
        aria-label={isFlipped ? "Card back — click to flip" : "Card front — click to flip"}
      >
        <div
          style={{
            transformStyle: "preserve-3d",
            transition: "transform 0.55s cubic-bezier(0.45, 0, 0.55, 1)",
            transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
            position: "relative",
            height: "540px",
          }}
        >
          {/* Front */}
          <div
            style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
            className="absolute inset-0 flex flex-col rounded-2xl border bg-card shadow-md overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
              <Badge variant="secondary" className="text-xs">Front</Badge>
              <span className="text-muted-foreground text-xs">Click to reveal answer</span>
            </div>
            {currentCard.frontImageUrl && (
              <div className="shrink-0 px-6 pb-2">
                <div className="relative w-full h-72 rounded-lg overflow-hidden border border-border bg-muted/20 shadow-inner">
                  <Image
                    src={currentCard.frontImageUrl}
                    alt="Card front image"
                    fill
                    className="object-contain p-3"
                  />
                </div>
              </div>
            )}
            <div className="flex-1 min-h-0 overflow-y-auto px-8 py-3 flex flex-col items-center justify-center">
              {currentCard.front && (
                <p className="text-center text-xl font-semibold leading-relaxed">
                  {currentCard.front}
                </p>
              )}
            </div>
          </div>

          {/* Back */}
          <div
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
            className="absolute inset-0 flex flex-col rounded-2xl border bg-card shadow-md overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
              <Badge variant="outline" className="text-xs">Back</Badge>
              <span className="text-muted-foreground text-xs">Click to flip back</span>
            </div>
            {currentCard.backImageUrl && (
              <div className="shrink-0 px-6 pb-2">
                <div className="relative w-full h-72 rounded-lg overflow-hidden border border-border bg-muted/20 shadow-inner">
                  <Image
                    src={currentCard.backImageUrl}
                    alt="Card back image"
                    fill
                    className="object-contain p-3"
                  />
                </div>
              </div>
            )}
            <div className="flex-1 min-h-0 overflow-y-auto px-8 py-3 flex flex-col justify-center">
              {currentCard.back && <FormattedCardBack text={currentCard.back} />}
            </div>
          </div>
        </div>
      </div>

      {/* Correct / Incorrect buttons — visible only on back side */}
      {isFlipped && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-muted-foreground italic text-center max-w-sm">
            🤝 Be honest with yourself — your growth depends on it. Did you really get it right?
          </p>
        <TooltipProvider>
          <div className="flex items-center gap-4">
            <Tooltip>
              <TooltipTrigger>
                <Button
                  size="lg"
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleCorrect}
                >
                  <CheckCircle className="h-5 w-5" />
                  Correct
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Click if you answered correctly</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger>
                <Button
                  size="lg"
                  variant="destructive"
                  className="gap-2"
                  onClick={handleIncorrect}
                >
                  <XCircle className="h-5 w-5" />
                  Incorrect
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Click if you answered incorrectly</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
        </div>
      )}

      {/* Navigation controls */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="lg"
          className="gap-2"
          onClick={handlePrevious}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>

        <Button
          variant="secondary"
          size="lg"
          className="gap-2 min-w-28"
          onClick={handleFlip}
        >
          <RefreshCw className="h-4 w-4" />
          {isFlipped ? "Unflip" : "Flip"}
        </Button>

        <Button
          variant="outline"
          size="lg"
          className="gap-2"
          onClick={handleNext}
          disabled={currentIndex === total - 1}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
