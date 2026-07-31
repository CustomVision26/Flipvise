import { z } from "zod";

/**
 * Essay / writing activity types for AI Writing Studio.
 * Keep labels and stance rules in sync with generation prompts.
 */
export const ESSAY_TYPE_VALUES = [
  "narrative",
  "descriptive",
  "expository",
  "persuasive",
  "argumentative",
  "discursive",
  "for_and_against",
  "compare_and_contrast",
  "cause_and_effect",
  "problem_and_solution",
  "process",
  "reflective",
  "informative",
  "research",
  "literary_analysis",
  "extended_response",
  "personal_response",
  "opinion",
  "creative_writing",
] as const;

export const essayTypeSchema = z.enum(ESSAY_TYPE_VALUES);
export type EssayType = z.infer<typeof essayTypeSchema>;

/** Stance for types that present two sides / two foci. */
export const essayStanceSchema = z.enum(["both", "side_1", "side_2"]);
export type EssayStance = z.infer<typeof essayStanceSchema>;

export type EssayTypeMeta = {
  value: EssayType;
  label: string;
  /** Short AI guidance for constructing this type accurately. */
  constructionGuide: string;
  /**
   * When true, UI shows a stance sub-dropdown (both / side 1 / side 2)
   * with labels from side1Label / side2Label / bothLabel.
   */
  supportsStance: boolean;
  bothLabel?: string;
  side1Label?: string;
  side2Label?: string;
};

export const ESSAY_TYPE_META: Record<EssayType, EssayTypeMeta> = {
  narrative: {
    value: "narrative",
    label: "Narrative",
    supportsStance: false,
    constructionGuide:
      "Tell a story with characters, setting, conflict, and resolution. Use chronological or flashback structure; sensory detail and a clear narrative arc.",
  },
  descriptive: {
    value: "descriptive",
    label: "Descriptive",
    supportsStance: false,
    constructionGuide:
      "Paint a vivid picture of a person, place, object, or experience using sensory language. Organize by spatial, sensory, or dominant-impression order—not a plot-driven story.",
  },
  expository: {
    value: "expository",
    label: "Expository",
    supportsStance: false,
    constructionGuide:
      "Explain a topic clearly and objectively. Use definition, examples, facts, and logical organization. Do not argue a controversial stance.",
  },
  persuasive: {
    value: "persuasive",
    label: "Persuasive",
    supportsStance: true,
    bothLabel: "Both sides (then persuade)",
    side1Label: "For (support)",
    side2Label: "Against (oppose)",
    constructionGuide:
      "Convince the reader to adopt a position. Use claims, reasons, evidence, and appeals (logic/emotion/credibility). Address counterarguments when stance is both or when useful.",
  },
  argumentative: {
    value: "argumentative",
    label: "Argumentative",
    supportsStance: true,
    bothLabel: "Both sides",
    side1Label: "For (support)",
    side2Label: "Against (oppose)",
    constructionGuide:
      "Argue a debatable claim with evidence and reasoning. Include a clear thesis, supporting arguments, and fair treatment of opposing views when stance requires both sides.",
  },
  discursive: {
    value: "discursive",
    label: "Discursive",
    supportsStance: true,
    bothLabel: "Balanced (both sides)",
    side1Label: "Emphasize side 1",
    side2Label: "Emphasize side 2",
    constructionGuide:
      "Explore a topic from multiple angles in a thoughtful, essayistic way. Weigh perspectives; may lean toward one emphasis when stance is side_1 or side_2, but remain reasoned rather than purely polemical.",
  },
  for_and_against: {
    value: "for_and_against",
    label: "For and Against",
    supportsStance: true,
    bothLabel: "Both (for and against)",
    side1Label: "For only",
    side2Label: "Against only",
    constructionGuide:
      "Structure around advantages/disadvantages or for/against points. When both: present each side clearly then conclude. When for or against only: develop that side thoroughly.",
  },
  compare_and_contrast: {
    value: "compare_and_contrast",
    label: "Compare and Contrast",
    supportsStance: true,
    bothLabel: "Balanced comparison",
    side1Label: "Focus on first subject",
    side2Label: "Focus on second subject",
    constructionGuide:
      "Compare and contrast two subjects (ideas, texts, events, methods). Use point-by-point or block structure. Balanced stance covers similarities and differences evenly; side focus still mentions the other briefly for context.",
  },
  cause_and_effect: {
    value: "cause_and_effect",
    label: "Cause and Effect",
    supportsStance: true,
    bothLabel: "Causes and effects",
    side1Label: "Focus on causes",
    side2Label: "Focus on effects",
    constructionGuide:
      "Explain causal relationships. Clarify chain of causes and/or effects with logical links and examples. Match emphasis to stance (causes, effects, or both).",
  },
  problem_and_solution: {
    value: "problem_and_solution",
    label: "Problem and Solution",
    supportsStance: true,
    bothLabel: "Problem and solution",
    side1Label: "Focus on the problem",
    side2Label: "Focus on the solution",
    constructionGuide:
      "Define a problem, analyze it, and propose workable solutions. When stance is both, balance problem analysis with solution detail; when one-sided, deepen that half while briefly framing the other.",
  },
  process: {
    value: "process",
    label: "Process Essay",
    supportsStance: false,
    constructionGuide:
      "Explain how to do something or how something works in clear sequential steps. Use chronological order, transitions, and precise instructions or explanations.",
  },
  reflective: {
    value: "reflective",
    label: "Reflective",
    supportsStance: false,
    constructionGuide:
      "Reflect on an experience, text, or idea. Combine description with personal insight, what was learned, and why it matters. First person is appropriate.",
  },
  informative: {
    value: "informative",
    label: "Informative",
    supportsStance: false,
    constructionGuide:
      "Inform the reader with accurate facts, definitions, and explanations. Stay neutral; prioritize clarity and useful coverage of the topic.",
  },
  research: {
    value: "research",
    label: "Research Essay",
    supportsStance: false,
    constructionGuide:
      "Present a research-oriented response: clear question/thesis, organized findings, evidence, and citation-style placeholders (e.g. Author, Year). Emphasize synthesis over personal narrative.",
  },
  literary_analysis: {
    value: "literary_analysis",
    label: "Literary Analysis",
    supportsStance: false,
    constructionGuide:
      "Analyze literature (character, theme, style, structure, symbolism). Use textual evidence and interpretation; avoid pure plot summary.",
  },
  extended_response: {
    value: "extended_response",
    label: "Extended Response",
    supportsStance: false,
    constructionGuide:
      "Provide a developed constructed/extended response suitable for assessments (including math or content-area reasoning when the subject calls for it). Clear claim or explanation, supporting steps/details, and a closing.",
  },
  personal_response: {
    value: "personal_response",
    label: "Personal Response",
    supportsStance: false,
    constructionGuide:
      "Respond personally to a prompt, text, or issue with honest viewpoint and supporting reasons or experiences. More personal than a formal research essay; still organized.",
  },
  opinion: {
    value: "opinion",
    label: "Opinion Essay",
    supportsStance: true,
    bothLabel: "Acknowledge both, state opinion",
    side1Label: "Opinion for",
    side2Label: "Opinion against",
    constructionGuide:
      "State a clear opinion and support it. When both: briefly acknowledge the other view then defend the chosen stance in the model; when for/against: commit fully to that opinion.",
  },
  creative_writing: {
    value: "creative_writing",
    label: "Creative Writing",
    supportsStance: false,
    constructionGuide:
      "Produce imaginative writing (story, vignette, or creative prose) matching the topic. Prioritize voice, imagery, and originality over formal academic essay structure.",
  },
};

