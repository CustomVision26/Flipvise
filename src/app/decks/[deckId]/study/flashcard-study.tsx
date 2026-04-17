"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
      <p className="text-center text-base sm:text-xl font-semibold leading-relaxed break-words">{text}</p>
    );
  }

  return (
    <div className="w-full space-y-1.5 text-left">
      {lines.map((line, i) => {
        if (/^Step\s*\d+:/i.test(line)) {
          return (
            <p key={i} className="font-semibold text-xs sm:text-sm text-primary pt-2 first:pt-0 break-words">
              {line}
            </p>
          );
        }
        if (/^(Answer|Result|Solution|∴)[\s:]*/i.test(line)) {
          return (
            <p key={i} className="font-bold text-xs sm:text-sm text-emerald-400 pt-3 mt-1 border-t border-border break-words">
              {line}
            </p>
          );
        }
        return (
          <p key={i} className="text-[10px] sm:text-xs font-mono text-foreground pl-2 sm:pl-3 leading-relaxed break-words">
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
const SLIDE_MS = 260;

export function FlashcardStudy({ cards, deckId, deckName }: FlashcardStudyProps) {
  const router = useRouter();
  const [deck, setDeck] = useState<CardData[]>(cards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visibleIndex, setVisibleIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [autoShuffle, setAutoShuffle] = useState(false);
  const [slideX, setSlideX] = useState(0);
  const [slideOpacity, setSlideOpacity] = useState(1);
  const [enableSlideTransition, setEnableSlideTransition] = useState(false);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [isDragSnapBack, setIsDragSnapBack] = useState(false);
  const dragStartXRef = useRef<number | null>(null);
  const hasDraggedRef = useRef(false);
  const pendingNavRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapBackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const total = deck.length;
  const currentCard = deck[visibleIndex];
  const progressPercent = ((currentIndex + 1) / total) * 100;

  function navigateTo(newIndex: number, direction: "left" | "right") {
    if (pendingNavRef.current) clearTimeout(pendingNavRef.current);
    setCurrentIndex(newIndex);

    // Phase 1: slide + fade out
    setEnableSlideTransition(true);
    setSlideX(direction === "left" ? -35 : 35);
    setSlideOpacity(0);

    pendingNavRef.current = setTimeout(() => {
      // Phase 2: reset flip, update content, snap to opposite side (invisible)
      setEnableSlideTransition(false);
      setIsFlipped(false);
      setVisibleIndex(newIndex);
      setSlideX(direction === "left" ? 35 : -35);

      // Phase 3: slide + fade in from opposite side
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setEnableSlideTransition(true);
          setSlideX(0);
          setSlideOpacity(1);
        });
      });
    }, SLIDE_MS);
  }

  useEffect(() => {
    return () => {
      if (pendingNavRef.current) clearTimeout(pendingNavRef.current);
      if (snapBackTimerRef.current) clearTimeout(snapBackTimerRef.current);
    };
  }, []);

  function handleFlip() {
    setIsFlipped((prev) => !prev);
  }

  const SWIPE_THRESHOLD = 60;

  function snapBack() {
    if (snapBackTimerRef.current) clearTimeout(snapBackTimerRef.current);
    setIsDragSnapBack(true);
    setDragOffsetX(0);
    snapBackTimerRef.current = setTimeout(() => setIsDragSnapBack(false), 220);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (enableSlideTransition) return;
    if (snapBackTimerRef.current) clearTimeout(snapBackTimerRef.current);
    setIsDragSnapBack(false);
    dragStartXRef.current = e.clientX;
    hasDraggedRef.current = false;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (dragStartXRef.current === null) return;
    const delta = e.clientX - dragStartXRef.current;
    if (Math.abs(delta) > 8) hasDraggedRef.current = true;
    setDragOffsetX(delta);
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (dragStartXRef.current === null) return;
    const delta = e.clientX - dragStartXRef.current;
    dragStartXRef.current = null;

    if (Math.abs(delta) >= SWIPE_THRESHOLD) {
      setDragOffsetX(0);
      if (delta < 0 && currentIndex < total - 1) {
        navigateTo(currentIndex + 1, "left");
      } else if (delta > 0 && currentIndex > 0) {
        navigateTo(currentIndex - 1, "right");
      } else {
        snapBack();
      }
    } else {
      snapBack();
    }
  }

  function handlePointerCancel() {
    dragStartXRef.current = null;
    snapBack();
  }

  function handleCardClick() {
    if (hasDraggedRef.current) {
      hasDraggedRef.current = false;
      return;
    }
    handleFlip();
  }

  function handlePrevious() {
    if (currentIndex === 0) return;
    navigateTo(currentIndex - 1, "right");
  }

  function handleNext() {
    if (currentIndex === total - 1) return;
    navigateTo(currentIndex + 1, "left");
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

  function resetSlide() {
    setSlideX(0);
    setSlideOpacity(1);
    setEnableSlideTransition(false);
  }

  useEffect(() => {
    if (pendingNavRef.current) clearTimeout(pendingNavRef.current);
    resetSlide();
    if (autoShuffle) {
      setDeck(shuffleArray(cards));
    } else {
      setDeck(cards);
    }
    setCurrentIndex(0);
    setVisibleIndex(0);
    setIsFlipped(false);
  }, [autoShuffle]);

  function handleShuffle() {
    if (pendingNavRef.current) clearTimeout(pendingNavRef.current);
    resetSlide();
    setDeck(shuffleArray(cards));
    setCurrentIndex(0);
    setVisibleIndex(0);
    setIsFlipped(false);
  }

  function handleCorrect() {
    setCorrectCount((c) => c + 1);
    if (currentIndex < total - 1) {
      navigateTo(currentIndex + 1, "left");
    } else {
      setIsFlipped(false);
      pendingNavRef.current = setTimeout(() => setSessionComplete(true), FLIP_DURATION_MS);
    }
  }

  function handleIncorrect() {
    setIncorrectCount((c) => c + 1);
    if (currentIndex < total - 1) {
      navigateTo(currentIndex + 1, "left");
    } else {
      setIsFlipped(false);
      pendingNavRef.current = setTimeout(() => setSessionComplete(true), FLIP_DURATION_MS);
    }
  }

  function handleStudyAgain() {
    if (pendingNavRef.current) clearTimeout(pendingNavRef.current);
    resetSlide();
    setDeck(shuffleArray(cards));
    setCurrentIndex(0);
    setVisibleIndex(0);
    setIsFlipped(false);
    setCorrectCount(0);
    setIncorrectCount(0);
    setSessionComplete(false);
  }

  if (sessionComplete) {
    const scorePercent = total > 0 ? Math.round((correctCount / total) * 100) : 0;

    let motivationalMessage = "";
    let messageColor = "";
    if (scorePercent === 100) {
      motivationalMessage = "Perfect score! You've mastered this deck!";
      messageColor = "text-yellow-500";
    } else if (scorePercent >= 50) {
      motivationalMessage = "Great progress! Keep practicing to reach perfection!";
      messageColor = "text-blue-400";
    } else {
      motivationalMessage = "Don't give up! Every mistake is a step toward mastery!";
      messageColor = "text-purple-400";
    }

    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 sm:gap-8 px-4">
        <div className="w-full max-w-md flex flex-col items-center gap-4 sm:gap-6 rounded-xl sm:rounded-2xl border bg-card p-6 sm:p-10 shadow-md text-center">
          <div className="flex flex-col items-center gap-2">
            <Trophy className="h-10 w-10 sm:h-12 sm:w-12 text-yellow-500" />
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Session Complete!</h2>
            <p className="text-muted-foreground text-sm break-words max-w-full">{deckName}</p>
            <p className={`text-sm sm:text-base font-semibold ${messageColor} mt-2 px-4`}>
              {motivationalMessage}
            </p>
          </div>

          <div className="w-full flex flex-col gap-2">
            <div className="flex justify-between text-sm text-muted-foreground mb-1">
              <span>Score</span>
              <span className="font-semibold text-foreground">{scorePercent}%</span>
            </div>
            <Progress value={scorePercent} className="h-3" />
          </div>

          <div className="w-full grid grid-cols-2 gap-3 sm:gap-4">
            <div className="flex flex-col items-center gap-1 rounded-xl border bg-emerald-500/10 border-emerald-500/20 py-3 sm:py-4">
              <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-500" />
              <span className="text-xl sm:text-2xl font-bold text-emerald-500">{correctCount}</span>
              <span className="text-xs text-muted-foreground">Correct</span>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-xl border bg-rose-500/10 border-rose-500/20 py-3 sm:py-4">
              <XCircle className="h-5 w-5 sm:h-6 sm:w-6 text-rose-500" />
              <span className="text-xl sm:text-2xl font-bold text-rose-500">{incorrectCount}</span>
              <span className="text-xs text-muted-foreground">Incorrect</span>
            </div>
          </div>

          <p className="text-muted-foreground text-sm">
            {total} card{total !== 1 ? "s" : ""} studied
          </p>

          <div className="w-full flex flex-col gap-3">
            <Button size="default" className="w-full gap-2 h-10 sm:h-11" onClick={handleStudyAgain}>
              <RotateCcw className="h-4 w-4" />
              Study Again
            </Button>
            <Button
              variant="outline"
              size="default"
              className="w-full gap-2 h-10 sm:h-11"
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
    <div className="flex flex-1 flex-col items-center gap-4 sm:gap-8">
      {/* Progress bar */}
      <div className="w-full max-w-2xl flex flex-col gap-2">
        <div className="flex justify-between items-center text-xs sm:text-sm text-muted-foreground">
          <span>
            Card {currentIndex + 1} of {total}
          </span>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-xs sm:text-sm font-semibold text-foreground">
              {Math.round(progressPercent)}%
            </span>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Switch
                id="auto-shuffle"
                checked={autoShuffle}
                onCheckedChange={setAutoShuffle}
                className="scale-75 sm:scale-100"
              />
              <label
                htmlFor="auto-shuffle"
                className="text-xs sm:text-sm text-muted-foreground cursor-pointer select-none"
              >
                Auto Shuffle
              </label>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-0 text-xs sm:text-sm text-muted-foreground hover:text-foreground"
              onClick={handleShuffle}
              disabled={autoShuffle}
            >
              <Shuffle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              <span className="hidden sm:inline">Shuffle</span>
            </Button>
          </div>
        </div>
        <Progress value={progressPercent} className="h-2" />
        <div className="flex items-center gap-3 sm:gap-4 mt-1">
          <div className="flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm text-emerald-500">
            <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="font-semibold">{correctCount}</span>
            <span className="text-muted-foreground hidden sm:inline">correct</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm text-rose-500">
            <XCircle className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="font-semibold">{incorrectCount}</span>
            <span className="text-muted-foreground hidden sm:inline">incorrect</span>
          </div>
        </div>
      </div>

      {/* Hint */}
      <p className="text-muted-foreground text-xs sm:text-sm md:hidden text-center">
        Swipe left / right to navigate · Tap to flip
      </p>
      <p className="text-muted-foreground text-xs sm:text-sm hidden md:block">
        Use <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">←</kbd>{" "}
        <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">→</kbd>{" "}
        arrow keys to navigate and{" "}
        <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">Space</kbd>{" "}
        to flip · or drag the card
      </p>

      {/* Flashcard */}
      <div
        className="w-full max-w-2xl select-none"
        style={{
          transform: `translateX(calc(${slideX}% + ${dragOffsetX}px))`,
          opacity: slideOpacity,
          transition: enableSlideTransition
            ? `transform ${SLIDE_MS}ms cubic-bezier(0.4, 0, 0.2, 1), opacity ${SLIDE_MS}ms ease`
            : isDragSnapBack
            ? "transform 200ms cubic-bezier(0.25, 0.46, 0.45, 0.94)"
            : "none",
          touchAction: "pan-y",
          cursor: dragOffsetX !== 0 ? "grabbing" : "grab",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClick={handleCardClick}
        role="button"
        aria-label={isFlipped ? "Card back — click to flip" : "Card front — click to flip"}
      >
      <div
        style={{ perspective: "1200px" }}
      >
        <div
          className="flashcard-container"
          style={{
            transformStyle: "preserve-3d",
            transition: "transform 0.55s cubic-bezier(0.45, 0, 0.55, 1)",
            transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
            position: "relative",
          }}
        >
          {/* Front */}
          <div
            style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
            className="absolute inset-0 flex flex-col rounded-xl sm:rounded-2xl border bg-card shadow-md overflow-hidden min-h-[300px] sm:min-h-[400px] md:h-[540px]"
          >
            <div className="flex items-center justify-between px-3 sm:px-5 pt-3 sm:pt-4 pb-2 shrink-0">
              <Badge variant="secondary" className="text-xs">Front</Badge>
              <span className="text-muted-foreground text-xs hidden sm:inline">Click to reveal answer</span>
            </div>
            {currentCard.frontImageUrl && (
              <div className="shrink-0 px-3 sm:px-6 pb-2">
                <div className="relative w-full h-40 sm:h-60 md:h-72 rounded-lg overflow-hidden border border-border bg-muted/20 shadow-inner">
                  <Image
                    src={currentCard.frontImageUrl}
                    alt="Card front image"
                    fill
                    className="object-contain p-2 sm:p-3"
                  />
                </div>
              </div>
            )}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 py-3 flex flex-col items-center justify-center">
              {currentCard.front && (
                <p className="text-center text-base sm:text-xl font-semibold leading-relaxed break-words">
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
            className="absolute inset-0 flex flex-col rounded-xl sm:rounded-2xl border bg-card shadow-md overflow-hidden min-h-[300px] sm:min-h-[400px] md:h-[540px]"
          >
            <div className="flex items-center justify-between px-3 sm:px-5 pt-3 sm:pt-4 pb-2 shrink-0">
              <Badge variant="outline" className="text-xs">Back</Badge>
              <span className="text-muted-foreground text-xs hidden sm:inline">Click to flip back</span>
            </div>
            {currentCard.backImageUrl && (
              <div className="shrink-0 px-3 sm:px-6 pb-2">
                <div className="relative w-full h-40 sm:h-60 md:h-72 rounded-lg overflow-hidden border border-border bg-muted/20 shadow-inner">
                  <Image
                    src={currentCard.backImageUrl}
                    alt="Card back image"
                    fill
                    className="object-contain p-2 sm:p-3"
                  />
                </div>
              </div>
            )}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 py-3 flex flex-col justify-center">
              {currentCard.back && <FormattedCardBack text={currentCard.back} />}
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Correct / Incorrect buttons — visible only on back side */}
      {isFlipped && (
        <div className="flex flex-col items-center gap-2 sm:gap-3">
          <p className="text-xs sm:text-sm text-muted-foreground italic text-center max-w-xs sm:max-w-sm px-4">
            🤝 Be honest with yourself — your growth depends on it. Did you really get it right?
          </p>
        <TooltipProvider>
          <div className="flex items-center gap-3 sm:gap-4">
            <Tooltip>
              <TooltipTrigger render={<span />}>
                <Button
                  size="default"
                  className="gap-1.5 sm:gap-2 bg-emerald-600 hover:bg-emerald-700 text-white h-10 sm:h-11 px-4 sm:px-6 text-sm"
                  onClick={handleCorrect}
                >
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="hidden sm:inline">Correct</span>
                  <span className="sm:hidden">✓</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Click if you answered correctly</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger render={<span />}>
                <Button
                  size="default"
                  variant="destructive"
                  className="gap-1.5 sm:gap-2 h-10 sm:h-11 px-4 sm:px-6 text-sm"
                  onClick={handleIncorrect}
                >
                  <XCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="hidden sm:inline">Incorrect</span>
                  <span className="sm:hidden">✗</span>
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
      <div className="flex items-center gap-2 sm:gap-3">
        <Button
          variant="outline"
          size="default"
          className="gap-1 sm:gap-2 h-10 sm:h-11 px-3 sm:px-4 text-xs sm:text-sm"
          onClick={handlePrevious}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline">Previous</span>
        </Button>

        <Button
          variant="secondary"
          size="default"
          className="gap-1 sm:gap-2 min-w-20 sm:min-w-28 h-10 sm:h-11 px-3 sm:px-4 text-xs sm:text-sm"
          onClick={handleFlip}
        >
          <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4" />
          {isFlipped ? "Unflip" : "Flip"}
        </Button>

        <Button
          variant="outline"
          size="default"
          className="gap-1 sm:gap-2 h-10 sm:h-11 px-3 sm:px-4 text-xs sm:text-sm"
          onClick={handleNext}
          disabled={currentIndex === total - 1}
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
        </Button>
      </div>
    </div>
  );
}
