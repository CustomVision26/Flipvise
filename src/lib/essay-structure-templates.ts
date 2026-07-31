import type { EssayGenerateInput, EssaySection } from "@/lib/essay-ai-schema";
import { ESSAY_TYPE_META } from "@/lib/essay-types";
import {
  lengthHintForPrompt,
  recommendedMainPointsForGrade,
} from "@/lib/essay-builder-options";
import { supportingSectionTitlePrefix } from "@/lib/essay-sample-content";

function section(
  index: number,
  title: string,
  type: string,
  estimatedWords: number,
  instructions: string,
): EssaySection {
  const id = `section-${index + 1}-${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)}`;
  return {
    id,
    title,
    type,
    instructions,
    sentenceStarters: [
      `In this part of the essay, …`,
      `One important point is that …`,
    ],
    examples: null,
    transitionWords: ["Furthermore", "However", "In addition", "Therefore"],
    checklist: [`Develops ${title}`, "Uses clear sentences", "Links to the thesis"],
    teacherNotes: null,
    estimatedWords,
    generatedContent: null,
    planningGoal: `Complete the ${title} section.`,
    planningKeyIdea: null,
    planningEvidence: null,
  };
}

function supportingTitles(
  count: number,
  prefix = "Supporting Point",
): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix} ${i + 1}`);
}

/** Type-aware fallback section titles — never "Body Paragraph 1/2/3". */
export function buildDynamicFallbackSections(
  input: EssayGenerateInput,
): EssaySection[] {
  const meta = ESSAY_TYPE_META[input.essayType];
  const mainPoints =
    input.essayLength === "custom"
      ? input.customMainPoints
      : input.essayLength === "short"
        ? 2
        : input.essayLength === "long" || input.essayLength === "extended"
          ? Math.max(4, recommendedMainPointsForGrade(input.gradeLevel))
          : recommendedMainPointsForGrade(input.gradeLevel);

  const perSection = Math.max(
    40,
    Math.round(input.wordCount / Math.max(3, mainPoints + 2)),
  );

  const titles: { title: string; type: string }[] = [];

  switch (input.essayType) {
    case "narrative":
      titles.push(
        { title: "Beginning", type: "narrative" },
        { title: "Conflict", type: "narrative" },
        { title: "Rising Action", type: "narrative" },
        { title: "Climax", type: "narrative" },
        { title: "Resolution", type: "narrative" },
        { title: "Conclusion", type: "conclusion" },
      );
      break;
    case "argumentative":
    case "persuasive":
    case "opinion":
    case "for_and_against":
    case "discursive": {
      titles.push({ title: "Introduction", type: "introduction" });
      if (input.essayStance === "side_2") {
        titles.push(
          ...supportingTitles(
            mainPoints,
            supportingSectionTitlePrefix(input, "side_2"),
          ).map((title) => ({ title, type: "supporting" as const })),
        );
      } else if (input.essayStance === "side_1") {
        titles.push(
          ...supportingTitles(
            mainPoints,
            supportingSectionTitlePrefix(input, "side_1"),
          ).map((title) => ({ title, type: "supporting" as const })),
        );
      } else {
        const half = Math.max(1, Math.floor(mainPoints / 2));
        titles.push(
          ...supportingTitles(
            half,
            supportingSectionTitlePrefix(input, "both_1"),
          ).map((title) => ({ title, type: "supporting" as const })),
          ...supportingTitles(
            Math.max(1, mainPoints - half),
            supportingSectionTitlePrefix(input, "both_2"),
          ).map((title) => ({ title, type: "supporting" as const })),
        );
      }
      if (input.includeCounterargument) {
        titles.push({ title: "Counterargument", type: "counterargument" });
      }
      titles.push({ title: "Conclusion", type: "conclusion" });
      break;
    }
    case "compare_and_contrast":
      titles.push(
        { title: "Introduction", type: "introduction" },
        { title: "Similarities", type: "supporting" },
        { title: "Differences", type: "supporting" },
        { title: "Balanced Analysis", type: "analysis" },
        { title: "Conclusion", type: "conclusion" },
      );
      break;
    case "cause_and_effect":
      titles.push({ title: "Introduction", type: "introduction" });
      if (input.essayStance === "side_1") {
        titles.push(
          ...supportingTitles(mainPoints, "Cause").map((title) => ({
            title,
            type: "supporting" as const,
          })),
        );
      } else if (input.essayStance === "side_2") {
        titles.push(
          ...supportingTitles(mainPoints, "Effect").map((title) => ({
            title,
            type: "supporting" as const,
          })),
        );
      } else {
        titles.push(
          { title: "Causes", type: "supporting" },
          { title: "Effects", type: "supporting" },
          { title: "Connections", type: "analysis" },
        );
      }
      titles.push({ title: "Conclusion", type: "conclusion" });
      break;
    case "problem_and_solution":
      titles.push(
        { title: "Introduction", type: "introduction" },
        { title: "Problem", type: "supporting" },
        { title: "Solution", type: "supporting" },
        { title: "Evaluation", type: "analysis" },
        { title: "Conclusion", type: "conclusion" },
      );
      break;
    case "literary_analysis":
      titles.push(
        { title: "Introduction", type: "introduction" },
        { title: "Textual Evidence", type: "supporting" },
        { title: "Analysis", type: "analysis" },
        { title: "Interpretation", type: "analysis" },
        { title: "Conclusion", type: "conclusion" },
      );
      break;
    case "research":
      titles.push(
        { title: "Introduction", type: "introduction" },
        { title: "Background", type: "supporting" },
        { title: "Evidence", type: "supporting" },
        { title: "Analysis", type: "analysis" },
        { title: "Conclusion", type: "conclusion" },
      );
      break;
    case "process":
      titles.push(
        { title: "Introduction", type: "introduction" },
        ...supportingTitles(Math.max(3, mainPoints), "Step").map((title) => ({
          title,
          type: "supporting" as const,
        })),
        { title: "Conclusion", type: "conclusion" },
      );
      break;
    default:
      titles.push({ title: "Introduction", type: "introduction" });
      titles.push(
        ...supportingTitles(mainPoints).map((title) => ({
          title,
          type: "supporting" as const,
        })),
      );
      if (input.includeCounterargument) {
        titles.push({ title: "Counterargument", type: "counterargument" });
      }
      titles.push({ title: "Conclusion", type: "conclusion" });
  }

  return titles.map((t, index) =>
    section(
      index,
      t.title,
      t.type,
      perSection,
      `Write the "${t.title}" section for a ${meta.label.toLowerCase()} on "${input.topic}". ${lengthHintForPrompt(input.essayLength, input.customMainPoints)}`,
    ),
  );
}
