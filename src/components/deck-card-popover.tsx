"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Eye, BookOpen, GraduationCap, Trash2, Loader2, Pencil } from "lucide-react";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { deleteDeckAction } from "@/actions/decks";
import { getGradientBySlug } from "@/lib/deck-gradients";
import {
  getCardsForDeckViewerPreviewAction,
  getCardsForPreviewAction,
} from "@/actions/cards";
import { withTeamWorkspaceQuery } from "@/lib/team-workspace-url";
import { DeckPreviewCarousel } from "./deck-preview-carousel";
import { EditDeckDialog } from "@/components/edit-deck-dialog";
import {
  ItemWatermark,
  itemCardContainerClass,
  itemPrimaryTextClass,
  type ItemWatermarkView,
} from "./item-watermark";

type PreviewCard = {
  id: number;
  front: string | null;
  frontImageUrl: string | null;
  back: string | null;
  backImageUrl: string | null;
  aiGenerated: boolean;
};

export type DeckView = ItemWatermarkView;

interface DeckCardPopoverProps {
  deck: {
    id: number;
    name: string;
    description: string | null;
    cardCount: number;
    updatedAt: Date;
    gradeLevel?: string | null;
    difficultyLevel?: string | null;
    teamId?: number | null;
    /** Team deck cover — shown on dashboard cards only. */
    coverImageUrl?: string | null;
    firstPreviewCardFrontImageUrl?: string | null;
    gradient?: string | null;
  };
  view?: DeckView;
  /** When set, append to deck and study links (team workspace URL context). */
  workspaceQueryString?: string;
  /** `team-preview`: study + preview only (assigned team members). */
  variant?: "full" | "team-preview";
  /** Education co-admin — true when this admin created the deck in the workspace. */
  canEditContent?: boolean;
  /** Team-tier subscriber — deck cover upload in edit dialog. */
  allowCoverUpload?: boolean;
  /** Main dashboard — team-tier subscribers: preview row shows first-card image + CTA. */
  teamTierPreviewPromo?: boolean;
  /** Listen-to-card in deck preview — Pro Plus / team / platform admin only. */
  hasAiReading?: boolean;
}

