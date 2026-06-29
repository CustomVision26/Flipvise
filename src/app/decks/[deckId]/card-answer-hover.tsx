"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { CheckCircle2 } from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FormattedCardAnswer } from "@/components/formatted-card-answer";
import { ImageEnlargeOverlay } from "@/components/image-enlarge-overlay";
import { cn } from "@/lib/utils";
import { isStepAnswer } from "@/lib/parse-step-answer";
import { CardHoverPreviewProvider } from "./card-hover-preview-context";

/**
 * True on touch / pen devices that have no hover. On these we open the answer
 * preview on tap (Popover) instead of on hover (PreviewCard), so the answer is
 * reachable inside the native mobile app and other touch screens.
 */
function useCoarsePointer() {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(hover: none), (pointer: coarse)");
    const sync = () => setCoarse(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  return coarse;
}

type CardAnswerHoverProps = {
  children: React.ReactNode;
  front: string | null;
  answer: string;
  isMC: boolean;
  backImageUrl: string | null;
  className?: string;
};

export function CardAnswerHover({
  children,
  front,
  answer,
  isMC,
  backImageUrl,
  className,
}: CardAnswerHoverProps) {
  const [hoverOpen, setHoverOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const coarsePointer = useCoarsePointer();
  const answerText = answer.trim();
  const frontText = front?.trim() ?? "";
  const hasPreview = Boolean(answerText || backImageUrl || frontText);
  if (!hasPreview) return <>{children}</>;

  const imageAlt = answerText || front || "Answer image";
  const isStructuredAnswer = isStepAnswer(answerText);
  const closeHover = () => setHoverOpen(false);

  const openBackImage = () => {
    closeHover();
    setImageOpen(true);
  };

  const triggerClassName = cn(
    "block w-full rounded-xl text-left outline-none transition-colors",
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    coarsePointer && "cursor-pointer",
    className,
  );
  const contentClassName = cn(
    "gap-0 overflow-hidden rounded-xl border border-border/70 bg-card p-0 text-card-foreground shadow-2xl shadow-black/40 ring-1 ring-foreground/10",
    isStructuredAnswer
      ? "w-[min(34rem,calc(100vw-1.5rem))]"
      : "w-[min(28rem,calc(100vw-1.5rem))]",
  );

  const triggerInner = (
    <CardHoverPreviewProvider closeHover={closeHover}>
      {children}
    </CardHoverPreviewProvider>
  );

  const previewBody = (
    <>
      <div className="border-b border-primary/25 bg-primary/10 px-4 py-2.5">
        <div className="flex items-center gap-2">
          {isMC ? (
            <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" aria-hidden />
          ) : (
            <div
              className="h-3.5 w-0.5 shrink-0 rounded-full bg-primary"
              aria-hidden
            />
          )}
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
            {isMC ? "Correct answer" : "Answer"}
          </p>
        </div>
      </div>

      <div
        className={cn(
          "max-h-[min(70vh,28rem)] overflow-y-auto bg-card/95 px-4 py-3.5",
          isStructuredAnswer && "py-4",
        )}
      >
        <div
          className={cn(
            "flex min-w-0",
            isStructuredAnswer || !backImageUrl
              ? "flex-col gap-2.5"
              : "items-start gap-3",
          )}
        >
          {backImageUrl ? (
            <button
              type="button"
              className={cn(
                "relative shrink-0 overflow-hidden rounded-lg border border-border/80 bg-muted/50 cursor-zoom-in transition-[box-shadow,transform] hover:ring-2 hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isStructuredAnswer ? "h-32 w-full" : "h-16 w-16",
              )}
              title="Double-click to enlarge"
              aria-label="Double-click to enlarge answer image"
              onClick={(event) => {
                if (coarsePointer) {
                  event.preventDefault();
                  event.stopPropagation();
                  openBackImage();
                }
              }}
              onDoubleClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                openBackImage();
              }}
            >
              <Image
                src={backImageUrl}
                alt=""
                fill
                className="object-contain pointer-events-none p-1.5"
                sizes={isStructuredAnswer ? "480px" : "64px"}
                draggable={false}
              />
            </button>
          ) : null}
          {answerText ? (
            <FormattedCardAnswer
              text={answerText}
              variant="hover"
              className="min-w-0 flex-1 text-sm leading-relaxed text-foreground/95"
            />
          ) : backImageUrl ? (
            <p className="text-sm font-medium text-foreground">Image answer</p>
          ) : (
            <p className="text-sm text-muted-foreground">No answer text</p>
          )}
        </div>
      </div>
    </>
  );

  const overlay = backImageUrl ? (
    <ImageEnlargeOverlay
      open={imageOpen}
      onClose={() => setImageOpen(false)}
      src={backImageUrl}
      alt={imageAlt}
      title={isMC ? "Correct answer" : "Answer"}
      footer={
        answerText ? (
          <FormattedCardAnswer
            text={answerText}
            variant="hover"
            className="text-center"
          />
        ) : undefined
      }
    />
  ) : null;

  if (coarsePointer) {
    return (
      <>
        <Popover open={hoverOpen} onOpenChange={setHoverOpen}>
          <PopoverTrigger
            nativeButton={false}
            render={<div tabIndex={0} />}
            className={triggerClassName}
          >
            {triggerInner}
          </PopoverTrigger>
          <PopoverContent
            side="bottom"
            align="center"
            sideOffset={10}
            className={contentClassName}
          >
            {previewBody}
          </PopoverContent>
        </Popover>
        {overlay}
      </>
    );
  }

  return (
    <>
      <HoverCard open={hoverOpen} onOpenChange={setHoverOpen}>
        <HoverCardTrigger render={<div tabIndex={0} />} className={triggerClassName}>
          {triggerInner}
        </HoverCardTrigger>
        <HoverCardContent
          side="bottom"
          align="center"
          sideOffset={10}
          className={contentClassName}
        >
          {previewBody}
        </HoverCardContent>
      </HoverCard>
      {overlay}
    </>
  );
}
