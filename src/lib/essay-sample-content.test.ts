/**
 * @vitest-environment node
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFallbackThesis,
  ensureModelEssaySample,
  isPlaceholderEssayProse,
} from "./essay-sample-content";
import { fallbackEssayResult } from "./essay-generate-prompt";
import { buildDynamicFallbackSections } from "./essay-structure-templates";
import type { EssayGenerateInput } from "./essay-ai-schema";

function baseInput(
  overrides: Partial<EssayGenerateInput> = {},
): EssayGenerateInput {
  return {
    subject: "Personal Finance",
    gradeLevel: "Grade 10",
    essayType: "persuasive",
    essayStance: "side_1",
    topic: "Financial Literacy: Should It Be a Required High School Course?",
    learningStandard: "",
    essayLength: "standard",
    customMainPoints: 3,
    complexity: "intermediate",
    difficultyLevel: "medium",
    wordCountPreset: "500",
    wordCount: 500,
    writingStyle: "academic",
    tone: "persuasive",
    includeCounterargument: false,
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

describe("essay sample content", () => {
  it("detects placeholder prose", () => {
    assert.equal(
      isPlaceholderEssayProse(
        '(Sample content for Introduction on "Financial Literacy".)',
      ),
      true,
    );
    assert.equal(
      isPlaceholderEssayProse(
        "Financial literacy should be required because students need budgeting skills.",
      ),
      false,
    );
  });

  it("fallback result returns real model essay prose, not placeholders", () => {
    const result = fallbackEssayResult(baseInput());
    assert.ok(result.modelEssay?.trim());
    assert.equal(isPlaceholderEssayProse(result.modelEssay), false);
    assert.ok(
      result.thesis && !/A clear controlling idea about/.test(result.thesis),
    );
    assert.equal(
      /Using transitions such as|meets the section goal/i.test(
        result.modelEssay ?? "",
      ),
      false,
    );
    for (const section of result.sections) {
      assert.ok(section.generatedContent?.trim());
      assert.equal(isPlaceholderEssayProse(section.generatedContent), false);
      assert.equal(/For \(support\)/i.test(section.title), false);
      assert.ok(section.teacherNotes?.includes("Construction tip"));
      assert.equal(
        /Using transitions such as|meets the section goal/i.test(
          section.generatedContent ?? "",
        ),
        false,
      );
    }
    assert.ok(
      result.sections.some((s) => /Supporting Argument/i.test(s.title)),
    );
  });

  it("ensureModelEssaySample replaces placeholder modelEssay", () => {
    const input = baseInput();
    const thesis = buildFallbackThesis(input);
    const sections = buildDynamicFallbackSections(input);
    const { modelEssay, sections: filled } = ensureModelEssaySample(
      input,
      sections,
      thesis,
      '## Introduction\n\n(Sample content for Introduction on "topic".)',
    );
    assert.equal(isPlaceholderEssayProse(modelEssay), false);
    assert.ok((modelEssay?.length ?? 0) > 200);
    assert.ok(filled.every((s) => !isPlaceholderEssayProse(s.generatedContent)));
  });

  it("citation fallback uses real author surnames, not Author1", () => {
    const result = fallbackEssayResult(
      baseInput({ citationStyle: "apa", sourcesRequired: 3 }),
    );
    assert.equal(/\bAuthor\d+\b/i.test(result.modelEssay ?? ""), false);
    assert.ok(/\bHattie,\s*2009\b|\bDweck,\s*2006\b/.test(result.modelEssay ?? ""));
    assert.ok((result.references?.length ?? 0) >= 2);
    assert.equal(
      result.references?.some((r) => /Author\d+|\[Sample\]/i.test(r)),
      false,
    );
    assert.equal(result.referencesAreSamples, false);
  });
});
