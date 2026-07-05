import { fileSourcePickerLabel, SOURCE_IMPORT_MAX_EXTRACTED_CHARS, type SourceFormat } from "@/lib/source-import-formats";
import { isYouTubeUrl, youTubeReferenceSummary } from "@/lib/youtube-url";

export type LessonPlanReferenceMaterial = {
  text: string;
  summary: string;
};

export const MAX_LESSON_PLAN_REFERENCES = 5;

export function referenceSourceSummaryLabel(
  format: SourceFormat,
  options?: { fileName?: string | null; url?: string | null },
): string {
  if (format === "url" && options?.url?.trim() && isYouTubeUrl(options.url)) {
    return youTubeReferenceSummary(options.url);
  }
  if (format === "url" && options?.url?.trim()) {
    try {
      return `Website (${new URL(options.url.trim()).hostname})`;
    } catch {
      return "Website";
    }
  }
  const typeLabel =
    format === "handwriting_image"
      ? "Image notes"
      : fileSourcePickerLabel(format as "txt" | "pdf" | "docx" | "pptx" | "handwriting_image");
  if (options?.fileName?.trim()) {
    return `${typeLabel}: ${options.fileName.trim()}`;
  }
  return typeLabel;
}

export function formatLessonPlanReferenceForPrompt(
  text: string,
  sourceSummary?: string | null,
): string {
  const header = sourceSummary?.trim()
    ? `Teacher-provided reference material (${sourceSummary.trim()}):`
    : "Teacher-provided reference material:";
  return [
    header,
    "Use this content to narrow and ground the lesson plan. Prioritize facts, vocabulary, concepts, sequencing, and examples from the reference when they align with the topic, grade level, and learning standard. Do not contradict the reference or invent unrelated content.",
    "",
    text.trim(),
  ].join("\n");
}

export function combineLessonPlanReferenceMaterials(
  references: LessonPlanReferenceMaterial[],
): LessonPlanReferenceMaterial | null {
  if (references.length === 0) return null;
  if (references.length === 1) return references[0];

  const summary = references.map((reference) => reference.summary).join("; ");
  const text = references
    .map((reference, index) => {
      const header = reference.summary.trim()
        ? `--- Reference ${index + 1} (${reference.summary.trim()}) ---`
        : `--- Reference ${index + 1} ---`;
      return `${header}\n${reference.text.trim()}`;
    })
    .join("\n\n");

  if (text.length <= SOURCE_IMPORT_MAX_EXTRACTED_CHARS) {
    return { summary, text };
  }

  return {
    summary: `${references.length} sources (truncated)`,
    text: `${text.slice(0, SOURCE_IMPORT_MAX_EXTRACTED_CHARS)}\n\n[Content truncated for processing.]`,
  };
}

export function formatMultipleLessonPlanReferencesForPrompt(
  references: LessonPlanReferenceMaterial[],
): string {
  if (references.length === 0) return "";
  if (references.length === 1) {
    return formatLessonPlanReferenceForPrompt(
      references[0].text,
      references[0].summary,
    );
  }

  const blocks = references.map((reference, index) => {
    const header = reference.summary.trim()
      ? `Reference ${index + 1} (${reference.summary.trim()}):`
      : `Reference ${index + 1}:`;
    return [header, reference.text.trim()].join("\n");
  });

  return [
    "Teacher-provided reference materials:",
    "Use these sources to narrow and ground the lesson plan. Prioritize facts, vocabulary, concepts, sequencing, and examples from the references when they align with the topic, grade level, and learning standard. Do not contradict the references or invent unrelated content.",
    "",
    ...blocks,
  ].join("\n\n");
}
