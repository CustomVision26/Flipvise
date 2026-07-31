/**
 * @vitest-environment node
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDynamicFallbackSections } from "./essay-structure-templates";
import { normalizeEssayGenerationResult } from "./essay-result-normalize";
import type { EssayGenerateInput } from "./essay-ai-schema";

function baseInput(
  overrides: Partial<EssayGenerateInput> = {},
): EssayGenerateInput {
  return {
    subject: "History",
    gradeLevel: "Grade 8",
    essayType: "argumentative",
    essayStance: "both",
    topic: "Optional homework",
    learningStandard: "",
    essayLength: "standard",
    customMainPoints: 5,
    complexity: "intermediate",
    difficultyLevel: "medium",
    wordCountPreset: "500",
    wordCount: 500,
    writingStyle: "academic",
    tone: "persuasive",
    includeCounterargument: true,
    citationStyle: "none",
    sourcesRequired: 0,
    accommodations: [],
    timeLimitMinutes: 0,
    includeVocabulary: true,
    includeOutline: true,
    includeRubric: true,
    includeModelEssay: true,
    ...overrides,
  };
}

describe("dynamic essay structure", () => {
  it("does not emit Body Paragraph labels", () => {
    const sections = buildDynamicFallbackSections(baseInput());
    for (const section of sections) {
      assert.equal(/body paragraph\s*\d+/i.test(section.title), false);
    }
    assert.ok(sections.some((s) => /intro/i.test(s.title)));
    assert.ok(sections.some((s) => /counter/i.test(s.title)));
    assert.ok(sections.some((s) => /conclu/i.test(s.title)));
  });

  it("builds narrative story sections", () => {
    const sections = buildDynamicFallbackSections(
      baseInput({
        essayType: "narrative",
        essayStance: null,
        includeCounterargument: false,
      }),
    );
    const titles = sections.map((s) => s.title);
    assert.ok(titles.includes("Beginning"));
    assert.ok(titles.includes("Climax"));
    assert.ok(titles.includes("Resolution"));
  });

  it("normalizes legacy string outlines into sections", () => {
    const normalized = normalizeEssayGenerationResult({
      title: "Legacy",
      prompt: "Write",
      learningObjectives: ["Learn"],
      outline: ["Introduction", "Evidence", "Conclusion"],
      planningGuide: ["Plan"],
      successChecklist: ["Done"],
      vocabulary: null,
      rubric: null,
      modelEssay: null,
    });
    assert.equal(normalized.sections.length, 3);
    assert.equal(normalized.sections[0]?.title, "Introduction");
    assert.ok(normalized.outline);
    assert.equal(normalized.outline?.[0]?.title, "Introduction");
  });
});
