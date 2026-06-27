"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Sparkles,
  ListChecks,
  Hash,
} from "lucide-react";
import { setViewModeAction } from "@/actions/view-mode";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  ViewModeDropdown,
  type ViewMode,
  type SortOption as DropdownSortOption,
} from "@/components/view-mode-dropdown";
import { cn } from "@/lib/utils";
import { CardFrontImage } from "./card-front-image";
import { EditCardDialog } from "./edit-card-dialog";
import { DeleteCardDialog } from "./delete-card-dialog";
import {
  ItemWatermark,
  itemCardContainerClass,
  itemPrimaryTextClass,
} from "@/components/item-watermark";

type CardData = {
  id: number;
  deckId: number;
  front: string | null;
  frontImageUrl: string | null;
  back: string | null;
  backImageUrl: string | null;
  aiGenerated: boolean;
  cardType: "standard" | "multiple_choice";
  choices: string[] | null;
  correctChoiceIndex: number | null;
  createdAt: Date;
  updatedAt: Date;
};

type SortOption = "newest" | "oldest" | "front-asc" | "front-desc" | "ai-first";

const PAGE_SIZE_OPTIONS = [6, 9, 12, 24, 48] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

// Elevated, near-opaque surface so card rows lift off the deck's gradient page
// background and stay clearly legible — matching the dashboard deck rows.
const cardSurfaceClass =
  "border border-border/80 bg-card/95 ring-1 ring-foreground/20 shadow-lg shadow-black/30 backdrop-blur-md hover:bg-card";

const SORT_OPTIONS: DropdownSortOption<SortOption>[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "front-asc", label: "Front A → Z" },
  { value: "front-desc", label: "Front Z → A" },
  { value: "ai-first", label: "AI generated first" },
];

function buildPageList(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: (number | "ellipsis")[] = [];
  const showLeftEllipsis = current > 3;
  const showRightEllipsis = current < total - 2;

  pages.push(1);
  if (showLeftEllipsis) pages.push("ellipsis");

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  if (showRightEllipsis) pages.push("ellipsis");
  pages.push(total);
  return pages;
}

function sortCards(cards: CardData[], sort: SortOption): CardData[] {
  const sorted = [...cards];
  switch (sort) {
    case "newest":
      return sorted.sort((a, b) => b.id - a.id);
    case "oldest":
      return sorted.sort((a, b) => a.id - b.id);
    case "front-asc":
      return sorted.sort((a, b) =>
        (a.front ?? "").localeCompare(b.front ?? "")
      );
    case "front-desc":
      return sorted.sort((a, b) =>
        (b.front ?? "").localeCompare(a.front ?? "")
      );
    case "ai-first":
      return sorted.sort((a, b) => Number(b.aiGenerated) - Number(a.aiGenerated));
  }
}

function cardTypeBadges(card: CardData, isMC: boolean) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {isMC ? (
        <Badge
          variant="outline"
          className="gap-1 px-1.5 py-0 text-[10px] font-normal border-primary/40"
        >
          <ListChecks className="size-3 text-primary" />
          MC
        </Badge>
      ) : (
        <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
          Standard
        </Badge>
      )}
      {card.aiGenerated && (
        <Badge variant="outline" className="gap-1 px-1.5 py-0 text-[10px] font-normal">
          <Sparkles className="size-3 text-primary" />
          AI
        </Badge>
      )}
    </div>
  );
}

function CardFaceText({
  front,
  correctAnswer,
  isMC,
  frontImageUrl,
  backImageUrl,
  cardTextClass,
  variant = "list",
}: {
  front: string | null;
  correctAnswer: string;
  isMC: boolean;
  frontImageUrl: string | null;
  backImageUrl: string | null;
  cardTextClass: string;
  variant?: "list" | "compact";
}) {
  const backText = correctAnswer || (backImageUrl ? "Image answer" : "No answer");
  const frontText = front ?? "No question";

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1">
      {variant === "compact" && frontImageUrl ? (
        <CardFrontImage
          src={frontImageUrl}
          alt={front ?? (isMC ? "Question image" : "Front image")}
          label={isMC ? "Question image" : "Front image"}
          variant="tile"
        />
      ) : null}
      <div className="flex items-start gap-2.5 min-w-0">
        {frontImageUrl ? (
          <CardFrontImage
            src={frontImageUrl}
            alt={front ?? (isMC ? "Question image" : "Front image")}
            label={isMC ? "Question image" : "Front image"}
            variant="thumb"
            className={variant === "compact" ? "hidden" : "h-9 w-9 sm:h-10 sm:w-10"}
          />
        ) : null}
        <p
          className={cn(
            "min-w-0 flex-1 font-semibold leading-snug text-card-foreground [overflow-wrap:anywhere]",
            variant === "compact"
              ? "line-clamp-2 text-[11px]"
              : "line-clamp-2 text-xs sm:text-sm",
            cardTextClass,
            !front && "italic text-muted-foreground",
          )}
          title={front ?? undefined}
        >
          {frontText}
        </p>
      </div>
      <p
        className={cn(
          "leading-snug text-muted-foreground line-clamp-2 [overflow-wrap:anywhere]",
          variant === "compact" ? "text-[10px]" : "text-[11px] sm:text-xs",
          cardTextClass,
        )}
        title={backText}
      >
        {backText}
      </p>
    </div>
  );
}

