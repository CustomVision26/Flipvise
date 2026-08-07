/** Independent (per-player) battle progress for Individual / Survival modes. */

import type { LiveClassroomBattleMode } from "@/lib/live-classroom-types";

export type LiveClassroomParticipantBattleStatus =
  | "active"
  | "finished"
  | "opted_out";

export type LiveClassroomParticipantBattleState = {
  status: LiveClassroomParticipantBattleStatus;
  finishedAt?: string;
};

export type LiveClassroomParticipantBattleMap = Record<
  string,
  LiveClassroomParticipantBattleState
>;

export function isIndependentLiveClassroomBattleMode(
  mode: LiveClassroomBattleMode,
): boolean {
  return mode === "individual_team" || mode === "survival";
}

export function readParticipantBattleMap(
  extensions: Record<string, unknown> | null | undefined,
): LiveClassroomParticipantBattleMap {
  const raw = extensions?.participantBattle;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: LiveClassroomParticipantBattleMap = {};
  for (const [userId, value] of Object.entries(
    raw as Record<string, unknown>,
  )) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const status = (value as { status?: unknown }).status;
    if (
      status !== "active" &&
      status !== "finished" &&
      status !== "opted_out"
    ) {
      continue;
    }
    const finishedAt = (value as { finishedAt?: unknown }).finishedAt;
    out[userId] = {
      status,
      ...(typeof finishedAt === "string" ? { finishedAt } : {}),
    };
  }
  return out;
}

export function withParticipantBattleStatus(
  extensions: Record<string, unknown> | null | undefined,
  userId: string,
  status: LiveClassroomParticipantBattleStatus,
): Record<string, unknown> {
  const prev = { ...(extensions ?? {}) };
  const map = readParticipantBattleMap(prev);
  map[userId] = {
    status,
    ...(status === "active"
      ? {}
      : { finishedAt: new Date().toISOString() }),
  };
  prev.participantBattle = map;
  return prev;
}

/** Team-assigned participants who still need to finish or opt out. */
export function eligibleIndependentBattleParticipants<
  T extends { userId: string; liveTeamId: number | null; removed?: boolean },
>(participants: T[]): T[] {
  return participants.filter(
    (p) => !p.removed && p.liveTeamId != null,
  );
}

export function participantHasCompletedIndependentBattle(
  userId: string,
  map: LiveClassroomParticipantBattleMap,
  answeredCount: number,
  questionCount: number,
): boolean {
  const status = map[userId]?.status;
  if (status === "finished" || status === "opted_out") return true;
  return questionCount > 0 && answeredCount >= questionCount;
}

export function allEligibleParticipantsCompletedIndependentBattle(input: {
  participants: Array<{
    userId: string;
    liveTeamId: number | null;
    removed?: boolean;
    /** When false, player is not actively battling (left / stale presence). */
    connected?: boolean;
  }>;
  battleMap: LiveClassroomParticipantBattleMap;
  answeredCountByUserId: Map<string, number>;
  questionCount: number;
}): boolean {
  const eligible = eligibleIndependentBattleParticipants(input.participants);
  if (eligible.length === 0) return false;
  return eligible.every((p) => {
    if (
      participantHasCompletedIndependentBattle(
        p.userId,
        input.battleMap,
        input.answeredCountByUserId.get(p.userId) ?? 0,
        input.questionCount,
      )
    ) {
      return true;
    }
    // Left the battle surface without finishing — not actively battling.
    return p.connected === false;
  });
}

export function personalQuestionIndex(input: {
  questionIdsInOrder: number[];
  answeredQuestionIds: Set<number>;
}): number {
  const idx = input.questionIdsInOrder.findIndex(
    (id) => !input.answeredQuestionIds.has(id),
  );
  return idx;
}
