import "server-only";

import type { DeckRow } from "@/db/queries/decks";
import type { SavedHomeworkPickerItem } from "@/db/queries/saved-homework";
import {
  getSavedHomeworkAssignmentsByUserIds,
  type SavedHomeworkRow,
} from "@/db/queries/saved-homework";
import {
  loadOwnerQuizLessonPlanPicker,
  type OwnerQuizLessonPlanPickerPayload,
  type TeamAdminQuizPickerOption,
} from "@/db/queries/saved-lesson-plans";
import { getDecksForTeam, getTeamById, listTeamMembers } from "@/db/queries/teams";
import { getClerkUserFieldDisplaysByIds } from "@/lib/clerk-user-display";

export type OwnerTeamAdminItemsPayload<T> = {
  isWorkspaceOwner: boolean;
  teamAdmins: TeamAdminQuizPickerOption[];
  itemsByAdminUserId: Record<string, T[]>;
};

export type OwnerTeamAdminLessonPlanPickerPayload = OwnerQuizLessonPlanPickerPayload;

export type OwnerTeamAdminHomeworkPickerPayload =
  OwnerTeamAdminItemsPayload<SavedHomeworkPickerItem>;

export type OwnerTeamAdminDeckPickerPayload = OwnerTeamAdminItemsPayload<DeckRow>;

export const loadOwnerTeamAdminLessonPlanPicker = loadOwnerQuizLessonPlanPicker;

function mapHomeworkRowToPickerItem(row: SavedHomeworkRow): SavedHomeworkPickerItem {
  return {
    id: row.id,
    label: row.label,
    assignmentTitle: row.assignmentTitle,
    savedLessonPlanId: row.savedLessonPlanId,
    subject: row.subject,
    gradeLevel: row.gradeLevel,
    topic: row.topic,
  };
}

function deckCreatorUserId(deck: DeckRow): string {
  return deck.createdByUserId ?? deck.userId;
}

async function loadOwnerTeamAdminBase(viewerUserId: string, teamId: number | null) {
  if (teamId == null) {
    return null;
  }

  const team = await getTeamById(teamId);
  if (!team || team.ownerUserId !== viewerUserId) {
    return null;
  }

  const members = await listTeamMembers(teamId);
  const teamAdmins = members.filter((member) => member.role === "team_admin");
  const creatorUserIds = [
    team.ownerUserId,
    ...teamAdmins.map((member) => member.userId),
  ];

  const displayById = await getClerkUserFieldDisplaysByIds(creatorUserIds);
  const ownerDisplay = displayById[team.ownerUserId];
  const adminOptions: TeamAdminQuizPickerOption[] = [
    {
      userId: team.ownerUserId,
      name: ownerDisplay?.primaryLine ?? null,
      email: ownerDisplay?.primaryEmail ?? null,
      isWorkspaceOwner: true,
    },
    ...teamAdmins.map((member) => {
      const display = displayById[member.userId];
      return {
        userId: member.userId,
        name: display?.primaryLine ?? null,
        email: display?.primaryEmail ?? null,
      };
    }),
  ];

  return { teamAdmins: adminOptions, creatorUserIds };
}

export async function loadOwnerTeamAdminHomeworkPicker(
  viewerUserId: string,
  teamId: number | null,
): Promise<OwnerTeamAdminHomeworkPickerPayload> {
  const base = await loadOwnerTeamAdminBase(viewerUserId, teamId);
  if (!base) {
    return { isWorkspaceOwner: false, teamAdmins: [], itemsByAdminUserId: {} };
  }

  const itemsByAdminUserId: Record<string, SavedHomeworkPickerItem[]> = {};
  for (const creatorUserId of base.creatorUserIds) {
    itemsByAdminUserId[creatorUserId] = [];
  }

  const rows = await getSavedHomeworkAssignmentsByUserIds(base.creatorUserIds);
  for (const row of rows) {
    const bucket = itemsByAdminUserId[row.userId];
    if (bucket) {
      bucket.push(mapHomeworkRowToPickerItem(row));
    }
  }

  return {
    isWorkspaceOwner: true,
    teamAdmins: base.teamAdmins,
    itemsByAdminUserId,
  };
}

export async function loadOwnerTeamAdminDeckPicker(
  viewerUserId: string,
  teamId: number | null,
): Promise<OwnerTeamAdminDeckPickerPayload> {
  const base = await loadOwnerTeamAdminBase(viewerUserId, teamId);
  if (!base || teamId == null) {
    return { isWorkspaceOwner: false, teamAdmins: [], itemsByAdminUserId: {} };
  }

  const team = await getTeamById(teamId);
  if (!team) {
    return { isWorkspaceOwner: false, teamAdmins: [], itemsByAdminUserId: {} };
  }

  const itemsByAdminUserId: Record<string, DeckRow[]> = {};
  for (const creatorUserId of base.creatorUserIds) {
    itemsByAdminUserId[creatorUserId] = [];
  }

  const teamDecks = await getDecksForTeam(teamId, team.ownerUserId);
  for (const deck of teamDecks) {
    const creatorUserId = deckCreatorUserId(deck);
    const bucket = itemsByAdminUserId[creatorUserId];
    if (bucket) {
      bucket.push(deck);
    }
  }

  return {
    isWorkspaceOwner: true,
    teamAdmins: base.teamAdmins,
    itemsByAdminUserId,
  };
}