function CardFrontTableCell({
  front,
  isMC,
  frontImageUrl,
  cardTextClass,
}: {
  front: string | null;
  isMC: boolean;
  frontImageUrl: string | null;
  cardTextClass: string;
}) {
  const frontText = front ?? (frontImageUrl ? "Image card" : "—");

  return (
    <div className="flex min-w-[12rem] items-start gap-3 py-0.5">
      {frontImageUrl ? (
        <CardFrontImage
          src={frontImageUrl}
          alt={front ?? (isMC ? "Question image" : "Front image")}
          label={isMC ? "Question image" : "Front image"}
          variant="thumb"
          className="h-11 w-11 shrink-0 sm:h-12 sm:w-12"
        />
      ) : null}
      <p
        className={cn(
          "min-w-0 flex-1 whitespace-normal text-sm font-medium leading-relaxed text-foreground [overflow-wrap:anywhere] [word-break:normal] sm:text-[0.9375rem]",
          cardTextClass,
          !front && !frontImageUrl && "text-muted-foreground",
        )}
      >
        {frontText}
      </p>
    </div>
  );
}

interface CardGridProps {
  cards: CardData[];
  deckId: number;
  hasAI?: boolean;
  initialView?: ViewMode;
}

export function CardGrid({
  cards,
  deckId,
  hasAI = false,
  initialView = "grid",
}: CardGridProps) {
  const [sort, setSort] = useState<SortOption>("newest");
  const [pageSize, setPageSize] = useState<PageSize>(9);
  const [page, setPage] = useState(1);
  const [view, setView] = useState<ViewMode>(initialView);
  const [, startTransition] = useTransition();

  function handleViewChange(next: ViewMode) {
    setView(next);
    startTransition(() => {
      setViewModeAction({ scope: "cards", view: next }).catch(() => {});
    });
  }

  const sorted = useMemo(() => sortCards(cards, sort), [cards, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, sorted.length);
  const paginated = sorted.slice(startIndex, endIndex);
  const pageList = buildPageList(safePage, totalPages);

  function goToPage(target: number) {
    if (target < 1 || target > totalPages) return;
    setPage(target);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-xs sm:text-sm tabular-nums">
          {sorted.length === 0
            ? "No cards"
            : `Showing ${startIndex + 1}–${endIndex} of ${sorted.length} card${sorted.length !== 1 ? "s" : ""}`}
        </p>
        <div className="flex flex-wrap items-center gap-2 sm:self-end">
          <ViewModeDropdown
            view={view}
            onViewChange={handleViewChange}
            sort={sort}
            onSortChange={(v) => {
              setSort(v);
              setPage(1);
            }}
            sortOptions={SORT_OPTIONS}
          />
          <div className="flex items-center gap-1.5">
            <Hash className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                setPageSize(Number(v) as PageSize);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue placeholder="Per page" />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size} per page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {view === "grid" && paginated.length > 0 ? (
        <div
          className={cn(
            "overflow-hidden rounded-xl",
            cardSurfaceClass,
          )}
        >
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="min-w-[14rem] whitespace-normal pl-4">
                  Front
                </TableHead>
                <TableHead className="hidden w-28 sm:table-cell">Type</TableHead>
                <TableHead className="hidden w-36 md:table-cell">Updated</TableHead>
                <TableHead className="w-[1%] pr-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((card, i) => {
                const isMC = card.cardType === "multiple_choice";
                const updatedLabel = card.updatedAt.toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                });
                const updatedShort = card.updatedAt.toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                });
                const cardTextClass = itemPrimaryTextClass(false);

                return (
                  <TableRow
                    key={card.id}
                    className="animate-in fade-in-0 duration-200 fill-mode-both"
                    style={{ animationDelay: `${i * 20}ms` }}
                  >
                    <TableCell className="whitespace-normal pl-4 align-top">
                      <CardFrontTableCell
                        front={card.front}
                        isMC={isMC}
                        frontImageUrl={card.frontImageUrl}
                        cardTextClass={cardTextClass}
                      />
                    </TableCell>
                    <TableCell className="hidden align-top sm:table-cell">
                      {cardTypeBadges(card, isMC)}
                    </TableCell>
                    <TableCell className="hidden align-top text-xs text-muted-foreground tabular-nums md:table-cell">
                      <span className="hidden lg:inline">{updatedLabel}</span>
                      <span className="lg:hidden">{updatedShort}</span>
                    </TableCell>
                    <TableCell className="pr-4 align-top">
                      <div className="flex items-center justify-end gap-1">
                        <EditCardDialog card={card} deckId={deckId} hasAI={hasAI} />
                        <DeleteCardDialog cardId={card.id} deckId={deckId} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
      <div
        className={
          view === "compact"
            ? "grid grid-cols-2 items-stretch gap-1.5 sm:grid-cols-3 sm:gap-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
            : "flex flex-col gap-1"
        }
      >
        {paginated.map((card, i) => {
          const isMC = card.cardType === "multiple_choice";
          const correctAnswer = (() => {
            if (!isMC) return card.back ?? "";
            const correctIdx = card.correctChoiceIndex ?? 0;
            return card.choices?.[correctIdx] ?? card.back ?? "";
          })();
          const updatedLabel = card.updatedAt.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          });
          const updatedShort = card.updatedAt.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          });
          const updatedCompact = card.updatedAt.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
          });

          // Card text sits on the solid card surface (not the deck gradient).
          const cardTextClass = itemPrimaryTextClass(false);

          if (view === "list") {
            return (
              <Card
                key={card.id}
                className={cn(
                  itemCardContainerClass,
                  cardSurfaceClass,
                  "flex flex-row items-center gap-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-200 fill-mode-both hover:shadow-xl transition-[box-shadow] py-2.5 px-3 min-h-[3.25rem]",
                )}
                style={{ animationDelay: `${i * 20}ms` }}
              >
                <ItemWatermark label="CARD" view="list" />
                <CardFaceText
                  front={card.front}
                  correctAnswer={correctAnswer}
                  isMC={isMC}
                  frontImageUrl={card.frontImageUrl}
                  backImageUrl={card.backImageUrl}
                  cardTextClass={cardTextClass}
                  variant="list"
                />
                <span className="hidden shrink-0 text-xs text-muted-foreground tabular-nums lg:inline">
                  {updatedShort}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  <EditCardDialog card={card} deckId={deckId} hasAI={hasAI} />
                  <DeleteCardDialog cardId={card.id} deckId={deckId} />
                </div>
              </Card>
            );
          }

          if (view === "compact") {
            return (
              <Card
                key={card.id}
                className={cn(
                  itemCardContainerClass,
                  cardSurfaceClass,
                  "flex h-full min-h-[120px] flex-col gap-1 rounded-md py-2 px-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-200 fill-mode-both transition-shadow hover:shadow-xl",
                )}
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <ItemWatermark label="CARD" view="compact" />
                <div className="flex min-h-0 flex-1 flex-col gap-1">
                  <div className="flex min-h-3 shrink-0 items-center gap-0.5">
                    {cardTypeBadges(card, isMC)}
                  </div>
                  <CardFaceText
                    front={card.front}
                    correctAnswer={correctAnswer}
                    isMC={isMC}
                    frontImageUrl={card.frontImageUrl}
                    backImageUrl={card.backImageUrl}
                    cardTextClass={cardTextClass}
                    variant="compact"
                  />
                </div>
                <div className="mt-auto flex shrink-0 items-center justify-between gap-0.5 border-t border-border/30 pt-1">
                  <span className="truncate text-[8px] text-muted-foreground tabular-nums">
                    {updatedCompact}
                  </span>
                  <div className="flex shrink-0 items-center [&_button]:h-5 [&_button]:min-h-5 [&_button]:px-1 [&_button]:text-[9px]">
                    <EditCardDialog card={card} deckId={deckId} hasAI={hasAI} />
                    <DeleteCardDialog cardId={card.id} deckId={deckId} />
                  </div>
                </div>
              </Card>
            );
          }

          return null;
        })}
      </div>
      )}

      {totalPages > 1 && (
        <Pagination className="pt-2">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                aria-disabled={safePage === 1}
                className={
                  safePage === 1
                    ? "pointer-events-none opacity-50"
                    : undefined
                }
                onClick={(e) => {
                  e.preventDefault();
                  goToPage(safePage - 1);
                }}
              />
            </PaginationItem>
            {pageList.map((item, i) =>
              item === "ellipsis" ? (
                <PaginationItem key={`ellipsis-${i}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={item}>
                  <PaginationLink
                    href="#"
                    isActive={item === safePage}
                    onClick={(e) => {
                      e.preventDefault();
                      goToPage(item);
                    }}
                  >
                    {item}
                  </PaginationLink>
                </PaginationItem>
              ),
            )}
            <PaginationItem>
              <PaginationNext
                href="#"
                aria-disabled={safePage === totalPages}
                className={
                  safePage === totalPages
                    ? "pointer-events-none opacity-50"
                    : undefined
                }
                onClick={(e) => {
                  e.preventDefault();
                  goToPage(safePage + 1);
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
