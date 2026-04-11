"use client";

import { Progress } from "@/components/ui/progress";

interface DeckProgressProps {
  totalCards: number;
  viewedCards: number;
}

export function DeckProgress({ totalCards, viewedCards }: DeckProgressProps) {
  const percentage = totalCards === 0 ? 0 : Math.round((viewedCards / totalCards) * 100);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs">Study progress</span>
        <span className="text-muted-foreground text-xs">
          {viewedCards} / {totalCards} cards viewed
        </span>
      </div>
      <Progress value={percentage} className="h-2" />
    </div>
  );
}
