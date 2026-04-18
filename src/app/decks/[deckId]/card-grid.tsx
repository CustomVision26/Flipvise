"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import {
  Sparkles,
  CheckCircle2,
  ListChecks,
  Hash,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { setViewModeAction } from "@/actions/view-mode";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { EditCardDialog } from "./edit-card-dialog";
import { DeleteCardDialog } from "./delete-card-dialog";

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
  const [hiddenActionRows, setHiddenActionRows] = useState<Set<number>>(
    new Set(),
  );
  const [, startTransition] = useTransition();

  function handleViewChange(next: ViewMode) {
    setView(next);
    startTransition(() => {
      setViewModeAction({ scope: "cards", view: next }).catch(() => {});
    });
  }

  function toggleRowActions(id: number) {
    setHiddenActionRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
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

      {/* Optional column header for detailed Grid view */}
      {view === "grid" && paginated.length > 0 && (
        <div className="hidden md:flex items-center gap-3 md:gap-4 px-4 pb-1 text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
          <span className="flex-1">Question / Front</span>
          <span className="flex-1">Answer / Back</span>
          <span className="w-20 text-right">Type</span>
          <span className="w-40 text-right">Updated</span>
          <span className="w-28 text-right" aria-hidden />
        </div>
      )}

      <div
        className={
          view === "compact"
            ? "grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
            : view === "list"
              ? "flex flex-col gap-1"
              : "flex flex-col gap-2"
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

          if (view === "list") {
            return (
              <Card
                key={card.id}
                className="flex flex-row items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200 fill-mode-both hover:shadow-md transition-[box-shadow] py-2 px-3"
                style={{ animationDelay: `${i * 20}ms` }}
              >
                <div className="flex shrink-0 items-center gap-1">
                  {isMC && (
                    <ListChecks className="size-3.5 text-primary" aria-label="Multiple choice" />
                  )}
                  {card.aiGenerated && (
                    <Sparkles className="size-3.5 text-primary" aria-label="AI generated" />
                  )}
                </div>
                <p className="flex-1 min-w-0 text-sm font-medium text-foreground line-clamp-1">
                  {card.front ?? "(no front)"}
                </p>
                <span className="hidden sm:inline shrink-0 text-xs text-muted-foreground tabular-nums">
                  {updatedShort}
                </span>
                <div className="flex shrink-0 items-center gap-1 self-center">
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
                className="flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-200 fill-mode-both hover:shadow-md hover:-translate-y-0.5 transition-[box-shadow,transform] py-3 px-3 gap-1.5"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <div className="flex flex-wrap items-center gap-1">
                  {isMC && (
                    <Badge
                      variant="outline"
                      className="gap-1 px-1 py-0 text-[9px] font-normal border-primary/40"
                    >
                      <ListChecks className="size-2.5 text-primary" />
                      MC
                    </Badge>
                  )}
                  {card.aiGenerated && (
                    <Badge
                      variant="outline"
                      className="gap-1 px-1 py-0 text-[9px] font-normal"
                    >
                      <Sparkles className="size-2.5 text-primary" />
                      AI
                    </Badge>
                  )}
                </div>
                {card.frontImageUrl ? (
                  <div className="relative h-16 w-full rounded-md overflow-hidden border border-border bg-muted/30">
                    <Image
                      src={card.frontImageUrl}
                      alt={isMC ? "Question image" : "Front image"}
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : null}
                {card.front && (
                  <p className="text-foreground text-xs font-medium line-clamp-2">
                    {card.front}
                  </p>
                )}
                <div className="flex-1" />
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] text-muted-foreground tabular-nums truncate">
                    {updatedShort}
                  </span>
                  <div className="flex items-center gap-1">
                    <EditCardDialog card={card} deckId={deckId} hasAI={hasAI} />
                    <DeleteCardDialog cardId={card.id} deckId={deckId} />
                  </div>
                </div>
              </Card>
            );
          }

          // Default: Grid = detailed table row — show every field fully, no truncation
          return (
            <Card
              key={card.id}
              className="flex flex-col md:flex-row items-stretch md:items-start gap-3 md:gap-4 animate-in fade-in slide-in-from-bottom-2 duration-200 fill-mode-both hover:shadow-md transition-[box-shadow] py-3 px-4"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <div className="md:flex-1 min-w-0 flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground md:hidden">
                  {isMC ? "Question" : "Front"}
                </span>
                <div className="flex items-start gap-2">
                  {card.frontImageUrl && (
                    <div className="relative h-10 w-10 shrink-0 rounded-md overflow-hidden border border-border bg-muted/30">
                      <Image
                        src={card.frontImageUrl}
                        alt=""
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                  <p className="text-sm font-medium text-foreground break-words whitespace-pre-wrap min-w-0">
                    {card.front ?? "(no front)"}
                  </p>
                </div>
              </div>
              <div className="md:flex-1 min-w-0 flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground md:hidden">
                  {isMC ? "Answer" : "Back"}
                </span>
                <div className="flex items-start gap-1.5 text-sm text-muted-foreground">
                  {isMC && (
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                  )}
                  {card.backImageUrl && !correctAnswer && (
                    <div className="relative h-10 w-10 shrink-0 rounded-md overflow-hidden border border-border bg-muted/30">
                      <Image
                        src={card.backImageUrl}
                        alt=""
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                  <span className="break-words whitespace-pre-wrap min-w-0">
                    {correctAnswer || (card.backImageUrl ? "(image)" : "(no back)")}
                  </span>
                </div>
              </div>
              <div className="flex flex-row md:flex-col md:w-20 shrink-0 items-start md:items-end gap-1 flex-wrap">
                <span className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground md:hidden mr-1 self-center">
                  Type
                </span>
                {isMC ? (
                  <Badge
                    variant="outline"
                    className="gap-1 px-1.5 py-0 text-[10px] font-normal border-primary/40"
                  >
                    <ListChecks className="size-3 text-primary" />
                    MC
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="px-1.5 py-0 text-[10px] font-normal"
                  >
                    Standard
                  </Badge>
                )}
                {card.aiGenerated && (
                  <Badge
                    variant="outline"
                    className="gap-1 px-1.5 py-0 text-[10px] font-normal"
                  >
                    <Sparkles className="size-3 text-primary" />
                    AI
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1 md:w-40 shrink-0 md:justify-end md:self-center">
                <span className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground md:hidden">
                  Updated
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {updatedLabel}
                </span>
              </div>
              <div className="flex md:w-28 shrink-0 items-center justify-end gap-1 md:self-center">
                {!hiddenActionRows.has(card.id) && (
                  <>
                    <EditCardDialog card={card} deckId={deckId} hasAI={hasAI} />
                    <DeleteCardDialog cardId={card.id} deckId={deckId} />
                  </>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                  aria-expanded={!hiddenActionRows.has(card.id)}
                  aria-label={
                    hiddenActionRows.has(card.id)
                      ? "Show edit and delete"
                      : "Hide edit and delete"
                  }
                  title={
                    hiddenActionRows.has(card.id)
                      ? "Show actions"
                      : "Hide actions"
                  }
                  onClick={() => toggleRowActions(card.id)}
                >
                  {hiddenActionRows.has(card.id) ? (
                    <ChevronLeft className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

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
