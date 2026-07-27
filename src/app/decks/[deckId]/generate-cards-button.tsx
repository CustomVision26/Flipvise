"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generateCardsAction } from "@/actions/cards";
import {
  AI_GENERATION_CAP_PER_DECK,
  buildAiBatchOptions,
  CARDS_PER_DECK_LIMIT_FREE,
} from "@/lib/deck-limits";
import { useOnlineStatus } from "@/lib/use-online-status";
import { cn } from "@/lib/utils";

interface GenerateCardsButtonProps {
  deckId: number;
  hasDescription: boolean;
  totalCardCount: number;
  aiGeneratedCount: number;
  hasAI: boolean;
  deckCardLimit: number;
  /** Higher-contrast copy when the panel sits on a deck gradient. */
  onGradient?: boolean;
}

function DisabledAiButton({
  tooltip,
  onClick,
  onGradient,
}: {
  tooltip: string;
  onClick?: (e: React.MouseEvent) => void;
  onGradient?: boolean;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              aria-disabled="true"
              onClick={onClick ?? ((e) => e.preventDefault())}
              className={cn(
                "h-9 w-full cursor-not-allowed gap-2 opacity-60",
                onGradient &&
                  "border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white",
              )}
            />
          }
        >
          <Sparkles className="size-4" />
          Generate with AI
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-64 text-center text-sm">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function GenerateCardsButton({
  deckId,
  hasDescription,
  totalCardCount,
  aiGeneratedCount,
  hasAI,
  deckCardLimit,
  onGradient = false,
}: GenerateCardsButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const online = useOnlineStatus();

  const manualCardCount = totalCardCount - aiGeneratedCount;
  const remainingAiSlots = AI_GENERATION_CAP_PER_DECK - aiGeneratedCount;
  const remainingDeckSlots = deckCardLimit - totalCardCount;
  const paidDeckCards = deckCardLimit > CARDS_PER_DECK_LIMIT_FREE;
  const aiFillPercent = Math.min(
    100,
    Math.round((aiGeneratedCount / AI_GENERATION_CAP_PER_DECK) * 100),
  );

  const batchOptions = useMemo(
    () => buildAiBatchOptions(remainingAiSlots, remainingDeckSlots),
    [remainingAiSlots, remainingDeckSlots],
  );

  const [batchSize, setBatchSize] = useState(5);

  useEffect(() => {
    if (batchOptions.length === 0) return;
    if (!batchOptions.includes(batchSize)) {
      setBatchSize(batchOptions[batchOptions.length - 1]!);
    }
  }, [batchOptions, batchSize]);

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      try {
        await generateCardsAction({ deckId, count: batchSize });
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to generate cards. Please try again.",
        );
      }
    });
  }

  const titleClass = onGradient ? "text-white" : "text-foreground";
  const mutedClass = onGradient ? "text-white/70" : "text-muted-foreground";
  const softClass = onGradient ? "text-white/55" : "text-muted-foreground/80";

  if (!hasAI) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg border",
              onGradient
                ? "border-white/20 bg-white/10 text-white"
                : "border-border bg-muted/60 text-muted-foreground",
            )}
          >
            <Sparkles className="size-4" />
          </div>
          <div className="space-y-1">
            <p className={cn("text-sm font-semibold", titleClass)}>AI generation</p>
            <p className={cn("text-xs leading-relaxed", mutedClass)}>
              Available on Pro and team plans.
            </p>
          </div>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/pricing")}
                  className={cn(
                    "h-9 w-full gap-2",
                    onGradient &&
                      "border-white/25 bg-white/10 text-white hover:bg-white/15 hover:text-white",
                  )}
                />
              }
            >
              <Sparkles className="size-4" />
              Upgrade for AI
            </TooltipTrigger>
            <TooltipContent side="bottom">
              View plans that include AI card generation
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  const atAiQuota = aiGeneratedCount >= AI_GENERATION_CAP_PER_DECK;
  const noBatchRoom = batchOptions.length === 0;

  return (
    <div className="space-y-3.5">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "relative flex size-9 shrink-0 items-center justify-center rounded-lg border",
            onGradient
              ? "border-white/20 bg-white/10 text-white"
              : "border-primary/25 bg-primary/10 text-primary",
          )}
        >
          <span
            className={cn(
              "absolute inset-0 rounded-lg opacity-40 blur-[6px]",
              onGradient ? "bg-white/30" : "bg-primary/30",
              isPending && "animate-pulse",
            )}
            aria-hidden
          />
          <Sparkles className={cn("relative size-4", isPending && "animate-spin")} />
        </div>
        <div className="min-w-0 space-y-1">
          <p className={cn("text-sm font-semibold tracking-tight", titleClass)}>
            AI generation
          </p>
          <p className={cn("text-xs leading-relaxed", mutedClass)}>
            Generate cards in batches. AI matches your deck&apos;s style and avoids
            duplicates.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div
          className={cn(
            "grid grid-cols-3 gap-2 rounded-lg border px-2.5 py-2 text-center",
            onGradient
              ? "border-white/12 bg-white/5"
              : "border-border/70 bg-muted/30",
          )}
        >
          <div>
            <p className={cn("text-[10px] uppercase tracking-wide", softClass)}>AI</p>
            <p className={cn("text-sm font-semibold tabular-nums", titleClass)}>
              {aiGeneratedCount}
            </p>
          </div>
          <div>
            <p className={cn("text-[10px] uppercase tracking-wide", softClass)}>Manual</p>
            <p className={cn("text-sm font-semibold tabular-nums", titleClass)}>
              {manualCardCount}
            </p>
          </div>
          <div>
            <p className={cn("text-[10px] uppercase tracking-wide", softClass)}>Slots</p>
            <p className={cn("text-sm font-semibold tabular-nums", titleClass)}>
              {Math.max(0, remainingDeckSlots)}
            </p>
          </div>
        </div>
        <div className="space-y-1">
          <div
            className={cn(
              "flex items-center justify-between text-[10px] font-medium uppercase tracking-wide",
              softClass,
            )}
          >
            <span>AI quota</span>
            <span className="tabular-nums">
              {aiGeneratedCount}/{AI_GENERATION_CAP_PER_DECK}
            </span>
          </div>
          <div
            className={cn(
              "h-1 overflow-hidden rounded-full",
              onGradient ? "bg-white/15" : "bg-muted",
            )}
          >
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-500 ease-out",
                onGradient ? "bg-white" : "bg-primary",
                atAiQuota && (onGradient ? "bg-rose-200" : "bg-destructive"),
              )}
              style={{ width: `${aiFillPercent}%` }}
            />
          </div>
          <p className={cn("text-[11px] tabular-nums", softClass)}>
            {deckCardLimit} max · {paidDeckCards ? "Paid plan" : "Free plan"}
          </p>
        </div>
      </div>

      {!online ? (
        <DisabledAiButton
          onGradient={onGradient}
          tooltip="AI generation needs an internet connection. Reconnect to generate cards."
        />
      ) : atAiQuota ? (
        <DisabledAiButton
          onGradient={onGradient}
          tooltip={`AI generation is limited to ${AI_GENERATION_CAP_PER_DECK} cards per deck. This deck already has ${aiGeneratedCount}.`}
        />
      ) : !hasDescription ? (
        <DisabledAiButton
          onGradient={onGradient}
          tooltip='Add a deck description first using "Edit deck".'
        />
      ) : noBatchRoom ? (
        <DisabledAiButton
          onGradient={onGradient}
          tooltip={
            remainingDeckSlots <= 0
              ? paidDeckCards
                ? `This deck is full (${deckCardLimit} cards). Delete cards to free space.`
                : `This deck is full on the Free plan (${deckCardLimit} cards). Upgrade or delete cards.`
              : "No valid batch size left with current limits."
          }
        />
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select
            value={String(batchSize)}
            onValueChange={(v) => setBatchSize(Number(v))}
            disabled={isPending}
          >
            <SelectTrigger
              size="sm"
              className={cn(
                "h-9 w-full sm:min-w-[8.5rem] sm:flex-1",
                onGradient &&
                  "border-white/25 bg-white/10 text-white data-[placeholder]:text-white/70 [&_svg]:text-white/70",
              )}
            >
              <SelectValue placeholder="Batch size" />
            </SelectTrigger>
            <SelectContent>
              {batchOptions.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} cards
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={
                  <span className="inline-flex w-full sm:w-auto sm:shrink-0" tabIndex={0} />
                }
              >
                <Button
                  size="sm"
                  onClick={handleGenerate}
                  disabled={isPending}
                  className={cn(
                    "h-9 w-full gap-2 sm:w-auto sm:shrink-0",
                    onGradient &&
                      "bg-white text-violet-950 hover:bg-white/90",
                  )}
                >
                  <Sparkles className={cn("size-4", isPending && "animate-spin")} />
                  {isPending ? "Generating…" : "Generate"}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Generate {batchSize} AI card{batchSize !== 1 ? "s" : ""} for this deck
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      {error ? (
        <p className={cn("text-xs", onGradient ? "text-rose-200" : "text-destructive")}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
