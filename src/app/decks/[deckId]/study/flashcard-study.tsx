"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { FormattedCardAnswer } from "@/components/formatted-card-answer";
import { FormattedCardFront } from "@/components/formatted-card-front";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  ChevronLeft,
  ChevronRight,
  Shuffle,
  RefreshCw,
  RotateCcw,
  ArrowLeft,
  Trophy,
  Flag,
} from "lucide-react";
import { SpeakButton, VoiceSelector, type TtsVoice } from "@/components/speak-button";
import { ImageEnlargeOverlay } from "@/components/image-enlarge-overlay";
import { getGradientBySlug } from "@/lib/deck-gradients";
import { cn } from "@/lib/utils";


type CardData = {
  id: number;
  front: string | null;
  frontImageUrl?: string | null;
  back: string | null;
  backImageUrl?: string | null;
};

const MAGIC_SPARKLE_POSITIONS = [
  { left: "12%", top: "18%" },
  { left: "82%", top: "14%" },
  { left: "68%", top: "72%" },
  { left: "22%", top: "78%" },
  { left: "48%", top: "10%" },
  { left: "90%", top: "48%" },
  { left: "8%", top: "52%" },
  { left: "55%", top: "88%" },
] as const;

function MagicAnswerAmbience({ revealKey }: { revealKey: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div
        key={`aura-${revealKey}`}
        className="magic-aura-burst animate-magic-aura-burst absolute inset-0"
      />
      {MAGIC_SPARKLE_POSITIONS.map((pos, i) => (
        <span
          key={`${revealKey}-${i}`}
          className="magic-sparkle-particle"
          style={{
            left: pos.left,
            top: pos.top,
            animationDelay: `${0.35 + i * 0.14}s`,
          }}
        />
      ))}
    </div>
  );
}

