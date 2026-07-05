import type { VocabularyTeachingApproach } from "@/lib/lesson-plan-ai-schema";

export const VOCABULARY_TEACHING_APPROACH_OPTIONS: {
  value: VocabularyTeachingApproach;
  label: string;
  description: string;
}[] = [
  {
    value: "weekly",
    label: "Weekly",
    description:
      "Spread vocabulary across the week — assign terms to each day with intro, practice, and review built into the weekly timeline.",
  },
  {
    value: "daily_lessons",
    label: "By daily lessons",
    description:
      "Break vocabulary by individual lesson sessions — map specific terms to each daily lesson within the unit duration.",
  },
];

export function vocabularyApproachPromptLine(
  approach: VocabularyTeachingApproach,
): string {
  if (approach === "weekly") {
    return `Vocabulary teaching approach: WEEKLY — distribute all vocabulary instruction across a full week aligned to the lesson duration. Structure the lesson timeline, warm-up, main teaching steps, classroom activity, homework, assessment, and teacher notes to show which terms are introduced, practiced, and reviewed on each day of the week. Include an explicit weekly vocabulary pacing guide in teacher notes.`;
  }
  return `Vocabulary teaching approach: BY DAILY LESSONS — break vocabulary into distinct daily lesson segments within the stated lesson duration (or multi-day unit when the duration implies it). Map specific terms to each lesson session with explicit introduction, guided practice, and review activities per day. Reflect this pacing in the lesson timeline and teacher notes.`;
}
