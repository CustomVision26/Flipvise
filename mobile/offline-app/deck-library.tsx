import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { deleteDeck, listCards, updateDeck } from "../../src/lib/offline/repository";
import type {
  OfflineWorkspaceContext,
  OfflineWorkspaceRole,
} from "../../src/lib/offline/access-context";
import { formatOfflineWorkspaceOwnerLabel } from "../../src/lib/offline/access-context";
import type { OfflineDeckRow } from "../../src/lib/offline/schema";
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
import { IllustratedOfflineDeck } from "./illustrated-library";
import { ConfirmDialog } from "./confirm-dialog";
import { ImagePickerField } from "./image-picker-field";
import { DisplayMenu } from "./display-menu";
import {
  EducationWorkspaceDecks,
  ownedEducationWorkspaces,
  personalDashboardTeamId,
} from "./education-workspace-decks";
import { Pagination } from "./pagination";

const DECKS_PER_PAGE = 12;

function teamWorkspaceEmptyCopy(role: OfflineWorkspaceRole | undefined): {
  title: string;
  body: ReactNode;
} {
  if (role === "team_member" || role === "team_admin") {
    return {
      title: "No assigned decks on this device",
      body: (
        <>
          {role === "team_admin"
            ? "Your workspace owner assigns decks in Team Admin. Once assigned to you, open the online dashboard and tap "
            : "Your workspace owner or admin hasn't assigned decks to you yet. Once assigned, open the online dashboard and tap "}
          <strong>Make available offline</strong> to download them here.
        </>
      ),
    };
  }

  return {
    title: "No workspace decks on this device",
    body: (
      <>
        Add decks on your Personal Dash, link them to this workspace in Team Admin, assign them
        to team members, then open the online dashboard and tap{" "}
        <strong>Make available offline</strong> to download them here.
      </>
    ),
  };
}

export type DeckWithCount = OfflineDeckRow & { cardCount: number };

function canEditDeckLocally(deck: OfflineDeckRow): boolean {
  // Owned decks (shown on the Personal Dashboard) are editable offline even when
  // linked to a workspace (team_id set). Member-assigned study copies stay read-only.
  // Deck tiles only render actions in personal scope (see `canEdit` below), so this
  // keeps team-workspace tiles read-only while unlocking workspace-linked personal decks.
  return (deck.member_assigned ?? 0) === 0;
}

function sortDecks(
  decks: DeckWithCount[],
  sort: OfflineDeckSort,
): DeckWithCount[] {
  const rows = [...decks];
  const updated = (row: DeckWithCount) => Number(row.updated_at_ms) || 0;
  const count = (row: DeckWithCount) => Number(row.cardCount) || 0;
  const byName = (a: DeckWithCount, b: DeckWithCount) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  switch (sort) {
    case "updated-desc":
      return rows.sort((a, b) => updated(b) - updated(a));
    case "updated-asc":
      return rows.sort((a, b) => updated(a) - updated(b));
    case "name-asc":
      return rows.sort(byName);
    case "name-desc":
      return rows.sort((a, b) => byName(b, a));
    case "cards-desc":
      return rows.sort((a, b) => count(b) - count(a));
    case "cards-asc":
      return rows.sort((a, b) => count(a) - count(b));
  }
}

