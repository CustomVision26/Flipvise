"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { FormattedCardFront } from "@/components/formatted-card-front";
import { useIllustratedAppearance } from "@/components/illustrated-appearance-provider";
import {
  SpeakButton,
  VoiceSelector,
  type TtsVoice,
} from "@/components/speak-button";

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
  hasAiReading?: boolean;
}

export function DeckPreviewCarousel({
  deckName,
  cards,
  open,
  onClose,
  hasAiReading = false,
}: DeckPreviewCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [voice, setVoice] = useState<TtsVoice>("nova");
  const { effectiveIllustratedDesign } = useIllustratedAppearance();
  const glossy = effectiveIllustratedDesign;

  // Refs to avoid stale closures in keyboard handler
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;
  const cardsLengthRef = useRef(cards.length);
  cardsLengthRef.current = cards.length;

  const handleClose = useCallback(() => {
    onClose();
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
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") goBack();
      if (e.key === "ArrowRight") goNext();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, goBack, goNext]);

  if (!open || cards.length === 0) return null;

  const progress = ((currentIndex + 1) / cards.length) * 100;
  const showDots = cards.length <= 12;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex h-[min(92dvh,52rem)] w-full max-w-[min(96vw,56rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl",
          glossy && "illustrated-preview border-0 bg-transparent shadow-none ring-0",
        )}
        aria-label={`Preview: ${deckName}`}
      >
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          glossy ? "illustrated-preview-frame" : "bg-background",
        )}
      >
      {/* Header — slides down */}
      <div
        className={cn(
          "flex shrink-0 items-center justify-between px-4 py-3 animate-in fade-in slide-in-from-top-3 duration-300 fill-mode-both",
          glossy ? "border-b-0" : "border-b border-border",
        )}
      >
        <div className="min-w-0 flex-1 pr-2">
          <DialogTitle
            className={cn(
              "truncate text-base font-semibold sm:text-lg",
              glossy && "text-white",
            )}
          >
            {deckName}
          </DialogTitle>
          <DialogDescription
            className={cn("text-xs tabular-nums", glossy && "text-violet-200")}
          >
            Card {currentIndex + 1} of {cards.length}
          </DialogDescription>
        </div>
        <div className="ml-3 flex shrink-0 items-center gap-2">
          {hasAiReading ? <VoiceSelector voice={voice} onChange={setVoice} /> : null}

          <Button
            variant="outline"
            onClick={handleClose}
            className={cn(
              "h-9 gap-1.5 px-3 text-sm font-medium transition-all duration-150 hover:scale-105 active:scale-95",
              glossy && "illustrated-preview-close",
            )}
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
        className={cn(
          "shrink-0 [&>*]:transition-all [&>*]:duration-500 [&>*]:ease-out",
          glossy ? "illustrated-preview-progress" : "h-[3px] rounded-none",
        )}
      />

      {/* Carousel area */}
      <div className="flex-1 min-h-0 flex items-center animate-in fade-in duration-400 delay-100 fill-mode-both">
        {/* Left arrow */}
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          onClick={goBack}
          disabled={currentIndex === 0}
          className={cn(
            "mx-1 shrink-0 rounded-full sm:mx-3",
            glossy
              ? "illustrated-preview-nav"
              : "border-border bg-background shadow-sm hover:scale-110",
          )}
          aria-label="Previous card"
        >
          <ChevronLeft className="size-4 sm:size-5" />
        </Button>

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
                    voice={voice}
                    hasAiReading={hasAiReading}
                    glossy={glossy}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right arrow */}
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          onClick={goNext}
          disabled={currentIndex === cards.length - 1}
          className={cn(
            "mx-1 shrink-0 rounded-full sm:mx-3",
            glossy
              ? "illustrated-preview-nav"
              : "border-border bg-background shadow-sm hover:scale-110",
          )}
          aria-label="Next card"
        >
          <ChevronRight className="size-4 sm:size-5" />
        </Button>
      </div>

      {/* Footer — slides up */}
      <div
        className={cn(
          "flex shrink-0 flex-col items-center gap-2 py-3 animate-in fade-in slide-in-from-bottom-3 duration-300 delay-100 fill-mode-both sm:py-4",
          glossy ? "border-t-0" : "border-t border-border",
        )}
      >
        {showDots ? (
          <div
            className={cn(
              "flex flex-wrap items-center justify-center gap-1.5 px-4",
              glossy && "illustrated-preview-dots",
            )}
          >
            {cards.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => navigateTo(i)}
                aria-label={`Go to card ${i + 1}`}
                aria-current={i === currentIndex ? "true" : undefined}
                className={cn(
                  "rounded-full transition-all duration-300 ease-[cubic-bezier(0.35,0,0.15,1)]",
                  i === currentIndex
                    ? "h-2 w-6 bg-primary"
                    : "h-2 w-2 bg-muted-foreground/30 hover:scale-125 hover:bg-muted-foreground/60",
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
            className={cn(
              "gap-1.5 transition-all duration-150 hover:scale-105 active:scale-95 sm:hidden",
              glossy && "illustrated-preview-close",
            )}
          >
            <X className="size-3.5" />
            Close Preview
          </Button>
          <p
            className={cn(
              "hidden text-[11px] sm:block",
              glossy ? "text-violet-200/80" : "text-muted-foreground/50",
            )}
          >
            Use ← → arrow keys or swipe to navigate · Esc to close
          </p>
        </div>
      </div>
      </div>
      </DialogContent>
    </Dialog>
  );
}


function CardSlide({
  card,
  animKey,
  voice,
  hasAiReading,
  glossy,
}: {
  card: CardData;
  animKey: number;
  voice: TtsVoice;
  hasAiReading: boolean;
  glossy: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      <div
        key={`q-${animKey}`}
        className={cn(
          "animate-in fade-in slide-in-from-top-5 fill-mode-both p-4 duration-500 sm:p-6",
          glossy
            ? "illustrated-preview-field"
            : "rounded-2xl border border-primary/20 bg-primary/5",
        )}
      >
        <div className="mb-3 flex items-center gap-2.5">
          {glossy ? (
            <span className="illustrated-preview-pill">Question</span>
          ) : (
            <>
              <div className="h-4 w-1 shrink-0 rounded-full bg-primary" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                Question
              </span>
            </>
          )}
          {card.aiGenerated && (
            <Badge
              variant="outline"
              className={cn(
                "gap-1 px-1.5 py-0 text-[10px] font-normal",
                glossy && "border-violet-200/40 text-violet-100",
              )}
            >
              <Sparkles className="size-3 text-primary" />
              AI
            </Badge>
          )}
          {card.front && hasAiReading ? (
            <SpeakButton text={card.front} stopKey={animKey} voice={voice} className="ml-auto" />
          ) : null}
        </div>
        {card.front ? (
          <FormattedCardFront text={card.front} variant="preview" />
        ) : (
          <p className={cn("text-sm italic", glossy ? "text-violet-200" : "text-muted-foreground")}>
            No question text
          </p>
        )}
        {card.frontImageUrl && (
          <div
            className={cn(
              "relative mt-3 h-36 overflow-hidden rounded-xl border sm:h-48",
              glossy
                ? "illustrated-preview-figure border-transparent"
                : "border-border bg-muted/30",
            )}
          >
            <Image
              src={card.frontImageUrl}
              alt="Question image"
              fill
              className="object-contain p-2"
            />
          </div>
        )}
      </div>

      {glossy ? null : (
        <div
          key={`d-${animKey}`}
          className="flex animate-in items-center gap-3 px-1 fade-in fill-mode-both delay-150 duration-500"
        >
          <div className="h-px flex-1 bg-border" />
          <span className="select-none text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Answer
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>
      )}

      <div
        key={`a-${animKey}`}
        className={cn(
          "animate-in fade-in slide-in-from-bottom-5 fill-mode-both p-4 delay-200 duration-500 sm:p-6",
          glossy
            ? "illustrated-preview-field"
            : "rounded-2xl border border-border bg-muted/30",
        )}
      >
        <div className="mb-3 flex items-center gap-2.5">
          {glossy ? (
            <span className="illustrated-preview-pill">Answer</span>
          ) : (
            <>
              <div className="h-4 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Answer
              </span>
            </>
          )}
          {card.back && hasAiReading ? (
            <SpeakButton text={card.back} stopKey={animKey} voice={voice} className="ml-auto" />
          ) : null}
        </div>
        {card.back ? (
          <p
            className={cn(
              "text-sm leading-relaxed whitespace-pre-line sm:text-base",
              glossy ? "text-white" : "text-foreground",
            )}
          >
            {card.back}
          </p>
        ) : (
          <p className={cn("text-sm italic", glossy ? "text-violet-200" : "text-muted-foreground")}>
            No answer text
          </p>
        )}
        {card.backImageUrl && (
          <div
            className={cn(
              "relative mt-3 h-36 overflow-hidden rounded-xl border sm:h-48",
              glossy
                ? "illustrated-preview-figure border-transparent"
                : "border-border bg-muted/30",
            )}
          >
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
