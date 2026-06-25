import { useEffect, useMemo, useState, type FormEvent } from "react";
import { deleteCard, listCards, updateCard } from "../../src/lib/offline/repository";
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
import { LibraryTileActions, LibraryTileWatermark } from "./library-tile-chrome";
import { OfflineImage } from "./offline-image";
import { ImagePickerField } from "./image-picker-field";

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

function CardAnswerDialog({
  front,
  back,
  backImageUrl,
  online,
  onClose,
}: {
  front: string;
  back: string;
  backImageUrl: string | null;
  online: boolean;
  onClose: () => void;
}) {
  return (
    <div
      className="card-answer-dialog__backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="card-answer-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="card-answer-label"
        aria-modal="true"
      >
        <p className="card-answer-dialog__question">{front}</p>
        <p id="card-answer-label" className="card-answer-dialog__label">
          Answer
        </p>
        {backImageUrl ? (
          <OfflineImage
            src={backImageUrl}
            alt="Answer image"
            className="card-answer-dialog__image"
            online={online}
          />
        ) : null}
        <p className="card-answer-dialog__answer">{back}</p>
        <button
          type="button"
          className="btn secondary btn--sm card-answer-dialog__close"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}

function CardTile({
  card,
  view,
  index,
  online,
  canEdit,
  onOpenAnswer,
  onEdit,
  onDelete,
}: {
  card: OfflineCardRow;
  view: OfflineCardViewMode;
  index: number;
  online: boolean;
  canEdit: boolean;
  onOpenAnswer: (card: OfflineCardRow) => void;
  onEdit: (card: OfflineCardRow) => void;
  onDelete: (card: OfflineCardRow) => void;
}) {
  const front = cardFrontLabel(card);
  const updated = formatUpdated(card.updated_at_ms);
  const frontImage = card.front_image_url ? (
    <OfflineImage
      src={card.front_image_url}
      alt=""
      className="card-tile__media"
      online={online}
    />
  ) : null;
  const actions = canEdit ? (
    <LibraryTileActions
      onEdit={() => onEdit(card)}
      onDelete={() => onDelete(card)}
    />
  ) : null;

  if (view === "list") {
    return (
      <div className="card-tile-shell card-tile list card-tile--interactive">
        <LibraryTileWatermark label="Card" />
        <button
          type="button"
          className="card-tile__open"
          onClick={() => onOpenAnswer(card)}
          aria-label={`Question: ${front}. Tap to reveal answer.`}
        >
          {frontImage}
          <span className="card-tile__front">{front}</span>
        </button>
        {actions}
      </div>
    );
  }

  if (view === "thumbnail") {
    return (
      <div className="card-tile-shell card-tile thumbnail card-tile--interactive">
        <LibraryTileWatermark label="Card" />
        <button
          type="button"
          className="card-tile__open"
          onClick={() => onOpenAnswer(card)}
          aria-label={`Question: ${front}. Tap to reveal answer.`}
        >
          {frontImage}
          <span className="card-tile__thumb-front">{front}</span>
        </button>
        {actions}
      </div>
    );
  }

  if (view === "grid") {
    return (
      <div className="card-tile-shell card-tile grid card-tile--interactive">
        <LibraryTileWatermark label="Card" />
        <button
          type="button"
          className="card-tile__open"
          onClick={() => onOpenAnswer(card)}
          aria-label={`Question: ${front}. Tap to reveal answer.`}
        >
          <p className="card-tile__label">Question</p>
          {frontImage}
          <p className="card-tile__front">{front}</p>
        </button>
        {actions}
      </div>
    );
  }

  return (
    <div className="card-tile-shell card-tile detail card-tile--interactive">
      <LibraryTileWatermark label="Card" />
      <button
        type="button"
        className="card-tile__open"
        onClick={() => onOpenAnswer(card)}
        aria-label={`Question: ${front}. Tap to reveal answer.`}
      >
        <span className="card-tile__index">#{index + 1}</span>
        <div className="card-tile__detail-body">
          <div className="card-tile__detail-main">
            <p className="card-tile__label">Question</p>
            {frontImage}
            <p className="card-tile__front">{front}</p>
          </div>
          <div className="card-tile__detail-meta">
            <span className="card-tile__stat-label">Updated</span>
            <span className="card-tile__stat-value">{updated}</span>
          </div>
        </div>
      </button>
      {actions}
    </div>
  );
}

function EditCardSheet({
  card,
  online,
  onClose,
  onSaved,
}: {
  card: OfflineCardRow;
  online: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [front, setFront] = useState(card.front ?? "");
  const [back, setBack] = useState(card.back ?? "");
  const [frontImageUrl, setFrontImageUrl] = useState(card.front_image_url ?? null);
  const [backImageUrl, setBackImageUrl] = useState(card.back_image_url ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const f = front.trim();
    const b = back.trim();
    if ((!f && !frontImageUrl) || (!b && !backImageUrl)) {
      setError("Each side needs text or an image.");
      return;
    }
    setBusy(true);
    try {
      await updateCard(card.local_id, {
        front: f || null,
        back: b || null,
        frontImageUrl,
        backImageUrl,
      });
      onSaved();
    } catch {
      setError("Couldn't save the card. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>Edit card</h2>
        <p className="sheet-hint">Changes save on this device and sync when you&apos;re online.</p>
        <form onSubmit={handleSubmit} className="form-stack">
          <label className="field">
            <span>Front (question)</span>
            <input
              value={front}
              onChange={(e) => setFront(e.target.value)}
              placeholder="Question"
              autoFocus
            />
          </label>
          <ImagePickerField
            label="Front image (optional)"
            value={frontImageUrl}
            online={online}
            onChange={setFrontImageUrl}
          />
          <label className="field">
            <span>Back (answer)</span>
            <input
              value={back}
              onChange={(e) => setBack(e.target.value)}
              placeholder="Answer"
            />
          </label>
          <ImagePickerField
            label="Back image (optional)"
            value={backImageUrl}
            online={online}
            onChange={setBackImageUrl}
          />
          {error && <p className="form-error">{error}</p>}
          <div className="row">
            <button type="button" className="btn secondary" style={{ flex: 1 }} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn" style={{ flex: 1 }} disabled={busy}>
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
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
  const [answerPreview, setAnswerPreview] = useState<OfflineCardRow | null>(null);
  const [editingCard, setEditingCard] = useState<OfflineCardRow | null>(null);
  const [cardsVersion, setCardsVersion] = useState(0);

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
  }, [deck.local_id, cardsVersion]);

  async function reloadCards() {
    const rows = await listCards(deck.local_id).catch(() => []);
    setCards(rows);
  }

  async function handleDeleteCard(card: OfflineCardRow) {
    const front = cardFrontLabel(card);
    if (!window.confirm(`Delete card "${front}" from this device?`)) {
      return;
    }
    await deleteCard(card.local_id);
    if (answerPreview?.local_id === card.local_id) {
      setAnswerPreview(null);
    }
    if (editingCard?.local_id === card.local_id) {
      setEditingCard(null);
    }
    await reloadCards();
  }

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
                <span>Question</span>
                <span>Updated</span>
              </div>
            )}
            <div className={containerClass}>
              {sorted.map((card, i) => (
                <CardTile
                  key={card.local_id}
                  card={card}
                  view={view}
                  index={i}
                  online={online}
                  canEdit={canEdit}
                  onOpenAnswer={setAnswerPreview}
                  onEdit={setEditingCard}
                  onDelete={(c) => void handleDeleteCard(c)}
                />
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

        {answerPreview ? (
          <CardAnswerDialog
            front={cardFrontLabel(answerPreview)}
            back={cardBackLabel(answerPreview)}
            backImageUrl={answerPreview.back_image_url}
            online={online}
            onClose={() => setAnswerPreview(null)}
          />
        ) : null}

        {editingCard && (
          <EditCardSheet
            card={editingCard}
            online={online}
            onClose={() => setEditingCard(null)}
            onSaved={() => {
              setEditingCard(null);
              setCardsVersion((v) => v + 1);
            }}
          />
        )}
      </div>
    </div>
  );
}
