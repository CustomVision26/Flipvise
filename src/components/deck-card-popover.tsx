"use client";

import * as React from "react";
import Link from "next/link";
import { Eye, BookOpen, Trash2, Loader2 } from "lucide-react";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { deleteDeckAction } from "@/actions/decks";
import { getCardsForPreviewAction } from "@/actions/cards";
import { DeckPreviewCarousel } from "./deck-preview-carousel";

type PreviewCard = {
  id: number;
  front: string | null;
  frontImageUrl: string | null;
  back: string | null;
  backImageUrl: string | null;
  aiGenerated: boolean;
};

export type DeckView = "grid" | "list" | "compact";

interface DeckCardPopoverProps {
  deck: {
    id: number;
    name: string;
    description: string | null;
    cardCount: number;
    updatedAt: Date;
  };
  view?: DeckView;
}

export function DeckCardPopover({ deck, view = "grid" }: DeckCardPopoverProps) {
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [previewCards, setPreviewCards] = React.useState<PreviewCard[]>([]);
  const [loadingPreview, setLoadingPreview] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  async function handlePreview() {
    setPopoverOpen(false);
    setLoadingPreview(true);
    try {
      const cards = await getCardsForPreviewAction(deck.id);
      setPreviewCards(cards);
      setPreviewOpen(true);
    } catch {
      // silent — could add a toast here
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await deleteDeckAction({ deckId: deck.id });
    } catch {
      // silent
    } finally {
      setIsDeleting(false);
      setDeleteOpen(false);
    }
  }

  const updatedLabel = deck.updatedAt.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const updatedShort = deck.updatedAt.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const wrapperClass =
    view === "compact"
      ? "relative min-h-[140px] sm:min-h-[160px]"
      : "relative";

  return (
    <div className={wrapperClass}>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger
          nativeButton={false}
          render={
            <div
              role="button"
              tabIndex={0}
              aria-label={`Open options for ${deck.name}`}
              className="block w-full h-full text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded-xl"
            />
          }
        >
          <Card
            className={cn(
              "h-full transition-all duration-200 cursor-pointer select-none",
              "hover:bg-muted/50 hover:shadow-md",
              "active:scale-[0.99]",
              view === "compact"
                ? "flex flex-col hover:-translate-y-0.5"
                : "flex flex-row items-center gap-3 sm:gap-4",
              view === "grid" && "py-3 px-4",
              view === "list" && "py-2 px-3",
            )}
          >
            {view === "compact" ? (
              <>
                <CardHeader className="px-3 py-3 gap-1">
                  <CardTitle className="line-clamp-2 text-sm sm:text-base leading-tight">
                    {deck.name}
                  </CardTitle>
                  <CardDescription className="line-clamp-2 text-[11px] sm:text-xs">
                    {deck.description ?? "No description provided."}
                  </CardDescription>
                </CardHeader>
                <div className="flex-1" />
                <CardFooter className="px-3 pb-3 pt-0 flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-[11px] tabular-nums">
                    {deck.cardCount}{" "}
                    {deck.cardCount === 1 ? "card" : "cards"}
                  </span>
                  <span className="text-muted-foreground text-[11px] tabular-nums truncate">
                    {updatedShort}
                  </span>
                </CardFooter>
              </>
            ) : view === "list" ? (
              <>
                <div className="flex-1 min-w-0">
                  <p className="line-clamp-1 text-sm font-medium">
                    {deck.name}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {deck.cardCount}{" "}
                  {deck.cardCount === 1 ? "card" : "cards"}
                </span>
                <span className="hidden sm:inline shrink-0 text-xs text-muted-foreground tabular-nums">
                  Updated {updatedLabel}
                </span>
              </>
            ) : (
              <>
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <p className="text-sm sm:text-base font-semibold break-words whitespace-pre-wrap">
                    {deck.name}
                  </p>
                  <p className="text-xs text-muted-foreground break-words whitespace-pre-wrap">
                    {deck.description ?? "No description provided."}
                  </p>
                </div>
                <div className="flex flex-wrap shrink-0 items-center gap-x-6 gap-y-1 text-xs text-muted-foreground tabular-nums">
                  <span className="sm:w-16 sm:text-right">
                    {deck.cardCount}{" "}
                    {deck.cardCount === 1 ? "card" : "cards"}
                  </span>
                  <span className="sm:w-44 sm:text-right">
                    Updated {updatedLabel}
                  </span>
                </div>
              </>
            )}
          </Card>
        </PopoverTrigger>

        <PopoverContent className="w-52 p-1.5" align="center" sideOffset={6}>
          <div className="flex flex-col gap-0.5">
            {/* Open Deck */}
            <Link
              href={`/decks/${deck.id}`}
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "w-full justify-start gap-2.5 h-9 px-2.5 font-normal",
              )}
              onClick={() => setPopoverOpen(false)}
            >
              <BookOpen className="size-4 text-muted-foreground shrink-0" />
              Open Deck
            </Link>

            {/* Preview Cards */}
            <button
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "w-full justify-start gap-2.5 h-9 px-2.5 font-normal",
                (deck.cardCount === 0 || loadingPreview) &&
                  "opacity-40 cursor-not-allowed pointer-events-none",
              )}
              onClick={handlePreview}
              disabled={deck.cardCount === 0 || loadingPreview}
            >
              {loadingPreview ? (
                <Loader2 className="size-4 text-muted-foreground animate-spin shrink-0" />
              ) : (
                <Eye className="size-4 text-muted-foreground shrink-0" />
              )}
              {loadingPreview ? "Loading…" : "Preview Cards"}
            </button>

            <div className="my-1 h-px bg-border" />

            {/* Delete Deck */}
            <button
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "w-full justify-start gap-2.5 h-9 px-2.5 font-normal",
                "text-destructive hover:text-destructive hover:bg-destructive/10",
              )}
              onClick={() => {
                setPopoverOpen(false);
                setDeleteOpen(true);
              }}
            >
              <Trash2 className="size-4 shrink-0" />
              Delete Deck
            </button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Loading overlay on card while fetching preview */}
      {loadingPreview && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/60 backdrop-blur-[2px] pointer-events-none">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      )}

      {/* Full-screen preview carousel */}
      <DeckPreviewCarousel
        deckName={deck.name}
        cards={previewCards}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-md mx-4 sm:mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">
              Delete &ldquo;{deck.name}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm">
              This will permanently delete the deck and all of its cards. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeleting}
              onClick={handleDelete}
              className="w-full sm:w-auto"
            >
              {isDeleting ? "Deleting…" : "Delete Deck"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
