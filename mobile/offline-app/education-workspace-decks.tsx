import { useMemo, useState, type ReactNode } from "react";
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
  const [view, setView] = useState<OfflineDeckViewMode>("grid");
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
    const parts = partitionEducationOwnerWorkspaceDecks(
      rows.map((deck) => ({
        ...deck,
        createdByUserId: deck.created_by_user_id,
        description: deck.description,
      })),
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
        <label className="edu-workspaces__field">
          <span>Workspace</span>
          <select
            className="edu-workspaces__select"
            value={String(selected.teamId)}
            onChange={(event) => setWorkspaceId(Number(event.target.value))}
          >
            {workspaces.map((workspace) => (
              <option key={workspace.teamId} value={workspace.teamId}>
                {workspace.name}
              </option>
            ))}
          </select>
        </label>
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
