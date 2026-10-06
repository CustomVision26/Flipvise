"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { Hash } from "lucide-react";
import { setViewModeAction } from "@/actions/view-mode";
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
import { Separator } from "@/components/ui/separator";
import { DeckCardPopover } from "@/components/deck-card-popover";
import {
  ViewModeDropdown,
  type ViewMode,
  type SortOption as DropdownSortOption,
} from "@/components/view-mode-dropdown";
import { cn } from "@/lib/utils";

type DeckData = {
  id: number;
  userId: string;
  name: string;
  description: string | null;
  cardCount: number;
  createdAt: Date;
  updatedAt: Date;
  gradeLevel?: string | null;
  difficultyLevel?: string | null;
  teamId?: number | null;
  /** Team workspace deck cover (dashboard card hero). */
  coverImageUrl?: string | null;
  /** First card in preview order (latest `updatedAt`) — front image for team-tier preview promo. */
  firstPreviewCardFrontImageUrl?: string | null;
  gradient?: string | null;
  /** Education team admins — false for owner-assigned decks (study/preview only). */
  canEditContent?: boolean;
};

type SortOption =
  | "newest"
  | "oldest"
  | "name-asc"
  | "name-desc"
  | "cards-desc"
  | "cards-asc";

const PAGE_SIZE_OPTIONS = [6, 9, 12, 24] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

const SORT_OPTIONS: DropdownSortOption<SortOption>[] = [
  { value: "newest", label: "Recently updated" },
  { value: "oldest", label: "Oldest updated" },
  { value: "name-asc", label: "Name A → Z" },
  { value: "name-desc", label: "Name Z → A" },
  { value: "cards-desc", label: "Most cards" },
  { value: "cards-asc", label: "Fewest cards" },
];

function resolveDeckPopoverVariant(
  deck: DeckData,
  defaultVariant: "full" | "team-preview",
): "full" | "team-preview" {
  if (deck.canEditContent === true) return "full";
  if (deck.canEditContent === false) return "team-preview";
  return defaultVariant;
}

function isTeamAdminCreatedDeck(deck: DeckData): boolean {
  return deck.canEditContent === true;
}

function TeamAdminDeckGroupDivider({
  label,
  compact,
}: {
  label: string;
  compact: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 py-2",
        compact && "col-span-full",
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <Separator />
    </div>
  );
}

function TeamAdminDeckGroupEmpty({
  message,
  compact,
}: {
  message: string;
  compact: boolean;
}) {
  return (
    <p
      className={cn(
        "text-muted-foreground px-1 pb-2 text-xs",
        compact && "col-span-full",
      )}
    >
      {message}
    </p>
  );
}

function sortDecks(decks: DeckData[], sort: SortOption): DeckData[] {
  const sorted = [...decks];
  switch (sort) {
    case "newest":
      return sorted.sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
      );
    case "oldest":
      return sorted.sort(
        (a, b) => a.updatedAt.getTime() - b.updatedAt.getTime(),
      );
    case "name-asc":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "name-desc":
      return sorted.sort((a, b) => b.name.localeCompare(a.name));
    case "cards-desc":
      return sorted.sort((a, b) => b.cardCount - a.cardCount);
    case "cards-asc":
      return sorted.sort((a, b) => a.cardCount - b.cardCount);
  }
}

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

interface DeckGridProps {
  decks: DeckData[];
  initialView?: ViewMode;
  workspaceQueryString?: string;
  deckPopoverVariant?: "full" | "team-preview";
  /** Team-tier subscriber — deck cover upload in edit dialog. */
  allowCoverUpload?: boolean;
  /** Team Clerk plan — richer “preview cards” entry with first-card image + CTA. */
  teamTierPreviewPromo?: boolean;
  hasAiReading?: boolean;
  /** Education / teacher-tools — detailed permanent-delete warning. */
  detailedDeleteWarning?: boolean;
  /**
   * Education Gold/Enterprise team admin — decks this admin created vs owner-set
   * (or plan) create allowance. Shown beside the “Showing …” range on Team Dash.
   */
  createQuota?: { used: number; max: number } | null;
  /**
   * Education team admin Team Dashboard — split owner-assigned decks from decks
   * this admin created, with a labeled divider between the groups.
   */
  groupOwnerAssignedFromCreated?: boolean;
}

