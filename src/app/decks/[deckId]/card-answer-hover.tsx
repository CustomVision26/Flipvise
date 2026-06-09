"use client";

import { useState } from "react";
import Image from "next/image";
import { CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";

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
  const [imageOpen, setImageOpen] = useState(false);
  const answerText = answer.trim();
  const hasPreview = Boolean(answerText || backImageUrl);
  if (!hasPreview) return <>{children}</>;

  const imageAlt = answerText || front || "Answer image";

  return (
    <>
    <HoverCard>
      <HoverCardTrigger
        className={cn(
          "block w-full rounded-xl text-left outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          className,
        )}
      >
        {children}
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="center"
        sideOffset={10}
        className="w-[min(18rem,calc(100vw-2rem))] overflow-hidden border-2 border-primary bg-card p-0 text-card-foreground shadow-lg shadow-primary/30 ring-0"
      >
        <div className="border-b border-primary/40 bg-primary px-3 py-2">
          <div className="flex items-center gap-2">
            <div
              className="h-3.5 w-1 shrink-0 rounded-full bg-primary-foreground/90"
              aria-hidden
            />
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-foreground">
              {isMC ? "Correct answer" : "Answer"}
            </p>
          </div>
        </div>
        <div className="bg-card px-3 py-2.5">
          <div className="flex items-start gap-2.5">
          {isMC ? (
            <CheckCircle2
              className="mt-0.5 size-3.5 shrink-0 text-emerald-500"
              aria-hidden
            />
          ) : null}
          {backImageUrl ? (
            <button
              type="button"
              className="relative size-11 shrink-0 overflow-hidden rounded-md border border-border bg-muted cursor-zoom-in transition-[box-shadow,transform] hover:ring-2 hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title="Double-click to enlarge"
              aria-label="Double-click to enlarge answer image"
              onDoubleClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setImageOpen(true);
              }}
            >
              <Image
                src={backImageUrl}
                alt=""
                fill
                className="object-cover pointer-events-none"
                sizes="44px"
                draggable={false}
              />
            </button>
          ) : null}
          <p className="min-w-0 text-sm font-medium leading-snug text-foreground break-words whitespace-pre-wrap">
            {answerText || (backImageUrl ? "Image answer" : "—")}
          </p>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>

    {backImageUrl ? (
      <Dialog open={imageOpen} onOpenChange={setImageOpen}>
        <DialogContent className="w-max max-w-[min(calc(100vw-2rem),22rem)] gap-0 overflow-hidden border-2 border-primary bg-card p-0 shadow-lg shadow-primary/30 ring-0 sm:max-w-[min(calc(100vw-2rem),22rem)]">
          <DialogHeader className="gap-0 border-b border-primary/40 bg-primary px-3 py-2 pr-10 text-left">
            <DialogTitle className="text-xs font-semibold text-primary-foreground">
              {isMC ? "Correct answer" : "Answer"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Enlarged answer image
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 bg-card p-3">
          <Image
            src={backImageUrl}
            alt={imageAlt}
            width={640}
            height={480}
            className="mx-auto block h-auto max-h-[min(55vh,18rem)] w-auto max-w-[min(calc(100vw-3.5rem),20rem)] rounded-md border border-primary/35 bg-muted object-contain"
            priority
          />
          {answerText ? (
            <p className="text-center text-xs font-medium text-card-foreground">
              {answerText}
            </p>
          ) : null}
          </div>
        </DialogContent>
      </Dialog>
    ) : null}
    </>
  );
}
