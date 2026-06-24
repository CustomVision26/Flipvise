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

interface GenerateCardsButtonProps {
  deckId: number;
  hasDescription: boolean;
  totalCardCount: number;
  aiGeneratedCount: number;
  hasAI: boolean;
  deckCardLimit: number;
}

function DisabledAiButton({
  tooltip,
  onClick,
}: {
  tooltip: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            aria-disabled="true"
            onClick={onClick ?? ((e) => e.preventDefault())}
            className="h-9 w-full cursor-not-allowed gap-2 opacity-60"
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
  );
}

export function GenerateCardsButton({
  deckId,
  hasDescription,
  totalCardCount,
  aiGeneratedCount,
  hasAI,
  deckCardLimit,
}: GenerateCardsButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const online = useOnlineStatus();

  const manualCardCount = totalCardCount - aiGeneratedCount;
  const remainingAiSlots = AI_GENERATION_CAP_PER_DECK - aiGeneratedCount;
  const remainingDeckSlots = deckCardLimit - totalCardCount;
  const paidDeckCards = deckCardLimit > CARDS_PER_DECK_LIMIT_FREE;

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
      <div className="space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">AI generation</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Available on Pro and team plans.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/pricing")}
          className="h-9 w-full gap-2"
        >
          <Sparkles className="size-4" />
          Upgrade for AI
        </Button>
      </div>
    );
  }

  const atAiQuota = aiGeneratedCount >= AI_GENERATION_CAP_PER_DECK;
  const noBatchRoom = batchOptions.length === 0;

  const statsLine = `${aiGeneratedCount} AI · ${manualCardCount} manual · ${Math.max(0, remainingDeckSlots)} slot${Math.max(0, remainingDeckSlots) !== 1 ? "s" : ""} remaining`;

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 shrink-0 text-primary" />
          <p className="text-sm font-medium text-foreground">AI generation</p>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Generate cards in batches of 5. AI matches your deck&apos;s style and avoids duplicates.
        </p>
        <p className="text-xs tabular-nums text-muted-foreground">
          {statsLine}
          <span className="text-muted-foreground/80">
            {" "}
            · {deckCardLimit} max · {paidDeckCards ? "Paid plan" : "Free plan"}
          </span>
        </p>
      </div>

      {!online ? (
        <DisabledAiButton tooltip="AI generation needs an internet connection. Reconnect to generate cards." />
      ) : atAiQuota ? (
        <DisabledAiButton
          tooltip={`AI generation is limited to ${AI_GENERATION_CAP_PER_DECK} cards per deck. This deck already has ${aiGeneratedCount}.`}
        />
      ) : !hasDescription ? (
        <DisabledAiButton tooltip='Add a deck description first using "Edit deck".' />
      ) : noBatchRoom ? (
        <DisabledAiButton
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
            <SelectTrigger size="sm" className="h-9 w-full sm:min-w-[8.5rem] sm:flex-1">
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
          <Button
            size="sm"
            onClick={handleGenerate}
            disabled={isPending}
            className="h-9 w-full gap-2 sm:w-auto sm:shrink-0"
          >
            <Sparkles className="size-4" />
            {isPending ? "Generating…" : "Generate"}
          </Button>
        </div>
      )}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