function DeckTile({
  deck,
  view,
  online,
  canEdit,
  expanded,
  onToggleExpand,
  onOpen,
  onPreview,
  onEdit,
  onDelete,
}: {
  deck: DeckWithCount;
  view: OfflineDeckViewMode;
  online: boolean;
  canEdit: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onOpen: () => void;
  onPreview: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const showEditDelete = canEdit && canEditDeckLocally(deck);
  return (
    <IllustratedOfflineDeck
      name={deck.name}
      description={deck.description}
      coverImageUrl={deck.cover_image_url}
      cardCount={deck.cardCount}
      updatedAtMs={deck.updated_at_ms}
      online={online}
      compact={view === "thumbnail"}
      menuOpen={expanded}
      onToggleMenu={onToggleExpand}
      onOpen={onOpen}
      onPreview={onPreview}
      onEdit={showEditDelete ? onEdit : undefined}
      onDelete={showEditDelete ? onDelete : undefined}
    />
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

export function DeckLibrary({
  decks,
  loading = false,
  message,
  online,
  workspaceScope,
  workspaces,
  personalPlanLabel,
  personalHasTeamTierPlan = false,
  viewerDisplayName,
  viewerEmail,
  canCreateDeck,
  onWorkspaceChange,
  onTeamAdminDash,
  onTeacherDash,
  onToAdminDash,
  showTeacherDashboard = false,
  workspaceContextUpdatedAtMs = 0,
  workspaceContextStale = false,
  onNewDeck,
  onOpenDeck,
  onPreviewDeck,
  onDecksChanged,
}: {
  decks: OfflineDeckRow[];
  loading?: boolean;
  message: string | null;
  online: boolean;
  workspaceScope: SavedWorkspaceScope;
  workspaces: OfflineWorkspaceContext[];
  personalPlanLabel?: string;
  personalHasTeamTierPlan?: boolean;
  viewerDisplayName?: string;
  viewerEmail?: string | null;
  canCreateDeck: boolean;
  onWorkspaceChange: (scope: SavedWorkspaceScope) => void;
  onTeamAdminDash?: () => void;
  onTeacherDash?: () => void;
  onToAdminDash?: (workspace: OfflineWorkspaceContext) => void;
  showTeacherDashboard?: boolean;
  workspaceContextUpdatedAtMs?: number;
  workspaceContextStale?: boolean;
  onNewDeck: () => void;
  onOpenDeck: (deck: OfflineDeckRow) => void;
  onPreviewDeck: (deck: OfflineDeckRow) => void;
  onDecksChanged: () => void | Promise<void>;
}) {
  const [view, setView] = useState<OfflineDeckViewMode>(() => loadDeckViewMode());
  const [sort, setSort] = useState<OfflineDeckSort>(() => loadDeckSort());
  const [editingDeck, setEditingDeck] = useState<OfflineDeckRow | null>(null);
  const [deletingDeck, setDeletingDeck] = useState<OfflineDeckRow | null>(null);
  const [expandedDeckId, setExpandedDeckId] = useState<string | null>(null);
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

  useEffect(() => {
    setExpandedDeckId(null);
  }, [page, view, workspaceScope, sort]);

  const decksWithCounts = useMemo<DeckWithCount[]>(
    () =>
      decks.map((deck) => ({
        ...deck,
        cardCount: counts[deck.local_id] ?? 0,
      })),
    [decks, counts],
  );

  const educationWorkspaces = useMemo(
    () =>
      workspaceScope === "personal" ? ownedEducationWorkspaces(workspaces) : [],
    [workspaceScope, workspaces],
  );
  const educationTeamIds = useMemo(
    () => new Set(educationWorkspaces.map((workspace) => workspace.teamId)),
    [educationWorkspaces],
  );
  const isEducationWorkspaceDeck = (deck: DeckWithCount) => {
    const teamId = personalDashboardTeamId(deck);
    return teamId != null && educationTeamIds.has(teamId);
  };
  const personalDecks = useMemo(
    () =>
      educationWorkspaces.length === 0
        ? decksWithCounts
        : decksWithCounts.filter((deck) => !isEducationWorkspaceDeck(deck)),
    [decksWithCounts, educationWorkspaces.length, educationTeamIds],
  );
  const educationDecks = useMemo(
    () =>
      educationWorkspaces.length === 0
        ? []
        : decksWithCounts.filter((deck) => isEducationWorkspaceDeck(deck)),
    [decksWithCounts, educationWorkspaces.length, educationTeamIds],
  );

  const sorted = useMemo(
    () => sortDecks(personalDecks, sort),
    [personalDecks, sort],
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
    await deleteDeck(deck.local_id);
    await onDecksChanged();
  }

  const canEditDecks = canCreateDeck;

  function renderLibraryDeck(deck: DeckWithCount, deckView: OfflineDeckViewMode) {
    return (
      <DeckTile
        key={deck.local_id}
        deck={deck}
        view={deckView}
        online={online}
        canEdit={canEditDecks}
        expanded={expandedDeckId === deck.local_id}
        onToggleExpand={() =>
          setExpandedDeckId((id) => (id === deck.local_id ? null : deck.local_id))
        }
        onOpen={() => {
          setExpandedDeckId(null);
          onOpenDeck(deck);
        }}
        onPreview={() => {
          setExpandedDeckId(null);
          onPreviewDeck(deck);
        }}
        onEdit={() => {
          setExpandedDeckId(null);
          setEditingDeck(deck);
        }}
        onDelete={() => {
          setExpandedDeckId(null);
          setDeletingDeck(deck);
        }}
      />
    );
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

  const pageTitle = isTeamScope ? "Team Dashboard" : "Personal Dash";

  const workspaceRoleLabel = (role: OfflineWorkspaceContext["role"] | undefined) => {
    switch (role) {
      case "owner":
        return "Owner";
      case "team_admin":
        return "Team admin";
      case "team_member":
        return "Member";
      default:
        return "Member";
    }
  };

  const subtitle = isTeamScope
    ? activeTeam
      ? activeTeam.role === "owner"
        ? `${activeTeam.name} · ${workspaceRoleLabel(activeTeam.role)} · ${formatOfflineWorkspaceOwnerLabel(activeTeam, {
            viewerDisplayName,
            viewerEmail,
          })}`
        : `${activeTeam.name} · ${workspaceRoleLabel(activeTeam.role)} · ${formatOfflineWorkspaceOwnerLabel(activeTeam, {
            viewerDisplayName,
            viewerEmail,
          })} — preview and study assigned decks`
      : "Team workspace on this device"
    : "Study on this device — sync when online";

  const teamEmpty = teamWorkspaceEmptyCopy(activeTeam?.role);
  const emptyTitle = isTeamScope ? teamEmpty.title : "No decks on this device";
  const emptyBody = isTeamScope ? (
    teamEmpty.body
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
            personalHasTeamTierPlan={personalHasTeamTierPlan}
            viewerDisplayName={viewerDisplayName}
            viewerEmail={viewerEmail}
            online={online}
            onChange={onWorkspaceChange}
            onTeamAdminDash={onTeamAdminDash}
            onTeacherDash={onTeacherDash}
            showTeacherDashboard={showTeacherDashboard}
            workspaceContextUpdatedAtMs={workspaceContextUpdatedAtMs}
            workspaceContextStale={workspaceContextStale}
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
          <DisplayMenu
            view={view}
            sort={sort}
            viewLabel={VIEW_LABELS[view].title}
            sortLabel={SORT_LABELS[sort]}
            views={(Object.keys(VIEW_LABELS) as OfflineDeckViewMode[]).map((mode) => ({
              value: mode,
              title: VIEW_LABELS[mode].title,
              hint: VIEW_LABELS[mode].hint,
            }))}
            sorts={(Object.keys(SORT_LABELS) as OfflineDeckSort[]).map((key) => ({
              value: key,
              title: SORT_LABELS[key],
            }))}
            onView={changeView}
            onSort={changeSort}
          />
        </div>
      )}

      {loading ? (
        <div className="library-loading" aria-busy="true" aria-live="polite">
          <p>Loading decks…</p>
        </div>
      ) : (
        <>
          {sorted.length === 0 && educationWorkspaces.length === 0 ? (
            <div className="empty">
              <h2>{emptyTitle}</h2>
              <p>{emptyBody}</p>
            </div>
          ) : sorted.length > 0 ? (
            <>
              {educationWorkspaces.length > 0 ? (
                <h2 className="library-section-label">Personal</h2>
              ) : null}
              <div className={containerClass}>
                {pagedDecks.map((deck) => renderLibraryDeck(deck, view))}
              </div>
              <Pagination
                page={page}
                pageCount={pageCount}
                onPageChange={setPage}
                label="Deck pages"
              />
            </>
          ) : null}

          {educationWorkspaces.length > 0 ? (
            <EducationWorkspaceDecks
              workspaces={educationWorkspaces}
              decks={educationDecks}
              renderDeck={renderLibraryDeck}
            />
          ) : null}
        </>
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

      {deletingDeck && (
        <ConfirmDialog
          title="Delete deck?"
          message={`"${deletingDeck.name}" and all its cards will be removed from this device. This can't be undone.`}
          confirmLabel="Delete deck"
          onCancel={() => setDeletingDeck(null)}
          onConfirm={async () => {
            await handleDeleteDeck(deletingDeck);
            setDeletingDeck(null);
          }}
        />
      )}
    </>
  );
}
