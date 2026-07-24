import "server-only";

import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import {
  JAMAICA_NSC_LESSON_GUIDELINES,
  type JamaicaNscLessonGuidelines,
} from "@/data/jamaica-nsc-lesson-guidelines";

const jamaicaLinkedLearningStandardSchema = z.object({
  isJamaicaLinked: z.boolean(),
  confidence: z.enum(["high", "medium", "low"]),
  reason: z.string().min(1).max(400),
});

/** Stored Jamaica NSC guidelines used to structure lesson plans. */
export function getStoredJamaicaNscLessonGuidelines(): JamaicaNscLessonGuidelines {
  return JAMAICA_NSC_LESSON_GUIDELINES;
}

/**
 * Use AI to confirm whether the teacher-entered Learning Standard is linked
 * to Jamaica (e.g. Jamaica NSC, MoEY Jamaica, PEP, GSAT, CSEC in a Jamaica context).
 * Returns false on missing key, empty input, or model failure (fail closed).
 */
export async function confirmLearningStandardLinkedToJamaica(
  learningStandard: string,
): Promise<boolean> {
  const trimmed = learningStandard.trim();
  if (!trimmed) return false;
  if (!process.env.OPENAI_API_KEY?.trim()) return false;

  try {
    const { output } = await generateText({
      model: openai("gpt-4o"),
      output: Output.object({ schema: jamaicaLinkedLearningStandardSchema }),
      system: `You classify whether a teacher-entered learning standard / curriculum framework text is linked to the country Jamaica.

Return isJamaicaLinked=true only when the text clearly refers to Jamaica or a Jamaica-specific curriculum or assessment framework. Examples that should be true:
- Jamaica National Standards Curriculum / Jamaica NSC / NSC (Jamaica)
- Ministry of Education Jamaica / MoEY Jamaica
- Jamaica Primary Exit Profile (PEP)
- GSAT (Jamaica historical primary exam) when Jamaica is implied or stated
- CSEC, CAPE, or CXC when Jamaica or Caribbean Jamaica classroom context is explicit
- Explicit phrases like "Jamaica Grade 4 Science standards"

Return isJamaicaLinked=false for:
- US Common Core (CCSS), NGSS, C3, TEKS, AP, IB without Jamaica
- UK National Curriculum, Australian Curriculum, or other non-Jamaica frameworks
- Vague "national standards" / "curriculum standards" with no Jamaica link
- Caribbean frameworks that are not specifically tied to Jamaica in the text

Be conservative: if unsure, return false with low confidence.`,
      prompt: `Learning standard entered by the teacher:\n"""${trimmed}"""\n\nIs this learning standard linked to the country Jamaica?`,
    });

    return output?.isJamaicaLinked === true;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[confirmLearningStandardLinkedToJamaica] Classification failed; skipping Jamaica NSC guidelines.",
        error,
      );
    }
    return false;
  }
}

/** Format stored Jamaica NSC guidelines for the lesson-plan user prompt. */
export function formatJamaicaNscGuidelinesForPrompt(
  guidelines: JamaicaNscLessonGuidelines = JAMAICA_NSC_LESSON_GUIDELINES,
): string {
  const fiveE = guidelines.fiveEModel;
  const lines = [
    `JAMAICA NSC LESSON STRUCTURE GUIDE (authoritative for this generation — follow closely):`,
    guidelines.title,
    "",
    "Purpose:",
    `- ${guidelines.purpose.summary}`,
    `- Promote: ${guidelines.purpose.promote.join("; ")}`,
    `- Avoid: ${guidelines.purpose.avoid.join("; ")}`,
    "",
    "5E Lesson Model (structure the lesson timeline, warm-up, teaching steps, activities, and assessment around these phases):",
    `- Engage: ${fiveE.engage}`,
    `- Explore: ${fiveE.explore}`,
    `- Explain: ${fiveE.explain}`,
    `- Elaborate: ${fiveE.elaborate}`,
    `- Evaluate: ${fiveE.evaluate}`,
    "",
    `Learning objectives — prefer measurable verbs: ${guidelines.learningObjectives.measurableVerbs.join(", ")}.`,
    "",
    "Teacher role:",
    ...guidelines.teacherRole.map((item) => `- ${item}`),
    "",
    "Student role:",
    ...guidelines.studentRole.map((item) => `- ${item}`),
    "",
    `Preferred activities: ${guidelines.activities.join("; ")}.`,
    `Real-life / Jamaican context themes: ${guidelines.realLifeContext.join("; ")}.`,
    ...guidelines.stemAnd21stCenturySkills.map((item) => `- ${item}`),
    "",
    "Inclusive education:",
    `- ${guidelines.inclusiveEducation.instruction}`,
    `- Consider: ${guidelines.inclusiveEducation.learnerGroups.join("; ")}.`,
    "",
    "Assessment:",
    `- ${guidelines.assessment.instruction}`,
    `- Measure: ${guidelines.assessment.measure.join("; ")}.`,
    `- Use ${guidelines.assessment.methods.join(" and ")} methods.`,
    "",
    `Resources to recommend when relevant: ${guidelines.resources.join("; ")}.`,
    `Homework: ${guidelines.homework.instruction} Prefer: ${guidelines.homework.taskTypes.join("; ")}.`,
    `Question progression (Bloom's): ${guidelines.questionProgression.join(" → ")}.`,
    "",
    "System rules:",
    ...guidelines.systemPromptRules.map((rule) => `- ${rule}`),
    "",
    `Source: ${guidelines.source}`,
  ];

  return lines.join("\n");
}

/** System-prompt bullets when Jamaica NSC guidelines are active. */
export function jamaicaNscSystemPromptRules(): string {
  return [
    "- Jamaica NSC lesson-structure guidelines are included in the user prompt. Follow them as the primary instructional design framework for this plan.",
    "- Structure every class period with the 5E model (Engage, Explore, Explain, Elaborate, Evaluate). Each weeklySchedule day's lessonTimeline MUST be five labeled 5E lines (not Warm-up/Instruction/Activity/Closing).",
    "- Keep the lesson student-centered, inquiry-based, and competency-driven; avoid lecture-only or note-copying designs.",
    "- Include culturally relevant Jamaican examples where appropriate and promote the 4Cs.",
    "- Align objectives, activities, and assessments; recommend differentiation/accommodations consistent with inclusive education guidance.",
  ].join("\n");
}
