import type { EssayGenerateInput } from "@/lib/essay-ai-schema";
import {
  normalizeDocumentStudioMeta,
  type DocumentStudioMeta,
} from "@/lib/document-generation-studio";
import { formatCitationStylePromptRules } from "@/lib/essay-citation-style-prompt";

export function resolveDocumentStudioFromInput(
  input: EssayGenerateInput,
): DocumentStudioMeta {
  return normalizeDocumentStudioMeta(
    input.documentStudio,
    input.citationStyle ?? "none",
  );
}

/** Appended to the existing essay generation prompt (does not replace it). */
export function formatDocumentStudioPromptAppendix(
  input: EssayGenerateInput,
): string {
  const studio = resolveDocumentStudioFromInput(input);
  const f = studio.essayFormatting;
  const integrity = studio.academicIntegrity;
  const lines: string[] = [
    "",
    "=== Document Generation Studio — Citation & Formatting ===",
    `Citation Style: ${f.citationStyle}`,
    `Include in-text citations: ${f.includeInTextCitations && f.citationStyle !== "none" ? "YES" : "NO"}`,
    `Generate references page: ${f.includeReferences && f.citationStyle !== "none" ? "YES" : "NO"}`,
    `Source mode: ${f.sourceMode}`,
    "",
    "Formatting:",
    `- Font: ${f.font}`,
    `- Font size: ${f.fontSize}`,
    `- Line spacing: ${f.lineSpacing}`,
    `- Alignment: ${f.alignment}`,
    `- Indent first line: ${f.indentFirstLine ? "YES" : "NO"}`,
    `- Margins: ${f.margins}`,
    `- Page numbers: ${f.pageNumbers ? "YES" : "NO"}`,
    `- Title page: ${f.titlePage ? "YES" : "NO"}`,
    `- Running header: ${f.runningHeader ? "YES" : "NO"}`,
    "",
    "Generate the essay following the selected academic writing style.",
    "Return these citation-related JSON fields when applicable:",
    "- titlePage: APA/Chicago title page text (nullable string with line breaks), or null",
    "- references: array of formatted reference entry strings",
    "- referencesAreSamples: false when using real published sources or user-supplied sources; true only if you cannot avoid placeholders (should be rare)",
    "- referencesNote: short integrity note for the references list",
    "- modelEssay: full essay body with real in-text citations that match the references list when citations are enabled",
  ];

  if (f.citationStyle !== "none") {
    lines.push(
      "Citations are enabled:",
      "- Include properly formatted in-text citations when in-text citations are YES.",
      "- Generate a correctly formatted reference page when references page is YES.",
      "- Use REAL published sources (or user-supplied sources) — not Author1/Author2 or [Sample] placeholders.",
      "- Do not fabricate direct quotations.",
      "- Do not invent fake DOIs or URLs.",
    );
  }

  if (f.sourceMode === "user_supplied") {
    lines.push(
      "Source mode is User Supplied Sources:",
      "- Prioritize the user-supplied sources below.",
      "- Format them into the selected citation style.",
      "- Do not invent sources that contradict or replace the supplied list.",
    );
    if (f.userSourcesText.trim()) {
      lines.push(
        "User-supplied sources / excerpts:",
        f.userSourcesText.trim().slice(0, 12_000),
      );
    } else {
      lines.push(
        "User-supplied sources: (none pasted).",
        "If references are still required, use REAL topic-relevant published sources and set referencesAreSamples false.",
      );
    }
  } else if (f.sourceMode === "ai_generated") {
    lines.push(
      "Source mode is AI Generated References:",
      "- Create topic-relevant REAL published references in the selected style.",
      "- Set referencesAreSamples false. Do NOT use [Sample] prefixes or Author1/Author2 placeholders.",
      "- Match every in-text citation in the model essay to a references entry.",
    );
  } else if (f.citationStyle !== "none" && f.includeReferences) {
    lines.push(
      "Source mode is No Sources, but a reference page was requested:",
      "- Use REAL topic-relevant published references.",
      "- Set referencesAreSamples false. Do NOT use [Sample] prefixes.",
      "- referencesNote should ask readers to verify bibliographic details before academic submission.",
    );
  }

  lines.push(
    "",
    "=== Academic Integrity ===",
    `Generate original content: ${integrity.generateOriginalContent ? "YES" : "NO"}`,
    `AI disclosure setting: ${integrity.aiDisclosure}`,
    integrity.generateOriginalContent
      ? "Write original student-facing content; avoid copying known published passages verbatim."
      : "Originality preference is off — still avoid fabricating quotations.",
    formatCitationStylePromptRules(input, f),
  );

  return lines.join("\n");
}
