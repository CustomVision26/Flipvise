"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { setViewModeAction } from "@/actions/view-mode";
import { DeckCardPopover } from "@/components/deck-card-popover";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ViewModeDropdown,
  type ViewMode,
} from "@/components/view-mode-dropdown";
import { partitionEducationOwnerWorkspaceDecks } from "@/lib/education-owner-workspace-decks";

type SortOption =
  | "newest"
  | "oldest"
  | "name-asc"
  | "name-desc"
  | "cards-desc"
  | "cards-asc";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Recently updated" },
  { value: "oldest", label: "Oldest updated" },
  { value: "name-asc", label: "Name A → Z" },
  { value: "name-desc", label: "Name Z → A" },
  { value: "cards-desc", label: "Most cards" },
  { value: "cards-asc", label: "Fewest cards" },
];

export type EducationOwnerWorkspaceDeck = {
  id: number;
  name: string;
  description: string | null;
  cardCount: number;
  updatedAt: Date;
  gradeLevel?: string | null;
  difficultyLevel?: string | null;
  teamId?: number | null;
  coverImageUrl?: string | null;
  firstPreviewCardFrontImageUrl?: string | null;
  gradient?: string | null;
  createdByUserId?: string | null;
};

export type EducationOwnerWorkspacePanel = {
  id: number;
  name: string;
  decks: EducationOwnerWorkspaceDeck[];
};

