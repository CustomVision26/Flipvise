"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

export type GenerateCardsButtonLoaderProps = {
  deckId: number;
  hasDescription: boolean;
  totalCardCount: number;
  aiGeneratedCount: number;
  hasAI: boolean;
  deckCardLimit: number;
};

const GenerateCardsButtonDynamic = dynamic<GenerateCardsButtonLoaderProps>(
  () =>
    import("./generate-cards-button").then((m) => m.GenerateCardsButton),
  {
    // Avoids Turbopack dev SSR "module factory is not available" for this client tree.
    ssr: false,
    loading: () => (
      <div className="flex w-full max-w-md flex-col gap-2 sm:max-w-lg sm:items-end">
        <Skeleton className="h-[7.5rem] w-full rounded-lg" />
        <Skeleton className="h-9 w-full rounded-md sm:w-48" />
      </div>
    ),
  },
);

export function GenerateCardsButtonLoader(props: GenerateCardsButtonLoaderProps) {
  return <GenerateCardsButtonDynamic {...props} />;
}
