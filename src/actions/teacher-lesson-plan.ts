"use server";

import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAccessContext } from "@/lib/access";
import { requireTeacherToolsAccess } from "@/lib/teacher-access";
import {
  lessonPlanInputSchema,
  lessonPlanResultSchema,
  type LessonPlanActionInput,
} from "@/lib/lesson-plan-ai-schema";
import { differentiatedInstructionAiRules, difficultyRigorAiRules, filterDifferentiatedInstruction } from "@/lib/lesson-plan-difficulty";
import {
  fetchCurriculumContextForLessonPlan,
  formatCurriculumContextForPrompt,
  type CurriculumResearchContext,
} from "@/lib/lesson-plan-curriculum-research";
import { vocabularyApproachPromptLine } from "@/lib/lesson-plan-vocabulary-approach";
import { saveLessonPlan } from "@/db/queries/saved-lesson-plans";
import {
  generateLessonPlanPdfBuffer,
  lessonPlanPdfSafeFileName,
} from "@/lib/lesson-plan-pdf-build";
import { uploadLessonPlanPdfBufferToS3 } from "@/lib/s3";
import {
  extractTextFromFile,
  extractTextFromUrl,
  assertFormatAllowedForPlan,
} from "@/lib/document-extract";
import { canUseAdvancedSourceImport } from "@/lib/source-import-access";
import {
  formatLessonPlanReferenceForPrompt,
  formatMultipleLessonPlanReferencesForPrompt,
  referenceSourceSummaryLabel,
} from "@/lib/lesson-plan-reference-material";
import { isYouTubeUrl, youTubeReferenceSummary } from "@/lib/youtube-url";
import {
  generateLessonPlan,
  type LessonPlanInput,
  type LessonPlanResult,
} from "@/lib/teacher-generators";

function buildLessonPlanPrompt(
  input: LessonPlanActionInput,
  curriculumContext?: CurriculumResearchContext | null,
): string {
  const lines = [
    `Subject: ${input.subject}`,
    `Grade level: ${input.gradeLevel}`,
    `Topic: ${input.topic}`,
    `Lesson duration: ${input.lessonDuration}`,
    `Target difficulty level: ${input.difficultyLevel}`,
  ];

  if (input.learningStandard?.trim()) {
    lines.push(`Learning standard: ${input.learningStandard.trim()}`);
  }
  if (input.classSize?.trim()) {
    lines.push(`Class size: ${input.classSize.trim()} students`);
  }
  if (input.specialInstructions?.trim()) {
    lines.push(
      `Special needs or accommodations: ${input.specialInstructions.trim()}`,
    );
  }
  if (input.referenceMaterials?.length) {
    lines.push(
      "",
      formatMultipleLessonPlanReferencesForPrompt(input.referenceMaterials),
    );
  } else if (input.referenceMaterialText?.trim()) {
    lines.push(
      "",
      formatLessonPlanReferenceForPrompt(
        input.referenceMaterialText,
        input.referenceSourceSummary,
      ),
    );
  }
  if (curriculumContext) {
    lines.push("", formatCurriculumContextForPrompt(curriculumContext));
  }
  if (input.vocabularyTeachingApproach) {
    lines.push("", vocabularyApproachPromptLine(input.vocabularyTeachingApproach));
  }
  if (input.regenerationSeed && input.regenerationSeed > 0) {
    lines.push(
      `Variation request #${input.regenerationSeed}: produce a fresh alternative lesson plan with different activities, examples, and sequencing while keeping the same topic and standards.`,
    );
  }

  return lines.join("\n");
}

