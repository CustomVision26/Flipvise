"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  getCardsPerDeckLimit,
} from "@/lib/deck-limits";

interface GenerateCardsButtonProps {
  deckId: number;
  hasDescription: boolean;
  totalCardCount: number;
  aiGeneratedCount: number;
  hasAI: boolean;
  hasUnlimitedDecks: boolean;
}

export function GenerateCardsButton({
  deckId,
  hasDescription,
  totalCardCount,
  aiGeneratedCount,
  hasAI,
  hasUnlimitedDecks,
}: GenerateCardsButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const manualCardCount = totalCardCount - aiGeneratedCount;
  const remainingAiSlots = AI_GENERATION_CAP_PER_DECK - aiGeneratedCount;
  const deckCardLimit = getCardsPerDeckLimit(hasUnlimitedDecks);
  const remainingDeckSlots = deckCardLimit - totalCardCount;

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

  if (!hasAI) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/pricing")}
              className="gap-1 sm:gap-1.5 text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
            />
          }
        >
          <Sparkles className="size-3 sm:size-4" />
          <span className="hidden sm:inline">Generate with AI</span>
          <span className="sm:hidden">AI Gen</span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-56 text-center">
          AI card generation is a Pro feature. Click to upgrade your plan.
        </TooltipContent>
      </Tooltip>
    );
  }

  const atAiQuota = aiGeneratedCount >= AI_GENERATION_CAP_PER_DECK;
  const noBatchRoom = batchOptions.length === 0;

  return (
    <div className="flex w-full max-w-md flex-col items-stretch gap-2 sm:max-w-lg sm:items-end">
      <Alert className="text-left text-xs sm:text-sm p-3 sm:p-4">
        <Sparkles className="text-primary h-4 w-4 sm:h-5 sm:w-5" />
        <AlertTitle className="text-sm sm:text-base">AI flashcard batches</AlertTitle>
        <AlertDescription className="text-muted-foreground space-y-1 text-xs sm:text-sm">
          <p className="hidden sm:block">
            Choose how many cards to generate (multiples of 5, up to 75 per run). Each option
            includes an AI marker on new cards.
          </p>
          <p className="sm:hidden">
            Choose batch size (multiples of 5, max 75).
          </p>
          <p className="text-foreground font-medium text-[10px] sm:text-sm">
            {aiGeneratedCount} AI · {manualCardCount} manual · {Math.max(0, remainingDeckSlots)} slot
            {Math.max(0, remainingDeckSlots) !== 1 ? "s" : ""} left (
            {deckCardLimit} max, {hasUnlimitedDecks ? "Pro" : "Free"})
          </p>
        </AlertDescription>
      </Alert>

      {atAiQuota ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                aria-disabled="true"
                onClick={(e) => e.preventDefault()}
                className="gap-1 sm:gap-1.5 cursor-not-allowed opacity-50 text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
              />
            }
          >
            <Sparkles className="size-3 sm:size-4" />
            <span className="hidden sm:inline">Generate with AI</span>
            <span className="sm:hidden">AI Gen</span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-64 text-center text-xs sm:text-sm">
            AI generation is limited to {AI_GENERATION_CAP_PER_DECK} AI-generated cards per deck.
            This deck already has {aiGeneratedCount}.
          </TooltipContent>
        </Tooltip>
      ) : !hasDescription ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                aria-disabled="true"
                onClick={(e) => e.preventDefault()}
                className="gap-1 sm:gap-1.5 cursor-not-allowed opacity-50 text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
              />
            }
          >
            <Sparkles className="size-3 sm:size-4" />
            <span className="hidden sm:inline">Generate with AI</span>
            <span className="sm:hidden">AI Gen</span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-56 text-center text-xs sm:text-sm">
            Add a description to this deck first. Click &ldquo;Edit Deck&rdquo; to add one.
          </TooltipContent>
        </Tooltip>
      ) : noBatchRoom ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                aria-disabled="true"
                onClick={(e) => e.preventDefault()}
                className="gap-1 sm:gap-1.5 cursor-not-allowed opacity-50 text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
              />
            }
          >
            <Sparkles className="size-3 sm:size-4" />
            <span className="hidden sm:inline">Generate with AI</span>
            <span className="sm:hidden">AI Gen</span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-64 text-center text-xs sm:text-sm">
            {remainingDeckSlots <= 0
              ? hasUnlimitedDecks
                ? `This deck is full (${deckCardLimit} cards on Pro). Delete cards to free space.`
                : `This deck is full on the Free plan (${deckCardLimit} cards). Upgrade to Pro for more room per deck, or delete cards.`
              : "No valid batch size left for AI generation with current limits."}
          </TooltipContent>
        </Tooltip>
      ) : (
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          <Select
            value={String(batchSize)}
            onValueChange={(v) => setBatchSize(Number(v))}
            disabled={isPending}
          >
            <SelectTrigger size="sm" className="w-full min-w-[140px] sm:min-w-[200px] sm:w-[220px] h-8 sm:h-9 text-xs sm:text-sm">
              <SelectValue placeholder="Cards per batch" />
            </SelectTrigger>
            <SelectContent>
              {batchOptions.map((n) => (
                <SelectItem key={n} value={String(n)} className="text-xs sm:text-sm">
                  <Sparkles className="size-3 sm:size-4 text-primary" />
                  <span>{n} cards</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerate}
            disabled={isPending}
            className="gap-1 sm:gap-1.5 text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
          >
            <Sparkles className="size-3 sm:size-4" />
            <span className="hidden sm:inline">{isPending ? "Generating…" : "Generate with AI"}</span>
            <span className="sm:hidden">{isPending ? "Gen…" : "Gen AI"}</span>
          </Button>
        </div>
      )}
      {error && (
        <p className="text-destructive max-w-md text-right text-[10px] sm:text-xs">{error}</p>
      )}
    </div>
  );
}
