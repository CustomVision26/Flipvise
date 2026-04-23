"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type CardData = {
  id: number;
  front: string | null;
  frontImageUrl: string | null;
  back: string | null;
  backImageUrl: string | null;
  aiGenerated: boolean;
};

interface DeckPreviewCarouselProps {
  deckName: string;
  cards: CardData[];
  open: boolean;
  onClose: () => void;
}

export function DeckPreviewCarousel({
  deckName,
  cards,
  open,
  onClose,
}: DeckPreviewCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [isClosing, setIsClosing] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  // Refs to avoid stale closures in keyboard handler
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;
  const cardsLengthRef = useRef(cards.length);
  cardsLengthRef.current = cards.length;

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 180);
  }, [onClose]);

  const goNext = useCallback(() => {
    if (currentIndexRef.current >= cardsLengthRef.current - 1) return;
    setCurrentIndex((i) => i + 1);
    setAnimKey((k) => k + 1);
  }, []);

  const goBack = useCallback(() => {
    if (currentIndexRef.current <= 0) return;
    setCurrentIndex((i) => i - 1);
    setAnimKey((k) => k + 1);
  }, []);

  const navigateTo = useCallback((index: number) => {
    if (index === currentIndexRef.current) return;
    setCurrentIndex(index);
    setAnimKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (open) {
      setCurrentIndex(0);
      setAnimKey(0);
      setIsClosing(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") goBack();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "Escape") handleClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, goBack, goNext, handleClose]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open || cards.length === 0) return null;

  const progress = ((currentIndex + 1) / cards.length) * 100;
  const showDots = cards.length <= 12;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 bg-background flex flex-col",
        isClosing
          ? "animate-out fade-out zoom-out-[0.98] duration-[180ms] fill-mode-forwards"
          : "animate-in fade-in zoom-in-[0.98] duration-300 fill-mode-both",
      )}
      role="dialog"
      aria-modal="true"
      aria-label={`Preview: ${deckName}`}
    >
      {/* Header — slides down */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0 animate-in fade-in slide-in-from-top-3 duration-300 fill-mode-both">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-base sm:text-lg truncate">{deckName}</h2>
          <p className="text-xs text-muted-foreground tabular-nums">
            Card {currentIndex + 1} of {cards.length}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 ml-3">
          <Button
            variant="outline"
            onClick={handleClose}
            className="gap-1.5 h-9 px-3 text-sm font-medium transition-all duration-150 hover:scale-105 active:scale-95"
            aria-label="Close preview"
          >
            <X className="size-4" />
            <span className="hidden sm:inline">Close</span>
          </Button>
        </div>
      </div>

      {/* Progress bar — smooth fill on navigation */}
      <Progress
        value={progress}
        className="h-[3px] rounded-none shrink-0 [&>*]:transition-all [&>*]:duration-500 [&>*]:ease-out"
      />

      {/* Carousel area */}
      <div className="flex-1 min-h-0 flex items-center animate-in fade-in duration-400 delay-100 fill-mode-both">
        {/* Left arrow */}
        <button
          onClick={goBack}
          disabled={currentIndex === 0}
          className={cn(
            "shrink-0 flex items-center justify-center",
            "w-9 h-9 sm:w-11 sm:h-11 mx-1 sm:mx-3 rounded-full",
            "border border-border bg-background shadow-sm",
            "transition-all duration-150",
            "hover:bg-muted hover:scale-110 hover:shadow-md",
            "active:scale-[0.88] active:shadow-sm",
            "disabled:opacity-20 disabled:cursor-not-allowed",
            "disabled:hover:scale-100 disabled:hover:shadow-sm disabled:hover:bg-background",
          )}
          aria-label="Previous card"
        >
          <ChevronLeft className="size-4 sm:size-5 transition-transform duration-150 group-hover:-translate-x-0.5" />
        </button>

        {/* Slides track */}
        <div
          className="flex-1 min-h-0 overflow-hidden h-full"
          onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchStartX === null) return;
            const delta = touchStartX - e.changedTouches[0].clientX;
            if (delta > 50) goNext();
            if (delta < -50) goBack();
            setTouchStartX(null);
          }}
        >
          <div
            className="flex h-full transition-transform duration-[380ms] ease-[cubic-bezier(0.35,0,0.15,1)]"
            style={{ transform: `translateX(-${currentIndex * 100}%)` }}
          >
            {cards.map((card, i) => (
              <div
                key={card.id}
                className="w-full flex-none h-full overflow-y-auto flex justify-center py-4 px-2"
              >
                <div className="w-full max-w-lg">
                  <CardSlide
                    card={card}
                    animKey={i === currentIndex ? animKey : -1}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right arrow */}
        <button
          onClick={goNext}
          disabled={currentIndex === cards.length - 1}
          className={cn(
            "shrink-0 flex items-center justify-center",
            "w-9 h-9 sm:w-11 sm:h-11 mx-1 sm:mx-3 rounded-full",
            "border border-border bg-background shadow-sm",
            "transition-all duration-150",
            "hover:bg-muted hover:scale-110 hover:shadow-md",
            "active:scale-[0.88] active:shadow-sm",
            "disabled:opacity-20 disabled:cursor-not-allowed",
            "disabled:hover:scale-100 disabled:hover:shadow-sm disabled:hover:bg-background",
          )}
          aria-label="Next card"
        >
          <ChevronRight className="size-4 sm:size-5 transition-transform duration-150 group-hover:translate-x-0.5" />
        </button>
      </div>

      {/* Footer — slides up */}
      <div className="shrink-0 flex flex-col items-center gap-2 py-3 sm:py-4 border-t border-border animate-in fade-in slide-in-from-bottom-3 duration-300 delay-100 fill-mode-both">
        {showDots ? (
          <div className="flex items-center gap-1.5 flex-wrap justify-center px-4">
            {cards.map((_, i) => (
              <button
                key={i}
                onClick={() => navigateTo(i)}
                aria-label={`Go to card ${i + 1}`}
                className={cn(
                  "rounded-full transition-all duration-300 ease-[cubic-bezier(0.35,0,0.15,1)]",
                  i === currentIndex
                    ? "w-6 h-2 bg-primary"
                    : "w-2 h-2 bg-muted-foreground/30 hover:bg-muted-foreground/60 hover:scale-125",
                )}
              />
            ))}
          </div>
        ) : (
          <span className="text-sm font-medium tabular-nums text-muted-foreground">
            {currentIndex + 1} / {cards.length}
          </span>
        )}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClose}
            className="gap-1.5 sm:hidden transition-all duration-150 hover:scale-105 active:scale-95"
          >
            <X className="size-3.5" />
            Close Preview
          </Button>
          <p className="text-[11px] text-muted-foreground/50 hidden sm:block">
            Use ← → arrow keys or swipe to navigate · Esc to close
          </p>
        </div>
      </div>
    </div>
  );
}

