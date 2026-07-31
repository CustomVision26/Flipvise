/**
 * Document Generation Studio — registry + shared citation/formatting/integrity defaults.
 * Essay Generator is the only enabled document type today; others are Coming Soon.
 */

export const DOCUMENT_STUDIO_TITLE = "Document Generation Studio";

export type DocumentStudioTypeId =
  | "essay"
  | "research_paper"
  | "book_report"
  | "lab_report"
  | "literature_review"
  | "reflection_journal"
  | "speech"
  | "debate"
  | "business_report"
  | "custom_document";

export type DocumentStudioType = {
  id: DocumentStudioTypeId;
  label: string;
  enabled: boolean;
  /** Existing essay routes stay under /dashboard/essay */
  href: string | null;
  summary: string;
};

export const DOCUMENT_STUDIO_TYPES: DocumentStudioType[] = [
  {
    id: "essay",
    label: "Essay Generator",
    enabled: true,
    href: "/dashboard/essay/generate",
    summary: "AI essay activities with prompts, sections, and rubrics.",
  },
  {
    id: "research_paper",
    label: "Research Paper",
    enabled: false,
    href: null,
    summary: "Coming Soon",
  },
  {
    id: "book_report",
    label: "Book Report",
    enabled: false,
    href: null,
    summary: "Coming Soon",
  },
  {
    id: "lab_report",
    label: "Lab Report",
    enabled: false,
    href: null,
    summary: "Coming Soon",
  },
  {
    id: "literature_review",
    label: "Literature Review",
    enabled: false,
    href: null,
    summary: "Coming Soon",
  },
  {
    id: "reflection_journal",
    label: "Reflection Journal",
    enabled: false,
    href: null,
    summary: "Coming Soon",
  },
  {
    id: "speech",
    label: "Speech Generator",
    enabled: false,
    href: null,
    summary: "Coming Soon",
  },
  {
    id: "debate",
    label: "Debate Generator",
    enabled: false,
    href: null,
    summary: "Coming Soon",
  },
  {
    id: "business_report",
    label: "Business Report",
    enabled: false,
    href: null,
    summary: "Coming Soon",
  },
  {
    id: "custom_document",
    label: "Custom Document",
    enabled: false,
    href: null,
    summary: "Coming Soon",
  },
];

export const DOCUMENT_STUDIO_SOURCE_MODES = [
  "none",
  "ai_generated",
  "user_supplied",
  "academic_search",
] as const;

export type DocumentStudioSourceMode =
  (typeof DOCUMENT_STUDIO_SOURCE_MODES)[number];

export const DOCUMENT_STUDIO_FONTS = [
  "Times New Roman",
  "Arial",
  "Calibri",
  "Georgia",
] as const;

export type DocumentStudioFont = (typeof DOCUMENT_STUDIO_FONTS)[number];

export const DOCUMENT_STUDIO_FONT_SIZES = [10, 11, 12, 14] as const;

export const DOCUMENT_STUDIO_SPACING = [1, 1.15, 1.5, 2] as const;

export const DOCUMENT_STUDIO_ALIGNMENTS = ["left", "justified"] as const;

export type DocumentStudioAlignment =
  (typeof DOCUMENT_STUDIO_ALIGNMENTS)[number];

export const DOCUMENT_STUDIO_MARGINS = ["normal", "narrow", "wide"] as const;

export type DocumentStudioMargins = (typeof DOCUMENT_STUDIO_MARGINS)[number];

export const DOCUMENT_STUDIO_AI_DISCLOSURE = [
  "none",
  "ai_assisted",
  "ai_generated_draft",
  "teacher_assisted",
] as const;

export type DocumentStudioAiDisclosure =
  (typeof DOCUMENT_STUDIO_AI_DISCLOSURE)[number];

/** Snapshot of the Citation & Formatting paper preview (independent of draft body). */
export type FormattedEssayPreviewSnapshot = {
  bodyTitle: string;
  titlePageText: string | null;
  bodyText: string;
  references: string[];
  referencesNote: string | null;
  savedAt: string;
};

