/** Per-question timer bonuses + reveal targeting (session.extensions). */

export type LiveClassroomTimerBonusMap = Record<
  string,
  { all?: number; byTeamId?: Record<string, number> }
>;

export type LiveClassroomRevealMap = Record<
  string,
  "all" | number[]
>;

export type LiveClassroomParticipantClockMap = Record<
  string,
  { questionId: number; startedAt: string }
>;

export function readTimerBonusMap(
  extensions: Record<string, unknown> | null | undefined,
): LiveClassroomTimerBonusMap {
  const raw = extensions?.questionTimerBonuses;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: LiveClassroomTimerBonusMap = {};
  for (const [qid, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const allRaw = (value as { all?: unknown }).all;
    const byRaw = (value as { byTeamId?: unknown }).byTeamId;
    const all =
      typeof allRaw === "number" && Number.isFinite(allRaw)
        ? Math.max(0, Math.floor(allRaw))
        : undefined;
    const byTeamId: Record<string, number> = {};
    if (byRaw && typeof byRaw === "object" && !Array.isArray(byRaw)) {
      for (const [tid, sec] of Object.entries(byRaw as Record<string, unknown>)) {
        if (typeof sec === "number" && Number.isFinite(sec) && sec > 0) {
          byTeamId[tid] = Math.floor(sec);
        }
      }
    }
    out[qid] = {
      ...(all != null ? { all } : {}),
      ...(Object.keys(byTeamId).length > 0 ? { byTeamId } : {}),
    };
  }
  return out;
}

export function withTimerBonus(
  extensions: Record<string, unknown> | null | undefined,
  questionId: number,
  target: "all" | number,
  extraSeconds: number,
): Record<string, unknown> {
  const sec = Math.max(1, Math.floor(extraSeconds));
  const map = readTimerBonusMap(extensions);
  const key = String(questionId);
  const prev = map[key] ?? {};
  if (target === "all") {
    map[key] = { ...prev, all: (prev.all ?? 0) + sec };
  } else {
    const byTeamId = { ...(prev.byTeamId ?? {}) };
    const tid = String(target);
    byTeamId[tid] = (byTeamId[tid] ?? 0) + sec;
    map[key] = { ...prev, byTeamId };
  }
  return { ...(extensions ?? {}), questionTimerBonuses: map };
}

export function timerBonusSecondsForTeam(
  extensions: Record<string, unknown> | null | undefined,
  questionId: number | null | undefined,
  liveTeamId: number | null | undefined,
): number {
  if (questionId == null) return 0;
  const entry = readTimerBonusMap(extensions)[String(questionId)];
  if (!entry) return 0;
  const teamExtra =
    liveTeamId != null ? (entry.byTeamId?.[String(liveTeamId)] ?? 0) : 0;
  return (entry.all ?? 0) + teamExtra;
}

/** Host/projector display: all-teams bonus + the largest per-team bonus. */
export function maxTimerBonusSeconds(
  extensions: Record<string, unknown> | null | undefined,
  questionId: number | null | undefined,
  liveTeamIds: number[],
): number {
  if (questionId == null) return 0;
  const entry = readTimerBonusMap(extensions)[String(questionId)];
  if (!entry) return 0;
  let teamMax = 0;
  for (const id of liveTeamIds) {
    teamMax = Math.max(teamMax, entry.byTeamId?.[String(id)] ?? 0);
  }
  return (entry.all ?? 0) + teamMax;
}

export function readRevealMap(
  extensions: Record<string, unknown> | null | undefined,
): LiveClassroomRevealMap {
  const raw = extensions?.questionRevealTargets;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: LiveClassroomRevealMap = {};
  for (const [qid, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === "all") {
      out[qid] = "all";
      continue;
    }
    if (!Array.isArray(value)) continue;
    const ids = value.filter(
      (v): v is number => typeof v === "number" && Number.isFinite(v),
    );
    if (ids.length > 0) out[qid] = ids;
  }
  return out;
}

export function withRevealTarget(
  extensions: Record<string, unknown> | null | undefined,
  questionId: number,
  target: "all" | number,
): Record<string, unknown> {
  const map = readRevealMap(extensions);
  const key = String(questionId);
  const prev = map[key];
  if (target === "all" || prev === "all") {
    map[key] = "all";
  } else {
    const set = new Set(Array.isArray(prev) ? prev : []);
    set.add(target);
    map[key] = [...set];
  }
  return { ...(extensions ?? {}), questionRevealTargets: map };
}

export function isQuestionRevealedForTeam(
  extensions: Record<string, unknown> | null | undefined,
  questionId: number | null | undefined,
  liveTeamId: number | null | undefined,
): boolean {
  if (questionId == null) return false;
  const target = readRevealMap(extensions)[String(questionId)];
  if (target == null) return false;
  if (target === "all") return true;
  if (liveTeamId == null) return false;
  return target.includes(liveTeamId);
}

export function isQuestionRevealedForAny(
  extensions: Record<string, unknown> | null | undefined,
  questionId: number | null | undefined,
): boolean {
  if (questionId == null) return false;
  return readRevealMap(extensions)[String(questionId)] != null;
}

export function readParticipantClockMap(
  extensions: Record<string, unknown> | null | undefined,
): LiveClassroomParticipantClockMap {
  const raw = extensions?.participantClocks;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: LiveClassroomParticipantClockMap = {};
  for (const [userId, value] of Object.entries(
    raw as Record<string, unknown>,
  )) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const questionId = (value as { questionId?: unknown }).questionId;
    const startedAt = (value as { startedAt?: unknown }).startedAt;
    if (
      typeof questionId === "number" &&
      Number.isFinite(questionId) &&
      typeof startedAt === "string" &&
      startedAt.length > 0
    ) {
      out[userId] = { questionId, startedAt };
    }
  }
  return out;
}

export function withParticipantClock(
  extensions: Record<string, unknown> | null | undefined,
  userId: string,
  questionId: number,
  startedAt: Date = new Date(),
): Record<string, unknown> {
  const map = readParticipantClockMap(extensions);
  map[userId] = { questionId, startedAt: startedAt.toISOString() };
  return { ...(extensions ?? {}), participantClocks: map };
}

/** Returns `null` when the battle has no per-question time limit (untimed). */
export function remainingQuestionSeconds(input: {
  timePerQuestionSec: number | null;
  bonusSec: number;
  startedAtIso: string | null | undefined;
  paused?: boolean;
  nowMs?: number;
}): number | null {
  if (input.timePerQuestionSec == null) return null;
  const limit = Math.max(1, input.timePerQuestionSec + Math.max(0, input.bonusSec));
  if (input.paused || !input.startedAtIso) return limit;
  const started = Date.parse(input.startedAtIso);
  if (!Number.isFinite(started)) return limit;
  const elapsed = Math.floor(((input.nowMs ?? Date.now()) - started) / 1000);
  return Math.max(0, limit - elapsed);
}