export function DeckGrid({
  decks,
  initialView = "grid",
  workspaceQueryString,
  deckPopoverVariant = "full",
  allowCoverUpload = false,
  teamTierPreviewPromo = false,
  hasAiReading = false,
  detailedDeleteWarning = false,
  createQuota = null,
  groupOwnerAssignedFromCreated = false,
}: DeckGridProps) {
  const [sort, setSort] = useState<SortOption>("newest");
  const [pageSize, setPageSize] = useState<PageSize>(9);
  const [page, setPage] = useState(1);
  const [view, setView] = useState<ViewMode>(initialView);
  const [, startTransition] = useTransition();

  function handleViewChange(next: ViewMode) {
    setView(next);
    startTransition(() => {
      setViewModeAction({ scope: "decks", view: next }).catch(() => {});
    });
  }

  const assignedSorted = useMemo(
    () =>
      groupOwnerAssignedFromCreated
        ? sortDecks(
            decks.filter((deck) => !isTeamAdminCreatedDeck(deck)),
            sort,
          )
        : [],
    [decks, groupOwnerAssignedFromCreated, sort],
  );
  const createdSorted = useMemo(
    () =>
      groupOwnerAssignedFromCreated
        ? sortDecks(decks.filter(isTeamAdminCreatedDeck), sort)
        : [],
    [decks, groupOwnerAssignedFromCreated, sort],
  );
  const sorted = useMemo(
    () =>
      groupOwnerAssignedFromCreated
        ? [...assignedSorted, ...createdSorted]
        : sortDecks(decks, sort),
    [
      assignedSorted,
      createdSorted,
      decks,
      groupOwnerAssignedFromCreated,
      sort,
    ],
  );

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
      {/* Controls bar */}
      <div className="flex flex-col gap-2 border-b border-border/50 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-xs sm:text-sm tabular-nums">
          {sorted.length === 0
            ? "No decks"
            : `Showing ${startIndex + 1}–${endIndex} of ${sorted.length} deck${sorted.length !== 1 ? "s" : ""}`}
          {createQuota != null ? (
            <span className="ml-2 text-foreground/90">
              · Created {createQuota.used} / {createQuota.max}
            </span>
          ) : null}
        </p>
        <div className="flex flex-wrap items-center gap-2">
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
            <Hash className="h-3.5 w-3.5 text-muted-foreground" />
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
        <div className="hidden sm:flex items-center gap-3 sm:gap-4 px-4 pb-1 text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
          <span className="flex-1">Name / Description</span>
          <span className="w-16 text-right">Cards</span>
          <span className="w-44 text-right">Updated</span>
        </div>
      )}

      {/* Deck container — Grid & List are stacked rows; Compact is a tile grid */}
      <div
        className={
          view === "compact"
            ? "grid grid-cols-2 items-stretch gap-2 sm:gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
            : view === "list"
              ? "flex flex-col gap-1"
              : "flex flex-col gap-3"
        }
      >
        {groupOwnerAssignedFromCreated &&
        assignedSorted.length === 0 &&
        safePage === 1 ? (
          <>
            <TeamAdminDeckGroupDivider
              label="Assigned by workspace owner"
              compact={view === "compact"}
            />
            <TeamAdminDeckGroupEmpty
              message="None assigned yet."
              compact={view === "compact"}
            />
          </>
        ) : null}
        {paginated.map((deck, index) => {
          const created = isTeamAdminCreatedDeck(deck);
          const previous = index === 0 ? null : paginated[index - 1];
          const previousCreated =
            previous != null ? isTeamAdminCreatedDeck(previous) : false;
          const showAssignedHeader =
            groupOwnerAssignedFromCreated &&
            !created &&
            (index === 0 || previousCreated);
          const showCreatedHeader =
            groupOwnerAssignedFromCreated &&
            created &&
            (index === 0 || !previousCreated);
          const compact = view === "compact";

          return (
            <Fragment key={deck.id}>
              {showAssignedHeader ? (
                <TeamAdminDeckGroupDivider
                  label="Assigned by workspace owner"
                  compact={compact}
                />
              ) : null}
              {showCreatedHeader ? (
                <TeamAdminDeckGroupDivider
                  label="Created by you"
                  compact={compact}
                />
              ) : null}
              <DeckCardPopover
                deck={deck}
                view={view}
                workspaceQueryString={workspaceQueryString}
                variant={resolveDeckPopoverVariant(deck, deckPopoverVariant)}
                canEditContent={deck.canEditContent}
                allowCoverUpload={allowCoverUpload}
                teamTierPreviewPromo={teamTierPreviewPromo}
                hasAiReading={hasAiReading}
                detailedDeleteWarning={detailedDeleteWarning}
              />
            </Fragment>
          );
        })}
        {groupOwnerAssignedFromCreated &&
        createdSorted.length === 0 &&
        safePage === totalPages ? (
          <>
            <TeamAdminDeckGroupDivider
              label="Created by you"
              compact={view === "compact"}
            />
            <TeamAdminDeckGroupEmpty
              message="None yet — create decks from Teacher tools."
              compact={view === "compact"}
            />
          </>
        ) : null}
      </div>

      {/* Pagination */}
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