function deckTime(value: Date): number {
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function sortDecks(
  decks: EducationOwnerWorkspaceDeck[],
  sort: SortOption,
): EducationOwnerWorkspaceDeck[] {
  const sorted = [...decks];
  switch (sort) {
    case "newest":
      return sorted.sort((a, b) => deckTime(b.updatedAt) - deckTime(a.updatedAt));
    case "oldest":
      return sorted.sort((a, b) => deckTime(a.updatedAt) - deckTime(b.updatedAt));
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

function DeckRows({
  decks,
  view,
  allowCoverUpload,
  teamTierPreviewPromo,
  hasAiReading,
  detailedDeleteWarning,
}: {
  decks: EducationOwnerWorkspaceDeck[];
  view: ViewMode;
  allowCoverUpload: boolean;
  teamTierPreviewPromo: boolean;
  hasAiReading: boolean;
  detailedDeleteWarning: boolean;
}) {
  return (
    <div
      className={
        view === "compact"
          ? "grid grid-cols-2 items-stretch gap-2 sm:gap-3 sm:grid-cols-3 lg:grid-cols-4"
          : view === "list"
            ? "flex flex-col gap-1"
            : "flex flex-col gap-3"
      }
    >
      {view === "grid" && decks.length > 0 ? (
        <div className="hidden items-center gap-3 px-4 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:flex sm:gap-4">
          <span className="flex-1">Name / Description</span>
          <span className="w-16 text-right">Cards</span>
          <span className="w-44 text-right">Updated</span>
        </div>
      ) : null}
      {decks.map((deck) => (
        <DeckCardPopover
          key={deck.id}
          deck={deck}
          view={view}
          variant="full"
          allowCoverUpload={allowCoverUpload}
          teamTierPreviewPromo={teamTierPreviewPromo}
          hasAiReading={hasAiReading}
          detailedDeleteWarning={detailedDeleteWarning}
        />
      ))}
    </div>
  );
}

function DeckGroup({
  title,
  description,
  emptyMessage,
  children,
  count,
}: {
  title: string;
  description: string;
  emptyMessage: string;
  children: ReactNode;
  count: number;
}) {
  return (
    <Card className="border-0 bg-background/40 shadow-none ring-1 ring-border/70">
      <CardHeader className="border-b border-border/60">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-semibold tracking-tight">
          {title}
          <Badge variant="secondary" className="font-normal tabular-nums">
            {count}
          </Badge>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {count === 0 ? (
          <p className="rounded-lg border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground">
            {emptyMessage}
          </p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

export function EducationOwnerWorkspaceDecks({
  workspaces,
  ownerUserId,
  creatorNames,
  initialView = "grid",
  allowCoverUpload = false,
  teamTierPreviewPromo = false,
  hasAiReading = false,
  detailedDeleteWarning = false,
}: {
  workspaces: EducationOwnerWorkspacePanel[];
  ownerUserId: string;
  creatorNames: Record<string, string>;
  initialView?: ViewMode;
  allowCoverUpload?: boolean;
  teamTierPreviewPromo?: boolean;
  hasAiReading?: boolean;
  detailedDeleteWarning?: boolean;
}) {
  const defaultWorkspaceId =
    workspaces.find((workspace) => workspace.decks.length > 0)?.id ??
    workspaces[0]?.id;
  const [workspaceId, setWorkspaceId] = useState(
    defaultWorkspaceId != null ? String(defaultWorkspaceId) : "",
  );
  const [sort, setSort] = useState<SortOption>("newest");
  const [view, setView] = useState<ViewMode>(initialView);
  const [, startTransition] = useTransition();

  const selected =
    workspaces.find((workspace) => String(workspace.id) === workspaceId) ??
    workspaces[0];

  const grouped = useMemo(() => {
    if (!selected) {
      return { teamAdmin: [], ownerLessonPlans: [], otherOwner: [] };
    }
    const parts = partitionEducationOwnerWorkspaceDecks(selected.decks, ownerUserId);
    return {
      teamAdmin: sortDecks(parts.teamAdmin, sort),
      ownerLessonPlans: sortDecks(parts.ownerLessonPlans, sort),
      otherOwner: sortDecks(parts.otherOwner, sort),
    };
  }, [ownerUserId, selected, sort]);

  const teamAdminByCreator = useMemo(() => {
    const groups = new Map<
      string,
      { label: string; decks: EducationOwnerWorkspaceDeck[] }
    >();
    for (const deck of grouped.teamAdmin) {
      const creatorId = deck.createdByUserId?.trim() || "team-admin";
      const label = creatorNames[creatorId]?.trim() || "Team admin";
      const current = groups.get(creatorId) ?? { label, decks: [] };
      current.decks.push(deck);
      groups.set(creatorId, current);
    }
    return [...groups.entries()];
  }, [creatorNames, grouped.teamAdmin]);

  if (!selected) return null;

  function handleViewChange(next: ViewMode) {
    setView(next);
    startTransition(() => {
      setViewModeAction({ scope: "decks", view: next }).catch(() => {});
    });
  }

  const rowProps = {
    view,
    allowCoverUpload,
    teamTierPreviewPromo,
    hasAiReading,
    detailedDeleteWarning,
  };

  return (
    <section className="space-y-4" aria-label="Workspace decks">
      <div className="flex flex-col gap-4 border-b border-border/60 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Workspaces
          </h2>
          <p className="max-w-xl text-sm text-muted-foreground">
            Choose a workspace. Team-admin decks stay separate from your lesson-plan decks.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="education-owner-workspace">Workspace</Label>
            <Select
              value={String(selected.id)}
              onValueChange={(value) => {
                if (value) setWorkspaceId(value);
              }}
            >
              <SelectTrigger
                id="education-owner-workspace"
                className="w-full sm:w-56"
              >
                <SelectValue placeholder="Select a workspace" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((workspace) => (
                  <SelectItem key={workspace.id} value={String(workspace.id)}>
                    {workspace.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ViewModeDropdown
            view={view}
            onViewChange={handleViewChange}
            sort={sort}
            onSortChange={setSort}
            sortOptions={SORT_OPTIONS}
          />
        </div>
      </div>

      <div className="space-y-4">
        <DeckGroup
          title="Created by team admin"
          description="Decks a team admin created in this workspace."
          emptyMessage="No team-admin decks in this workspace."
          count={grouped.teamAdmin.length}
        >
          <div className="space-y-4">
            {teamAdminByCreator.map(([creatorId, group]) => (
              <div key={creatorId} className="space-y-2">
                <p className="text-xs font-medium text-foreground">{group.label}</p>
                <DeckRows decks={group.decks} {...rowProps} />
              </div>
            ))}
          </div>
        </DeckGroup>

        <DeckGroup
          title="Owner lesson plans"
          description="Lesson-plan decks you created in this workspace, including quiz decks saved from a plan."
          emptyMessage="No owner lesson-plan decks in this workspace."
          count={grouped.ownerLessonPlans.length}
        >
          <DeckRows decks={grouped.ownerLessonPlans} {...rowProps} />
        </DeckGroup>

        {grouped.otherOwner.length > 0 ? (
          <DeckGroup
            title="Other owner decks"
            description="Your other decks in this workspace."
            emptyMessage=""
            count={grouped.otherOwner.length}
          >
            <DeckRows decks={grouped.otherOwner} {...rowProps} />
          </DeckGroup>
        ) : null}
      </div>
    </section>
  );
}
