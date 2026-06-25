import { useEffect, useMemo, useState } from "react";
import { listCards } from "../../src/lib/offline/repository";
import type { OfflineWorkspaceContext } from "../../src/lib/offline/access-context";
import type { OfflineDeckRow } from "../../src/lib/offline/schema";
import { offlineDeckGradientStyle } from "./deck-gradients";
import {
  loadDeckSort,
  loadDeckViewMode,
  saveDeckSort,
  saveDeckViewMode,
  SORT_LABELS,
  VIEW_LABELS,
  type OfflineDeckSort,
  type OfflineDeckViewMode,
} from "./deck-library-prefs";
import type { SavedWorkspaceScope } from "./workspace-prefs";
import { WorkspaceSelector } from "./workspace-selector";

export type DeckWithCount = OfflineDeckRow & { cardCount: number };

function formatUpdated(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function sortDecks(
  decks: DeckWithCount[],
  sort: OfflineDeckSort,
): DeckWithCount[] {
  const rows = [...decks];
  switch (sort) {
    case "updated-desc":
      return rows.sort((a, b) => b.updated_at_ms - a.updated_at_ms);
    case "updated-asc":
      return rows.sort((a, b) => a.updated_at_ms - b.updated_at_ms);
    case "name-asc":
      return rows.sort((a, b) => a.name.localeCompare(b.name));
    case "name-desc":
      return rows.sort((a, b) => b.name.localeCompare(a.name));
    case "cards-desc":
      return rows.sort((a, b) => b.cardCount - a.cardCount);
    case "cards-asc":
      return rows.sort((a, b) => a.cardCount - b.cardCount);
  }
}

function DeckTile({
  deck,
  view,
  onOpen,
}: {
  deck: DeckWithCount;
  view: OfflineDeckViewMode;
  onOpen: () => void;
}) {
  const gradient = offlineDeckGradientStyle(deck.gradient);
  const countLabel = `${deck.cardCount} card${deck.cardCount === 1 ? "" : "s"}`;
  const updated = formatUpdated(deck.updated_at_ms);

  if (view === "list") {
    return (
      <button type="button" className="deck-tile list" onClick={onOpen}>
        <span className="deck-tile__name">{deck.name}</span>
        <span className="deck-tile__meta">{countLabel}</span>
      </button>
    );
  }

  if (view === "thumbnail") {
    return (
      <button
        type="button"
        className="deck-tile thumbnail"
        onClick={onOpen}
        style={gradient ? { background: gradient } : undefined}
      >
        <span className="deck-tile__watermark" aria-hidden>
          {deck.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="deck-tile__thumb-title">{deck.name}</span>
        <span className="deck-tile__thumb-count">{countLabel}</span>
      </button>
    );
  }

  if (view === "grid") {
    return (
      <button
        type="button"
        className="deck-tile grid"
        onClick={onOpen}
        style={gradient ? { background: gradient } : undefined}
      >
        <h3 className="deck-tile__title">{deck.name}</h3>
        {deck.description && (
          <p className="deck-tile__desc">{deck.description}</p>
        )}
        <div className="deck-tile__footer">
          <span>{countLabel}</span>
          <span>{updated}</span>
        </div>
      </button>
    );
  }

  // detail
  return (
    <button type="button" className="deck-tile detail" onClick={onOpen}>
      <div
        className="deck-tile__accent"
        style={gradient ? { background: gradient } : undefined}
        aria-hidden
      />
      <div className="deck-tile__body">
        <div className="deck-tile__detail-main">
          <h3 className="deck-tile__title">{deck.name}</h3>
          {deck.description && (
            <p className="deck-tile__desc">{deck.description}</p>
          )}
        </div>
        <div className="deck-tile__detail-meta">
          <span className="deck-tile__stat">
            <span className="deck-tile__stat-label">Cards</span>
            <span className="deck-tile__stat-value">{deck.cardCount}</span>
          </span>
          <span className="deck-tile__stat">
            <span className="deck-tile__stat-label">Updated</span>
            <span className="deck-tile__stat-value">{updated}</span>
          </span>
        </div>
      </div>
    </button>
  );
}

function ViewSortSheet({
  view,
  sort,
  onView,
  onSort,
  onClose,
}: {
  view: OfflineDeckViewMode;
  sort: OfflineDeckSort;
  onView: (v: OfflineDeckViewMode) => void;
  onSort: (s: OfflineDeckSort) => void;
  onClose: () => void;
}) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet sheet--menu" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>Display &amp; sort</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <p className="sheet-section-label">View as</p>
        <div className="option-list">
          {(Object.keys(VIEW_LABELS) as OfflineDeckViewMode[]).map((mode) => {
            const active = mode === view;
            return (
              <button
                key={mode}
                type="button"
                className={`option-row${active ? " active" : ""}`}
                onClick={() => onView(mode)}
              >
                <span>
                  <strong>{VIEW_LABELS[mode].title}</strong>
                  <small>{VIEW_LABELS[mode].hint}</small>
                </span>
                {active && <span className="check">✓</span>}
              </button>
            );
          })}
        </div>

        <p className="sheet-section-label">Sort by</p>
        <div className="option-list">
          {(Object.keys(SORT_LABELS) as OfflineDeckSort[]).map((key) => {
            const active = key === sort;
            return (
              <button
                key={key}
                type="button"
                className={`option-row${active ? " active" : ""}`}
                onClick={() => onSort(key)}
              >
                <span>
                  <strong>{SORT_LABELS[key]}</strong>
                </span>
                {active && <span className="check">✓</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function DeckLibrary({
  decks,
  message,
  online,
  workspaceScope,
  workspaces,
  personalPlanLabel,
  canCreateDeck,
  onWorkspaceChange,
  onTeamAdminDash,
  onToAdminDash,
  onNewDeck,
  onOpenDeck,
}: {
  decks: OfflineDeckRow[];
  message: string | null;
  online: boolean;
  workspaceScope: SavedWorkspaceScope;
  workspaces: OfflineWorkspaceContext[];
  personalPlanLabel?: string;
  canCreateDeck: boolean;
  onWorkspaceChange: (scope: SavedWorkspaceScope) => void;
  onTeamAdminDash?: () => void;
  onToAdminDash?: (workspace: OfflineWorkspaceContext) => void;
  onNewDeck: () => void;
  onOpenDeck: (deck: OfflineDeckRow) => void;
}) {
  const [view, setView] = useState<OfflineDeckViewMode>(() => loadDeckViewMode());
  const [sort, setSort] = useState<OfflineDeckSort>(() => loadDeckSort());
  const [showOptions, setShowOptions] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        decks.map(async (deck) => {
          const cards = await listCards(deck.local_id).catch(() => []);
          return [deck.local_id, cards.length] as const;
        }),
      );
      if (!cancelled) {
        setCounts(Object.fromEntries(entries));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [decks]);

  const decksWithCounts = useMemo<DeckWithCount[]>(
    () =>
      decks.map((deck) => ({
        ...deck,
        cardCount: counts[deck.local_id] ?? 0,
      })),
    [decks, counts],
  );

  const sorted = useMemo(
    () => sortDecks(decksWithCounts, sort),
    [decksWithCounts, sort],
  );

  function changeView(next: OfflineDeckViewMode) {
    setView(next);
    saveDeckViewMode(next);
  }

  function changeSort(next: OfflineDeckSort) {
    setSort(next);
    saveDeckSort(next);
  }

  const containerClass =
    view === "thumbnail"
      ? "deck-collection thumbnail"
      : view === "grid"
        ? "deck-collection grid"
        : view === "list"
          ? "deck-collection list"
          : "deck-collection detail";

  const isTeamScope = workspaceScope !== "personal";
  const activeTeam =
    isTeamScope && typeof workspaceScope === "number"
      ? workspaces.find((w) => w.teamId === workspaceScope)
      : null;
  const subtitle = isTeamScope
    ? activeTeam?.role === "team_member"
      ? "Study assigned decks — sync when online"
      : "Team workspace on this device — sync when online"
    : "Study on this device — sync when online";

  const emptyTitle = isTeamScope
    ? activeTeam?.role === "team_member"
      ? "No assigned decks on this device"
      : "No workspace decks on this device"
    : "No decks on this device";

  const emptyBody = isTeamScope ? (
    activeTeam?.role === "team_member" ? (
      <>
        Your admin hasn&apos;t assigned decks yet, or open the Dashboard while online
        and tap <strong>Make available offline</strong> to download them.
      </>
    ) : canCreateDeck ? (
      <>
        Create a deck with <strong>+ New deck</strong>, or open the Dashboard while
        online to download workspace decks.
      </>
    ) : (
      <>
        Open the Dashboard while online and tap <strong>Make available offline</strong>{" "}
        to download workspace decks.
      </>
    )
  ) : (
    <>
      Create a deck with <strong>+ New deck</strong>, or open the Dashboard while online
      to download existing decks.
    </>
  );

  return (
    <>
      <header className="page-header">
        <div className="page-header__main">
          <h1 className="page-title">Your decks</h1>
          <p className="page-subtitle">{subtitle}</p>
          <WorkspaceSelector
            scope={workspaceScope}
            workspaces={workspaces}
            personalPlanLabel={personalPlanLabel}
            online={online}
            onChange={onWorkspaceChange}
            onTeamAdminDash={onTeamAdminDash}
            onToAdminDash={onToAdminDash}
          />
        </div>
        {canCreateDeck && (
          <button type="button" className="btn" onClick={onNewDeck}>
            + New deck
          </button>
        )}
      </header>

      {message && <p className="banner banner--info">{message}</p>}

      {sorted.length > 0 && (
        <div className="library-toolbar">
          <p className="library-count">
            {sorted.length} deck{sorted.length === 1 ? "" : "s"}
          </p>
          <button
            type="button"
            className="btn secondary btn--sm"
            onClick={() => setShowOptions(true)}
          >
            {VIEW_LABELS[view].title} · {SORT_LABELS[sort].split(" ")[0]}…
          </button>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="empty">
          <h2>{emptyTitle}</h2>
          <p>{emptyBody}</p>
        </div>
      ) : (
        <>
          {view === "detail" && sorted.length > 0 && (
            <div className="deck-column-head" aria-hidden>
              <span>Name / Description</span>
              <span>Cards</span>
              <span>Updated</span>
            </div>
          )}
          <div className={containerClass}>
            {sorted.map((deck) => (
              <DeckTile
                key={deck.local_id}
                deck={deck}
                view={view}
                onOpen={() => onOpenDeck(deck)}
              />
            ))}
          </div>
        </>
      )}

      {showOptions && (
        <ViewSortSheet
          view={view}
          sort={sort}
          onView={changeView}
          onSort={changeSort}
          onClose={() => setShowOptions(false)}
        />
      )}
    </>
  );
}