export const ESSAY_TYPES: { value: EssayType; label: string }[] =
  ESSAY_TYPE_VALUES.map((value) => ({
    value,
    label: ESSAY_TYPE_META[value].label,
  }));

export function essayTypeSupportsStance(essayType: EssayType): boolean {
  return ESSAY_TYPE_META[essayType].supportsStance;
}

export function essayStanceOptions(essayType: EssayType): {
  value: EssayStance;
  label: string;
}[] {
  const meta = ESSAY_TYPE_META[essayType];
  if (!meta.supportsStance) return [];
  return [
    { value: "both", label: meta.bothLabel ?? "Both sides" },
    { value: "side_1", label: meta.side1Label ?? "Side 1" },
    { value: "side_2", label: meta.side2Label ?? "Side 2" },
  ];
}

export function formatEssayStanceForPrompt(
  essayType: EssayType,
  stance: EssayStance | null | undefined,
): string | null {
  const meta = ESSAY_TYPE_META[essayType];
  if (!meta.supportsStance || !stance) return null;
  if (stance === "both") return meta.bothLabel ?? "Both sides";
  if (stance === "side_1") return meta.side1Label ?? "Side 1";
  return meta.side2Label ?? "Side 2";
}

/** Human-readable type label for UI and fallbacks. */
export function essayTypeLabel(essayType: EssayType | string): string {
  if (essayType in ESSAY_TYPE_META) {
    return ESSAY_TYPE_META[essayType as EssayType].label;
  }
  return essayType.replace(/_/g, " ");
}
