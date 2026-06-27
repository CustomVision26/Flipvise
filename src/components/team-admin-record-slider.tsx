"use client";

import * as React from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ClerkUserFieldDisplay } from "@/lib/clerk-user-display";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type TeamAdminRecordSort =
  | "member_az"
  | "member_za"
  | "deck_az"
  | "deck_za"
  | "date_newest"
  | "date_oldest";

const SORT_LABELS: Record<TeamAdminRecordSort, string> = {
  member_az: "Member (A–Z)",
  member_za: "Member (Z–A)",
  deck_az: "Deck (A–Z)",
  deck_za: "Deck (Z–A)",
  date_newest: "Date (newest)",
  date_oldest: "Date (oldest)",
};

const FILTER_ALL_DECKS = "__fv_all_decks__";

export function matchesMemberSearch(
  userId: string,
  display: ClerkUserFieldDisplay | undefined,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    display?.primaryLine,
    display?.primaryEmail,
    display?.secondaryLine,
    userId,
  ]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function sortTeamAdminRecords<T extends { memberLabel: string; deckName: string }>(
  items: T[],
  sort: TeamAdminRecordSort,
  getDate?: (item: T) => number | null,
): T[] {
  const copy = [...items];
  copy.sort((a, b) => {
    switch (sort) {
      case "member_az":
        return a.memberLabel.localeCompare(b.memberLabel);
      case "member_za":
        return b.memberLabel.localeCompare(a.memberLabel);
      case "deck_az":
        return a.deckName.localeCompare(b.deckName);
      case "deck_za":
        return b.deckName.localeCompare(a.deckName);
      case "date_newest":
      case "date_oldest": {
        const ta = getDate?.(a) ?? Number.NEGATIVE_INFINITY;
        const tb = getDate?.(b) ?? Number.NEGATIVE_INFINITY;
        return sort === "date_newest" ? tb - ta : ta - tb;
      }
      default:
        return 0;
    }
  });
  return copy;
}

export type TeamAdminRecordSliderProps<T extends { key: string; memberLabel: string; deckName: string }> = {
  items: T[];
  activeKey?: string | null;
  onActivate?: (item: T) => void;
  onDoubleClick?: (item: T) => void;
  renderCard: (item: T, isActive: boolean) => React.ReactNode;
  renderBelowActive?: (item: T) => React.ReactNode;
  deckFilterOptions?: string[];
  showDateSort?: boolean;
  /** When true, slide cards are non-button containers (for forms inside). */
  interactiveCard?: boolean;
  getSearchHaystack?: (item: T) => string;
  getSortDate?: (item: T) => number | null;
  emptyMessage?: string;
  noResultsMessage?: string;
  searchLabel?: string;
  searchPlaceholder?: string;
  sortLabelMap?: Partial<Record<TeamAdminRecordSort, string>>;
  allowedSortOptions?: TeamAdminRecordSort[];
  /** Optional controls rendered inside the Search & filters panel (e.g. workspace picker). */
  filterPanelExtra?: (context: { filtersOpen: boolean }) => React.ReactNode;
  filterPanelExtraActive?: boolean;
  /** Card carousel (default) or scrollable table of all filtered rows. */
  layout?: "slider" | "table";
  /** Table headers — required when `layout="table"`. */
  tableColumns?: Array<{
    id: string;
    header: string;
    className?: string;
    cell: (item: T, isActive: boolean) => React.ReactNode;
  }>;
};

