import type {
  EssayFeedbackResult,
  EssayGenerationResult,
} from "@/lib/essay-ai-schema";

export type EssayFeedbackCriterionScores = {
  grammar: number;
  organization: number;
  vocabulary: number;
  supportingDetails: number;
  essayStructure: number;
  introduction: number;
  bodyParagraphs: number;
  conclusion: number;
};

const CRITERION_KEYS = [
  "grammar",
  "organization",
  "vocabulary",
  "supportingDetails",
  "essayStructure",
  "introduction",
  "bodyParagraphs",
  "conclusion",
] as const;

/** Average criterion scores into a single 0–100 overall (avoids sticky 65/85 defaults). */
export function averageCriterionScores(
  scores: EssayFeedbackCriterionScores,
): number {
  const values = CRITERION_KEYS.map((key) => scores[key]);
  const sum = values.reduce((acc, n) => acc + n, 0);
  return Math.max(0, Math.min(100, Math.round(sum / values.length)));
}

export function buildEssayFeedbackPrompt(input: {
  title: string;
  prompt: string;
  thesis: string | null;
  wordCountTarget: number;
  studentWordCount: number;
  studentEssay: string;
  result: EssayGenerationResult;
}): string {
  const rubricLines =
    input.result.rubric && input.result.rubric.length > 0
      ? [
          "Activity rubric (use as scoring guidance):",
          ...input.result.rubric.map(
            (row) => `- ${row.name} (${row.maxPoints} pts): ${row.description}`,
          ),
          "",
        ]
      : [
          "No custom rubric provided — score against standard academic writing criteria below.",
          "",
        ];

  const objectives =
    input.result.learningObjectives?.filter(Boolean).slice(0, 6) ?? [];

  return [
    "You are an experienced writing teacher grading ONE student essay.",
    "Evaluate THIS essay only — do not reuse generic scores or stock comments.",
    "",
    `Essay title: ${input.title}`,
    `Assigned prompt: ${input.prompt}`,
    input.thesis ? `Expected thesis direction: ${input.thesis}` : "",
    `Target word count: ${input.wordCountTarget}`,
    `Student word count: ${input.studentWordCount}`,
    "",
    objectives.length > 0
      ? ["Learning objectives:", ...objectives.map((o) => `- ${o}`), ""].join(
          "\n",
        )
      : "",
    ...rubricLines,
    "Scoring rules (REQUIRED):",
    "- Score EACH criterion 0–100 in criterionScores: grammar, organization, vocabulary, supportingDetails, essayStructure, introduction, bodyParagraphs, conclusion.",
    "- overallScore MUST equal the rounded average of those eight criterion scores.",
    "- Use the full 0–100 scale. Differentiate carefully (e.g. 72 vs 78 vs 81).",
    "- Do NOT default to 65 or 85. Those numbers are only valid if the average truly lands there.",
    "- Band guide: 90–100 excellent; 80–89 strong; 70–79 competent with clear gaps; 60–69 developing; below 60 needs major revision.",
    "- Mention concrete details from THIS essay (section titles, claims, examples, wording) in strengths, areasForImprovement, and revisionSuggestions.",
    "- If the essay misses the assigned topic/prompt, lower essayStructure, supportingDetails, and overallScore accordingly.",
    "- If length is far from the target, reflect that in organization/supportingDetails comments and scores.",
    "",
    "Student essay:",
    input.studentEssay.slice(0, 24_000),
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/** Offline / AI-failure feedback with varied, length-aware scores (not stuck on 65/85). */
export function buildFallbackEssayFeedback(input: {
  body: string;
  wordCount: number;
  wordCountTarget: number;
}): EssayFeedbackResult {
  const words = input.wordCount || countWords(input.body);
  const target = Math.max(1, input.wordCountTarget || 300);
  const lengthRatio = words / target;

  let lengthScore = 78;
  if (lengthRatio < 0.4) lengthScore = 48;
  else if (lengthRatio < 0.7) lengthScore = 62;
  else if (lengthRatio < 0.9) lengthScore = 72;
  else if (lengthRatio <= 1.15) lengthScore = 82;
  else if (lengthRatio <= 1.4) lengthScore = 76;
  else lengthScore = 68;

  // Small deterministic jitter from word count so repeated fallbacks aren't identical.
  const jitter = words % 7;
  const criterionScores: EssayFeedbackCriterionScores = {
    grammar: clampScore(lengthScore - 2 + (jitter % 3)),
    organization: clampScore(lengthScore - 4 + ((jitter + 1) % 4)),
    vocabulary: clampScore(lengthScore - 1 + ((jitter + 2) % 3)),
    supportingDetails: clampScore(lengthScore - 6 + ((jitter + 3) % 5)),
    essayStructure: clampScore(lengthScore - 3 + ((jitter + 1) % 3)),
    introduction: clampScore(lengthScore - 5 + (jitter % 4)),
    bodyParagraphs: clampScore(lengthScore - 4 + ((jitter + 2) % 4)),
    conclusion: clampScore(lengthScore - 7 + ((jitter + 3) % 3)),
  };
  const overallScore = averageCriterionScores(criterionScores);

  return {
    overallScore,
    strengths: [
      "You produced a complete response that can be revised further.",
      words >= target * 0.7
        ? "Draft length is close enough to support a full evaluation."
        : "You made a start on the assigned topic.",
    ],
    areasForImprovement: [
      "Strengthen topic sentences in each essay section.",
      "Add more specific supporting details tied to the prompt.",
    ],
    revisionSuggestions: [
      "Revise the introduction so the thesis is unmistakable.",
      "Check transitions between essay sections.",
      "Proofread for grammar and punctuation.",
    ],
    grammar: "Review sentence boundaries and agreement.",
    organization: "Ensure each essay section has one clear focus.",
    vocabulary: "Use precise academic vocabulary where appropriate.",
    supportingDetails: "Add examples or explanations for key claims.",
    essayStructure:
      "Confirm introduction, supporting sections, and conclusion are present.",
    introduction: "Open with context and a clear thesis.",
    bodyParagraphs: "Develop each essay section with evidence and explanation.",
    conclusion: "Restate the thesis and leave a final thought.",
  };
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}
