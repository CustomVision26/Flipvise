"use client";

import * as React from "react";
import { createPortal } from "react-dom";
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
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { useIllustratedAppearance } from "@/components/illustrated-appearance-provider";
import { IllustratedDeckTile } from "@/components/illustrated/surfaces";
import { deleteDeckAction, getDeckDeleteImpactAction } from "@/actions/decks";
import type { DeckDeleteImpact } from "@/db/queries/deck-delete-impact";
import { DeckDeleteWarningBody } from "@/components/deck-delete-warning-body";
import { getGradientBySlug } from "@/lib/deck-gradients";
import {
  formatDeckCardDisplayName,
  formatLessonPlanDayCardLabel,
} from "@/lib/teacher-generation-titles";
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

const DECK_ACCENTS = [
  {
    rail: "from-cyan-300 via-sky-400 to-teal-300",
    wash: "bg-[radial-gradient(120%_90%_at_0%_0%,rgba(34,211,238,0.22),transparent_58%)]",
    glow: "hover:shadow-cyan-500/25 hover:ring-cyan-300/40",
    chip: "bg-cyan-500/20 text-cyan-100 ring-cyan-300/40",
  },
  {
    rail: "from-violet-300 via-fuchsia-400 to-purple-400",
    wash: "bg-[radial-gradient(120%_90%_at_0%_0%,rgba(167,139,250,0.24),transparent_58%)]",
    glow: "hover:shadow-violet-500/25 hover:ring-violet-300/40",
    chip: "bg-violet-500/20 text-violet-100 ring-violet-300/40",
  },
  {
    rail: "from-emerald-300 via-green-400 to-teal-300",
    wash: "bg-[radial-gradient(120%_90%_at_0%_0%,rgba(52,211,153,0.22),transparent_58%)]",
    glow: "hover:shadow-emerald-500/25 hover:ring-emerald-300/40",
    chip: "bg-emerald-500/20 text-emerald-100 ring-emerald-300/40",
  },
  {
    rail: "from-amber-200 via-orange-400 to-rose-400",
    wash: "bg-[radial-gradient(120%_90%_at_0%_0%,rgba(251,191,36,0.2),transparent_58%)]",
    glow: "hover:shadow-amber-500/25 hover:ring-amber-300/40",
    chip: "bg-amber-500/20 text-amber-50 ring-amber-300/40",
  },
  {
    rail: "from-rose-300 via-pink-400 to-fuchsia-400",
    wash: "bg-[radial-gradient(120%_90%_at_0%_0%,rgba(251,113,133,0.22),transparent_58%)]",
    glow: "hover:shadow-rose-500/25 hover:ring-rose-300/40",
    chip: "bg-rose-500/20 text-rose-50 ring-rose-300/40",
  },
  {
    rail: "from-sky-300 via-indigo-400 to-blue-400",
    wash: "bg-[radial-gradient(120%_90%_at_0%_0%,rgba(96,165,250,0.24),transparent_58%)]",
    glow: "hover:shadow-sky-500/25 hover:ring-sky-300/40",
    chip: "bg-sky-500/20 text-sky-50 ring-sky-300/40",
  },
] as const;

function deckAccentFor(id: number) {
  return DECK_ACCENTS[Math.abs(id) % DECK_ACCENTS.length]!;
}

type PreviewCard = {
  id: number;
  front: string | null;
  frontImageUrl: string | null;
  back: string | null;
  backImageUrl: string | null;
  aiGenerated: boolean;
};

export type DeckView = ItemWatermarkView;

function coverPreviewStyle(anchor: DOMRect): React.CSSProperties {
  const width = Math.min(320, Math.max(160, window.innerWidth - 24));
  const gap = 10;
  const estimatedHeight = width * (10 / 16) + 8;
  const left = Math.min(
    Math.max(12, anchor.left + anchor.width / 2 - width / 2),
    window.innerWidth - width - 12,
  );
  const placeAbove = anchor.top >= estimatedHeight + gap + 8;
  if (placeAbove) {
    return {
      left,
      top: anchor.top - gap,
      width,
      transform: "translateY(-100%)",
    };
  }
  return {
    left,
    top: anchor.bottom + gap,
    width,
    transform: "none",
  };
}

