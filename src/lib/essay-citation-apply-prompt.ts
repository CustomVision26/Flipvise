import type { EssayCitationStyle } from "@/lib/essay-builder-options";
import type { EssayGenerationResult } from "@/lib/essay-ai-schema";
import type { DocumentStudioMeta } from "@/lib/document-generation-studio";

export function buildEssayCitationApplyPrompt(input: {
  title: string;
  citationStyle: Exclude<EssayCitationStyle, "none">;
  essayBody: string;
  sections: Array<{ id: string; title: string; text: string }>;
  userSourcesText: string;
  documentStudio: DocumentStudioMeta;
  sourceLabel?: "user_written" | "model_essay";
}): string {
  const style = input.citationStyle.toUpperCase();
  const refsHeading =
    input.citationStyle === "mla"
      ? "Works Cited"
      : input.citationStyle === "chicago"
        ? "Bibliography"
        : "References";
  const hasUserSources = input.userSourcesText.trim().length > 0;
  const copyLabel =
    input.sourceLabel === "model_essay"
      ? "MODEL ESSAY BODY (copy to format)"
      : "USER-WRITTEN ESSAY BODY (copy to format)";
  const sectionList = input.sections
    .map(
      (s, i) =>
        `${i + 1}. id="${s.id}" title="${s.title}"\n${s.text || "(empty)"}`,
    )
    .join("\n\n");

  return [
    `You are formatting a COPY of an essay into a complete ${style} academic paper.`,
    "The original essay document is not being edited — work only on this copy.",
    "",
    "TASK:",
    "1. Start from the provided essay body (a copy). Do not invent a new essay.",
    "2. Insert proper in-text citations into that copied body.",
    `3. Build a ${refsHeading} list from the provided sources (or sample sources if none).`,
    "4. Ensure EVERY in-text citation has exactly one matching reference entry.",
    "5. Include ONLY sources that are actually cited in the essay body — no unused bibliography entries.",
    "6. Do not invent direct quotations or page numbers.",
    "7. Preserve the original wording and meaning; only add citation markers and light glue for citation flow.",
    "8. For APA: continuous paragraphs (no Introduction/Conclusion headings). First-line indent style in prose.",
    '9. Return sections as an array of { id, content } using the same section ids, each with the cited portion for that section.',
    "10. citedEssay must be the full continuous cited body (no References section inside it).",
    "11. titlePage: APA/Chicago student title page text with line breaks when style is apa/chicago; else null.",
    "",
    `Paper title: ${input.title}`,
    `Citation style: ${style}`,
    `Copy source: ${input.sourceLabel === "model_essay" ? "model essay" : "user-written essay"}`,
    `Include title page: ${input.documentStudio.essayFormatting.titlePage ? "YES" : "NO"}`,
    "",
    hasUserSources
      ? [
          "SOURCE MODE: USER SUPPLIED",
          "- Format ONLY these sources into reference entries.",
          "- Base in-text citations ONLY on these sources.",
          "- Set referencesAreSamples=false.",
          "- referencesNote: brief note that references were formatted from user-supplied sources.",
          "",
          "User-supplied sources:",
          input.userSourcesText.trim().slice(0, 14_000),
        ].join("\n")
      : [
          "SOURCE MODE: REAL PUBLISHED SOURCES",
          "- Create 2–4 topic-relevant REAL published sources that support claims in the essay copy.",
          "- Prefer well-known peer-reviewed articles, scholarly books, or reputable organization reports.",
          "- Set referencesAreSamples=false.",
          '- referencesNote: "References support claims in the formatted essay. Verify bibliographic details before academic submission."',
          "- Do NOT use [Sample] prefixes or Author1/Author2 placeholders.",
          "- Do NOT invent fake DOIs/URLs; omit when unsure.",
          "- Insert matching in-text citations for those real sources.",
        ].join("\n"),
    "",
    `${copyLabel}:`,
    input.essayBody.slice(0, 20_000),
    "",
    "SECTIONS (return these ids in sections[]):",
    sectionList.slice(0, 18_000),
  ].join("\n");
}

/**
 * Extract rough APA/MLA-style author-year keys from essay text, e.g. (Johnson, 2023).
 */
