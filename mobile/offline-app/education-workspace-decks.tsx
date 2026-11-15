import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { OfflineWorkspaceContext } from "../../src/lib/offline/access-context";
import { isEducationTeamPlanId } from "../../src/lib/education-plans";
import { partitionEducationOwnerWorkspaceDecks } from "../../src/lib/education-owner-workspace-decks";
import { DisplayMenu } from "./display-menu";
import {
  SORT_LABELS,
  VIEW_LABELS,
  type OfflineDeckSort,
  type OfflineDeckViewMode,
} from "./deck-library-prefs";
import type { DeckWithCount } from "./deck-library";

export function ownedEducationWorkspaces(
  workspaces: OfflineWorkspaceContext[],
): OfflineWorkspaceContext[] {
  return workspaces.filter(
    (workspace) =>
      isEducationTeamPlanId(workspace.planSlug) &&
      (workspace.isSubscriberOwned === true || workspace.role === "owner"),
  );
}

function sortWorkspaceDecks(
  decks: DeckWithCount[],
  sort: OfflineDeckSort,
): DeckWithCount[] {
  const rows = [...decks];
  const updated = (row: DeckWithCount) => Number(row.updated_at_ms) || 0;
  const count = (row: DeckWithCount) => Number(row.cardCount) || 0;
  switch (sort) {
    case "updated-desc":
      return rows.sort((a, b) => updated(b) - updated(a));
    case "updated-asc":
      return rows.sort((a, b) => updated(a) - updated(b));
    case "name-asc":
      return rows.sort((a, b) => a.name.localeCompare(b.name));
    case "name-desc":
      return rows.sort((a, b) => b.name.localeCompare(a.name));
    case "cards-desc":
      return rows.sort((a, b) => count(b) - count(a));
    case "cards-asc":
      return rows.sort((a, b) => count(a) - count(b));
  }
}

