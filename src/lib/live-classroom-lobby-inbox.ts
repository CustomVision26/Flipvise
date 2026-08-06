import type { UnifiedInboxItem } from "@/lib/inbox-item-types";
import type { listLiveClassroomLobbyInboxMessagesForUser } from "@/db/queries/live-classroom-lobby-inbox";
import {
  battleModeLabel,
  sessionTypeLabel,
  type LiveClassroomBattleMode,
  type LiveClassroomSessionType,
} from "@/lib/live-classroom-types";
import { liveClassroomDeckStudyPath } from "@/lib/live-classroom-url";

type LobbyInboxRow = Awaited<
  ReturnType<typeof listLiveClassroomLobbyInboxMessagesForUser>
>[number];

export function buildLiveClassroomLobbyInviteCopy(input: {
  recipientDisplayName?: string | null;
  hostDisplayName?: string | null;
  sessionName: string;
  sessionType: LiveClassroomSessionType;
  battleMode: LiveClassroomBattleMode;
  joinCode: string;
  deckName?: string | null;
  deckId?: number | null;
  teamId?: number | null;
}): { title: string; description: string } {
  const greeting = input.recipientDisplayName?.trim()
    ? `Dear ${input.recipientDisplayName.trim()},`
    : "Dear Flipvise learner,";
  const hostLine = input.hostDisplayName?.trim()
    ? input.hostDisplayName.trim()
    : "Your Live Classroom™ host";
  const deckLine = input.deckName?.trim()
    ? `\nLinked deck: ${input.deckName.trim()}`
    : "";
  const studyPath =
    input.deckId != null && Number.isFinite(input.deckId) && input.deckId > 0
      ? liveClassroomDeckStudyPath(input.deckId, input.teamId)
      : null;

  return {
    title: `Live Classroom™ invitation — ${input.sessionName}`,
    description:
      `${greeting}\n\n` +
      "You have been granted access to join a Live Classroom™ session for your workspace.\n\n" +
      `Session name: ${input.sessionName}\n` +
      `Session type: ${sessionTypeLabel(input.sessionType)}\n` +
      `Battle mode: ${battleModeLabel(input.battleMode)}` +
      `${deckLine}\n\n` +
      "You will be placed on a team for this session. Your host may assign your team in the lobby before the battle begins.\n\n" +
      `Lobby join code: ${input.joinCode}\n\n` +
      "How to enter the lobby code:\n" +
      "1. Open the study page for the deck linked to this battle.\n" +
      "2. Enter the lobby join code in the Join with code field.\n" +
      "3. Select Join lobby.\n\n" +
      (studyPath
        ? `Study page path: ${studyPath}\n\n`
        : "Join with code appears on the linked deck’s study page.\n\n") +
      "Join with the code only — there is no lobby link to share.\n\n" +
      "Regards,\n" +
      `${hostLine}\n` +
      "Flipvise Live Classroom™",
  };
}

export function liveClassroomLobbyInboxRowsToInboxItems(
  rows: LobbyInboxRow[],
  readSet: Set<string>,
): UnifiedInboxItem[] {
  return rows.map((row) => {
    const itemId = String(row.id);
    const key = `live_classroom_lobby:${itemId}`;
    return {
      type: "live_classroom_lobby" as const,
      key,
      title: row.title,
      description: row.description,
      dateIso: row.createdAt.toISOString(),
      isRead: readSet.has(key),
      requiresAction: false as const,
      payload: {
        messageId: row.id,
        sessionId: row.sessionId,
        teamId: row.teamId,
        joinCode: row.joinCode,
      },
    };
  });
}
