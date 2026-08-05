import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  expandMultiPassageToQuizCards,
  resolveReadingPassageQuestionCounts,
  resolvePassageGenerationToggles,
  teacherQuizInputSchema,
  sumPassageQuestionCounts,
  type TeacherQuizMultiPassageResult,
} from "./teacher-quiz-ai-schema";
import { buildCurriculumPassagePrompt } from "./teacher-quiz-reading-passage";
import { buildManualLessonPlanContext, normalizeLessonPlanContext } from "./lesson-plan-context";
import type { LessonPlanInput, LessonPlanResult } from "./teacher-generators";
import { PRO_PLUS_CARDS_PER_DECK_LIMIT } from "./personal-plan-limits";
import { DEFAULT_TEACHER_QUIZ_PASSAGE_QUESTION_TYPES } from "./teacher-quiz-passage-settings";

describe("generation-options validation", () => {
  it("requires at least one passage question type when passages are enabled", () => {
    const parsed = teacherQuizInputSchema.safeParse({
      subject: "Mathematics",
      gradeLevel: "Grade 6",
      topic: "Percentages",
      numberOfQuestions: 0,
      questionTypes: "Multiple choice",
      difficultyLevel: "Beginner",
      readingPassageQuestions: true,
      readingPassageCount: 2,
      questionsPerPassage: 2,
      passageQuestionTypes: [],
    });
    assert.equal(parsed.success, false);
  });

  it("rejects combined card counts above the plan limit", () => {
    const parsed = teacherQuizInputSchema.safeParse({
      subject: "Science",
      gradeLevel: "Grade 7",
      topic: "Food Chains",
      numberOfQuestions: PRO_PLUS_CARDS_PER_DECK_LIMIT,
      questionTypes: "Multiple choice",
      difficultyLevel: "Beginner",
      readingPassageQuestions: true,
      readingPassageCount: 1,
      questionsPerPassage: 1,
      passageQuestionTypes: ["multiple_choice"],
    });
    assert.equal(parsed.success, false);
  });

  it("accepts valid curriculum passage options", () => {
    const parsed = teacherQuizInputSchema.safeParse({
      subject: "History",
      gradeLevel: "Grade 9",
      topic: "Migration",
      numberOfQuestions: 0,
      questionTypes: "Multiple choice",
      difficultyLevel: "Intermediate",
      readingPassageQuestions: true,
      readingPassageCount: 3,
      questionsPerPassage: 2,
      passageType: "historical_narrative",
      passageStyle: "historical",
      readingLevel: "on_grade",
      passageQuestionTypes: ["multiple_choice", "critical_thinking"],
      includeVocabulary: true,
      includeAnswerExplanations: true,
    });
    assert.equal(parsed.success, true);
  });
});

describe("card-limit calculation", () => {
  it("resolves uniform questions-per-passage into a card total", () => {
    const counts = resolveReadingPassageQuestionCounts({
      readingPassageQuestions: true,
      readingPassageCount: 7,
      questionsPerPassage: 1,
    });
    assert.deepEqual(counts, [1, 1, 1, 1, 1, 1, 1]);
    assert.equal(sumPassageQuestionCounts(counts), 7);
  });
});

describe("expandMultiPassageToQuizCards", () => {
  it("maps each question to a card that reuses its passage text", () => {
    const result: TeacherQuizMultiPassageResult = {
      passages: [
        {
          title: "Budget Bus Plans",
          passageType: "scenario",
          scenarioCategory: "budget planning",
          scenarioSummary: "Two transport plans are compared with percentages.",
          centralEvent: "Compare two bus fare options",
          mainProblem: "Ignoring percentage discount",
          consequence: "Choosing a more expensive plan",
          requiredResponse: "Calculate totals with percent discount",
          perspective: "trip planner",
          setting: "school office",
          educationalContext: null,
          passage: "Two transport plans show different percentage discounts.",
          alignedStandards: [],
          alignedObjectives: ["Calculate percentages"],
          alignedCompetencies: ["Compare multi-step costs"],
          vocabularyTermsUsed: ["percentage", "total"],
          vocabularyUsed: ["percentage", "total"],
          learningObjectivesCovered: ["Calculate percentages"],
          teacherNotes: null,
          questions: [
            {
              questionType: "multiple_choice",
              question: "What is being compared?",
              correctAnswer: "Two transport plans",
              wrongAnswers: ["Two ecosystems", "Two poems", "Two maps"],
              explanation: "The passage compares transport plans.",
              competencyAssessed: null,
            },
            {
              questionType: "critical_thinking",
              question: "Why must the discount be calculated before choosing?",
              correctAnswer: "To compare true totals fairly",
              wrongAnswers: [
                "Because discounts never change totals",
                "Because the cheaper plan is always wrong",
                "Because surveys replace calculations",
              ],
              explanation: "Discount math changes which plan costs less.",
              competencyAssessed: null,
            },
          ],
        },
      ],
    };

    const cards = expandMultiPassageToQuizCards(result, {
      expectedQuestionCounts: [2],
      sourceLessonPlanId: 99,
      includeAnswerExplanations: true,
    });
    assert.equal(cards.length, 2);
    assert.equal(cards[0]?.passage, cards[1]?.passage);
    assert.equal(cards[0]?.sourceLessonPlanId, 99);
    assert.equal(cards[0]?.scenarioCategory, "budget planning");
    assert.ok(cards[0]?.passageGroupId);
  });
});

