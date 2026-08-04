"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { AiRecallSessionCardsSettingsProps } from "@/components/ai-recall-session-cards-settings-types";

/**
 * Client-only loader so Turbopack SSR cannot fail unrelated pages with
 * "module factory is not available" for ai-recall-session-cards-settings.
 */
const AiRecallSessionCardsSettings = dynamic(
  () =>
    import("@/components/ai-recall-session-cards-settings").then(
      (mod) => mod.AiRecallSessionCardsSettings,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    ),
  },
);

export function AiRecallSessionCardsSettingsLoader(
  props: AiRecallSessionCardsSettingsProps,
) {
  return <AiRecallSessionCardsSettings {...props} />;
}
