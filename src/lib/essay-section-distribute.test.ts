import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { EssaySection } from "@/lib/essay-ai-schema";
import {
  distributeEssayTextAcrossSections,
  resolveEssaySectionsContent,
} from "@/lib/essay-result-normalize";

function section(
  id: string,
  title: string,
  type: string,
): EssaySection {
  return {
    id,
    title,
    type,
    instructions: title,
    sentenceStarters: null,
    examples: null,
    transitionWords: null,
    checklist: null,
    teacherNotes: null,
    estimatedWords: 80,
    generatedContent: null,
    planningGoal: null,
    planningKeyIdea: null,
    planningEvidence: null,
  };
}

describe("distributeEssayTextAcrossSections", () => {
  const sections = [
    section("s1", "1. Introduction: Introduce characters", "introduction"),
    section("s2", "2. Rising Action", "rising_action"),
    section("s3", "3. Climax", "climax"),
    section("s4", "4. Falling Action", "falling_action"),
    section("s5", "5. Resolution", "resolution"),
  ];

  it("places headed blocks into matching sections", () => {
    const text = [
      "## 1. Introduction: Introduce characters",
      "",
      "Intro paragraph.",
      "",
      "## 5. Resolution",
      "",
      "Ending paragraph.",
    ].join("\n");
    const mapped = distributeEssayTextAcrossSections(sections, text);
    assert.match(mapped.s1 ?? "", /Intro paragraph/);
    assert.match(mapped.s5 ?? "", /Ending paragraph/);
    assert.equal((mapped.s2 ?? "").trim(), "");
  });

  it("distributes unheaded paragraphs across intro / support / conclusion", () => {
    const text = [
      "Intro sentence about Lily.",
      "",
      "Support one about the bracelet.",
      "",
      "Support two searching the park.",
      "",
      "Support three at the playground.",
      "",
      "Conclusion about friendship.",
    ].join("\n");
    const mapped = distributeEssayTextAcrossSections(sections, text);
    assert.match(mapped.s1 ?? "", /Lily/);
    assert.match(mapped.s5 ?? "", /friendship/);
    const support = [mapped.s2, mapped.s3, mapped.s4].join(" ");
    assert.match(support, /bracelet/);
    assert.match(support, /playground/);
  });

  it("redistributes collapsed single-section content", () => {
    const blob = [
      "Intro about Lily and Mia.",
      "",
      "They searched all afternoon.",
      "",
      "They found the bracelet.",
      "",
      "Friendship was the treasure.",
    ].join("\n");
    const mapped = resolveEssaySectionsContent(
      sections,
      { s1: blob, s2: "", s3: "", s4: "", s5: "" },
      "",
      { redistributeCollapsed: true },
    );
    assert.match(mapped.s1 ?? "", /Lily/);
    assert.notEqual((mapped.s1 ?? "").trim(), blob.trim());
    assert.ok(
      [mapped.s2, mapped.s3, mapped.s4].some((value) => value?.trim()),
      "expected supporting sections to receive text",
    );
    assert.match(mapped.s5 ?? "", /Friendship|treasure/i);
  });

  it("peels a trailing thesis-restatement sentence into Conclusion", () => {
    const persuasive = [
      section("intro", "Introduction", "introduction"),
      section("s1", "Supporting Argument 1", "supporting"),
      section("s2", "Supporting Argument 2", "supporting"),
      section("s3", "Supporting Argument 3", "supporting"),
      section("conc", "Conclusion", "conclusion"),
    ];
    const text = [
      "Although remote and hybrid learning became popular during the pandemic, most students should return to learning primarily in the classroom.",
      "",
      "Face-to-face instruction helps students stay focused, participate in discussions, and receive immediate support from teachers.",
      "",
      "While online learning can be useful during emergencies or for reviewing lessons, it should not replace regular classroom instruction. Schools should keep digital tools as learning resources but continue to prioritize in-person education because it provides a stronger academic experience and better prepares students for future success.",
    ].join("\n");
    const mapped = distributeEssayTextAcrossSections(persuasive, text);
    assert.match(
      mapped.conc ?? "",
      /Schools should keep digital tools as learning resources/,
    );
    assert.equal(
      /While online learning can be useful/i.test(mapped.conc ?? ""),
      false,
    );
    assert.match(mapped.s3 ?? "", /While online learning can be useful/);
  });
});
