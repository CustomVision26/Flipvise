"use server";

import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { getAccessContext } from "@/lib/access";
import { requireTeacherToolsAccess } from "@/lib/teacher-access";
import { getSavedHomeworkAssignmentByIdForUser } from "@/db/queries/saved-homework";
import { getSavedLessonPlanByIdForUser } from "@/db/queries/saved-lesson-plans";
import { formatMultipleLessonPlanReferencesForPrompt } from "@/lib/lesson-plan-reference-material";
import { buildLessonPlanQuizContext } from "@/lib/lesson-plan-quiz-context";
import { buildHomeworkStudyGuideContext } from "@/lib/study-guide-source-context";
import {
  studyGuideResultSchema,
  teacherStudyGuideInputSchema,
  type TeacherStudyGuideActionInput,
} from "@/lib/teacher-study-guide-ai-schema";
import {
  generateStudyGuide,
  type StudyGuideInput,
  type StudyGuideResult,
} from "@/lib/teacher-generators";

function buildStudyGuidePrompt(
  input: TeacherStudyGuideActionInput,
  sourceContext: {
    lessonPlanContext: string | null;
    homeworkContext: string | null;
  },
): string {
  const lines = [
    `Subject: ${input.subject}`,
    `Grade level: ${input.gradeLevel}`,
    `Topic: ${input.topic}`,
  ];

  if (input.referenceMaterials?.length) {
    lines.push(
      "",
      formatMultipleLessonPlanReferencesForPrompt(input.referenceMaterials).replace(
        "Use these sources to narrow and ground the lesson plan.",
        "Use these sources to narrow and ground the study guide.",
      ),
    );
  }

  if (sourceContext.lessonPlanContext) {
    lines.push(
      "",
      "Linked lesson plan (use objectives, vocabulary, teaching steps, and assessment items):",
      sourceContext.lessonPlanContext,
    );
  }

  if (sourceContext.homeworkContext) {
    lines.push(
      "",
      "Linked homework assignment (align vocabulary, examples, and practice with these questions):",
      sourceContext.homeworkContext,
    );
  }

  if (input.regenerationSeed && input.regenerationSeed > 0) {
    lines.push(
      "",
      `Variation request #${input.regenerationSeed}: produce a fresh alternative study guide with different worked examples, sample problems, and practice questions while covering the same topic and source material.`,
    );
  }

  return lines.join("\n");
}

function toTemplateInput(input: TeacherStudyGuideActionInput): StudyGuideInput {
  return {
    subject: input.subject,
    gradeLevel: input.gradeLevel,
    topic: input.topic,
    savedLessonPlanId: input.savedLessonPlanId,
    savedHomeworkId: input.savedHomeworkId,
    referenceMaterialCount: input.referenceMaterials?.length ?? 0,
    regenerationSeed: input.regenerationSeed,
  };
}

async function resolveStudyGuideSourceContext(
  input: TeacherStudyGuideActionInput,
  userId: string,
): Promise<{
  lessonPlanContext: string | null;
  homeworkContext: string | null;
  homeworkTitle: string | null;
}> {
  let lessonPlanContext: string | null = null;
  let homeworkContext: string | null = null;
  let homeworkTitle: string | null = null;

  if (input.savedLessonPlanId != null) {
    const savedPlan = await getSavedLessonPlanByIdForUser(userId, input.savedLessonPlanId);
    if (!savedPlan) {
      throw new Error("Saved lesson plan not found.");
    }
    lessonPlanContext = buildLessonPlanQuizContext({
      input: savedPlan.input,
      result: savedPlan.result,
    });
  }

  if (input.savedHomeworkId != null) {
    const savedHomework = await getSavedHomeworkAssignmentByIdForUser(
      userId,
      input.savedHomeworkId,
    );
    if (!savedHomework) {
      throw new Error("Saved homework assignment not found.");
    }
    if (
      input.savedLessonPlanId != null &&
      savedHomework.savedLessonPlanId !== input.savedLessonPlanId
    ) {
      throw new Error("Selected homework does not match the selected lesson plan.");
    }
    homeworkContext = buildHomeworkStudyGuideContext(savedHomework);
    homeworkTitle = savedHomework.label;
  }

  return { lessonPlanContext, homeworkContext, homeworkTitle };
}

export async function generateStudyGuideAction(
  data: TeacherStudyGuideActionInput,
): Promise<StudyGuideResult> {
  const ctx = await getAccessContext();
  await requireTeacherToolsAccess(
    ctx,
    "Study Guide Generator requires an education plan.",
  );

  const parsed = teacherStudyGuideInputSchema.safeParse(data);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(first?.message ?? "Invalid input");
  }

  const input = parsed.data;
  const sourceContext = await resolveStudyGuideSourceContext(input, ctx.userId!);

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return generateStudyGuide({
      ...toTemplateInput(input),
      homeworkTitle: sourceContext.homeworkTitle ?? undefined,
    });
  }

  try {
    const { output } = await generateText({
      model: openai("gpt-4o"),
      output: Output.object({
        schema: studyGuideResultSchema,
      }),
      system: `You are an expert K–12 teacher creating student-facing study guides.

Requirements:
- Write specific, in-depth content grounded in the provided source material — never generic placeholders like "definition 1", "key term A", or "core concept 1".
- When reference material (websites, documents, captions, etc.) is provided, prioritize its facts, vocabulary, concepts, and examples. Do not contradict the references or invent unrelated content.
- When a lesson plan is linked, draw vocabulary, important points, examples, and practice from its objectives, vocabulary list, teaching steps, and assessment items.
- When homework is linked, align the study guide so students can prepare for those questions — cover the same skills and terminology without copying homework questions verbatim into practiceQuestions.
- summary: 2–4 sentences overview of what students need to know for ${input.topic}.
- keyVocabulary: 6–12 real subject-specific terms. Format each as "Term — concise student-friendly definition".
- importantPoints: 4–8 concise bullet-ready statements of essential concepts students must understand.
- workedExamples: 2–4 fully worked, step-by-step examples showing how to apply the topic. Each entry is one complete example with numbered or labeled steps in plain text.
- sampleProblems: 3–5 sample problems WITH brief worked solutions or answer hints so students can check their understanding. Format each as "Problem: … Solution: …" in one string.
- practiceQuestions: 4–6 self-test questions WITHOUT full answers (for students to try on their own).
- studyTips: 3–5 practical, actionable study strategies for this topic.
- Do NOT prefix list items with numbers or bullets — plain text only (formatting is added by the UI).
- Do not use markdown formatting.`,
      prompt: buildStudyGuidePrompt(input, sourceContext),
    });

    if (!output) {
      throw new Error("AI study guide generation returned no output.");
    }

    return output;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[generateStudyGuideAction] AI failed; using template fallback.", error);
    }
    return generateStudyGuide({
      ...toTemplateInput(input),
      homeworkTitle: sourceContext.homeworkTitle ?? undefined,
    });
  }
}
