import { useEffect, useMemo, useState } from "react";
import { listCards } from "../../src/lib/offline/repository";
import type { OfflineCardRow, OfflineDeckRow } from "../../src/lib/offline/schema";
import {
  CARD_SORT_LABELS,
  CARD_VIEW_LABELS,
  loadCardSort,
  loadCardViewMode,
  saveCardSort,
  saveCardViewMode,
  type OfflineCardSort,
  type OfflineCardViewMode,
} from "./card-library-prefs";
import { ConnectionStatusPill } from "./connection-status";
import {
  DeckWorkspaceContext,
  resolveDeckWorkspaceInfo,
  type DeckWorkspaceContextInput,
} from "./deck-workspace-context";

function formatUpdated(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function cardFrontLabel(card: OfflineCardRow): string {
  const t = card.front?.trim();
  return t || "(no question)";
}

function cardBackLabel(card: OfflineCardRow): string {
  const t = card.back?.trim();
  return t || "(no answer)";
}

function sortCards(cards: OfflineCardRow[], sort: OfflineCardSort): OfflineCardRow[] {
  const rows = [...cards];
  switch (sort) {
    case "updated-desc":
      return rows.sort((a, b) => b.updated_at_ms - a.updated_at_ms);
    case "updated-asc":
      return rows.sort((a, b) => a.updated_at_ms - b.updated_at_ms);
    case "front-asc":
      return rows.sort((a, b) =>
        cardFrontLabel(a).localeCompare(cardFrontLabel(b)),
      );
    case "front-desc":
      return rows.sort((a, b) =>
        cardFrontLabel(b).localeCompare(cardFrontLabel(a)),
      );
    case "back-asc":
      return rows.sort((a, b) => cardBackLabel(a).localeCompare(cardBackLabel(b)));
    case "back-desc":
      return rows.sort((a, b) => cardBackLabel(b).localeCompare(cardBackLabel(a)));
  }
}

function CardViewSortSheet({
  view,
  sort,
  onView,
  onSort,
  onClose,
}: {
  view: OfflineCardViewMode;
  sort: OfflineCardSort;
  onView: (v: OfflineCardViewMode) => void;
  onSort: (s: OfflineCardSort) => void;
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
          {(Object.keys(CARD_VIEW_LABELS) as OfflineCardViewMode[]).map((mode) => {
            const active = mode === view;
            return (
              <button
                key={mode}
                type="button"
                className={`option-row${active ? " active" : ""}`}
                onClick={() => onView(mode)}
              >
                <span>
                  <strong>{CARD_VIEW_LABELS[mode].title}</strong>
                  <small>{CARD_VIEW_LABELS[mode].hint}</small>
                </span>
                {active && <span className="check">✓</span>}
              </button>
            );
          })}
        </div>

        <p className="sheet-section-label">Sort by</p>
        <div className="option-list">
          {(Object.keys(CARD_SORT_LABELS) as OfflineCardSort[]).map((key) => {
            const active = key === sort;
            return (
              <button
                key={key}
                type="button"
                className={`option-row${active ? " active" : ""}`}
                onClick={() => onSort(key)}
              >
                <span>
                  <strong>{CARD_SORT_LABELS[key]}</strong>
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

function CardTile({
  card,
  view,
  index,
}: {
  card: OfflineCardRow;
  view: OfflineCardViewMode;
  index: number;
}) {
  const front = cardFrontLabel(card);
  const back = cardBackLabel(card);
  const updated = formatUpdated(card.updated_at_ms);
  const watermark = front.slice(0, 1).toUpperCase() || "?";

  if (view === "list") {
    return (
      <div className="card-tile list">
        <span className="card-tile__front">{front}</span>
        <span className="card-tile__back">{back}</span>
      </div>
    );
  }

  if (view === "thumbnail") {
    return (
      <div className="card-tile thumbnail">
        <span className="card-tile__watermark" aria-hidden>
          {watermark}
        </span>
        <span className="card-tile__thumb-front">{front}</span>
        <span className="card-tile__thumb-back">{back}</span>
      </div>
    );
  }

  if (view === "grid") {
    return (
      <div className="card-tile grid">
        <p className="card-tile__label">Question</p>
        <p className="card-tile__front">{front}</p>
        <p className="card-tile__label">Answer</p>
        <p className="card-tile__back">{back}</p>
      </div>
    );
  }

  return (
    <div className="card-tile detail">
      <span className="card-tile__index">#{index + 1}</span>
      <div className="card-tile__detail-body">
        <div className="card-tile__detail-main">
          <p className="card-tile__label">Question</p>
          <p className="card-tile__front">{front}</p>
          <p className="card-tile__label">Answer</p>
          <p className="card-tile__back">{back}</p>
        </div>
        <div className="card-tile__detail-meta">
          <span className="card-tile__stat-label">Updated</span>
          <span className="card-tile__stat-value">{updated}</span>
        </div>
      </div>
    </div>
  );
}

export function DeckDetail({
  deck,
  canEdit,
  online,
  workspaceContext,
  onBack,
  onStudy,
  onAddCards,
}: {
  deck: OfflineDeckRow;
  canEdit: boolean;
  online: boolean;
  workspaceContext: DeckWorkspaceContextInput;
  onBack: () => void;
  onStudy: () => void;
  onAddCards: () => void;
}) {
  const [cards, setCards] = useState<OfflineCardRow[] | null>(null);
  const [view, setView] = useState<OfflineCardViewMode>(() => loadCardViewMode());
  const [sort, setSort] = useState<OfflineCardSort>(() => loadCardSort());
  const [showOptions, setShowOptions] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listCards(deck.local_id)
      .then((rows) => {
        if (!cancelled) setCards(rows);
      })
      .catch(() => {
        if (!cancelled) setCards([]);
      });
    return () => {
      cancelled = true;
    };
  }, [deck.local_id]);

  const sorted = useMemo(() => {
    if (!cards) return [];
    return sortCards(cards, sort);
  }, [cards, sort]);

  const containerClass =
    view === "thumbnail"
      ? "card-collection thumbnail"
      : view === "grid"
        ? "card-collection grid"
        : view === "list"
          ? "card-collection list"
          : "card-collection detail";

  const count = cards?.length ?? null;
  const hasCards = count != null && count > 0;
  const workspaceInfo = resolveDeckWorkspaceInfo(deck, workspaceContext);

  function changeView(next: OfflineCardViewMode) {
    setView(next);
    saveCardViewMode(next);
  }

  function changeSort(next: OfflineCardSort) {
    setSort(next);
    saveCardSort(next);
  }

  return (
    <div className="app">
      <div className="topbar">
        <button type="button" className="btn secondary" onClick={onBack}>
          ← Decks
        </button>
        <div className="spacer" />
        <ConnectionStatusPill online={online} compact />
        {canEdit && (
          <button type="button" className="btn secondary btn--sm" onClick={onAddCards}>
            Add cards
          </button>
        )}
      </div>
      <div className="content content--library">
        <header className="page-header">
          <div className="page-header__main">
            <DeckWorkspaceContext info={workspaceInfo} />
            <h1 className="page-title">{deck.name}</h1>
            {deck.description ? (
              <p className="page-subtitle">{deck.description}</p>
            ) : null}
            <p className="deck-detail__count">
              {count == null ? "…" : `${count} card${count === 1 ? "" : "s"}`}
            </p>
          </div>
          <div className="page-header__actions">
            <button
              type="button"
              className="btn"
              onClick={onStudy}
              disabled={!hasCards}
            >
              Study
            </button>
          </div>
        </header>

        {cards === null ? (
          <div className="library-loading" aria-busy="true">
            <p>Loading cards…</p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="empty">
            <h2>No cards yet</h2>
            <p>
              {canEdit
                ? "Tap Add cards in the top right to build this deck."
                : "This assigned deck has no downloaded cards yet."}
            </p>
          </div>
        ) : (
          <>
            <div className="library-toolbar">
              <p className="library-count">
                {sorted.length} card{sorted.length === 1 ? "" : "s"}
              </p>
              <button
                type="button"
                className="btn secondary btn--sm"
                onClick={() => setShowOptions(true)}
              >
                {CARD_VIEW_LABELS[view].title} ·{" "}
                {CARD_SORT_LABELS[sort].split(" ")[0]}…
              </button>
            </div>
            {view === "detail" && (
              <div className="card-column-head" aria-hidden>
                <span>Front / Back</span>
                <span>Updated</span>
              </div>
            )}
            <div className={containerClass}>
              {sorted.map((card, i) => (
                <CardTile key={card.local_id} card={card} view={view} index={i} />
              ))}
            </div>
          </>
        )}

        {showOptions && (
          <CardViewSortSheet
            view={view}
            sort={sort}
            onView={changeView}
            onSort={changeSort}
            onClose={() => setShowOptions(false)}
          />
        )}
      </div>
    </div>
  );
}
