/**
 * Pro Plus document import rollout — flip each flag when the extractor is ready.
 * Pro plan always has URL + plain text regardless of these flags.
 */
export const PRO_PLUS_SOURCE_FORMATS_ENABLED = {
  pdf: true,
  docx: true,
  pptx: true,
  handwriting_image: true,
} as const;

export type ProPlusSourceFormat = keyof typeof PRO_PLUS_SOURCE_FORMATS_ENABLED;

export type SourceFormat = "url" | "txt" | ProPlusSourceFormat;

export const SOURCE_IMPORT_MAX_FILE_BYTES = 15 * 1024 * 1024;

export const SOURCE_IMPORT_MAX_EXTRACTED_CHARS = 50_000;

export const SOURCE_IMPORT_TRUNCATION_NOTICE =
  "\n\n[Content truncated for processing.]";

/** Keep extracted reference text within SOURCE_IMPORT_MAX_EXTRACTED_CHARS including any notice. */
export function truncateSourceImportText(text: string): string {
  const trimmed = text.replace(/\r\n/g, "\n").trim();
  if (trimmed.length <= SOURCE_IMPORT_MAX_EXTRACTED_CHARS) return trimmed;
  const maxBody =
    SOURCE_IMPORT_MAX_EXTRACTED_CHARS - SOURCE_IMPORT_TRUNCATION_NOTICE.length;
  return `${trimmed.slice(0, maxBody)}${SOURCE_IMPORT_TRUNCATION_NOTICE}`;
}

/** Formats available on Pro (and team-tier deck editors with basic AI). */
export const PRO_SOURCE_FORMATS: SourceFormat[] = ["url", "txt"];

export function isProPlusSourceFormat(format: SourceFormat): format is ProPlusSourceFormat {
  return format !== "url" && format !== "txt";
}

export function isProPlusFormatEnabled(format: ProPlusSourceFormat): boolean {
  return PRO_PLUS_SOURCE_FORMATS_ENABLED[format];
}

export function mimeToSourceFormat(mime: string, fileName: string): SourceFormat | null {
  const lower = fileName.toLowerCase();
  if (mime === "text/plain" || lower.endsWith(".txt")) return "txt";
  if (mime === "application/pdf" || lower.endsWith(".pdf")) return "pdf";
  if (
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.endsWith(".docx")
  ) {
    return "docx";
  }
  if (
    mime ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    lower.endsWith(".pptx")
  ) {
    return "pptx";
  }
  if (mime.startsWith("image/") || /\.(jpe?g|png|webp|gif)$/i.test(lower)) {
    return "handwriting_image";
  }
  return null;
}

export function acceptAttributeForUpload(hasAdvancedSourceImport: boolean): string {
  const parts = [acceptAttributeForFileSource("txt")];
  if (!hasAdvancedSourceImport) return parts.join(",");
  if (PRO_PLUS_SOURCE_FORMATS_ENABLED.pdf) {
    parts.push(acceptAttributeForFileSource("pdf"));
  }
  if (PRO_PLUS_SOURCE_FORMATS_ENABLED.docx) {
    parts.push(acceptAttributeForFileSource("docx"));
  }
  if (PRO_PLUS_SOURCE_FORMATS_ENABLED.pptx) {
    parts.push(acceptAttributeForFileSource("pptx"));
  }
  if (PRO_PLUS_SOURCE_FORMATS_ENABLED.handwriting_image) {
    parts.push(acceptAttributeForFileSource("handwriting_image"));
  }
  return parts.join(",");
}

/** File-based source picker ids (excludes website URL). */
export type FileSourcePickerId = "txt" | ProPlusSourceFormat;

export type SourcePickerId = "url" | FileSourcePickerId;

export function acceptAttributeForFileSource(id: FileSourcePickerId): string {
  switch (id) {
    case "txt":
      return ".txt,text/plain";
    case "pdf":
      return ".pdf,application/pdf";
    case "docx":
      return ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "pptx":
      return ".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case "handwriting_image":
      return "image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif";
  }
}

export function fileSourcePickerLabel(id: FileSourcePickerId): string {
  switch (id) {
    case "txt":
      return "Plain text";
    case "pdf":
      return "PDF";
    case "docx":
      return "Word";
    case "pptx":
      return "PowerPoint";
    case "handwriting_image":
      return "Handwritten";
  }
}

export function fileSourcePickerHint(id: FileSourcePickerId): string {
  switch (id) {
    case "txt":
      return "Upload a .txt or Notepad export. Files are read once and not stored.";
    case "pdf":
      return "Upload a PDF with selectable text. Files are read once and not stored.";
    case "docx":
      return "Upload a Word .docx document. Files are read once and not stored.";
    case "pptx":
      return "Upload a PowerPoint .pptx deck. Files are read once and not stored.";
    case "handwriting_image":
      return "Upload a clear photo (JPG, PNG, WebP) of handwritten or printed notes.";
  }
}

export function isFileSourceProPlusOnly(id: FileSourcePickerId): boolean {
  return id !== "txt";
}

export function proPlusFormatLabel(format: ProPlusSourceFormat): string {
  switch (format) {
    case "pdf":
      return "PDF";
    case "docx":
      return "Word";
    case "pptx":
      return "PowerPoint";
    case "handwriting_image":
      return "handwritten notes (photo)";
  }
}