export type EssayFormattingMeta = {
  citationStyle: "none" | "apa" | "mla" | "chicago" | "harvard";
  includeInTextCitations: boolean;
  includeReferences: boolean;
  sourceMode: DocumentStudioSourceMode;
  userSourcesText: string;
  font: DocumentStudioFont;
  fontSize: (typeof DOCUMENT_STUDIO_FONT_SIZES)[number];
  lineSpacing: (typeof DOCUMENT_STUDIO_SPACING)[number];
  alignment: DocumentStudioAlignment;
  indentFirstLine: boolean;
  margins: DocumentStudioMargins;
  pageNumbers: boolean;
  titlePage: boolean;
  runningHeader: boolean;
  /**
   * ISO timestamp when the user saved a citation-formatted paper from
   * Citation & Formatting. Powers Citation & Formatting → Formatted papers.
   */
  citationFormattedSavedAt: string | null;
  /** Saved Formatted essay preview only — does not replace the writing draft. */
  formattedEssayPreview: FormattedEssayPreviewSnapshot | null;
};

export type AcademicIntegrityMeta = {
  generateOriginalContent: boolean;
  aiDisclosure: DocumentStudioAiDisclosure;
};

export type DocumentStudioMeta = {
  documentType: DocumentStudioTypeId;
  essayFormatting: EssayFormattingMeta;
  academicIntegrity: AcademicIntegrityMeta;
};

export function defaultEssayFormatting(
  citationStyle: EssayFormattingMeta["citationStyle"] = "none",
): EssayFormattingMeta {
  const hasCitation = citationStyle !== "none";
  const isApa = citationStyle === "apa";
  return {
    citationStyle,
    includeInTextCitations: hasCitation,
    includeReferences: hasCitation,
    // APA / academic styles default to AI sample refs until the user supplies sources.
    sourceMode: hasCitation ? "ai_generated" : "none",
    userSourcesText: "",
    font: "Times New Roman",
    fontSize: 12,
    lineSpacing: 2,
    alignment: "left",
    indentFirstLine: true,
    margins: "normal",
    pageNumbers: true,
    titlePage: hasCitation,
    runningHeader: isApa || citationStyle === "mla",
    citationFormattedSavedAt: null,
    formattedEssayPreview: null,
  };
}

function normalizeFormattedEssayPreview(
  raw: unknown,
): FormattedEssayPreviewSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const bodyText =
    typeof data.bodyText === "string" ? data.bodyText.slice(0, 100_000) : "";
  const savedAt =
    typeof data.savedAt === "string" && data.savedAt.trim()
      ? data.savedAt.trim()
      : "";
  if (!bodyText.trim() || !savedAt) return null;
  const references = Array.isArray(data.references)
    ? data.references
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .slice(0, 40)
    : [];
  return {
    bodyTitle:
      typeof data.bodyTitle === "string"
        ? data.bodyTitle.trim().slice(0, 512)
        : "Untitled Essay",
    titlePageText:
      typeof data.titlePageText === "string" && data.titlePageText.trim()
        ? data.titlePageText.slice(0, 8_000)
        : null,
    bodyText,
    references,
    referencesNote:
      typeof data.referencesNote === "string" && data.referencesNote.trim()
        ? data.referencesNote.trim().slice(0, 2_000)
        : null,
    savedAt,
  };
}

export function defaultAcademicIntegrity(): AcademicIntegrityMeta {
  return {
    generateOriginalContent: true,
    aiDisclosure: "none",
  };
}

export function defaultDocumentStudioMeta(
  citationStyle: EssayFormattingMeta["citationStyle"] = "none",
): DocumentStudioMeta {
  return {
    documentType: "essay",
    essayFormatting: defaultEssayFormatting(citationStyle),
    academicIntegrity: defaultAcademicIntegrity(),
  };
}