export function TeamAdminRecordSlider<T extends { key: string; memberLabel: string; deckName: string }>({
  items,
  activeKey = null,
  onActivate,
  onDoubleClick,
  renderCard,
  renderBelowActive,
  deckFilterOptions,
  showDateSort = false,
  interactiveCard = false,
  getSearchHaystack,
  getSortDate,
  emptyMessage = "No records yet.",
  noResultsMessage = "No records match your search or filters.",
  searchLabel = "Search member",
  searchPlaceholder = "Name, email, or username…",
  sortLabelMap,
  allowedSortOptions,
  filterPanelExtra,
  filterPanelExtraActive = false,
  layout = "slider",
  tableColumns,
}: TeamAdminRecordSliderProps<T>) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortBy, setSortBy] = React.useState<TeamAdminRecordSort>("member_az");
  const [deckFilter, setDeckFilter] = React.useState(FILTER_ALL_DECKS);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [slideIndex, setSlideIndex] = React.useState(0);
  const trackRef = React.useRef<HTMLDivElement>(null);

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    sortBy !== "member_az" ||
    deckFilter !== FILTER_ALL_DECKS ||
    filterPanelExtraActive;

  const filteredItems = React.useMemo(() => {
    let next = items;
    if (deckFilter !== FILTER_ALL_DECKS) {
      next = next.filter((item) => item.deckName === deckFilter);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      next = next.filter((item) => {
        const haystack = (
          getSearchHaystack?.(item) ?? `${item.memberLabel} ${item.deckName}`
        ).toLowerCase();
        return haystack.includes(q);
      });
    }
    return sortTeamAdminRecords(next, sortBy, getSortDate);
  }, [items, deckFilter, searchQuery, sortBy, getSearchHaystack, getSortDate]);

  React.useEffect(() => {
    setSlideIndex(0);
  }, [searchQuery, sortBy, deckFilter, items.length]);

  React.useEffect(() => {
    if (slideIndex >= filteredItems.length && filteredItems.length > 0) {
      setSlideIndex(filteredItems.length - 1);
    }
  }, [filteredItems.length, slideIndex]);

  React.useEffect(() => {
    if (!activeKey) return;
    const index = filteredItems.findIndex((item) => item.key === activeKey);
    if (index < 0) return;
    setSlideIndex(index);
    requestAnimationFrame(() => scrollToIndex(index));
  }, [activeKey, filteredItems]);

  const activeItem = filteredItems[slideIndex] ?? null;
  const canPrev = slideIndex > 0;
  const canNext = slideIndex < filteredItems.length - 1;

  function scrollToIndex(index: number) {
    const track = trackRef.current;
    if (!track) return;
    const child = track.children[index] as HTMLElement | undefined;
    child?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  }

  function goPrev() {
    if (!canPrev) return;
    const next = slideIndex - 1;
    setSlideIndex(next);
    scrollToIndex(next);
  }

  function goNext() {
    if (!canNext) return;
    const next = slideIndex + 1;
    setSlideIndex(next);
    scrollToIndex(next);
  }

  const resolvedSortLabels = { ...SORT_LABELS, ...sortLabelMap };

  const sortOptions =
    allowedSortOptions ??
    (Object.keys(SORT_LABELS) as TeamAdminRecordSort[]).filter(
      (key) =>
        showDateSort || (key !== "date_newest" && key !== "date_oldest"),
    );

  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border/80 bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 w-full justify-between gap-2 sm:w-auto sm:min-w-[11rem]"
          onClick={() => setFiltersOpen((open) => !open)}
          aria-expanded={filtersOpen}
          aria-controls="record-slider-filters"
        >
          <span className="inline-flex min-w-0 items-center gap-2">
            <SlidersHorizontal className="size-4 shrink-0" aria-hidden />
            <span>Search & filters</span>
            {hasActiveFilters && !filtersOpen ? (
              <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                Active
              </span>
            ) : null}
          </span>
          <ChevronDown
            className={cn("size-4 shrink-0 transition-transform", filtersOpen && "rotate-180")}
            aria-hidden
          />
        </Button>

        <div
          id="record-slider-filters"
          className={cn(
            "grid gap-3 rounded-lg border border-border/70 bg-muted/15 p-4 sm:grid-cols-2 lg:grid-cols-4",
            !filtersOpen && "hidden",
          )}
          aria-hidden={!filtersOpen}
        >
            {filterPanelExtra ? (
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
                {filterPanelExtra({ filtersOpen })}
              </div>
            ) : null}
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
              <Label htmlFor="record-slider-search" className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {searchLabel}
              </Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  id="record-slider-search"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-10 bg-background pl-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="record-slider-sort" className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Sort by
              </Label>
              <Select
                value={sortBy}
                disabled={!filtersOpen}
                onValueChange={(v) => v != null && setSortBy(v as TeamAdminRecordSort)}
              >
                <SelectTrigger id="record-slider-sort" className="h-10 w-full bg-background">
                  <SelectValue placeholder="Sort by">{resolvedSortLabels[sortBy]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {sortOptions.map((value) => (
                    <SelectItem key={value} value={value}>
                      {resolvedSortLabels[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {deckFilterOptions && deckFilterOptions.length > 0 ? (
              <div className="space-y-1.5">
                <Label htmlFor="record-slider-deck" className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Filter by deck
                </Label>
                <Select
                  value={deckFilter}
                  disabled={!filtersOpen}
                  onValueChange={(v) => v != null && setDeckFilter(v)}
                >
                  <SelectTrigger id="record-slider-deck" className="h-10 w-full bg-background">
                    <SelectValue placeholder="All decks">
                      {deckFilter === FILTER_ALL_DECKS ? "All decks" : deckFilter}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={FILTER_ALL_DECKS}>All decks</SelectItem>
                    {deckFilterOptions.map((name) => (
                      <SelectItem key={name} value={name}>
                        <span className="truncate">{name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/80 bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
          {noResultsMessage}
        </p>
      ) : layout === "table" && tableColumns && tableColumns.length > 0 ? (
        <>
          <div className="overflow-x-auto -mx-1 px-1">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {tableColumns.map((col) => (
                    <TableHead key={col.id} className={col.className}>
                      {col.header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => {
                  const isActive = activeKey === item.key;
                  return (
                    <TableRow
                      key={item.key}
                      className={cn(
                        "cursor-pointer",
                        isActive && "bg-muted/40",
                      )}
                      onClick={() => onActivate?.(item)}
                      aria-selected={isActive}
                    >
                      {tableColumns.map((col) => (
                        <TableCell key={col.id} className={col.className}>
                          {col.cell(item, isActive)}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {activeItem && renderBelowActive ? (
            <div>{renderBelowActive(activeItem)}</div>
          ) : null}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="shrink-0"
              disabled={!canPrev}
              onClick={goPrev}
              aria-label="Previous record"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Button>
            <p className="text-center text-xs font-medium tabular-nums text-muted-foreground">
              {slideIndex + 1} of {filteredItems.length}
            </p>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="shrink-0"
              disabled={!canNext}
              onClick={goNext}
              aria-label="Next record"
            >
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          </div>

          <div
            ref={trackRef}
            className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            onScroll={(e) => {
              const track = e.currentTarget;
              const width = track.clientWidth;
              if (width <= 0) return;
              const index = Math.round(track.scrollLeft / width);
              if (index !== slideIndex && index >= 0 && index < filteredItems.length) {
                setSlideIndex(index);
              }
            }}
          >
            {filteredItems.map((item) => {
              const isActive = activeKey === item.key || activeItem?.key === item.key;
              const cardClass = cn(
                "w-full rounded-lg border border-border/80 bg-card/60 p-4 shadow-sm transition-colors",
                isActive
                  ? "border-primary/50 ring-1 ring-primary/20"
                  : !interactiveCard && "hover:bg-muted/30 active:bg-muted/40",
              );
              return (
                <div
                  key={item.key}
                  className="w-full min-w-full shrink-0 snap-start snap-always"
                >
                  {interactiveCard ? (
                    <div
                      className={cn(cardClass, onDoubleClick && "cursor-pointer")}
                      onDoubleClick={() => onDoubleClick?.(item)}
                    >
                      {renderCard(item, isActive)}
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={cn(cardClass, "text-left")}
                      onClick={() => onActivate?.(item)}
                    >
                      {renderCard(item, isActive)}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {activeItem && renderBelowActive ? (
            <div>{renderBelowActive(activeItem)}</div>
          ) : null}
        </>
      )}
    </div>
  );
}
