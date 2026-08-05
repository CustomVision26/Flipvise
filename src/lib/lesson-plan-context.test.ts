import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildManualLessonPlanContext,
  formatLessonPlanContextForPrompt,
  normalizeLessonPlanContext,
  vocabularyTermsFromContext,
} from "./lesson-plan-context";
import type { LessonPlanInput, LessonPlanResult } from "./teacher-generators";

function baseInput(overrides: Partial<LessonPlanInput> = {}): LessonPlanInput {
  return {
    subject: "TVET: Auto Mechanics",
    gradeLevel: "Grade 10",
    topic: "Workplace Safety",
    lessonDuration: "60 minutes",
    planPeriodDays: 1,
    difficultyLevel: "Intermediate",
    learningStandard: "NVQ-J",
    classSize: "20",
    specialInstructions: "Extra support for new workshop students",
    ...overrides,
  };
}

function baseResult(overrides: Partial<LessonPlanResult> = {}): LessonPlanResult {
  return {
    lessonTitle: "Workplace Safety — Auto Mechanics",
    learningObjectives: [
      "Identify workplace hazards",
      "Apply safe housekeeping procedures",
    ],
    materialsNeeded: ["PPE", "Safety checklist"],
    warmUpActivity: "Discuss a recent near-miss",
    mainTeachingSteps: ["Review OSH expectations", "Inspect a bay"],
    classroomActivity: "Hazard walk",
    lessonTimeline: ["Engage", "Explore", "Evaluate"],
    vocabulary: [
      "Hazard — a source of potential harm",
      "Personal Protective Equipment (PPE)",
      "Risk Assessment",
      "Occupational Safety and Health (OSH)",
    ],
    assessmentQuestions: ["Name two workshop hazards"],
    homework: "List hazards at home garage",
    differentiatedInstruction: ["Pair support during bay walk"],
    teacherNotes: "Emphasize jack-stand use",
    ...overrides,
  };
}

describe("normalizeLessonPlanContext", () => {
  it("maps structured lesson-plan fields without inventing strand/unit", () => {
    const context = normalizeLessonPlanContext({
      lessonPlanId: 42,
      input: baseInput(),
      result: baseResult(),
    });

    assert.equal(context.lessonPlanId, 42);
    assert.equal(context.curriculum, "NVQ-J");
    assert.equal(context.subject, "TVET: Auto Mechanics");
    assert.equal(context.topic, "Workplace Safety");
    assert.deepEqual(context.learningStandards, ["NVQ-J"]);
    assert.equal(context.learningObjectives.length, 2);
    assert.equal(context.competencies.length, 2);
    assert.equal(context.vocabulary.length, 4);
    assert.equal(context.vocabulary[0]?.term, "Hazard");
    assert.match(context.vocabulary[0]?.definition ?? "", /potential harm/i);
    assert.deepEqual(context.accommodations, [
      "Extra support for new workshop students",
    ]);
    assert.equal(context.strand, null);
    assert.equal(context.subStrand, null);
    assert.equal(context.unit, null);
  });

  it("applies UI overrides for subject/grade/topic", () => {
    const context = normalizeLessonPlanContext({
      input: baseInput(),
      result: baseResult(),
      overrides: {
        subject: "Mathematics",
        gradeLevel: "Grade 6",
        topic: "Percentages",
      },
    });
    assert.equal(context.subject, "Mathematics");
    assert.equal(context.gradeLevel, "Grade 6");
    assert.equal(context.topic, "Percentages");
  });

  it("does not treat vocabulary terms as separate lesson topics", () => {
    const context = normalizeLessonPlanContext({
      input: baseInput(),
      result: baseResult(),
    });
    const terms = vocabularyTermsFromContext(context);
    assert.ok(terms.includes("Hazard"));
    assert.ok(terms.includes("Risk Assessment"));
    assert.notEqual(context.topic, "Hazard");
    const prompt = formatLessonPlanContextForPrompt(context);
    assert.match(prompt, /supporting context/i);
    assert.match(prompt, /CURRICULUM DATA/i);
  });
});

describe("buildManualLessonPlanContext", () => {
  it("builds minimal fallback context without inventing a curriculum name", () => {
    const context = buildManualLessonPlanContext({
      subject: "Science",
      gradeLevel: "Grade 7",
      topic: "Food Chains",
      difficultyLevel: "Beginner",
    });
    assert.equal(context.curriculum, null);
    assert.equal(context.qualification, null);
    assert.deepEqual(context.learningStandards, []);
    assert.equal(context.subject, "Science");
    assert.equal(context.topic, "Food Chains");
  });
});