/** Merge partial/legacy metadata with safe defaults (backward compatible). */
export function normalizeDocumentStudioMeta(
  raw: unknown,
  fallbackCitation: EssayFormattingMeta["citationStyle"] = "none",
): DocumentStudioMeta {
  const base = defaultDocumentStudioMeta(fallbackCitation);
  if (!raw || typeof raw !== "object") return base;
  const data = raw as Record<string, unknown>;
  const formattingRaw =
    data.essayFormatting && typeof data.essayFormatting === "object"
      ? (data.essayFormatting as Record<string, unknown>)
      : data;
  const integrityRaw =
    data.academicIntegrity && typeof data.academicIntegrity === "object"
      ? (data.academicIntegrity as Record<string, unknown>)
      : {};

  const citationStyle = (
    [
      "none",
      "apa",
      "mla",
      "chicago",
      "harvard",
    ] as const
  ).includes(formattingRaw.citationStyle as never)
    ? (formattingRaw.citationStyle as EssayFormattingMeta["citationStyle"])
    : fallbackCitation;

  const sourceMode = (
    DOCUMENT_STUDIO_SOURCE_MODES as readonly string[]
  ).includes(String(formattingRaw.sourceMode))
    ? (formattingRaw.sourceMode as DocumentStudioSourceMode)
    : "none";

  const font = (DOCUMENT_STUDIO_FONTS as readonly string[]).includes(
    String(formattingRaw.font),
  )
    ? (formattingRaw.font as DocumentStudioFont)
    : base.essayFormatting.font;

  const fontSize = (DOCUMENT_STUDIO_FONT_SIZES as readonly number[]).includes(
    Number(formattingRaw.fontSize),
  )
    ? (Number(formattingRaw.fontSize) as EssayFormattingMeta["fontSize"])
    : base.essayFormatting.fontSize;

  const lineSpacing = (DOCUMENT_STUDIO_SPACING as readonly number[]).includes(
    Number(formattingRaw.lineSpacing),
  )
    ? (Number(formattingRaw.lineSpacing) as EssayFormattingMeta["lineSpacing"])
    : base.essayFormatting.lineSpacing;

  const alignment = (DOCUMENT_STUDIO_ALIGNMENTS as readonly string[]).includes(
    String(formattingRaw.alignment),
  )
    ? (formattingRaw.alignment as DocumentStudioAlignment)
    : base.essayFormatting.alignment;

  const margins = (DOCUMENT_STUDIO_MARGINS as readonly string[]).includes(
    String(formattingRaw.margins),
  )
    ? (formattingRaw.margins as DocumentStudioMargins)
    : base.essayFormatting.margins;

  const aiDisclosure = (
    DOCUMENT_STUDIO_AI_DISCLOSURE as readonly string[]
  ).includes(String(integrityRaw.aiDisclosure))
    ? (integrityRaw.aiDisclosure as DocumentStudioAiDisclosure)
    : "none";

  const hasCitation = citationStyle !== "none";

  return {
    documentType: "essay",
    essayFormatting: {
      citationStyle,
      includeInTextCitations: hasCitation
        ? Boolean(
            formattingRaw.includeInTextCitations ??
              base.essayFormatting.includeInTextCitations,
          )
        : false,
      includeReferences: hasCitation
        ? Boolean(
            formattingRaw.includeReferences ?? true,
          )
        : false,
      sourceMode: sourceMode === "academic_search" ? "none" : sourceMode,
      userSourcesText:
        typeof formattingRaw.userSourcesText === "string"
          ? formattingRaw.userSourcesText.slice(0, 50_000)
          : "",
      font,
      fontSize,
      lineSpacing,
      alignment,
      indentFirstLine: Boolean(
        formattingRaw.indentFirstLine ?? base.essayFormatting.indentFirstLine,
      ),
      margins,
      pageNumbers: Boolean(
        formattingRaw.pageNumbers ?? base.essayFormatting.pageNumbers,
      ),
      titlePage: Boolean(
        formattingRaw.titlePage ?? (hasCitation ? true : false),
      ),
      runningHeader: hasCitation
        ? Boolean(
            formattingRaw.runningHeader ??
              (citationStyle === "apa" || citationStyle === "mla"),
          )
        : false,
      citationFormattedSavedAt:
        typeof formattingRaw.citationFormattedSavedAt === "string" &&
        formattingRaw.citationFormattedSavedAt.trim()
          ? formattingRaw.citationFormattedSavedAt.trim()
          : null,
      formattedEssayPreview: normalizeFormattedEssayPreview(
        formattingRaw.formattedEssayPreview,
      ),
    },
    academicIntegrity: {
      generateOriginalContent: Boolean(
        integrityRaw.generateOriginalContent ?? true,
      ),
      aiDisclosure,
    },
  };
}

/** True when the essay was saved from Citation & Formatting into Formatted papers. */
export function isEssayCitationFormattedSaved(
  input: unknown,
  fallbackCitation: EssayFormattingMeta["citationStyle"] = "none",
): boolean {
  if (!input || typeof input !== "object") return false;
  const data = input as {
    documentStudio?: unknown;
    citationStyle?: EssayFormattingMeta["citationStyle"];
  };
  const studio = normalizeDocumentStudioMeta(
    data.documentStudio,
    data.citationStyle ?? fallbackCitation,
  );
  return Boolean(
    studio.essayFormatting.formattedEssayPreview ||
      studio.essayFormatting.citationFormattedSavedAt,
  );
}

export function citationStyleRequiresRunningHeader(
  style: EssayFormattingMeta["citationStyle"],
): boolean {
  return style === "apa" || style === "mla";
}

export function marginInches(margins: DocumentStudioMargins): number {
  switch (margins) {
    case "narrow":
      return 0.5;
    case "wide":
      return 1.5;
    case "normal":
    default:
      return 1;
  }
}
