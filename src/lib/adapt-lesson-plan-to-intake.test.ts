import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  adaptLessonPlanResultToIntake,
  gradeMentionVariants,
  learningStandardLooksJamaicaRelated,
} from "./adapt-lesson-plan-to-intake";
import type { LessonPlanInput, LessonPlanResult } from "./teacher-generators";

function baseSourceInput(
  overrides: Partial<LessonPlanInput> = {},
): LessonPlanInput {
  return {
    subject: "MAth",
    gradeLevel: "Grade 6",
    topic: "Learning Alegbra 1",
    lessonDuration: "45 minutes",
    planPeriodDays: 5,
    difficultyLevel: "Intermediate",
    learningStandard: "Jamaica PEP",
    classSize: "25",
    ...overrides,
  };
}

function baseSourceResult(
  overrides: Partial<LessonPlanResult> = {},
): LessonPlanResult {
  return {
    lessonTitle: "Learning Alegbra 1 — MAth",
    learningObjectives: [
      "Students will analyze relationships within Learning Alegbra 1.",
      "Students will solve multi-step problems involving Learning Alegbra 1.",
      "Students will evaluate examples of Learning Alegbra 1 in unfamiliar contexts. Align objectives and assessment to Jamaica PEP.",
    ],
    materialsNeeded: [
      "Student notebooks",
      "Printed Learning Alegbra 1 reference diagram (grade Grade 6)",
      "Index cards",
      "Timer",
    ],
    vocabulary: [
      "Learning Alegbra 1 — the main concept students must understand",
      "Variable — a symbol that represents a number",
      "Expression — a combination of numbers and operations",
      "Equation — a statement that two expressions are equal",
      "Inequality — a comparison that is not equal",
      "Coefficient — a number multiplied by a variable",
    ],
    lessonTimeline: [
      "Day 1 — Launch Learning Alegbra 1",
      "Days 2–4 — Build understanding",
      "Day 5 — Consolidate Learning Alegbra 1",
    ],
    weeklySchedule: [
      {
        dayLabel: "Day 1",
        dailyFocus: "Introduce Learning Alegbra 1 basics.",
        vocabulary: [
          "Learning Alegbra 1 — the main concept students must understand",
          "Variable — a symbol that represents a number",
        ],
        lessonTimeline: [
          "0-5 min: Engage — Activate prior knowledge for Learning Alegbra 1",
          "5-15 min: Explore — Encounter today's vocabulary terms",
          "15-25 min: Explain — Teach and clarify terms",
          "25-35 min: Elaborate — Collaborative application",
          "35-45 min: Evaluate — Exit ticket",
        ],
      },
      {
        dayLabel: "Day 2",
        dailyFocus: "Introduce Learning Alegbra 1 basics.",
        vocabulary: ["Expression — a combination of numbers and operations"],
        lessonTimeline: [
          "0-5 min: Engage — Activate prior knowledge for Learning Alegbra 1",
          "5-15 min: Explore — Encounter today's vocabulary terms",
          "15-25 min: Explain — Teach and clarify terms",
          "25-35 min: Elaborate — Collaborative application",
          "35-45 min: Evaluate — Exit ticket",
        ],
      },
      {
        dayLabel: "Day 3",
        dailyFocus: "Introduce Learning Alegbra 1 basics.",
        vocabulary: ["Equation — a statement that two expressions are equal"],
        lessonTimeline: [
          "0-5 min: Engage — Activate prior knowledge for Learning Alegbra 1",
          "5-15 min: Explore — Encounter today's vocabulary terms",
          "15-25 min: Explain — Teach and clarify terms",
          "25-35 min: Elaborate — Collaborative application",
          "35-45 min: Evaluate — Exit ticket",
        ],
      },
      {
        dayLabel: "Day 4",
        dailyFocus: "Practice Learning Alegbra 1.",
        vocabulary: ["Inequality — a comparison that is not equal"],
        lessonTimeline: [
          "0-5 min: Engage — Activate prior knowledge for Learning Alegbra 1",
          "5-15 min: Explore — Encounter today's vocabulary terms",
          "15-25 min: Explain — Teach and clarify terms",
          "25-35 min: Elaborate — Collaborative application",
          "35-45 min: Evaluate — Exit ticket",
        ],
      },
      {
        dayLabel: "Day 5",
        dailyFocus: "Review Learning Alegbra 1.",
        vocabulary: ["Coefficient — a number multiplied by a variable"],
        lessonTimeline: [
          "0-5 min: Engage — Activate prior knowledge for Learning Alegbra 1",
          "5-15 min: Explore — Encounter today's vocabulary terms",
          "15-25 min: Explain — Teach and clarify terms",
          "25-35 min: Elaborate — Collaborative application",
          "35-45 min: Evaluate — Exit ticket",
        ],
      },
    ],
    warmUpActivity: "Quick review of Learning Alegbra 1.",
    mainTeachingSteps: [
      "Hook students on Learning Alegbra 1",
      "Model a Grade 6 example",
      "Guided practice",
      "Check understanding",
      "Preview homework",
    ],
    classroomActivity: "Partner task on Learning Alegbra 1.",
    assessmentQuestions: [
      "Define a key term from Learning Alegbra 1.",
      "Solve a problem about Learning Alegbra 1.",
      "Explain one step in Learning Alegbra 1.",
      "Give a real-world example of Learning Alegbra 1.",
    ],
    homework: "Complete practice on Learning Alegbra 1.",
    differentiatedInstruction: [
      "Intermediate: standard Learning Alegbra 1 practice with guided checkpoints",
    ],
    teacherNotes:
      "Lesson calibrated for Intermediate rigor. Class size: 25. Aligned to Jamaica PEP.",
    jamaicaNscGuidelinesApplied: true,
    ...overrides,
  };
}

