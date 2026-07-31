/** Form + AI recommendation options for dynamic essay builder v2. */

export const ESSAY_LENGTH_VALUES = [
  "ai_recommended",
  "short",
  "standard",
  "long",
  "extended",
  "custom",
] as const;

export type EssayLength = (typeof ESSAY_LENGTH_VALUES)[number];

export const ESSAY_LENGTH_OPTIONS: { value: EssayLength; label: string }[] = [
  { value: "ai_recommended", label: "AI Recommended" },
  { value: "short", label: "Short" },
  { value: "standard", label: "Standard" },
  { value: "long", label: "Long" },
  { value: "extended", label: "Extended" },
  { value: "custom", label: "Custom" },
];

export const ESSAY_COMPLEXITY_VALUES = [
  "ai_recommended",
  "basic",
  "intermediate",
  "advanced",
  "college",
  "university",
] as const;

export type EssayComplexity = (typeof ESSAY_COMPLEXITY_VALUES)[number];

export const ESSAY_COMPLEXITY_OPTIONS: {
  value: EssayComplexity;
  label: string;
}[] = [
  { value: "ai_recommended", label: "AI Recommended" },
  { value: "basic", label: "Basic" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "college", label: "College" },
  { value: "university", label: "University" },
];

export const ESSAY_WORD_COUNT_PRESETS = [
  "ai_recommended",
  "100",
  "200",
  "300",
  "500",
  "750",
  "1000",
  "1500",
  "custom",
] as const;

export type EssayWordCountPreset = (typeof ESSAY_WORD_COUNT_PRESETS)[number];

export const ESSAY_WORD_COUNT_OPTIONS: {
  value: EssayWordCountPreset;
  label: string;
}[] = [
  { value: "ai_recommended", label: "AI Recommended" },
  { value: "100", label: "100" },
  { value: "200", label: "200" },
  { value: "300", label: "300" },
  { value: "500", label: "500" },
  { value: "750", label: "750" },
  { value: "1000", label: "1000" },
  { value: "1500", label: "1500" },
  { value: "custom", label: "Custom" },
];

export const ESSAY_WRITING_STYLE_VALUES = [
  "academic",
  "formal",
  "conversational",
  "creative",
  "professional",
] as const;

export type EssayWritingStyle = (typeof ESSAY_WRITING_STYLE_VALUES)[number];

export const ESSAY_WRITING_STYLE_OPTIONS: {
  value: EssayWritingStyle;
  label: string;
}[] = [
  { value: "academic", label: "Academic" },
  { value: "formal", label: "Formal" },
  { value: "conversational", label: "Conversational" },
  { value: "creative", label: "Creative" },
  { value: "professional", label: "Professional" },
];

export const ESSAY_TONE_VALUES = [
  "neutral",
  "persuasive",
  "objective",
  "reflective",
  "inspirational",
  "critical",
] as const;

export type EssayTone = (typeof ESSAY_TONE_VALUES)[number];

export const ESSAY_TONE_OPTIONS: { value: EssayTone; label: string }[] = [
  { value: "neutral", label: "Neutral" },
  { value: "persuasive", label: "Persuasive" },
  { value: "objective", label: "Objective" },
  { value: "reflective", label: "Reflective" },
  { value: "inspirational", label: "Inspirational" },
  { value: "critical", label: "Critical" },
];

export const ESSAY_CITATION_VALUES = [
  "none",
  "apa",
  "mla",
  "chicago",
  "harvard",
] as const;

export type EssayCitationStyle = (typeof ESSAY_CITATION_VALUES)[number];

export const ESSAY_CITATION_OPTIONS: {
  value: EssayCitationStyle;
  label: string;
}[] = [
  { value: "none", label: "None" },
  { value: "apa", label: "APA (7th Edition)" },
  { value: "mla", label: "MLA (9th Edition)" },
  { value: "chicago", label: "Chicago (17th Edition)" },
  { value: "harvard", label: "Harvard" },
];

export const ESSAY_ACCOMMODATION_VALUES = [
  "dyslexia_friendly",
  "extra_sentence_starters",
  "simplified_vocabulary",
  "visual_supports",
  "english_language_learner",
  "extended_time",
] as const;

export type EssayAccommodation = (typeof ESSAY_ACCOMMODATION_VALUES)[number];

export const ESSAY_ACCOMMODATION_OPTIONS: {
  value: EssayAccommodation;
  label: string;
}[] = [
  { value: "dyslexia_friendly", label: "Dyslexia Friendly" },
  { value: "extra_sentence_starters", label: "Extra Sentence Starters" },
  { value: "simplified_vocabulary", label: "Simplified Vocabulary" },
  { value: "visual_supports", label: "Visual Supports" },
  { value: "english_language_learner", label: "English Language Learner" },
  { value: "extended_time", label: "Extended Time" },
];

/** Suggested main supporting sections (excluding intro/conclusion) by grade band. */
export function recommendedMainPointsForGrade(gradeLevel: string): number {
  const g = gradeLevel.toLowerCase();
  if (/grade\s*[1-3]|primary|year\s*1/.test(g)) return 2;
  if (/grade\s*[4-6]|upper\s*primary/.test(g)) return 3;
  if (/grade\s*[7-8]|middle/.test(g)) return 4;
  if (/grade\s*(9|10|11|12)|high\s*school|secondary/.test(g)) return 5;
  if (/college|undergraduate|year\s*2/.test(g)) return 6;
  if (/university/.test(g)) return 7;
  return 4;
}

export function recommendedWordCountForGrade(gradeLevel: string): number {
  const points = recommendedMainPointsForGrade(gradeLevel);
  return Math.min(1500, Math.max(100, points * 120 + 80));
}

export function lengthHintForPrompt(length: EssayLength, customMainPoints: number): string {
  switch (length) {
    case "short":
      return "Prefer a compact structure (about 2–3 essay sections total besides a short intro/conclusion pair).";
    case "standard":
      return "Use a standard classroom structure with a clear intro, several supporting sections, and conclusion.";
    case "long":
      return "Use a longer structure with more supporting sections and deeper development.";
    case "extended":
      return "Use an extended multi-section structure suitable for sustained writing.";
    case "custom":
      return `Target about ${customMainPoints} main supporting point section(s) (plus introduction and conclusion as appropriate). Allowed main points: 1–10.`;
    case "ai_recommended":
    default:
      return "Choose an appropriate number of sections for the grade and complexity. Do not force three body paragraphs.";
  }
}

/** Map complexity to legacy difficultyLevel column. */
export function complexityToDifficultyLevel(
  complexity: EssayComplexity,
): "easy" | "medium" | "hard" {
  switch (complexity) {
    case "basic":
      return "easy";
    case "advanced":
    case "college":
    case "university":
      return "hard";
    case "intermediate":
    case "ai_recommended":
    default:
      return "medium";
  }
}