export function EducationWorkspaceDecks({
  workspaces,
  decks,
  renderDeck,
}: {
  workspaces: OfflineWorkspaceContext[];
  decks: DeckWithCount[];
  renderDeck: (deck: DeckWithCount, view: OfflineDeckViewMode) => ReactNode;
}) {
  const [workspaceId, setWorkspaceId] = useState(
    () => workspaces.find((workspace) => workspace.teamId)?.teamId ?? workspaces[0]?.teamId,
  );
  const [view, setView] = useState<OfflineDeckViewMode>("detail");
  const [sort, setSort] = useState<OfflineDeckSort>("updated-desc");

  const selected =
    workspaces.find((workspace) => workspace.teamId === workspaceId) ?? workspaces[0];

  const grouped = useMemo(() => {
    if (!selected) {
      return { teamAdmin: [], ownerLessonPlans: [], otherOwner: [] };
    }
    const rows = decks.filter((deck) => deck.team_id === selected.teamId);
    const ownerUserId =
      rows.find((deck) => deck.owner_user_id?.trim())?.owner_user_id?.trim() ||
      rows[0]?.user_id ||
      "";
    const ownerIds = new Set(
      rows.flatMap((deck) => [deck.owner_user_id?.trim(), deck.user_id?.trim()]).filter(Boolean),
    );
    const parts = partitionEducationOwnerWorkspaceDecks(
      rows.map((deck) => {
        const creator = deck.created_by_user_id?.trim() ?? "";
        const createdByOwner = creator.length > 0 && ownerIds.has(creator);
        return {
          ...deck,
          createdByUserId: createdByOwner ? ownerUserId : deck.created_by_user_id,
          description: deck.description,
        };
      }),
      ownerUserId,
    );
    return {
      teamAdmin: sortWorkspaceDecks(parts.teamAdmin, sort),
      ownerLessonPlans: sortWorkspaceDecks(parts.ownerLessonPlans, sort),
      otherOwner: sortWorkspaceDecks(parts.otherOwner, sort),
    };
  }, [decks, selected, sort]);

  const teamAdminByCreator = useMemo(() => {
    const groups = new Map<string, DeckWithCount[]>();
    for (const deck of grouped.teamAdmin) {
      const creatorId = deck.created_by_user_id?.trim() || "team-admin";
      const current = groups.get(creatorId) ?? [];
      current.push(deck);
      groups.set(creatorId, current);
    }
    return [...groups.entries()];
  }, [grouped.teamAdmin]);

  if (!selected) return null;

  const containerClass =
    view === "thumbnail"
      ? "deck-collection thumbnail"
      : view === "grid"
        ? "deck-collection grid"
        : view === "list"
          ? "deck-collection list"
          : "deck-collection detail";

  return (
    <section className="edu-workspaces" aria-label="Workspace decks">
      <div className="edu-workspaces__intro">
        <h2 className="edu-workspaces__title">Workspaces</h2>
        <p className="edu-workspaces__lead">
          Choose a workspace. Team-admin decks stay separate from your lesson-plan decks.
        </p>
      </div>
      <div className="edu-workspaces__controls">
        <WorkspacePicker
          workspaces={workspaces}
          selectedId={selected.teamId}
          onSelect={setWorkspaceId}
        />
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
          onView={setView}
          onSort={setSort}
        />
      </div>

      <Group
        title="Created by team admin"
        description="Decks a team admin created in this workspace."
        emptyMessage="No team-admin decks in this workspace."
        count={grouped.teamAdmin.length}
      >
        {teamAdminByCreator.map(([creatorId, creatorDecks]) => (
          <div key={creatorId} className={containerClass}>
            {creatorDecks.map((deck) => renderDeck(deck, view))}
          </div>
        ))}
      </Group>

      <Group
        title="Owner lesson plans"
        description="Lesson-plan decks you created in this workspace, including quiz decks saved from a plan."
        emptyMessage="No owner lesson-plan decks in this workspace."
        count={grouped.ownerLessonPlans.length}
      >
        <div className={containerClass}>
          {grouped.ownerLessonPlans.map((deck) => renderDeck(deck, view))}
        </div>
      </Group>

      {grouped.otherOwner.length > 0 ? (
        <Group
          title="Other owner decks"
          description="Your other decks in this workspace."
          emptyMessage=""
          count={grouped.otherOwner.length}
        >
          <div className={containerClass}>
            {grouped.otherOwner.map((deck) => renderDeck(deck, view))}
          </div>
        </Group>
      ) : null}
    </section>
  );
}

function WorkspacePicker({
  workspaces,
  selectedId,
  onSelect,
}: {
  workspaces: OfflineWorkspaceContext[];
  selectedId: number;
  onSelect: (teamId: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = workspaces.find((workspace) => workspace.teamId === selectedId) ?? workspaces[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!selected) return null;

  return (
    <div className="edu-workspaces__field" ref={rootRef}>
      <span>Workspace</span>
      <button
        type="button"
        className="edu-workspaces__select"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selected.name}</span>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
          <path
            d="M6 9l6 6 6-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open ? (
        <div className="edu-workspaces__menu" role="listbox" aria-label="Workspace">
          {workspaces.map((workspace) => {
            const active = workspace.teamId === selected.teamId;
            return (
              <button
                key={workspace.teamId}
                type="button"
                role="option"
                aria-selected={active}
                className={`edu-workspaces__option${active ? " is-active" : ""}`}
                onClick={() => {
                  onSelect(workspace.teamId);
                  setOpen(false);
                }}
              >
                <span>{workspace.name}</span>
                <span className="edu-workspaces__option-mark" aria-hidden />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function Group({
  title,
  description,
  emptyMessage,
  count,
  children,
}: {
  title: string;
  description: string;
  emptyMessage: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="edu-workspaces__group">
      <h3>
        {title}
        <span className="edu-workspaces__count">{count}</span>
      </h3>
      <p>{description}</p>
      {count === 0 ? <p className="edu-workspaces__empty">{emptyMessage}</p> : children}
    </section>
  );
}
