import type { EssayGenerationResult } from "@/lib/essay-ai-schema";
import type {
  DocumentStudioMeta,
  FormattedEssayPreviewSnapshot,
} from "@/lib/document-generation-studio";
import { normalizeDocumentStudioMeta } from "@/lib/document-generation-studio";
import { citationStyleDisplayLabel } from "@/lib/essay-model-citation-demo";
import type { EssayCitationStyle } from "@/lib/essay-builder-options";

export type ApaTitlePageFields = {
  title: string;
  /** AI-generated title page text, if any. */
  titlePage?: string | null;
  studentName?: string | null;
  institutionName?: string | null;
  courseName?: string | null;
  instructorName?: string | null;
  /** Display date, e.g. July 29, 2026 */
  assignmentDate?: string | null;
};

/** Format a date like "July 29, 2026" for APA student title pages. */
export function formatApaTitlePageDate(date: Date = new Date()): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Build APA 7 student title-page lines.
 * Fills placeholders from profile/course when available; keeps brackets only when unknown.
 */
export function resolveApaStudentTitlePageLines(
  fields: ApaTitlePageFields,
): string[] {
  const title = fields.title.trim() || "Untitled Essay";
  const student = fields.studentName?.trim() || "Student Name";
  const institution = fields.institutionName?.trim() || "Institution Name";
  const course = fields.courseName?.trim() || "Course Name and Number";
  const instructor = fields.instructorName?.trim() || "Instructor Name";
  const dueDate = fields.assignmentDate?.trim() || formatApaTitlePageDate();

  // If AI already returned a full title page, replace known placeholders then use it.
  const raw = fields.titlePage?.trim();
  if (raw && raw.includes("\n")) {
    return raw
      .replace(/\[Student Name\]/gi, student)
      .replace(/\[School\s*\/\s*Institution\]/gi, institution)
      .replace(/\[Institution(?: Name)?\]/gi, institution)
      .replace(/\[Course Name(?: and Number)?\]/gi, course)
      .replace(/\[Instructor Name\]/gi, instructor)
      .replace(/\[Due Date\]/gi, dueDate)
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean);
  }

  return [title, student, institution, course, instructor, dueDate];
}

/**
 * Continuous essay body paragraphs (no section headings) for APA student-paper preview.
 * Prefers draft → generated section content → model essay.
 */
export function collectContinuousWrittenEssayParagraphs(
  result: EssayGenerationResult,
  writtenSections: Record<string, string> | null | undefined,
): string[] {
  const chunks: string[] = [];
  for (const section of result.sections) {
    const fromDraft = (writtenSections?.[section.id] ?? "").trim();
    const fromGenerated = (section.generatedContent ?? "").trim();
    const text = fromDraft || fromGenerated;
    if (text) chunks.push(stripLeadingSectionLabel(text));
  }

  let body =
    chunks.length > 0
      ? chunks.join("\n\n")
      : stripLeadingSectionLabel((result.modelEssay ?? "").trim());

  if (!body) return [];

  // Drop a leading "References" block if the model appended one inside the body.
  body = body.replace(/\n+References\s*\n[\s\S]*$/i, "").trim();

  return body
    .split(/\n\s*\n/)
    .map((p) => stripLeadingSectionLabel(p.replace(/\s*\n\s*/g, " ").trim()))
    .filter(Boolean);
}

function stripLeadingSectionLabel(text: string): string {
  return text
    .replace(
      /^(Introduction|Conclusion|Thesis|Body|Distraction Potential|Impact on Social Skills|Rising Action|Climax|Falling Action|Resolution)\s*[:.\-–—]?\s*/i,
      "",
    )
    .trim();
}

/** References for export: prefer AI/user refs; strip [Sample] prefix for display when needed. */
export function resolveEssayReferencesForPaper(
  result: EssayGenerationResult,
  documentStudio: DocumentStudioMeta | null | undefined,
): {
  references: string[];
  referencesTitle: string;
  referencesAreSamples: boolean;
  referencesNote: string | null;
} {
  const studio = normalizeDocumentStudioMeta(documentStudio);
  const style = studio.essayFormatting.citationStyle;
  const referencesTitle =
    style === "mla"
      ? "Works Cited"
      : style === "chicago"
        ? "Bibliography"
        : "References";

  const userSources = studio.essayFormatting.userSourcesText.trim();
  const aiRefs = (result.references ?? [])
    .map((r) => r.trim())
    .filter(Boolean);

  const referencesAreSamples =
    result.referencesAreSamples === true ||
    (aiRefs.length > 0 && aiRefs.every((r) => /^\[Sample\]/i.test(r)));

  // Prefer user-supplied source text when present and AI marked samples / empty.
  let references = aiRefs;
  if (
    userSources &&
    (aiRefs.length === 0 || referencesAreSamples)
  ) {
    // Keep AI-formatted entries if they exist without [Sample]; otherwise surface note only.
    if (aiRefs.some((r) => !/^\[Sample\]/i.test(r))) {
      references = aiRefs.filter((r) => !/^\[Sample\]/i.test(r));
    }
  }

  // Clean sample prefix for a cleaner paper preview while keeping the integrity note.
  const cleaned = references.map((r) => r.replace(/^\[Sample\]\s*/i, "").trim());

  const referencesNote =
    result.referencesNote?.trim() ||
    (referencesAreSamples
      ? "Sample references (AI-generated for formatting demonstration). Replace with real, verified sources before academic submission."
      : userSources
        ? "References formatted from user-supplied sources."
        : null);

  return {
    references: cleaned,
    referencesTitle,
    referencesAreSamples,
    referencesNote,
  };
}