function CardSlide({ card, animKey }: { card: CardData; animKey: number }) {
  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {/* Question — slides in from top */}
      <div
        key={`q-${animKey}`}
        className="rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-6 animate-in fade-in slide-in-from-top-5 duration-500 fill-mode-both"
      >
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-1 h-4 rounded-full bg-primary shrink-0" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
            Question
          </span>
          {card.aiGenerated && (
            <Badge
              variant="outline"
              className="gap-1 px-1.5 py-0 text-[10px] font-normal"
            >
              <Sparkles className="size-3 text-primary" />
              AI
            </Badge>
          )}
        </div>
        {card.front ? (
          <p className="text-foreground text-base sm:text-lg font-medium leading-relaxed whitespace-pre-line">
            {card.front}
          </p>
        ) : (
          <p className="text-muted-foreground italic text-sm">No question text</p>
        )}
        {card.frontImageUrl && (
          <div className="relative mt-3 h-36 sm:h-48 rounded-xl overflow-hidden border border-border bg-muted/30">
            <Image
              src={card.frontImageUrl}
              alt="Question image"
              fill
              className="object-contain p-2"
            />
          </div>
        )}
      </div>

      {/* Divider — fades in with delay */}
      <div
        key={`d-${animKey}`}
        className="flex items-center gap-3 px-1 animate-in fade-in duration-500 delay-150 fill-mode-both"
      >
        <div className="flex-1 h-px bg-border" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground select-none">
          Answer
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Answer — slides in from bottom with delay */}
      <div
        key={`a-${animKey}`}
        className="rounded-2xl border border-border bg-muted/30 p-4 sm:p-6 animate-in fade-in slide-in-from-bottom-5 duration-500 delay-200 fill-mode-both"
      >
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-1 h-4 rounded-full bg-muted-foreground/50 shrink-0" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Answer
          </span>
        </div>
        {card.back ? (
          <p className="text-foreground text-sm sm:text-base leading-relaxed whitespace-pre-line">
            {card.back}
          </p>
        ) : (
          <p className="text-muted-foreground italic text-sm">No answer text</p>
        )}
        {card.backImageUrl && (
          <div className="relative mt-3 h-36 sm:h-48 rounded-xl overflow-hidden border border-border bg-muted/30">
            <Image
              src={card.backImageUrl}
              alt="Answer image"
              fill
              className="object-contain p-2"
            />
          </div>
        )}
      </div>
    </div>
  );
}
