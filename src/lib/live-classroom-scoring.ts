import type { LiveClassroomBattleMode } from "@/lib/live-classroom-types";
import { LIVE_CLASSROOM_POINTS_PER_QUESTION_DEFAULT } from "@/lib/live-classroom-types";

export type ScoreAnswerInput = {
  battleMode: LiveClassroomBattleMode;
  correct: boolean;
  /** Elapsed ms from question start to answer. */
  responseTimeMs: number;
  /** `null` when the battle has no per-question time limit (no speed bonus). */
  timeLimitSec: number | null;
  /**
   * Base points for a correct answer (host-configured on the session).
   * @default 100
   */
  pointsPerQuestion?: number;
  /** Active strategy bonuses already resolved for this answer (host-configured score values). */
  doublePointsBonus?: number;
  scoreBoostBonus?: number;
  shielded?: boolean;
};

export type ScoreAnswerResult = {
  points: number;
  speedBonus: number;
  participation: number;
  eliminated: boolean;
};

const PARTICIPATION = 10;
const MAX_SPEED_BONUS = 50;

/**
 * Pure scoring — used by server actions and unit tests.
 * Correct answers use the host-configured points-per-question, plus speed /
 * participation bonuses (individual & survival) and any active strategy bonuses.
 * Survival: scoring still awards points; hearts handled separately.
 */
export function scoreLiveClassroomAnswer(
  input: ScoreAnswerInput,
): ScoreAnswerResult {
  const participation = PARTICIPATION;
  const baseCorrect =
    typeof input.pointsPerQuestion === "number" &&
    Number.isFinite(input.pointsPerQuestion)
      ? Math.max(0, Math.round(input.pointsPerQuestion))
      : LIVE_CLASSROOM_POINTS_PER_QUESTION_DEFAULT;

  if (!input.correct) {
    return {
      points: input.shielded ? participation : 0,
      speedBonus: 0,
      participation: input.shielded ? participation : 0,
      eliminated: input.battleMode === "survival" && !input.shielded,
    };
  }

  if (input.battleMode === "collaborative_team") {
    let points = baseCorrect;
    points += input.doublePointsBonus ?? 0;
    points += input.scoreBoostBonus ?? 0;
    return {
      points,
      speedBonus: 0,
      participation,
      eliminated: false,
    };
  }

  let speedBonus = 0;
  if (input.timeLimitSec != null) {
    const limitMs = Math.max(1, input.timeLimitSec * 1000);
    const ratio = Math.max(0, Math.min(1, 1 - input.responseTimeMs / limitMs));
    speedBonus = Math.round(MAX_SPEED_BONUS * ratio);
  }
  let points = baseCorrect + speedBonus + participation;
  points += input.doublePointsBonus ?? 0;
  points += input.scoreBoostBonus ?? 0;

  return {
    points,
    speedBonus,
    participation,
    eliminated: false,
  };
}

/** Evenly distribute participant ids across team slots (random assignment). */
export function distributeParticipantsRandomly(
  participantUserIds: string[],
  teamCount: number,
): string[][] {
  const count = Math.max(1, Math.min(4, teamCount));
  const shuffled = [...participantUserIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  const buckets: string[][] = Array.from({ length: count }, () => []);
  shuffled.forEach((id, index) => {
    buckets[index % count]!.push(id);
  });
  return buckets;
}

export function canStartWithParticipantCount(
  connectedCount: number,
  licensedSeats: number,
): boolean {
  return connectedCount >= 1 && connectedCount <= licensedSeats;
}
