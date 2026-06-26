import { useEffect, useMemo, useState, type FormEvent } from "react";
import { deleteDeck, listCards, updateDeck } from "../../src/lib/offline/repository";
import type { OfflineWorkspaceContext } from "../../src/lib/offline/access-context";
import { formatOfflineWorkspaceOwnerLabel } from "../../src/lib/offline/access-context";
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
import { LibraryTileActions, LibraryTileWatermark } from "./library-tile-chrome";
import { OfflineImage } from "./offline-image";
import { ImagePickerField } from "./image-picker-field";
import { Pagination } from "./pagination";

const DECKS_PER_PAGE = 12;

export type DeckWithCount = OfflineDeckRow & { cardCount: number };

function canEditDeckLocally(deck: OfflineDeckRow): boolean {
  // Owned decks (shown on the Personal Dashboard) are editable offline even when
  // linked to a workspace (team_id set). Member-assigned study copies stay read-only.
  // Deck tiles only render actions in personal scope (see `canEdit` below), so this
  // keeps team-workspace tiles read-only while unlocking workspace-linked personal decks.
  return (deck.member_assigned ?? 0) === 0;
}

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
  online,
  canEdit,
  onOpen,
  onEdit,
  onDelete,
}: {
  deck: DeckWithCount;
  view: OfflineDeckViewMode;
  online: boolean;
  canEdit: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const gradient = offlineDeckGradientStyle(deck.gradient);
  const countLabel = `${deck.cardCount} card${deck.cardCount === 1 ? "" : "s"}`;
  const updated = formatUpdated(deck.updated_at_ms);
  const showActions = canEdit && canEditDeckLocally(deck);
  const hasCover = !!deck.cover_image_url;
  const gradientStyle =
    !hasCover && (view === "thumbnail" || view === "grid") && gradient
      ? { background: gradient }
      : undefined;
  const coverImage = hasCover ? (
    <OfflineImage
      src={deck.cover_image_url}
      alt=""
      className="deck-tile__cover"
      online={online}
    />
  ) : null;

  const actions = showActions ? (
    <LibraryTileActions onEdit={onEdit} onDelete={onDelete} />
  ) : null;

  if (view === "list") {
    return (
      <div className="deck-tile-shell deck-tile list">
        <LibraryTileWatermark label="Deck" />
        {coverImage}
        <button type="button" className="deck-tile__open" onClick={onOpen}>
          <span className="deck-tile__name">{deck.name}</span>
          <span className="deck-tile__meta">{countLabel}</span>
        </button>
        {actions}
      </div>
    );
  }

  if (view === "thumbnail") {
    return (
      <div
        className="deck-tile-shell deck-tile thumbnail"
        style={gradientStyle}
      >
        <LibraryTileWatermark label="Deck" />
        {coverImage}
        <button type="button" className="deck-tile__open" onClick={onOpen}>
          <span className="deck-tile__thumb-title">{deck.name}</span>
          <span className="deck-tile__thumb-count">{countLabel}</span>
        </button>
        {actions}
      </div>
    );
  }

  if (view === "grid") {
    return (
      <div className="deck-tile-shell deck-tile grid" style={gradientStyle}>
        <LibraryTileWatermark label="Deck" />
        {coverImage}
        <button type="button" className="deck-tile__open" onClick={onOpen}>
          <h3 className="deck-tile__title">{deck.name}</h3>
          {deck.description && (
            <p className="deck-tile__desc">{deck.description}</p>
          )}
          <div className="deck-tile__footer">
            <span>{countLabel}</span>
            <span>{updated}</span>
          </div>
        </button>
        {actions}
      </div>
    );
  }

  return (
    <div className="deck-tile-shell deck-tile detail">
      <LibraryTileWatermark label="Deck" />
      {coverImage}
      <button type="button" className="deck-tile__open" onClick={onOpen}>
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
      {actions}
    </div>
  );
}