export function extractInTextCitationKeys(text: string): Set<string> {
  const keys = new Set<string>();
  const re =
    /\(([A-Z][A-Za-z'’-]+(?:\s*(?:&|and)\s*[A-Z][A-Za-z'’-]+)?(?:\s+et\s+al\.)?),?\s*(\d{4}[a-z]?)\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) != null) {
    const author = match[1]!.toLowerCase().replace(/\s+/g, " ").trim();
    const year = match[2]!;
    keys.add(`${author}|${year}`);
  }
  return keys;
}

function referenceKey(entry: string): { author: string; year: string } | null {
  const cleaned = entry.replace(/^\[Sample\]\s*/i, "").trim();
  const yearMatch = cleaned.match(/\((\d{4}[a-z]?)\)/);
  if (!yearMatch) return null;
  const authorPart = cleaned.split("(")[0]?.trim() ?? "";
  const surname = authorPart
    .split(/,|&| and /i)[0]
    ?.replace(/\./g, "")
    .trim()
    .toLowerCase();
  if (!surname) return null;
  return { author: surname, year: yearMatch[1]! };
}

/** Keep only bibliography entries that appear as in-text citations. */
export function filterReferencesToCitedOnly(
  essayText: string,
  references: string[],
): string[] {
  const keys = extractInTextCitationKeys(essayText);
  if (keys.size === 0) return references;

  const kept = references.filter((entry) => {
    const meta = referenceKey(entry);
    if (!meta) return true; // keep unparsable rather than drop everything
    for (const key of keys) {
      const [author, year] = key.split("|");
      if (!author || !year) continue;
      if (meta.year !== year) continue;
      if (author.includes(meta.author) || meta.author.includes(author.split(/\s+/)[0]!)) {
        return true;
      }
      if (author.includes("et al") && author.startsWith(meta.author)) {
        return true;
      }
    }
    return false;
  });

  return kept.length > 0 ? kept : references;
}

export function joinSectionTextsForCitation(
  result: EssayGenerationResult,
  writtenSections: Record<string, string> | null | undefined,
): {
  essayBody: string;
  sections: Array<{ id: string; title: string; text: string }>;
} {
  const sections = result.sections.map((section) => {
    const fromDraft = (writtenSections?.[section.id] ?? "").trim();
    const fromGenerated = (section.generatedContent ?? "").trim();
    const text = fromDraft || fromGenerated || "";
    return { id: section.id, title: section.title, text };
  });
  const essayBody =
    sections
      .map((s) => s.text)
      .filter(Boolean)
      .join("\n\n")
      .trim() ||
    (result.modelEssay ?? "").trim();
  return { essayBody, sections };
}

/** Resolve a copyable essay body from the user's choice (never mutates originals). */
export function resolveEssayCopyForCitationFormat(input: {
  source: "user_written" | "model_essay";
  result: EssayGenerationResult;
  writtenSections: Record<string, string> | null | undefined;
  draftBody?: string | null;
}): {
  essayBody: string;
  sections: Array<{ id: string; title: string; text: string }>;
} {
  if (input.source === "user_written") {
    const sections = input.result.sections.map((section) => ({
      id: section.id,
      title: section.title,
      text: (input.writtenSections?.[section.id] ?? "").trim(),
    }));
    const fromSections = sections
      .map((s) => s.text)
      .filter(Boolean)
      .join("\n\n")
      .trim();
    const essayBody = fromSections || (input.draftBody ?? "").trim();
    if (!essayBody) {
      throw new Error(
        "No user-written essay found. Write the essay first, or choose Model essay.",
      );
    }
    return { essayBody, sections };
  }

  const sections = input.result.sections.map((section) => ({
    id: section.id,
    title: section.title,
    text: (section.generatedContent ?? "").trim(),
  }));
  const fromSections = sections
    .map((s) => s.text)
    .filter(Boolean)
    .join("\n\n")
    .trim();
  const modelBody = (input.result.modelEssay ?? "").trim();
  const essayBody = fromSections || modelBody;
  if (!essayBody) {
    throw new Error(
      "No model essay found. Reveal or generate a model essay first, or choose User written essay.",
    );
  }
  if (!fromSections && modelBody) {
    return {
      essayBody: modelBody,
      sections: input.result.sections.map((section, index) => ({
        id: section.id,
        title: section.title,
        text: index === 0 ? modelBody : "",
      })),
    };
  }
  return { essayBody, sections };
}
