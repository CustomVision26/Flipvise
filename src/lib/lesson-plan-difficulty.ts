export const LESSON_DIFFICULTY_LEVELS = [
  "All",
  "Beginner",
  "Intermediate",
  "Advanced",
  "Honors/Gifted",
] as const;

export type LessonDifficultyLevel = (typeof LESSON_DIFFICULTY_LEVELS)[number];

const TIER_PREFIX_PATTERNS: Record<
  Exclude<LessonDifficultyLevel, "All">,
  RegExp
> = {
  Beginner: /^Beginner\s*:/i,
  Intermediate: /^Intermediate\s*:/i,
  Advanced: /^Advanced\s*:/i,
  "Honors/Gifted": /^Honors\s*\/?\s*Gifted\s*:/i,
};

function isAccommodationLine(item: string): boolean {
  return item.trim().toLowerCase().startsWith("accommodations:");
}

export function filterDifferentiatedInstruction(
  items: string[],
  selectedLevel: string,
): string[] {
  if (selectedLevel === "All") {
    return items;
  }

  const pattern =
    TIER_PREFIX_PATTERNS[selectedLevel as Exclude<LessonDifficultyLevel, "All">];
  if (!pattern) {
    return items;
  }

  const tierLines = items.filter((item) => pattern.test(item.trim()));
  const accommodationLines = items.filter(isAccommodationLine);

  if (tierLines.length > 0) {
    return [...tierLines, ...accommodationLines];
  }

  const looseMatch = items.filter(
    (item) =>
      !isAccommodationLine(item) &&
      item.toLowerCase().includes(selectedLevel.toLowerCase()),
  );

  if (looseMatch.length > 0) {
    return [...looseMatch, ...accommodationLines];
  }

  return accommodationLines.length > 0 ? accommodationLines : items.slice(0, 1);
}

export function difficultyLabelForContent(level: string): string {
  return level === "All" ? "multiple readiness levels" : level;
}

export function differentiatedInstructionAiRules(level: string): string {
  if (level === "All") {
    return `- Differentiated instruction MUST include exactly four entries using these labels: "Beginner:", "Intermediate:", "Advanced:", and "Honors/Gifted:" — one detailed strategy per tier.`;
  }

  return `- Differentiated instruction MUST include ONLY ONE tier entry for "${level}" using the label "${level}:" followed by a detailed, in-depth strategy. Do NOT include Beginner, Intermediate, Advanced, or Honors/Gifted entries for other tiers.`;
}

export type DifficultyRigorProfile = {
  summary: string;
  objectiveDepth: string;
  vocabularyGuidance: string;
  assessmentGuidance: string;
  activityGuidance: string;
  homeworkGuidance: string;
  teachingStepsGuidance: string;
};

export function getDifficultyRigorProfile(level: string): DifficultyRigorProfile {
  switch (level) {
    case "Beginner":
      return {
        summary: "foundational and accessible — the easiest version of the lesson",
        objectiveDepth:
          "focus on identifying, naming, and describing basic ideas with heavy scaffolding and simplified language",
        vocabularyGuidance:
          "4–6 essential terms only, with short student-friendly definitions and everyday examples",
        assessmentGuidance:
          "low-stakes checks such as matching, labeling diagrams, or short oral responses — avoid multi-step problems",
        activityGuidance:
          "highly structured partner tasks with sentence frames, visuals, and teacher-led checkpoints",
        homeworkGuidance:
          "brief illustrated summary or 3–5 sentence reflection — no complex problem sets",
        teachingStepsGuidance:
          "slower pacing, explicit modeling, frequent comprehension checks, and heavily guided practice",
      };
    case "Advanced":
      return {
        summary: "challenging — above typical grade-level expectations",
        objectiveDepth:
          "require analysis, multi-step reasoning, and application to unfamiliar scenarios",
        vocabularyGuidance:
          "8–10 precise academic terms, including nuanced distinctions between related concepts",
        assessmentGuidance:
          "multi-part questions requiring explanation, comparison, and evidence-based justification",
        activityGuidance:
          "collaborative problem-solving with limited hints and higher cognitive demand",
        homeworkGuidance:
          "applied practice with multi-step problems and written justification of answers",
        teachingStepsGuidance:
          "concise direct instruction, fewer scaffolds, and rapid transition to independent application",
      };
    case "Honors/Gifted":
      return {
        summary: "most rigorous — enrichment and extension for gifted learners",
        objectiveDepth:
          "include synthesis, evaluation, and open-ended inquiry beyond the standard curriculum",
        vocabularyGuidance:
          "10–12 advanced terms, including cross-disciplinary connections where appropriate",
        assessmentGuidance:
          "open-ended performance tasks, design challenges, or teach-back mini-lessons with rubrics",
        activityGuidance:
          "student-led investigation, peer teaching, or creative extension projects with minimal guidance",
        homeworkGuidance:
          "research, design, or creation task that extends the topic into a novel context",
        teachingStepsGuidance:
          "brief launch, student inquiry cycles, and teacher as facilitator rather than primary explainer",
      };
    case "All":
      return {
        summary:
          "multi-tier — standard core lesson with clear scaffolding and extension paths for every readiness level",
        objectiveDepth:
          "include measurable objectives that span foundational understanding through enrichment",
        vocabularyGuidance:
          "6–10 tiered terms — core terms for all students plus optional extension vocabulary",
        assessmentGuidance:
          "formative checks at multiple depths, from recall to applied reasoning",
        activityGuidance:
          "flexible stations or tiered tasks so each readiness group has an appropriate challenge",
        homeworkGuidance:
          "choice-based assignment with a core task plus optional challenge extension",
        teachingStepsGuidance:
          "whole-class core instruction followed by tiered practice and conferencing",
      };
    case "Intermediate":
    default:
      return {
        summary: "grade-level standard — balanced rigor for a typical class",
        objectiveDepth:
          "explain, apply, and demonstrate understanding using grade-appropriate academic language",
        vocabularyGuidance:
          "6–8 key terms with clear definitions tied directly to lesson examples",
        assessmentGuidance:
          "mix of recall, short explanation, and one applied problem at grade-level depth",
        activityGuidance:
          "structured group work with clear roles, rubric, and grade-level problem complexity",
        homeworkGuidance:
          "short practice set or written reflection reinforcing the day's learning targets",
        teachingStepsGuidance:
          "standard I-do / we-do / you-do pacing with periodic formative checks",
      };
  }
}

export function difficultyRigorAiRules(level: string): string {
  const profile = getDifficultyRigorProfile(level);
  return `- Overall lesson rigor (${level}): ${profile.summary}.
- Objectives: ${profile.objectiveDepth}.
- Vocabulary: ${profile.vocabularyGuidance}.
- Assessment: ${profile.assessmentGuidance}.
- Classroom activity: ${profile.activityGuidance}.
- Homework: ${profile.homeworkGuidance}.
- Main teaching steps: ${profile.teachingStepsGuidance}.
- Calibrate warm-up, examples, problem complexity, and teacher language to match "${level}" throughout the entire plan.`;
}

