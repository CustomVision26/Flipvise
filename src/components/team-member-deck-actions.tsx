"use client";

import * as React from "react";
import Link from "next/link";
import { Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { getCardsForDeckViewerPreviewAction } from "@/actions/cards";
import { DeckPreviewCarousel } from "@/components/deck-preview-carousel";
import { withTeamWorkspaceQuery } from "@/lib/team-workspace-url";

type PreviewCard = {
  id: number;
  front: string | null;
  frontImageUrl: string | null;
  back: string | null;
  backImageUrl: string | null;
  aiGenerated: boolean;
};

export function TeamMemberDeckActions({
  deckId,
  deckName,
  cardCount,
  workspaceQueryString = "",
}: {
  deckId: number;
  deckName: string;
  cardCount: number;
  workspaceQueryString?: string;
}) {
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewCards, setPreviewCards] = React.useState<PreviewCard[]>([]);
  const [loadingPreview, setLoadingPreview] = React.useState(false);

  const studyHref = workspaceQueryString
    ? withTeamWorkspaceQuery(`/decks/${deckId}/study`, workspaceQueryString)
    : `/decks/${deckId}/study`;

  async function handlePreview() {
    setLoadingPreview(true);
    try {
      const cards = await getCardsForDeckViewerPreviewAction({ deckId });
      setPreviewCards(cards);
      setPreviewOpen(true);
    } catch {
      // silent
    } finally {
      setLoadingPreview(false);
    }
  }

  const canPreview = cardCount > 0;

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link
          href={studyHref}
          className={cn(
            buttonVariants({ variant: "default", size: "sm" }),
            "gap-1.5 no-underline",
          )}
        >
          Study
        </Link>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canPreview || loadingPreview}
          onClick={handlePreview}
          className="gap-1.5"
        >
          {loadingPreview ? (
            <Loader2 className="size-3.5 animate-spin shrink-0" aria-hidden />
          ) : (
            <Eye className="size-3.5 shrink-0" aria-hidden />
          )}
          Preview
        </Button>
      </div>
      <DeckPreviewCarousel
        deckName={deckName}
        cards={previewCards}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />
    </>
  );
}