function CoverHoverPreview({
  src,
  label,
  anchor,
}: {
  src: string;
  label: string;
  anchor: DOMRect;
}) {
  return (
    <Card
      size="sm"
      className="pointer-events-none fixed z-[200] overflow-hidden p-0 shadow-xl ring-1 ring-foreground/15"
      style={coverPreviewStyle(anchor)}
      aria-hidden
    >
      <div className="relative aspect-[16/10] w-full bg-muted/40">
        <Image
          src={src}
          alt=""
          fill
          className="object-contain"
          sizes="320px"
        />
      </div>
      <p className="truncate px-2.5 py-1.5 text-xs font-medium text-foreground">
        {label}
      </p>
    </Card>
  );
}

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
  /** `team-preview`: assigned team members — same compact menu; Open/Edit/Delete only if they created the deck. */
  variant?: "full" | "team-preview";
  /** Education co-admin — true when this admin created the deck in the workspace. */
  canEditContent?: boolean;
  /** Team-tier subscriber — deck cover upload in edit dialog. */
  allowCoverUpload?: boolean;
  /** Main dashboard — team-tier subscribers: preview row shows first-card image + CTA. */
  teamTierPreviewPromo?: boolean;
  /** Listen-to-card in deck preview — Pro Plus / team / platform admin only. */
  hasAiReading?: boolean;
  /**
   * Education / teacher-tools users — always show the detailed permanent-delete
   * warning (linked lesson plans, assignments, classes, etc.).
   */
  detailedDeleteWarning?: boolean;
  /** Staggers the entrance animation when decks render in a list. */
  enterIndex?: number;
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
  detailedDeleteWarning = false,
  enterIndex = 0,
}: DeckCardPopoverProps) {
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [previewCards, setPreviewCards] = React.useState<PreviewCard[]>([]);
  const [loadingPreview, setLoadingPreview] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteImpact, setDeleteImpact] =
    React.useState<DeckDeleteImpact | null>(null);
  const [deleteImpactLoading, setDeleteImpactLoading] = React.useState(false);

  const [coverAnchor, setCoverAnchor] = React.useState<DOMRect | null>(null);
  const { effectiveIllustratedDesign } = useIllustratedAppearance();
  const illustratedTile = effectiveIllustratedDesign && view !== "list";

  const displayName = formatDeckCardDisplayName(deck.name);
  const lessonPlanDayLabel = formatLessonPlanDayCardLabel(
    deck.description,
    deck.name,
  );

  async function handlePreview() {
    setPopoverOpen(false);
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

  React.useEffect(() => {
    if (!deleteOpen) {
      setDeleteImpact(null);
      setDeleteImpactLoading(false);
      return;
    }

    let cancelled = false;
    setDeleteImpactLoading(true);
    void getDeckDeleteImpactAction({ deckId: deck.id })
      .then((impact) => {
        if (!cancelled) setDeleteImpact(impact);
      })
      .catch(() => {
        if (!cancelled) setDeleteImpact(null);
      })
      .finally(() => {
        if (!cancelled) setDeleteImpactLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [deleteOpen, deck.id]);

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

  const wrapperClass = cn(
    effectiveIllustratedDesign && view !== "list"
      ? "relative h-full"
      : "animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both duration-500",
    view === "compact"
      ? "relative h-full min-h-[140px] sm:min-h-[160px]"
      : view === "list"
        ? "relative"
        : illustratedTile
          ? "relative h-full"
          : "relative min-h-[4.75rem]",
  );

  const triggerClassName = cn(
    "block w-full min-h-0 text-left cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    view === "compact" && "h-full",
  );

  const deckTriggerRender = (
    <div tabIndex={0} aria-label={`Quick actions for ${deck.name}`} />
  );

  const menuLocked = popoverOpen || previewOpen || editDialogOpen || deleteOpen;

  React.useEffect(() => {
    if (menuLocked) setCoverAnchor(null);
  }, [menuLocked]);

  React.useEffect(() => {
    if (!coverAnchor) return;
    const close = () => setCoverAnchor(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [coverAnchor]);

  const coverPreview =
    deck.coverImageUrl && coverAnchor && !menuLocked && typeof document !== "undefined"
      ? createPortal(
          <CoverHoverPreview
            src={deck.coverImageUrl}
            label={displayName}
            anchor={coverAnchor}
          />,
          document.body,
        )
      : null;

  function previewControlsFor(compact: boolean) {
    const rowGhost = cn(
      buttonVariants({ variant: "ghost", size: compact ? "xs" : "sm" }),
      compact
        ? "w-full justify-start gap-2 px-2 font-normal rounded-md"
        : "w-full justify-start gap-2.5 h-9 px-2.5 font-normal",
    );
    if (variant !== "team-preview" && teamTierPreviewPromo && deck.cardCount > 0) {
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
  const deckAccentStyle = deckAccentFor(deck.id);
  const deckMark = (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 shadow-inner transition-transform duration-300 group-hover/card:scale-105",
        hasGradient
          ? "bg-white/15 text-white ring-white/35"
          : deckAccentStyle.chip,
      )}
    >
      <BookOpen className="size-4" aria-hidden />
    </span>
  );

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

  const standardDeckCard = (
    <Card
      className={cn(
        itemCardContainerClass,
        "h-full cursor-pointer select-none border shadow-lg shadow-black/30 transition-all duration-300 active:scale-[0.99] hover:-translate-y-0.5 hover:shadow-xl",
        hasGradient
          ? cn(
              deckGradient.classes,
              "border-white/25 ring-1 ring-inset ring-white/20 hover:shadow-xl hover:ring-white/40",
            )
          : cn(
              "border-border/80 bg-card/95 ring-1 ring-foreground/15 backdrop-blur-md hover:bg-card",
              deckAccentStyle.glow,
            ),
        view === "compact"
          ? cn("flex h-full min-h-0 flex-col", hasCover && "p-0")
          : view === "list"
            ? cn(
                "flex flex-row items-center py-2.5 sm:gap-3",
                hasCover
                  ? "gap-2.5 pl-3.5 pr-3 sm:pl-4 sm:pr-3"
                  : "gap-3 pl-4 pr-3",
              )
            : "flex min-h-[4.75rem] flex-row items-center gap-3 py-3.5 pl-5 pr-4 sm:gap-4",
      )}
    >
      <ItemWatermark label="DECK" view={view} onGradient={hasGradient} />
      <span
        data-deck-accent
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 z-[3] w-1.5 bg-gradient-to-b",
          hasGradient ? "from-white/90 via-white/40 to-white/10" : deckAccentStyle.rail,
        )}
      />
      {hasGradient ? (
        <span
          data-deck-accent
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-10 z-0 size-32 rounded-full bg-white/20 blur-2xl"
        />
      ) : (
        <span
          data-deck-accent
          aria-hidden
          className={cn("pointer-events-none absolute inset-0 z-0", deckAccentStyle.wash)}
        />
      )}
      <span
        data-deck-accent
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-[3] w-1/4 -translate-x-full -skew-x-12 bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 transition-all duration-700 ease-out group-hover/card:translate-x-[420%] group-hover/card:opacity-100"
      />
      {view === "compact" && coverBanner}
      {view === "compact" ? (
        <>
          <CardHeader className="px-3 py-3 gap-1">
            {lessonPlanDayLabel ? (
              <Badge
                variant="outline"
                className={cn(
                  "w-fit max-w-full truncate text-[10px] font-medium uppercase tracking-wide",
                  hasGradient
                    ? "border-white/25 bg-white/10 text-white"
                    : "border-border/70 bg-muted/40 text-muted-foreground",
                )}
              >
                {lessonPlanDayLabel}
              </Badge>
            ) : null}
            <CardTitle
              className={cn(
                "line-clamp-2 text-sm font-semibold leading-snug tracking-tight text-balance sm:text-base",
                deckTextClass,
                hasGradient && "text-white",
              )}
            >
              {displayName}
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
          {coverThumbList ?? deckMark}
          <div className="flex-1 min-w-0">
            {lessonPlanDayLabel ? (
              <p
                className={cn(
                  "mb-0.5 truncate text-[10px] font-medium uppercase tracking-wide",
                  hasGradient ? "text-white/70" : "text-muted-foreground",
                )}
              >
                {lessonPlanDayLabel}
              </p>
            ) : null}
            <p
              className={cn(
                "line-clamp-1 text-sm font-semibold leading-snug tracking-tight",
                deckTextClass,
                hasGradient && "text-white",
              )}
            >
              {displayName}
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
          {hasCover ? null : deckMark}
          <div className="min-w-0 flex-1 flex flex-col gap-1">
            {lessonPlanDayLabel ? (
              <Badge
                variant="outline"
                className={cn(
                  "w-fit max-w-full truncate text-[10px] font-medium uppercase tracking-wide",
                  hasGradient
                    ? "border-white/25 bg-white/10 text-white"
                    : "border-border/70 bg-muted/40 text-muted-foreground",
                )}
              >
                {lessonPlanDayLabel}
              </Badge>
            ) : null}
            <p
              className={cn(
                "text-base font-semibold leading-snug tracking-tight text-balance text-foreground [overflow-wrap:anywhere] [word-break:normal] sm:text-lg",
                deckTextClass,
                hasGradient && "text-white",
              )}
            >
              {displayName}
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

  const deckCard = illustratedTile ? (
    <IllustratedDeckTile
      name={displayName}
      description={deck.description}
      gradeLevel={deck.gradeLevel}
      coverImageUrl={deck.coverImageUrl}
      cardCount={deck.cardCount}
      updatedLabel={view === "compact" ? updatedShort : `Updated ${updatedLabel}`}
    />
  ) : (
    standardDeckCard
  );

  return (
    <div
      className={wrapperClass}
      style={{ animationDelay: `${Math.min(enterIndex, 12) * 55}ms` }}
      onPointerEnter={(event) => {
        if (!deck.coverImageUrl || menuLocked) return;
        setCoverAnchor(event.currentTarget.getBoundingClientRect());
      }}
      onPointerLeave={() => setCoverAnchor(null)}
      onPointerDown={() => setCoverAnchor(null)}
    >
      {coverPreview}
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger
            nativeButton={false}
            render={deckTriggerRender}
            className={triggerClassName}
          >
            {deckCard}
          </PopoverTrigger>

          <PopoverContent
            className={cn(
              "gap-0 p-1 shadow-md",
              variant !== "team-preview" &&
                teamTierPreviewPromo &&
                deck.cardCount > 0
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
              {showDeckEdit ? (
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
              ) : null}

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

              {showDeckEdit ? (
                <>
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
                </>
              ) : null}
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
            <DeckDeleteWarningBody
              deckName={deck.name}
              forceDetailed={detailedDeleteWarning}
              impact={deleteImpact}
              impactLoading={deleteImpactLoading}
            />
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