export function DeckCardPopover({
  deck,
  view = "grid",
  workspaceQueryString,
  variant = "full",
  canEditContent,
  allowCoverUpload = false,
  teamTierPreviewPromo = false,
  hasAiReading = false,
}: DeckCardPopoverProps) {
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const [teamWorkspaceDialogOpen, setTeamWorkspaceDialogOpen] =
    React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [previewCards, setPreviewCards] = React.useState<PreviewCard[]>([]);
  const [loadingPreview, setLoadingPreview] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  async function handlePreview() {
    if (variant === "team-preview") {
      setTeamWorkspaceDialogOpen(false);
    } else {
      setPopoverOpen(false);
    }
    setLoadingPreview(true);
    try {
      const cards =
        variant === "team-preview"
          ? await getCardsForDeckViewerPreviewAction({ deckId: deck.id })
          : await getCardsForPreviewAction(deck.id);
      setPreviewCards(cards);
      setPreviewOpen(true);
    } catch {
      // silent — could add a toast here
    } finally {
      setLoadingPreview(false);
    }
  }

  const openDeckHref = workspaceQueryString
    ? withTeamWorkspaceQuery(`/decks/${deck.id}`, workspaceQueryString)
    : `/decks/${deck.id}`;
  const studyHref = workspaceQueryString
    ? withTeamWorkspaceQuery(`/decks/${deck.id}/study`, workspaceQueryString)
    : `/decks/${deck.id}/study`;

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
      ? "relative h-full min-h-[140px] sm:min-h-[160px]"
      : view === "list"
        ? "relative"
        : "relative min-h-[4.75rem]";

  const triggerClassName = cn(
    "block w-full min-h-0 text-left cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    view === "compact" && "h-full",
  );

  const deckTriggerRender = (
    <div tabIndex={0} aria-label={`Quick actions for ${deck.name}`} />
  );

  /**
   * Grid (detail) view: inline cover omitted — show cover on hover via CSS only.
   * Do not use Tooltip here: it portals into document.body while the card sits
   * inside Popover/Dialog triggers, and dual portal teardown races → removeChild(null).
   */
  function withGridCoverHover(card: React.ReactNode) {
    if (view !== "grid" || !deck.coverImageUrl) return card;
    const overlayOpen = popoverOpen || teamWorkspaceDialogOpen || previewOpen;
    return (
      <div className="group/cover-preview relative block w-full min-h-0 rounded-xl">
        {card}
        {!overlayOpen ? (
          <div
            className={cn(
              "pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 z-[100] hidden -translate-x-1/2",
              "rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-lg ring-1 ring-foreground/10",
              "group-hover/cover-preview:block",
            )}
            aria-hidden
          >
            <p className="mb-1.5 max-w-[10.5rem] truncate text-[11px] font-medium leading-tight text-foreground sm:max-w-[11rem] sm:text-xs">
              {deck.name}
            </p>
            <div className="relative h-[5.25rem] w-[9.25rem] overflow-hidden rounded-md border border-border bg-muted/30 sm:h-24 sm:w-40">
              <Image
                src={deck.coverImageUrl}
                alt=""
                fill
                className="object-cover"
                sizes="160px"
              />
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  function previewControlsFor(compact: boolean) {
    const rowGhost = cn(
      buttonVariants({ variant: "ghost", size: compact ? "xs" : "sm" }),
      compact
        ? "w-full justify-start gap-2 px-2 font-normal rounded-md"
        : "w-full justify-start gap-2.5 h-9 px-2.5 font-normal",
    );
    if (teamTierPreviewPromo && deck.cardCount > 0) {
      const previewButton = (
        <button
          type="button"
          className={cn(
            buttonVariants({ variant: "default", size: compact ? "xs" : "sm" }),
            "w-full justify-center gap-1.5 font-medium",
            loadingPreview && "pointer-events-none opacity-70",
          )}
          onClick={handlePreview}
          disabled={loadingPreview}
        >
          {loadingPreview ? (
            <Loader2
              className={cn(
                "animate-spin shrink-0",
                compact ? "size-3.5" : "size-4",
              )}
              aria-hidden
            />
          ) : (
            <Eye
              className={cn("shrink-0", compact ? "size-3.5" : "size-4")}
              aria-hidden
            />
          )}
          {loadingPreview
            ? compact
              ? "Opening…"
              : "Opening preview…"
            : compact
              ? "Preview cards"
              : "Click to preview deck cards"}
        </button>
      );

      if (!deck.firstPreviewCardFrontImageUrl) {
        return previewButton;
      }

      return (
        <div
          className={cn(
            "flex flex-col rounded-md border border-border bg-muted/20",
            compact ? "gap-1 p-1" : "gap-2 p-2",
          )}
        >
          <div
            className={cn(
              "relative w-full overflow-hidden rounded-md border border-border bg-background",
              compact ? "aspect-[5/2] max-h-[5.25rem]" : "aspect-[4/3]",
            )}
          >
            <Image
              src={deck.firstPreviewCardFrontImageUrl}
              alt="First card in this deck (preview order)"
              fill
              className="object-cover"
              sizes={compact ? "180px" : "280px"}
            />
          </div>
          {previewButton}
        </div>
      );
    }
    return (
      <button
        type="button"
        className={cn(
          rowGhost,
          (deck.cardCount === 0 || loadingPreview) &&
            "opacity-40 cursor-not-allowed pointer-events-none",
        )}
        onClick={handlePreview}
        disabled={deck.cardCount === 0 || loadingPreview}
      >
        {loadingPreview ? (
          <Loader2
            className={cn(
              "text-muted-foreground animate-spin shrink-0",
              compact ? "size-3.5" : "size-4",
            )}
          />
        ) : (
          <Eye
            className={cn(
              "text-muted-foreground shrink-0",
              compact ? "size-3.5" : "size-4",
            )}
          />
        )}
        {loadingPreview ? "Loading…" : compact ? "Preview cards" : "Preview Cards"}
      </button>
    );
  }

  const hasCover = Boolean(deck.coverImageUrl);
  const showDeckEdit = variant === "full" || canEditContent === true;
  const deckGradient = getGradientBySlug(deck.gradient);
  const hasGradient = deckGradient.slug !== "none";

  function deckEditMenuButton(
    compact: boolean,
    onMenuClose: () => void,
  ) {
    if (!showDeckEdit) return null;
    return (
      <button
        type="button"
        className={cn(
          buttonVariants({ variant: "ghost", size: compact ? "xs" : "sm" }),
          compact
            ? "w-full justify-start gap-2 px-2 font-normal rounded-md"
            : "w-full justify-start gap-2.5 h-9 px-2.5 font-normal",
        )}
        onClick={() => {
          onMenuClose();
          setEditDialogOpen(true);
        }}
      >
        <Pencil
          className={cn(
            "text-muted-foreground shrink-0",
            compact ? "size-3.5" : "size-4",
          )}
          aria-hidden
        />
        Edit deck
      </button>
    );
  }

  const editDeckPayload = {
    id: deck.id,
    name: deck.name,
    description: deck.description,
    gradeLevel: deck.gradeLevel ?? null,
    difficultyLevel: deck.difficultyLevel ?? null,
    teamId: deck.teamId ?? null,
    coverImageUrl: deck.coverImageUrl,
    gradient: deck.gradient,
  };

  const coverBanner = deck.coverImageUrl ? (
    <div className="relative aspect-[5/2] w-full max-h-[4.75rem] shrink-0 border-b border-border bg-muted/40 sm:aspect-[3/1] sm:max-h-[6.5rem]">
      <Image
        src={deck.coverImageUrl}
        alt=""
        fill
        className="object-cover"
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 360px"
      />
    </div>
  ) : null;

  const coverThumbList = deck.coverImageUrl ? (
    <div className="relative size-11 shrink-0 overflow-hidden rounded-md border border-border bg-muted/40 sm:size-[3.25rem]">
      <Image
        src={deck.coverImageUrl}
        alt=""
        fill
        className="object-cover"
        sizes="52px"
      />
    </div>
  ) : null;

  const deckTextClass = itemPrimaryTextClass(hasGradient);
  const deckMetaClass = hasGradient ? "text-white/80" : "text-foreground/70";
  const deckDescriptionClass = hasGradient ? "text-white/80" : "text-foreground/75";

  const deckCard = (
    <Card
      className={cn(
        itemCardContainerClass,
        "h-full transition-all duration-200 cursor-pointer select-none",
        "border shadow-lg shadow-black/30 active:scale-[0.99]",
        hasGradient
          ? cn(
              deckGradient.classes,
              "border-white/20 ring-1 ring-inset ring-white/15 hover:shadow-xl hover:ring-white/25",
            )
          : "border-border/80 bg-card/95 ring-1 ring-foreground/20 backdrop-blur-md hover:border-foreground/30 hover:bg-card hover:shadow-xl",
        view === "compact"
          ? cn("flex h-full min-h-0 flex-col hover:-translate-y-0.5", hasCover && "p-0")
          : view === "list"
            ? cn(
                "flex flex-row items-center py-2.5 sm:gap-3",
                hasCover
                  ? "gap-2.5 pl-2 pr-3 sm:pl-2.5 sm:pr-3"
                  : "gap-3 px-3",
              )
            : "flex min-h-[4.75rem] flex-row items-center gap-3 px-4 py-3.5 sm:gap-4",
      )}
    >
      <ItemWatermark label="DECK" view={view} onGradient={hasGradient} />
      {view === "compact" && coverBanner}
      {view === "compact" ? (
        <>
          <CardHeader className="px-3 py-3 gap-1">
            <CardTitle
              className={cn(
                "line-clamp-2 text-sm font-semibold leading-snug tracking-tight text-balance sm:text-base",
                deckTextClass,
                hasGradient && "text-white",
              )}
            >
              {deck.name}
            </CardTitle>
            <CardDescription
              className={cn(
                "line-clamp-2 text-[11px] sm:text-xs",
                deckTextClass,
                deckDescriptionClass,
              )}
            >
              {deck.description ?? "No description provided."}
            </CardDescription>
          </CardHeader>
          <div className="flex-1" />
          <CardFooter className="px-3 pb-3 pt-0 flex items-center justify-between gap-2">
            <span className={cn("text-[11px] tabular-nums", deckMetaClass)}>
              {deck.cardCount}{" "}
              {deck.cardCount === 1 ? "card" : "cards"}
            </span>
            <span className={cn("text-[11px] tabular-nums truncate", deckMetaClass)}>
              {updatedShort}
            </span>
          </CardFooter>
        </>
      ) : view === "list" ? (
        <>
          {coverThumbList}
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                "line-clamp-1 text-sm font-semibold leading-snug tracking-tight",
                deckTextClass,
                hasGradient && "text-white",
              )}
            >
              {deck.name}
            </p>
          </div>
          <span className={cn("shrink-0 text-xs tabular-nums", deckMetaClass)}>
            {deck.cardCount}{" "}
            {deck.cardCount === 1 ? "card" : "cards"}
          </span>
          <span className={cn("hidden sm:inline shrink-0 text-xs tabular-nums", deckMetaClass)}>
            Updated {updatedLabel}
          </span>
        </>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-4">
          <div className="min-w-0 flex-1 flex flex-col gap-1">
            <p
              className={cn(
                "text-base font-semibold leading-snug tracking-tight text-balance text-foreground [overflow-wrap:anywhere] [word-break:normal] sm:text-lg",
                deckTextClass,
                hasGradient && "text-white",
              )}
            >
              {deck.name}
            </p>
            <p
              className={cn(
                "text-xs leading-relaxed line-clamp-2 text-foreground sm:line-clamp-none sm:text-sm [overflow-wrap:anywhere] [word-break:normal]",
                deckTextClass,
                deckDescriptionClass,
              )}
            >
              {deck.description ?? "No description provided."}
            </p>
          </div>
          <div
            className={cn(
              "flex shrink-0 items-center justify-between gap-3 border-t pt-2 text-xs tabular-nums sm:flex-col sm:items-end sm:justify-center sm:gap-1 sm:border-0 sm:pt-0",
              hasGradient ? "border-white/15" : "border-border/50",
              deckMetaClass,
            )}
          >
            <span className="font-medium sm:w-16 sm:text-right">
              {deck.cardCount}{" "}
              {deck.cardCount === 1 ? "card" : "cards"}
            </span>
            <span className="text-right sm:w-44">
              Updated {updatedLabel}
            </span>
          </div>
        </div>
      )}
    </Card>
  );

  return (
    <div className={wrapperClass}>
      {variant === "team-preview" ? (
        <Dialog
          open={teamWorkspaceDialogOpen}
          onOpenChange={setTeamWorkspaceDialogOpen}
        >
          <DialogTrigger
            nativeButton={false}
            render={deckTriggerRender}
            className={triggerClassName}
          >
            {withGridCoverHover(deckCard)}
          </DialogTrigger>
          <DialogContent
            className="w-[calc(100vw-2rem)] max-w-md mx-4 sm:mx-auto gap-0 p-0 sm:max-w-sm"
            showCloseButton={false}
          >
            <div className="grid gap-4 p-4 pt-5">
              <DialogHeader className="text-left sm:text-left gap-1.5">
                <DialogTitle className="text-base sm:text-lg pr-8">
                  {deck.name}
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm text-pretty">
                  {deck.description ?? "No description provided."}
                  <span className="mt-2 block text-muted-foreground tabular-nums">
                    {deck.cardCount}{" "}
                    {deck.cardCount === 1 ? "card" : "cards"}
                    {" · "}Updated {updatedLabel}
                  </span>
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                {canEditContent ? (
                  <Link
                    href={openDeckHref}
                    className={cn(
                      buttonVariants({ variant: "default", size: "sm" }),
                      "w-full justify-center gap-2 font-medium no-underline",
                    )}
                    onClick={() => setTeamWorkspaceDialogOpen(false)}
                  >
                    <BookOpen className="size-4 shrink-0" aria-hidden />
                    Open deck
                  </Link>
                ) : null}
                <Link
                  href={studyHref}
                  className={cn(
                    buttonVariants({
                      variant: canEditContent ? "outline" : "default",
                      size: "sm",
                    }),
                    "w-full justify-center gap-2 font-medium no-underline",
                  )}
                  onClick={() => setTeamWorkspaceDialogOpen(false)}
                >
                  <GraduationCap className="size-4 shrink-0" aria-hidden />
                  Study
                </Link>
                {previewControlsFor(false)}
                {deckEditMenuButton(false, () => setTeamWorkspaceDialogOpen(false))}
                {canEditContent ? (
                  <button
                    type="button"
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "sm" }),
                      "w-full justify-center gap-2 font-medium text-destructive hover:bg-destructive/10 hover:text-destructive",
                    )}
                    onClick={() => {
                      setTeamWorkspaceDialogOpen(false);
                      setDeleteOpen(true);
                    }}
                  >
                    <Trash2 className="size-4 shrink-0" aria-hidden />
                    Delete deck
                  </button>
                ) : null}
              </div>
            </div>
            <DialogFooter className="sm:gap-0">
              <DialogClose render={<Button variant="outline" type="button" className="w-full sm:w-auto" />}>
                Cancel
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : (
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger
            nativeButton={false}
            render={deckTriggerRender}
            className={triggerClassName}
          >
            {withGridCoverHover(deckCard)}
          </PopoverTrigger>

          <PopoverContent
            className={cn(
              "gap-0 p-1 shadow-md",
              teamTierPreviewPromo && deck.cardCount > 0
                ? "w-[min(13.5rem,calc(100vw-1.25rem))] sm:w-56"
                : "w-[min(11.25rem,calc(100vw-1.25rem))]",
            )}
            align="start"
            sideOffset={4}
          >
            <PopoverHeader className="px-2 pt-1.5 pb-0">
              <PopoverTitle className="text-xs font-medium leading-tight text-foreground line-clamp-1">
                {deck.name}
              </PopoverTitle>
            </PopoverHeader>
            <div className="flex flex-col gap-px px-1 pb-1">
              <Link
                href={openDeckHref}
                className={cn(
                  buttonVariants({ variant: "ghost", size: "xs" }),
                  "w-full justify-start gap-2 px-2 font-normal rounded-md",
                )}
                onClick={() => setPopoverOpen(false)}
              >
                <BookOpen className="size-3.5 text-muted-foreground shrink-0" />
                Open deck
              </Link>

              <Link
                href={studyHref}
                className={cn(
                  buttonVariants({ variant: "ghost", size: "xs" }),
                  "w-full justify-start gap-2 px-2 font-normal rounded-md",
                  deck.cardCount === 0 && "pointer-events-none opacity-40",
                )}
                onClick={() => setPopoverOpen(false)}
                aria-disabled={deck.cardCount === 0}
                tabIndex={deck.cardCount === 0 ? -1 : undefined}
              >
                <GraduationCap className="size-3.5 text-muted-foreground shrink-0" />
                Study
              </Link>

              {previewControlsFor(true)}

              {deckEditMenuButton(true, () => setPopoverOpen(false))}

              <div className="my-0.5 h-px bg-border" />

              <button
                type="button"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "xs" }),
                  "w-full justify-start gap-2 px-2 font-normal rounded-md",
                  "text-destructive hover:text-destructive hover:bg-destructive/10",
                )}
                onClick={() => {
                  setPopoverOpen(false);
                  setDeleteOpen(true);
                }}
              >
                <Trash2 className="size-3.5 shrink-0" />
                Delete deck
              </button>
            </div>
          </PopoverContent>
        </Popover>
      )}

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
        hasAiReading={hasAiReading}
      />

      {/* Edit deck — rendered outside popover so it stays mounted when the menu closes */}
      {showDeckEdit ? (
        <EditDeckDialog
          deck={editDeckPayload}
          allowCoverUpload={allowCoverUpload}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          hideTrigger
        />
      ) : null}

      {/* Delete confirmation dialog — full variant only */}
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