describe("learningStandardLooksJamaicaRelated", () => {
  it("detects Jamaica and PEP cues", () => {
    assert.equal(learningStandardLooksJamaicaRelated("Jamaica PEP"), true);
    assert.equal(learningStandardLooksJamaicaRelated("Jamaica NSC"), true);
    assert.equal(learningStandardLooksJamaicaRelated("PEP"), true);
  });

  it("fails closed for non-Jamaica frameworks", () => {
    assert.equal(learningStandardLooksJamaicaRelated("Common Core"), false);
    assert.equal(learningStandardLooksJamaicaRelated(""), false);
  });
});

describe("gradeMentionVariants", () => {
  it("includes doubled grade Grade N form", () => {
    const variants = gradeMentionVariants("Grade 6");
    assert.ok(variants.includes("grade Grade 6"));
    assert.ok(variants.includes("Grade 6"));
  });
});

describe("adaptLessonPlanResultToIntake", () => {
  it("retargets topic, grade, learning standard, and plan period", () => {
    const sourceInput = baseSourceInput();
    const sourceResult = baseSourceResult();
    const targetIntake = baseSourceInput({
      subject: "MAth : Alegbra 1",
      gradeLevel: "grade 7",
      topic: "Variables and Expressions, Solving Equations and Inequalities.",
      planPeriodDays: 3,
      difficultyLevel: "Advanced",
      learningStandard: "Jamaica PEP",
      classSize: "20",
      specialInstructions: "Prefer visual supports",
    });

    const adapted = adaptLessonPlanResultToIntake(
      sourceResult,
      sourceInput,
      targetIntake,
    );

    assert.match(
      adapted.lessonTitle,
      /Variables and Expressions, Solving Equations and Inequalities\./i,
    );
    assert.match(adapted.lessonTitle, /grade 7/i);

    for (const objective of adapted.learningObjectives) {
      assert.doesNotMatch(objective, /Learning Alegbra 1/i);
      assert.match(
        objective,
        /Variables and Expressions, Solving Equations and Inequalities\./i,
      );
    }
    assert.ok(
      adapted.learningObjectives.some((objective) =>
        /Align objectives and assessment to Jamaica PEP/i.test(objective),
      ),
    );

    const materialsJoined = adapted.materialsNeeded.join(" ");
    assert.doesNotMatch(materialsJoined, /grade Grade 6/i);
    assert.doesNotMatch(materialsJoined, /Grade 6/i);
    assert.match(materialsJoined, /grade 7/i);

    assert.ok(
      adapted.vocabulary.every(
        (line) => !/Learning Alegbra 1/i.test(line),
      ),
    );
    assert.ok(
      adapted.vocabulary.some((line) =>
        /Variables and Expressions, Solving Equations and Inequalities\./i.test(
          line,
        ),
      ),
    );

    assert.equal(adapted.weeklySchedule?.length, 3);
    const focuses = (adapted.weeklySchedule ?? []).map((day) => day.dailyFocus);
    assert.equal(new Set(focuses).size, focuses.length);
    for (const focus of focuses) {
      assert.match(
        focus,
        /Variables and Expressions, Solving Equations and Inequalities\./i,
      );
    }

    assert.match(adapted.teacherNotes, /Class size:\s*20/i);
    assert.match(adapted.teacherNotes, /Aligned to Jamaica PEP/i);
    assert.match(adapted.teacherNotes, /Prefer visual supports/i);
    assert.equal(adapted.jamaicaNscGuidelinesApplied, true);
  });

  it("does not newly force 5E when Jamaica flag cannot be kept", () => {
    const adapted = adaptLessonPlanResultToIntake(
      baseSourceResult({ jamaicaNscGuidelinesApplied: true }),
      baseSourceInput(),
      baseSourceInput({
        topic: "Linear equations",
        learningStandard: "Common Core",
        planPeriodDays: 3,
      }),
    );

    assert.equal(adapted.jamaicaNscGuidelinesApplied, false);
    const dayOneTimeline = adapted.weeklySchedule?.[0]?.lessonTimeline ?? [];
    assert.ok(dayOneTimeline.length > 0);
    assert.ok(dayOneTimeline.every((line) => !/\bEngage\b/i.test(line)));
  });
});