export async function generateLessonPlanAction(
  data: LessonPlanActionInput,
): Promise<LessonPlanResult> {
  const ctx = await getAccessContext();
  await requireTeacherToolsAccess(
    ctx,
    "Lesson Builder requires an education plan.",
  );

  const parsed = lessonPlanInputSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Invalid input");
  }

  const input = parsed.data;

  const curriculumContext = input.learningStandard?.trim()
    ? await fetchCurriculumContextForLessonPlan(input)
    : null;

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return generateLessonPlan(input);
  }

  try {
    const { output } = await generateText({
      model: openai("gpt-4o"),
      output: Output.object({
        schema: lessonPlanResultSchema,
      }),
      system: `You are an expert K–12 curriculum designer. Create detailed, classroom-ready lesson plans teachers can use immediately.

Requirements:
- Write specific, in-depth content — never generic placeholders like "term A", "key concept 1", or "sample problem".
- Vocabulary must list real subject-specific terms for the topic. Format each entry as "Term — concise student-friendly definition" (6–10 terms).
- Learning objectives must be measurable and grade-appropriate (use action verbs: explain, analyze, model, compare, evaluate).
- Materials must be practical and specific to the lesson activities.
- Main teaching steps must be detailed procedural steps a teacher can follow (5–8 steps).
- Warm-up, classroom activity, homework, and assessment must be concrete and topic-specific.
- Lesson timeline must break the full lesson duration into timed segments that add up logically.
${difficultyRigorAiRules(input.difficultyLevel)}
${differentiatedInstructionAiRules(input.difficultyLevel)}
- Never use outdated labels like "On-level", "Support", or "Extension".
- If special needs or accommodations are provided, weave specific adaptations into differentiated instruction and teacher notes.
- If a learning standard is provided, align objectives, vocabulary, assessment, and pacing to that framework.
${curriculumContext ? "- Official curriculum / syllabus research is included in the user prompt. Treat it as authoritative grounding — cite applicable standard codes, competencies, and syllabus outcomes in learning objectives and assessment where relevant." : ""}
${input.vocabularyTeachingApproach ? "- Follow the vocabulary teaching approach specified in the user prompt. Reflect it in vocabulary entries, lesson timeline, activities, homework, and teacher notes." : ""}
${input.referenceMaterials?.length || input.referenceMaterialText?.trim() ? "- Teacher-provided reference material is included in the user prompt. Ground objectives, vocabulary, teaching steps, activities, and assessment in that content when it aligns with the topic." : ""}
- Do not use markdown formatting.`,
      prompt: buildLessonPlanPrompt(input, curriculumContext),
    });

    if (!output) {
      throw new Error("AI lesson generation returned no output.");
    }

    return {
      ...output,
      differentiatedInstruction: filterDifferentiatedInstruction(
        output.differentiatedInstruction,
        input.difficultyLevel,
      ),
    };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[generateLessonPlanAction] AI failed; using template fallback.",
        error,
      );
    }
    return generateLessonPlan(input);
  }
}

const saveLessonPlanSchema = z.object({
  input: lessonPlanInputSchema.omit({
    regenerationSeed: true,
    referenceMaterials: true,
    referenceMaterialText: true,
    referenceSourceSummary: true,
  }),
  result: lessonPlanResultSchema,
});

export async function extractLessonPlanReferenceAction(
  formData: FormData,
): Promise<{ text: string; summary: string }> {
  const ctx = await getAccessContext();
  await requireTeacherToolsAccess(
    ctx,
    "Lesson Builder requires an education plan.",
  );

  const url = formData.get("url")?.toString().trim() ?? "";
  const fileEntry = formData.get("file");
  const hasFile = fileEntry instanceof File && fileEntry.size > 0;

  if (url && hasFile) {
    throw new Error("Add either a website URL or a file — not both at once.");
  }
  if (!url && !hasFile) {
    throw new Error("Provide a website URL or upload a file.");
  }

  const advancedImport = canUseAdvancedSourceImport({
    hasAiReading: ctx.hasAiReading,
    teamTierProWorkspace: ctx.activeEducationTeamPlan !== null,
  });

  if (url) {
    assertFormatAllowedForPlan("url", advancedImport);
    const extracted = await extractTextFromUrl(url);
    return {
      text: extracted.text,
      summary: isYouTubeUrl(url)
        ? youTubeReferenceSummary(url, extracted.sourceTitle)
        : referenceSourceSummaryLabel("url", { url }),
    };
  }

  const file = fileEntry as File;
  const extracted = await extractTextFromFile(file);
  assertFormatAllowedForPlan(extracted.format, advancedImport);
  return {
    text: extracted.text,
    summary: referenceSourceSummaryLabel(extracted.format, { fileName: file.name }),
  };
}

export async function saveLessonPlanAction(data: {
  input: LessonPlanInput;
  result: LessonPlanResult;
}): Promise<{ id: number; lessonTitle: string; pdfUrl: string | null }> {
  const ctx = await getAccessContext();
  const { userId } = await requireTeacherToolsAccess(
    ctx,
    "Lesson Builder requires an education plan.",
  );

  const parsed = saveLessonPlanSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Invalid lesson plan data");
  }

  let pdfUrl: string | null = null;
  let pdfFileName: string | null = null;

  try {
    const pdfBuffer = await generateLessonPlanPdfBuffer(parsed.data.result);
    pdfFileName = `${lessonPlanPdfSafeFileName(parsed.data.result.lessonTitle)}.pdf`;
    pdfUrl = await uploadLessonPlanPdfBufferToS3({
      userId,
      fileName: pdfFileName,
      buffer: pdfBuffer,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[saveLessonPlanAction] PDF upload skipped or failed; saving plan without PDF.",
        error,
      );
    }
  }

  const saved = await saveLessonPlan({
    userId,
    input: parsed.data.input,
    result: parsed.data.result,
    pdfUrl,
    pdfFileName,
  });

  revalidatePath("/teacher/resources");
  revalidatePath("/teacher/quizzes");

  return {
    id: saved.id,
    lessonTitle: saved.lessonTitle,
    pdfUrl: saved.pdfUrl,
  };
}