interface FlashcardStudyProps {
  cards: CardData[];
  deckId: number;
  deckName: string;
  deckGradient?: string | null;
  hasAiReading?: boolean;
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const SLIDE_MS = 260;

export function FlashcardStudy({
  cards,
  deckId,
  deckName,
  deckGradient,
  hasAiReading = false,
}: FlashcardStudyProps) {
  const router = useRouter();
  const cardGradient = getGradientBySlug(deckGradient);
  const hasGradient = cardGradient.slug !== "none";
  const [deck, setDeck] = useState<CardData[]>(cards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visibleIndex, setVisibleIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [answerRevealKey, setAnswerRevealKey] = useState(0);
  const [voice, setVoice] = useState<TtsVoice>("nova");
  const [sessionComplete, setSessionComplete] = useState(false);
  const [autoShuffle, setAutoShuffle] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [slideX, setSlideX] = useState(0);
  const [slideOpacity, setSlideOpacity] = useState(1);
  const [enableSlideTransition, setEnableSlideTransition] = useState(false);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [isDragSnapBack, setIsDragSnapBack] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<{
    src: string;
    title: string;
    alt: string;
  } | null>(null);
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

  useEffect(() => {
    setEnlargedImage(null);
  }, [visibleIndex]);

  function handleFlip() {
    setIsFlipped((prev) => {
      if (!prev) setAnswerRevealKey((k) => k + 1);
      return !prev;
    });
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
    if (currentIndex === total - 1) {
      setReviewedCount(total);
      setIsFlipped(false);
      setSessionComplete(true);
      return;
    }
    setReviewedCount((c) => Math.max(c, currentIndex + 1));
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

  function handleFinish() {
    if (pendingNavRef.current) clearTimeout(pendingNavRef.current);
    setReviewedCount(Math.max(reviewedCount, currentIndex + 1));
    setIsFlipped(false);
    setSessionComplete(true);
  }

  function handleStudyAgain() {
    if (pendingNavRef.current) clearTimeout(pendingNavRef.current);
    resetSlide();
    setDeck(shuffleArray(cards));
    setCurrentIndex(0);
    setVisibleIndex(0);
    setIsFlipped(false);
    setReviewedCount(0);
    setSessionComplete(false);
  }

  if (sessionComplete) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 sm:gap-8 px-4">
        <div className="w-full max-w-md flex flex-col items-center gap-4 sm:gap-6 rounded-xl sm:rounded-2xl border bg-card p-6 sm:p-10 shadow-md text-center">
          <div className="flex flex-col items-center gap-2">
            <Trophy className="h-10 w-10 sm:h-12 sm:w-12 text-yellow-500" />
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Session Complete!</h2>
            <p className="text-muted-foreground text-sm break-words max-w-full">{deckName}</p>
            <p className="text-sm text-muted-foreground mt-2 px-4">
              Nice work reviewing offline-friendly Standard Review. Use AI Recall™ when you are
              online for scored Active Recall practice.
            </p>
          </div>

          <p className="text-muted-foreground text-sm">
            {Math.max(reviewedCount, total)} of {total} card{total !== 1 ? "s" : ""} reviewed
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
        <div className="flex items-center justify-end gap-3 mt-1">
          {hasAiReading ? <VoiceSelector voice={voice} onChange={setVoice} /> : null}
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
        className="w-full max-w-xl select-none"
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
        className={cn(
          dragOffsetX === 0 && !enableSlideTransition && "animate-flashcard-float",
        )}
      >
      <div
        key={visibleIndex}
        className="animate-flashcard-enter"
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
            className={cn(
              "absolute inset-0 flex flex-col rounded-xl sm:rounded-2xl shadow-md overflow-hidden min-h-[220px] sm:min-h-[300px] md:h-[380px] animate-flashcard-shimmer",
              hasGradient
                ? cn(cardGradient.classes, "border border-white/20")
                : "bg-card border",
            )}
          >
            <div className="flex items-center justify-between px-3 sm:px-5 pt-3 sm:pt-4 pb-2 shrink-0">
              <Badge variant="secondary" className={cn("text-xs", hasGradient && "bg-white/20 text-white border-white/30")}>Front</Badge>
              <span className={cn("text-xs hidden sm:inline", hasGradient ? "text-white/70" : "text-muted-foreground")}>Click to reveal answer</span>
            </div>
            {currentCard.frontImageUrl && (
              <div className="shrink-0 px-3 sm:px-6 pb-2">
                <button
                  type="button"
                  className="relative w-full h-28 sm:h-40 md:h-48 rounded-lg overflow-hidden border border-border bg-muted/20 shadow-inner cursor-zoom-in transition-[box-shadow] hover:ring-2 hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title="Double-click to enlarge"
                  aria-label="Double-click to enlarge front image"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                  onDoubleClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setEnlargedImage({
                      src: currentCard.frontImageUrl!,
                      title: "Front image",
                      alt: "Card front image",
                    });
                  }}
                >
                  <Image
                    src={currentCard.frontImageUrl}
                    alt="Card front image"
                    fill
                    className="object-contain p-2 sm:p-3 pointer-events-none"
                    draggable={false}
                  />
                </button>
              </div>
            )}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 py-3 flex flex-col justify-start">
              {currentCard.front && (
                <FormattedCardFront
                  text={currentCard.front}
                  variant="study"
                  hasGradient={hasGradient}
                />
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
            className={cn(
              "absolute inset-0 flex flex-col rounded-xl sm:rounded-2xl shadow-md overflow-hidden min-h-[220px] sm:min-h-[300px] md:h-[380px] animate-flashcard-shimmer",
              hasGradient
                ? cn(cardGradient.classes, "border border-white/20")
                : "bg-card border",
            )}
          >
            {isFlipped && <MagicAnswerAmbience revealKey={answerRevealKey} />}
            <div className="flex items-center justify-between px-3 sm:px-5 pt-3 sm:pt-4 pb-2 shrink-0 relative z-10">
              <Badge variant="outline" className={cn("text-xs", hasGradient && "bg-white/20 text-white border-white/30")}>Back</Badge>
              <span className={cn("text-xs hidden sm:inline", hasGradient ? "text-white/70" : "text-muted-foreground")}>Click to flip back</span>
            </div>
            {currentCard.backImageUrl && (
              <div className="shrink-0 px-3 sm:px-6 pb-2 relative z-10">
                <button
                  type="button"
                  className="relative w-full h-28 sm:h-40 md:h-48 rounded-lg overflow-hidden border border-border bg-muted/20 shadow-inner cursor-zoom-in transition-[box-shadow] hover:ring-2 hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title="Double-click to enlarge"
                  aria-label="Double-click to enlarge back image"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                  onDoubleClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setEnlargedImage({
                      src: currentCard.backImageUrl!,
                      title: "Back image",
                      alt: "Card back image",
                    });
                  }}
                >
                  <Image
                    src={currentCard.backImageUrl}
                    alt="Card back image"
                    fill
                    className="object-contain p-2 sm:p-3 pointer-events-none"
                    draggable={false}
                  />
                </button>
              </div>
            )}
            <div className="relative z-10 flex min-h-0 flex-1 flex-col justify-start overflow-y-auto px-4 py-3 sm:px-8">
              {currentCard.back && (
                <FormattedCardAnswer
                  text={currentCard.back}
                  variant="study"
                  hasGradient={hasGradient}
                  revealKey={answerRevealKey}
                />
              )}
            </div>
          </div>
        </div>
      </div>
      </div>
      </div>

      {/* Listen row — outside the card so clicks never trigger the flip */}
      {hasAiReading && (currentCard.front || currentCard.back) && (
        <div className="flex items-center justify-center gap-3">
          {!isFlipped && currentCard.front && (
            <SpeakButton
              text={currentCard.front}
              voice={voice}
              stopKey={currentIndex}
              className="flex items-center gap-1.5 h-8 px-3 rounded-full border border-border bg-background text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-all w-auto"
              label="Question"
            />
          )}
          {isFlipped && currentCard.back && (
            <SpeakButton
              text={currentCard.back}
              voice={voice}
              stopKey={currentIndex}
              className="flex items-center gap-1.5 h-8 px-3 rounded-full border border-border bg-background text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-all w-auto"
              label="Answer"
            />
          )}
        </div>
      )}

      {/* Navigation controls — flip to reveal, then Next (no self-grading). */}
      <div className="flex flex-col items-center gap-2 sm:gap-3">
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
          >
            <span className="hidden sm:inline">
              {currentIndex === total - 1 ? "Finish" : "Next"}
            </span>
            <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
        </div>

        <Button
          size="default"
          className="gap-2 h-10 sm:h-11 px-4 sm:px-6 text-sm"
          onClick={handleFinish}
        >
          <Flag className="h-4 w-4" />
          Finish Review
        </Button>
      </div>

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