describe("resolvePassageGenerationToggles", () => {
  it("applies defaults when toggles are omitted", () => {
    const toggles = resolvePassageGenerationToggles({});
    assert.equal(toggles.includeVocabulary, true);
    assert.equal(toggles.includeTeacherNotes, false);
    assert.equal(toggles.includeAnswerExplanations, true);
    assert.equal(toggles.useRelevantLocalContext, true);
    assert.equal(toggles.avoidPreviousPassages, true);
  });

  it("defaults passage question types to Multiple Choice only", () => {
    assert.deepEqual(DEFAULT_TEACHER_QUIZ_PASSAGE_QUESTION_TYPES, ["multiple_choice"]);
  });
});

describe("curriculum passage prompt fixtures", () => {
  const fixtures = [
    {
      name: "TVET Auto Mechanics",
      subject: "TVET: Auto Mechanics",
      gradeLevel: "Grade 10",
      topic: "Workplace Safety",
      learningStandard: "NVQ-J",
      vocabulary: [
        "Hazard — a source of potential harm",
        "Personal Protective Equipment (PPE)",
        "Risk Assessment",
        "Occupational Safety and Health (OSH)",
      ],
      objectives: ["Identify workplace hazards", "Apply safe housekeeping procedures"],
    },
    {
      name: "Mathematics",
      subject: "Mathematics",
      gradeLevel: "Grade 6",
      topic: "Percentages",
      learningStandard: "Common Core",
      vocabulary: ["Percentage", "total", "discount", "original price"],
      objectives: ["Calculate percentages", "Compare multi-step costs"],
    },
    {
      name: "Science",
      subject: "Science",
      gradeLevel: "Grade 7",
      topic: "Food Chains",
      learningStandard: "NGSS",
      vocabulary: ["Producer", "consumer", "predator", "ecosystem"],
      objectives: ["Describe feeding relationships in an ecosystem"],
    },
    {
      name: "English Language Arts",
      subject: "English Language Arts",
      gradeLevel: "Grade 6",
      topic: "Main Idea and Supporting Details",
      learningStandard: null,
      vocabulary: ["main idea", "supporting detail"],
      objectives: ["Identify the main idea and supporting details"],
    },
    {
      name: "History",
      subject: "History",
      gradeLevel: "Grade 9",
      topic: "Caribbean Migration in the 20th Century",
      learningStandard: "CSEC",
      vocabulary: ["migration", "diaspora", "push factor"],
      objectives: ["Compare source perspectives on migration"],
    },
  ] as const;

  for (const fixture of fixtures) {
    it(`builds a curriculum-first prompt for ${fixture.name}`, () => {
      const input: LessonPlanInput = {
        subject: fixture.subject,
        gradeLevel: fixture.gradeLevel,
        topic: fixture.topic,
        lessonDuration: "45 minutes",
        planPeriodDays: 1,
        difficultyLevel: "Intermediate",
        learningStandard: fixture.learningStandard ?? undefined,
      };
      const result: LessonPlanResult = {
        lessonTitle: `${fixture.topic} — ${fixture.subject}`,
        learningObjectives: [...fixture.objectives],
        materialsNeeded: ["Notebook"],
        warmUpActivity: "Activate prior knowledge",
        mainTeachingSteps: ["Explain", "Practice"],
        classroomActivity: "Guided practice",
        lessonTimeline: ["Engage", "Explain", "Evaluate"],
        vocabulary: [...fixture.vocabulary],
        assessmentQuestions: ["Exit ticket"],
        homework: "Practice",
        differentiatedInstruction: ["Scaffolded prompts"],
        teacherNotes: "Keep focus on objectives",
      };

      const context = normalizeLessonPlanContext({ input, result, lessonPlanId: 1 });
      const { system, user } = buildCurriculumPassagePrompt({
        lessonPlanContext: context,
        subject: fixture.subject,
        gradeLevel: fixture.gradeLevel,
        topic: fixture.topic,
        difficultyLevel: "Intermediate",
        questionsForThisPassage: 1,
        passageIndex: 1,
        totalPassages: 3,
        settings: {
          passageType: "scenario",
          passageStyle: "auto",
          readingLevel: "on_grade",
          passageQuestionTypes: ["multiple_choice"],
        },
        previousPassages: [
          {
            title: "Accepted prior",
            scenarioCategory: "prior event",
            scenarioSummary: "A prior accepted situation",
            centralEvent: "Prior central event",
            mainProblem: "Prior problem",
            consequence: "Prior consequence",
            requiredResponse: "Prior response",
            perspective: "observer",
            setting: "prior setting",
          },
        ],
      });

      assert.match(system, /lesson plan is the curriculum source/i);
      assert.match(system, /Vocabulary is not the topic/i);
      assert.match(system, /ONE educational reading passage/i);
      assert.match(user, /CURRICULUM CONTEXT/i);
      assert.match(user, /REQUIRED DIVERSITY/i);
      assert.match(user, /PREVIOUS PASSAGES THAT MUST NOT BE REUSED/i);
      assert.match(user, new RegExp(fixture.topic, "i"));
      assert.match(user, /not a vocabulary word/i);
    });
  }

  it("supports fallback generation without a lesson plan", () => {
    const context = buildManualLessonPlanContext({
      subject: "Geography",
      gradeLevel: "Grade 8",
      topic: "Natural Hazards",
    });
    const { user } = buildCurriculumPassagePrompt({
      lessonPlanContext: context,
      subject: "Geography",
      gradeLevel: "Grade 8",
      topic: "Natural Hazards",
      difficultyLevel: "Beginner",
      questionCounts: [2],
    });
    assert.match(user, /do not invent a named curriculum/i);
    assert.match(user, /minimal topic context/i);
  });
});
