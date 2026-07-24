import type { CardMasteryLevel, RecallCardOutcome } from "@/lib/ai-recall-types";

/**
 * Pure mastery transition after an AI Recall evaluation.
 * Replace manual Correct/Incorrect grading with automatic levels.
 */
export function nextMasteryLevel(
  current: CardMasteryLevel | null | undefined,
  outcome: RecallCardOutcome,
  score: number | null,
): CardMasteryLevel {
  const base: CardMasteryLevel = current ?? "new";

  if (outcome === "forced_unlock" || outcome === "skipped") {
    if (base === "mastered" || base === "strong") return "learning";
    return base === "new" ? "learning" : base;
  }

  if (outcome === "incorrect") {
    if (base === "mastered") return "strong";
    if (base === "strong") return "learning";
    return "learning";
  }

  // correct
  const highScore = score != null && score >= 90;
  if (base === "new" || base === "learning") {
    return highScore ? "strong" : "learning";
  }
  if (base === "strong") {
    return highScore ? "mastered" : "strong";
  }
  return "mastered";
}

export function isMasteredLevel(level: CardMasteryLevel): boolean {
  return level === "mastered";
}

export function needsReviewLevel(level: CardMasteryLevel): boolean {
  return level === "new" || level === "learning";
}