function EditDeckSheet({
  deck,
  online,
  onClose,
  onSaved,
}: {
  deck: OfflineDeckRow;
  online: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(deck.name);
  const [description, setDescription] = useState(deck.description ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(deck.cover_image_url ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Deck name is required.");
      return;
    }
    setBusy(true);
    try {
      await updateDeck(deck.local_id, {
        name: trimmed,
        description: description.trim() || null,
        coverImageUrl,
      });
      onSaved();
    } catch {
      setError("Couldn't save the deck. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>Edit deck</h2>
        <p className="sheet-hint">Changes save on this device and sync when you&apos;re online.</p>
        <form onSubmit={handleSubmit} className="form-stack">
          <label className="field">
            <span>Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Deck name"
              autoFocus
            />
          </label>
          <label className="field">
            <span>Description (optional)</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this deck about?"
              rows={3}
            />
          </label>
          <ImagePickerField
            label="Cover image (optional)"
            value={coverImageUrl}
            online={online}
            onChange={setCoverImageUrl}
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
  loading = false,
  message,
  online,
  workspaceScope,
  workspaces,
  personalPlanLabel,
  viewerDisplayName,
  viewerEmail,
  canCreateDeck,
  onWorkspaceChange,
  onTeamAdminDash,
  onToAdminDash,
  onNewDeck,
  onOpenDeck,
  onDecksChanged,
}: {
  decks: OfflineDeckRow[];
  loading?: boolean;
  message: string | null;
  online: boolean;
  workspaceScope: SavedWorkspaceScope;
  workspaces: OfflineWorkspaceContext[];
  personalPlanLabel?: string;
  viewerDisplayName?: string;
  viewerEmail?: string | null;
  canCreateDeck: boolean;
  onWorkspaceChange: (scope: SavedWorkspaceScope) => void;
  onTeamAdminDash?: () => void;
  onToAdminDash?: (workspace: OfflineWorkspaceContext) => void;
  onNewDeck: () => void;
  onOpenDeck: (deck: OfflineDeckRow) => void;
  onDecksChanged: () => void | Promise<void>;
}) {
  const [view, setView] = useState<OfflineDeckViewMode>(() => loadDeckViewMode());
  const [sort, setSort] = useState<OfflineDeckSort>(() => loadDeckSort());
  const [showOptions, setShowOptions] = useState(false);
  const [editingDeck, setEditingDeck] = useState<OfflineDeckRow | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [page, setPage] = useState(1);

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

  const pageCount = Math.max(1, Math.ceil(sorted.length / DECKS_PER_PAGE));

  // Reset to the first page whenever the result set or ordering changes.
  useEffect(() => {
    setPage(1);
  }, [sort, workspaceScope, sorted.length]);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  const pagedDecks = useMemo(
    () => sorted.slice((page - 1) * DECKS_PER_PAGE, page * DECKS_PER_PAGE),
    [sorted, page],
  );

  function changeView(next: OfflineDeckViewMode) {
    setView(next);
    saveDeckViewMode(next);
  }

  function changeSort(next: OfflineDeckSort) {
    setSort(next);
    saveDeckSort(next);
  }

  async function handleDeleteDeck(deck: OfflineDeckRow) {
    if (
      !window.confirm(
        `Delete "${deck.name}" and all its cards from this device?`,
      )
    ) {
      return;
    }
    await deleteDeck(deck.local_id);
    await onDecksChanged();
  }

  const canEditDecks = canCreateDeck;

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

  const pageTitle = isTeamScope ? "Team Dashboard" : "Personal Dash";

  const subtitle = isTeamScope
    ? activeTeam
      ? `${activeTeam.name} · OWNER · ${formatOfflineWorkspaceOwnerLabel(activeTeam, {
          viewerDisplayName,
          viewerEmail,
        })}`
      : "Team workspace on this device"
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
    ) : (
      <>
        Create team decks on the online dashboard from your personal workspace, then tap{" "}
        <strong>Make available offline</strong> to download them here.
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
          <h1 className="page-title">{pageTitle}</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>
        <div className="page-header__actions">
          <WorkspaceSelector
            scope={workspaceScope}
            workspaces={workspaces}
            personalPlanLabel={personalPlanLabel}
            viewerDisplayName={viewerDisplayName}
            viewerEmail={viewerEmail}
            online={online}
            onChange={onWorkspaceChange}
            onTeamAdminDash={onTeamAdminDash}
            onToAdminDash={onToAdminDash}
          />
          {canCreateDeck && (
            <button type="button" className="btn" onClick={onNewDeck}>
              + New deck
            </button>
          )}
        </div>
      </header>

      {message && <p className="banner banner--info">{message}</p>}

      {sorted.length > 0 && !loading && (
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

      {loading ? (
        <div className="library-loading" aria-busy="true" aria-live="polite">
          <p>Loading decks…</p>
        </div>
      ) : sorted.length === 0 ? (
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
            {pagedDecks.map((deck) => (
              <DeckTile
                key={deck.local_id}
                deck={deck}
                view={view}
                online={online}
                canEdit={canEditDecks}
                onOpen={() => onOpenDeck(deck)}
                onEdit={() => setEditingDeck(deck)}
                onDelete={() => void handleDeleteDeck(deck)}
              />
            ))}
          </div>
          <Pagination
            page={page}
            pageCount={pageCount}
            onPageChange={setPage}
            label="Deck pages"
          />
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

      {editingDeck && (
        <EditDeckSheet
          deck={editingDeck}
          online={online}
          onClose={() => setEditingDeck(null)}
          onSaved={() => {
            setEditingDeck(null);
            void onDecksChanged();
          }}
        />
      )}
    </>
  );
}
