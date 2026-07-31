import type { z } from "zod";
import {
  essayGenerateInputSchema,
  essayTypeLabel,
  ESSAY_TYPE_META,
  formatEssayStanceForPrompt,
  type EssayGenerationResult,
  type EssaySection,
} from "@/lib/essay-ai-schema";
import { essayTypeSupportsStance } from "@/lib/essay-types";
import {
  ESSAY_ACCOMMODATION_OPTIONS,
  lengthHintForPrompt,
  recommendedMainPointsForGrade,
} from "@/lib/essay-builder-options";
import { buildDynamicFallbackSections } from "@/lib/essay-structure-templates";
import { normalizeEssayGenerationResult } from "@/lib/essay-result-normalize";
import { formatDocumentStudioPromptAppendix } from "@/lib/essay-document-studio-prompt";
import {
  buildFallbackReferenceEntries,
  isPlaceholderAuthorCitation,
  replacePlaceholderInTextCitations,
} from "@/lib/essay-fallback-citations";
import {
  buildFallbackThesis,
  ensureModelEssaySample,
} from "@/lib/essay-sample-content";

type EssayGenerateInput = z.infer<typeof essayGenerateInputSchema>;

export function buildEssayGeneratePrompt(input: EssayGenerateInput): string {
  const meta = ESSAY_TYPE_META[input.essayType];
  const typeLabel = meta.label;
  const stanceLabel = formatEssayStanceForPrompt(
    input.essayType,
    input.essayStance,
  );
  const accommodationLabels = input.accommodations
    .map(
      (key) =>
        ESSAY_ACCOMMODATION_OPTIONS.find((o) => o.value === key)?.label ?? key,
    )
    .join(", ");

  const stanceBlock =
    essayTypeSupportsStance(input.essayType) && stanceLabel
      ? [
          `Stance / focus: ${stanceLabel} (code: ${input.essayStance})`,
          "Honor this stance across prompt, outline, sections, and model content.",
        ]
      : ["Stance / focus: not applicable for this essay type."];

  const modelEssayRules = input.includeModelEssay
    ? [
        input.citationStyle !== "none"
          ? `- modelEssay: complete sample essay body with REAL ${input.citationStyle.toUpperCase()} in-text citations that match the references array (not placeholders)`
          : "- modelEssay: complete, coherent sample essay body joining the same prose as each section's generatedContent",
        "",
        "CRITICAL — sample / model essay quality (REQUIRED when includeModelEssay is true):",
        "- modelEssay AND every section.generatedContent MUST be real grade-level essay prose a strong student could submit.",
        '- NEVER output placeholders such as "(Sample content for Introduction on …)" or empty markdown stubs.',
        "- Do NOT wrap paragraphs in markdown ## headings inside modelEssay or generatedContent — plain essay paragraphs only.",
        "- Invent a clear thesis (thesis field) and develop it from introduction → supporting sections → conclusion.",
        "- Each generatedContent must fulfill that section's instructions, planningGoal, checklist, sentence starters intent, and transitions — but do NOT narrate those instructions inside the prose.",
        "- Put ALL construction tips, transition suggestions, stance reminders, and 'why this works' coaching in section.teacherNotes — NEVER inside modelEssay or generatedContent.",
        "- teacherNotes should start with a short label like \"Construction tip — Introduction:\" and explain how to build that section formally and clearly.",
        "- The full sample must satisfy the rubric criteria (critical thinking, evidence, organization, vocabulary, formatting/citations when required, and a strong conclusion).",
        `- Match tone (${input.tone}), writing style (${input.writingStyle}), grade (${input.gradeLevel}), and target about ${input.wordCount} words (±15%).`,
        "- Use natural academic transitions inside the essay prose (e.g. Furthermore, However) without explaining the transitions to the reader.",
        input.citationStyle !== "none"
          ? `CRITICAL: modelEssay and generatedContent must contain actual ${input.citationStyle.toUpperCase()} parenthetical/narrative citations (real author surnames + years) tied to REAL references — never Author1/Author2 or [Sample] placeholders.`
          : "",
      ]
    : ["- modelEssay must be null", "- Leave section.generatedContent null"];

  return [
    "Create a complete classroom writing activity with a DYNAMIC essay structure.",
    "CRITICAL: Do NOT use fixed labels like Body Paragraph 1, Body Paragraph 2, or Body Paragraph 3.",
    "Determine the ideal essay sections from grade, subject, type, length, complexity, and word count.",
    "First invent an outline of essay sections, then flesh each into a section object.",
    "",
    `Subject: ${input.subject}`,
    `Grade level: ${input.gradeLevel}`,
    `Essay type: ${typeLabel} (${input.essayType})`,
    `Type construction rules: ${meta.constructionGuide}`,
    ...stanceBlock,
    `Essay length setting: ${input.essayLength}`,
    lengthHintForPrompt(input.essayLength, input.customMainPoints),
    `Suggested main supporting points for this grade (AI may override): ${recommendedMainPointsForGrade(input.gradeLevel)}`,
    `Complexity: ${input.complexity}`,
    `Writing style: ${input.writingStyle}`,
    `Tone: ${input.tone}`,
    `Include counterargument section: ${input.includeCounterargument ? "YES — add a Counterargument section when appropriate" : "NO — omit counterargument unless the essay type inherently requires it"}`,
    `Citation style: ${input.citationStyle}`,
    `Sources required: ${input.sourcesRequired}`,
    `Topic: ${input.topic}`,
    input.learningStandard
      ? `Learning standard / curriculum: ${input.learningStandard}`
      : "Learning standard: (none provided)",
    accommodationLabels
      ? `Accommodations: ${accommodationLabels}`
      : "Accommodations: none",
    `Target word count: ${input.wordCount}`,
    input.timeLimitMinutes > 0
      ? `Suggested time limit: ${input.timeLimitMinutes} minutes`
      : "Suggested time limit: none",
    "",
    "Structure examples (adapt, do not copy blindly):",
    "- Argumentative: Introduction, Arguments For, Arguments Against, Counterargument (if requested), Conclusion",
    "- Discursive: Introduction, Advantages, Disadvantages, Balanced Discussion, Conclusion",
    "- Narrative: Beginning, Conflict, Rising Action, Climax, Resolution, Conclusion",
    "- Compare and Contrast: Introduction, Similarities, Differences, Analysis, Conclusion",
    "",
    "Return JSON fields:",
    "- title, thesis (nullable), prompt, learningObjectives",
    input.includeOutline
      ? "- outline: array of { id, title, purpose, estimatedWords } matching the dynamic structure"
      : "- outline must be null",
    "- sections: array of { id, title, type, instructions, sentenceStarters, examples, transitionWords, checklist, teacherNotes, estimatedWords, generatedContent, planningGoal, planningKeyIdea, planningEvidence }",
    "  Section count must fit the length/complexity (typically 3–10). Never hardcode three body paragraphs.",
    '  Prefer clear section titles like "Supporting Argument 1" — never raw stance UI labels like "For (support) 1".',
    input.includeVocabulary
      ? "- vocabulary: terms with definitions"
      : "- vocabulary must be null",
    "- planningGuide: short global planning steps (nullable ok)",
    "- successChecklist",
    input.includeRubric
      ? "- rubric totaling about 100 points across Content, Organization, Grammar, Vocabulary, Critical Thinking, Evidence, Creativity, Formatting, Conclusion (adapt names as needed)"
      : "- rubric must be null",
    input.sourcesRequired > 0 || input.citationStyle !== "none"
      ? `- references: ${input.sourcesRequired || 3} REAL published ${input.citationStyle.toUpperCase()} reference entries that match in-text citations (no [Sample] prefix, no Author1 placeholders)`
      : "- references must be null",
    input.citationStyle !== "none"
      ? "- titlePage: title-page text when requested by formatting (APA required when titlePage YES), else null"
      : "- titlePage must be null",
    input.citationStyle !== "none"
      ? "- referencesAreSamples: boolean — false for real published / user-supplied sources (preferred); true only if placeholders were unavoidable"
      : "- referencesAreSamples must be null",
    input.citationStyle !== "none"
      ? '- referencesNote: short integrity note (e.g. ask readers to verify bibliographic details before academic submission)'
      : "- referencesNote must be null",
    "- conclusion: optional closing teacher note (nullable)",
    ...modelEssayRules,
    "If accommodations include extra sentence starters or simplified vocabulary, enrich those fields.",
    "Keep language age-appropriate. Do not put answer keys in the student prompt.",
    formatDocumentStudioPromptAppendix(input),
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export function fallbackEssayResult(
  input: EssayGenerateInput,
): EssayGenerationResult {
  const typeLabel = essayTypeLabel(input.essayType);
  const stanceLabel = formatEssayStanceForPrompt(
    input.essayType,
    input.essayStance,
  );
  const stanceClause = stanceLabel ? ` (${stanceLabel})` : "";
  const meta = ESSAY_TYPE_META[input.essayType];
  const thesis = buildFallbackThesis(input);
  let sections = buildDynamicFallbackSections(input);
  const outline = input.includeOutline
    ? sections.map((s) => ({
        id: `outline-${s.id}`,
        title: s.title,
        purpose: s.instructions,
        estimatedWords: s.estimatedWords,
      }))
    : null;

  const sample = ensureModelEssaySample(input, sections, thesis, null);
  sections = sample.sections;

  return {
    title: `${input.topic} — ${typeLabel}`,
    thesis,
    prompt: `Write a ${typeLabel.toLowerCase()} about "${input.topic}" for ${input.gradeLevel}${stanceClause}. Aim for about ${input.wordCount} words. Use the provided essay sections — do not force a three-body-paragraph template. ${meta.constructionGuide}`,
    learningObjectives: [
      `Produce a clear ${typeLabel.toLowerCase()} response to the topic${stanceClause}.`,
      "Organize ideas using the dynamic essay sections provided.",
      "Support ideas with relevant details and vocabulary.",
    ],
    outline,
    sections,
    vocabulary: input.includeVocabulary
      ? [
          {
            term: "thesis",
            definition: "The main claim or controlling idea of an essay.",
          },
          {
            term: "evidence",
            definition: "Facts, examples, or details that support a claim.",
          },
          {
            term: "transition",
            definition: "A word or phrase that connects ideas smoothly.",
          },
        ]
      : null,
    planningGuide: [
      `Review what a ${typeLabel.toLowerCase()} requires.`,
      stanceLabel
        ? `Plan content for stance/focus: ${stanceLabel}.`
        : "Brainstorm ideas related to the topic.",
      "Draft each essay section in order, then revise for clarity.",
    ],
    successChecklist: [
      `Matches ${typeLabel} expectations`,
      ...(stanceLabel ? [`Honors stance/focus: ${stanceLabel}`] : []),
      "Uses the provided essay sections",
      "Supports ideas with details",
      `Meets approximately ${input.wordCount} words`,
    ],
    rubric: input.includeRubric
      ? [
          {
            name: "Content",
            description: "Ideas address the prompt.",
            maxPoints: 15,
          },
          {
            name: "Organization",
            description: "Dynamic sections flow logically.",
            maxPoints: 15,
          },
          {
            name: "Grammar",
            description: "Conventions and clarity.",
            maxPoints: 10,
          },
          {
            name: "Vocabulary",
            description: "Word choice fits audience.",
            maxPoints: 10,
          },
          {
            name: "Critical Thinking",
            description: "Reasoning and insight.",
            maxPoints: 15,
          },
          {
            name: "Evidence",
            description: "Support and examples.",
            maxPoints: 15,
          },
          {
            name: "Creativity",
            description: "Voice and originality where appropriate.",
            maxPoints: 5,
          },
          {
            name: "Formatting",
            description: "Readable structure and citations if required.",
            maxPoints: 5,
          },
          {
            name: "Conclusion",
            description: "Effective closing.",
            maxPoints: 10,
          },
        ]
      : null,
    references:
      input.citationStyle !== "none" || input.sourcesRequired > 0
        ? buildFallbackReferenceEntries(
            input.citationStyle === "none" ? "apa" : input.citationStyle,
            Math.max(input.sourcesRequired || 3, 2),
          )
        : null,
    titlePage:
      input.citationStyle === "apa"
        ? [
            input.topic,
            "",
            "[Student Name]",
            "[School / Institution]",
            "[Course Name]",
            "[Instructor Name]",
            "[Due Date]",
          ].join("\n")
        : null,
    referencesAreSamples:
      input.citationStyle !== "none" || input.sourcesRequired > 0
        ? false
        : null,
    referencesNote:
      input.citationStyle !== "none" || input.sourcesRequired > 0
        ? "References support claims in the model essay. Verify bibliographic details before academic submission."
        : null,
    conclusion: null,
    modelEssay: sample.modelEssay,
  };
}

export function coerceGeneratedResult(
  output: EssayGenerationResult,
  input: EssayGenerateInput,
): EssayGenerationResult {
  const normalized = normalizeEssayGenerationResult(output);
  let sections: EssaySection[] = normalized.sections;
  if (sections.length === 0) {
    sections = buildDynamicFallbackSections(input);
  }
  const thesis = normalized.thesis?.trim() || buildFallbackThesis(input);
  const sample = ensureModelEssaySample(
    input,
    sections,
    thesis,
    normalized.modelEssay,
  );
  sections = sample.sections.map((section) => ({
    ...section,
    generatedContent: section.generatedContent
      ? replacePlaceholderInTextCitations(
          section.generatedContent,
          input.citationStyle,
        )
      : section.generatedContent,
  }));
  const modelEssay = sample.modelEssay
    ? replacePlaceholderInTextCitations(sample.modelEssay, input.citationStyle)
    : sample.modelEssay;
  const needsRefs =
    input.citationStyle !== "none" || input.sourcesRequired > 0;
  const rawRefs = (normalized.references ?? [])
    .map((r) => r.trim())
    .filter(Boolean);
  const refsArePlaceholders =
    rawRefs.length === 0 ||
    rawRefs.every((r) => isPlaceholderAuthorCitation(r));
  const references = needsRefs
    ? refsArePlaceholders
      ? buildFallbackReferenceEntries(
          input.citationStyle === "none" ? "apa" : input.citationStyle,
          Math.max(input.sourcesRequired || 3, rawRefs.length || 3),
        )
      : rawRefs.map((r) => r.replace(/^\[Sample\]\s*/i, "").trim())
    : null;
  const referencesAreSamples = needsRefs
    ? refsArePlaceholders
      ? false
      : (normalized.referencesAreSamples ??
        rawRefs.some((r) => /^\[Sample\]/i.test(r)))
    : null;

  return {
    ...normalized,
    thesis,
    sections,
    outline: input.includeOutline
      ? (normalized.outline ??
        sections.map((s) => ({
          id: `outline-${s.id}`,
          title: s.title,
          purpose: s.instructions,
          estimatedWords: s.estimatedWords,
        })))
      : null,
    vocabulary: input.includeVocabulary ? normalized.vocabulary : null,
    rubric: input.includeRubric ? normalized.rubric : null,
    modelEssay,
    titlePage:
      input.citationStyle === "none" ? null : (normalized.titlePage ?? null),
    references,
    referencesAreSamples,
    referencesNote: needsRefs
      ? refsArePlaceholders
        ? "References support claims in the model essay. Verify bibliographic details before academic submission."
        : (normalized.referencesNote ??
          "References support claims in the model essay. Verify bibliographic details before academic submission.")
      : null,
  };
}
