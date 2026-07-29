export type AiRecallMotivationTier = "improve" | "encourage" | "excellence";

export type AiRecallMotivation = {
  tier: AiRecallMotivationTier;
  percentCorrect: number;
  title: string;
  message: string;
  /** Quote attribution when available (famous author or Flipvise). */
  author: string | null;
};

/** Session accuracy = correct ÷ reviewed (forced unlocks count as not correct). */
export function computeSessionAccuracyPercent(
  correct: number,
  reviewed: number,
): number {
  if (reviewed <= 0) return 0;
  return Math.round((correct / reviewed) * 100);
}

export function resolveMotivationTier(
  percentCorrect: number,
): AiRecallMotivationTier {
  if (percentCorrect > 90) return "excellence";
  if (percentCorrect >= 50) return "encourage";
  return "improve";
}

export function fallbackAiRecallMotivation(
  percentCorrect: number,
): AiRecallMotivation {
  const tier = resolveMotivationTier(percentCorrect);
  if (tier === "excellence") {
    return {
      tier,
      percentCorrect,
      title: "Your flower of excellence",
      message:
        "Outstanding work — you bloomed through this session with near-perfect recall. Keep watering that mastery.",
      author: "Flipvise",
    };
  }
  if (tier === "encourage") {
    return {
      tier,
      percentCorrect,
      title: "Solid progress",
      message:
        "Nice work this session. Your effort is paying off — keep practicing and those tough cards will stick.",
      author: "Flipvise",
    };
  }
  return {
    tier,
    percentCorrect,
    title: "Keep going",
    message:
      "Every attempt builds stronger recall. Review the tough cards again soon — improvement is within reach.",
    author: "Flipvise",
  };
}