export type FormattedWrittenEssayPreviewModel = {
  title: string;
  citationStyleLabel: string;
  titlePageLines: string[];
  bodyTitle: string;
  paragraphs: string[];
  referencesTitle: string;
  references: string[];
  referencesNote: string | null;
  indentFirstLine: boolean;
};

/** Rebuild preview from a saved Citation & Formatting snapshot. */
export function buildPreviewFromFormattedSnapshot(input: {
  title: string;
  citationStyle: EssayCitationStyle;
  snapshot: FormattedEssayPreviewSnapshot;
  indentFirstLine?: boolean;
}): FormattedWrittenEssayPreviewModel {
  const style = input.citationStyle === "none" ? "apa" : input.citationStyle;
  const referencesTitle =
    style === "mla"
      ? "Works Cited"
      : style === "chicago"
        ? "Bibliography"
        : "References";
  const titlePageLines = (input.snapshot.titlePageText ?? "")
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const paragraphs = input.snapshot.bodyText
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);

  return {
    title: input.title,
    citationStyleLabel: citationStyleDisplayLabel(style),
    titlePageLines,
    bodyTitle: input.snapshot.bodyTitle.trim() || input.title,
    paragraphs,
    referencesTitle,
    references: input.snapshot.references,
    referencesNote: input.snapshot.referencesNote,
    indentFirstLine: input.indentFirstLine ?? true,
  };
}

/** Build an in-app paper preview model (no PDF). */
export function buildFormattedWrittenEssayPreview(input: {
  title: string;
  result: EssayGenerationResult;
  writtenSections?: Record<string, string> | null;
  documentStudio?: DocumentStudioMeta | null;
  studentName?: string | null;
  institutionName?: string | null;
  courseName?: string | null;
  instructorName?: string | null;
  assignmentDate?: string | null;
}): FormattedWrittenEssayPreviewModel {
  const studio = normalizeDocumentStudioMeta(input.documentStudio);
  const formatting = studio.essayFormatting;
  if (formatting.formattedEssayPreview) {
    return buildPreviewFromFormattedSnapshot({
      title: input.title,
      citationStyle: formatting.citationStyle,
      snapshot: formatting.formattedEssayPreview,
      indentFirstLine: formatting.indentFirstLine,
    });
  }
  const style = formatting.citationStyle;
  const isApa = style === "apa";
  const titlePageLines =
    formatting.titlePage && isApa
      ? resolveApaStudentTitlePageLines({
          title: input.title,
          titlePage: input.result.titlePage,
          studentName: input.studentName,
          institutionName: input.institutionName,
          courseName: input.courseName,
          instructorName: input.instructorName,
          assignmentDate: input.assignmentDate,
        })
      : formatting.titlePage
        ? (input.result.titlePage?.trim()
            ? input.result.titlePage
                .trim()
                .split(/\n/)
                .map((l) => l.trim())
                .filter(Boolean)
            : [input.title])
        : [];

  const refPack = resolveEssayReferencesForPaper(
    input.result,
    input.documentStudio,
  );
  const styleLabel =
    style === "none"
      ? "Unformatted"
      : style === "apa"
        ? "APA (7th Edition)"
        : style.toUpperCase();

  return {
    title: input.title,
    citationStyleLabel: styleLabel,
    titlePageLines,
    bodyTitle: input.title,
    paragraphs: collectContinuousWrittenEssayParagraphs(
      input.result,
      input.writtenSections,
    ),
    referencesTitle: refPack.referencesTitle,
    references: formatting.includeReferences ? refPack.references : [],
    referencesNote: formatting.includeReferences ? refPack.referencesNote : null,
    indentFirstLine: formatting.indentFirstLine,
  };
}
