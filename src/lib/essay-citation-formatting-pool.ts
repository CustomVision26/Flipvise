import type { EssayCitationStyle } from "@/lib/essay-builder-options";
import { normalizeDocumentStudioMeta } from "@/lib/document-generation-studio";

export type SubmittedEssayPoolItem = {
  documentId: number;
  title: string;
  subject: string;
  gradeLevel: string;
  essayType: string;
  wordCount: number;
  submittedAt: string | null;
  currentCitationStyle: EssayCitationStyle;
};

export function toSubmittedEssayPoolItem(row: {
  documentId: number;
  title: string;
  subject: string;
  gradeLevel: string;
  essayType: string;
  wordCount: number;
  submittedAt: Date | null;
  input: unknown;
}): SubmittedEssayPoolItem {
  const input = (row.input ?? {}) as {
    documentStudio?: unknown;
    citationStyle?: EssayCitationStyle;
  };
  const studio = normalizeDocumentStudioMeta(
    input.documentStudio,
    input.citationStyle ?? "none",
  );
  return {
    documentId: row.documentId,
    title: row.title,
    subject: row.subject,
    gradeLevel: row.gradeLevel,
    essayType: row.essayType,
    wordCount: row.wordCount,
    submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
    currentCitationStyle: studio.essayFormatting.citationStyle,
  };
}
