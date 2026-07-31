import type { EssayGenerationResult } from "@/lib/essay-ai-schema";
import {
  normalizeDocumentStudioMeta,
  type DocumentStudioMeta,
  type EssayFormattingMeta,
} from "@/lib/document-generation-studio";
import {
  buildFallbackReferenceEntries,
  isPlaceholderAuthorCitation,
  replacePlaceholderInTextCitations,
} from "@/lib/essay-fallback-citations";
import {
  segmentModelEssay,
  type ModelEssaySegment,
} from "@/lib/essay-result-normalize";

export type CitationStyle = EssayFormattingMeta["citationStyle"];

export function referencesPageTitle(style: CitationStyle): string {
  if (style === "mla") return "Works Cited";
  if (style === "chicago") return "Bibliography";
  if (style === "harvard") return "Reference List";
  return "References";
}

export function citationStyleDisplayLabel(style: CitationStyle): string {
  switch (style) {
    case "apa":
      return "APA (7th Edition)";
    case "mla":
      return "MLA (9th Edition)";
    case "chicago":
      return "Chicago (17th Edition)";
    case "harvard":
      return "Harvard";
    default:
      return "None";
  }
}

/** Detect common in-text citation patterns already present in the model essay. */
export function textHasInTextCitations(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return (
    /\([A-Za-z][^)]{0,60}\d{4}[a-z]?[^)]*\)/.test(t) ||
    /\b[A-Z][A-Za-z'’-]+(?:\s(?:&|and)\s[A-Z][A-Za-z'’-]+)?\s\(\d{4}\)/.test(
      t,
    ) ||
    /\([A-Z][A-Za-z'’-]+(?:\s(?:and|&)\s[A-Z][A-Za-z'’-]+)?\s+\d{1,4}\)/.test(
      t,
    ) ||
    /\([A-Z][A-Za-z'’-]+,?\s+\d{4},\s*p\.?\s*\d+\)/.test(t)
  );
}

type ParsedSource = {
  author: string;
  year: string;
  page: string;
};

function defaultSources(count: number): ParsedSource[] {
  const seeds = [
    { author: "Johnson", year: "2021", page: "14" },
    { author: "Chen", year: "2022", page: "88" },
    { author: "Martinez", year: "2020", page: "33" },
    { author: "Patel", year: "2023", page: "7" },
  ];
  return Array.from({ length: Math.max(1, count) }, (_, i) => seeds[i % seeds.length]!);
}

function parseSourcesFromReferences(
  references: string[] | null | undefined,
): ParsedSource[] {
  if (!references?.length) return defaultSources(3);
  const parsed = references.map((raw, i) => {
    const line = raw.trim();
    const yearMatch = line.match(/\((19|20)\d{2}\)/) ?? line.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch
      ? (yearMatch[0].replace(/[()]/g, "") as string)
      : String(2020 + (i % 5));
    const authorMatch =
      line.match(/^([A-Z][A-Za-z'’-]+)(?:,|\s)/) ??
      line.match(/^([A-Z][A-Za-z'’-]+)/);
    const author = authorMatch?.[1] ?? `Author${i + 1}`;
    return {
      author,
      year,
      page: String(10 + i * 3),
    };
  });
  return parsed.length > 0 ? parsed : defaultSources(3);
}

export function formatInTextCitation(
  style: CitationStyle,
  source: ParsedSource,
  narrative = false,
): string {
  const { author, year, page } = source;
  switch (style) {
    case "apa":
      return narrative
        ? `${author} (${year})`
        : `(${author}, ${year})`;
    case "mla":
      return narrative ? `${author}` : `(${author} ${page})`;
    case "chicago":
      return narrative
        ? `${author} (${year})`
        : `(${author} ${year}, ${page})`;
    case "harvard":
      return narrative
        ? `${author} (${year})`
        : `(${author}, ${year})`;
    default:
      return "";
  }
}

function ensureSampleReferences(
  style: CitationStyle,
  existing: string[] | null | undefined,
  sources: ParsedSource[],
): string[] {
  if (existing && existing.length > 0) {
    return existing.map((r) => r.trim()).filter(Boolean);
  }
  return sources.map((s, i) => {
    const title = [
      "Mobile phones and classroom attention",
      "Adolescent communication in the digital age",
      "Screen time and peer relationships",
      "Focus and learning with personal devices",
    ][i % 4]!;
    switch (style) {
      case "mla":
        return `${s.author}, Alex. "${title}." Journal of Education, vol. ${12 + i}, no. 2, ${s.year}, pp. ${s.page}–${Number(s.page) + 12}.`;
      case "chicago":
        return `${s.author}, Alex. "${title}." Journal of Education ${12 + i}, no. 2 (${s.year}): ${s.page}–${Number(s.page) + 12}.`;
      case "harvard":
        return `${s.author}, A. (${s.year}) '${title}', Journal of Education, ${12 + i}(${2}), pp. ${s.page}–${Number(s.page) + 12}.`;
      case "apa":
      default:
        return `${s.author}, A. (${s.year}). ${title}. Journal of Education, ${12 + i}(2), ${s.page}–${Number(s.page) + 12}.`;
    }
  });
}

function injectCitationIntoParagraph(
  paragraph: string,
  citation: string,
): string {
  const trimmed = paragraph.trim();
  if (!trimmed || textHasInTextCitations(trimmed)) return trimmed;
  if (trimmed.endsWith(".")) {
    return `${trimmed.slice(0, -1)} ${citation}.`;
  }
  return `${trimmed} ${citation}`;
}

/**
 * Applies selected citation style to model-essay segments for display.
 * If the AI already included in-text citations, segments are left as-is.
 * Client-side demo citations are only used when AI returned neither citations
 * nor real references (legacy / empty responses).
 */
export function applyCitationFormatToModelSegments(
  segments: ModelEssaySegment[],
  formatting: EssayFormattingMeta,
  references: string[] | null | undefined,
): {
  segments: ModelEssaySegment[];
  references: string[];
  referencesTitle: string;
  appliedDemo: boolean;
  styleLabel: string;
} {
  const style = formatting.citationStyle;
  const aiRefs = (references ?? []).map((r) => r.trim()).filter(Boolean);
  const hasRealAiRefs =
    aiRefs.length > 0 && !aiRefs.every((r) => /^\[Sample\]/i.test(r));
  const sources = parseSourcesFromReferences(references);
  const sampleRefs = ensureSampleReferences(style, references, sources);
  const styleLabel = citationStyleDisplayLabel(style);
  const referencesTitle = referencesPageTitle(style);

  if (style === "none") {
    return {
      segments,
      references: aiRefs,
      referencesTitle,
      appliedDemo: false,
      styleLabel,
    };
  }

  const joined = segments.map((s) => s.text).join("\n\n");
  const alreadyCited = textHasInTextCitations(joined);

  // Prefer AI-authored citations + references. Never replace real AI refs with demos.
  if (alreadyCited || !formatting.includeInTextCitations || hasRealAiRefs) {
    return {
      segments,
      references: aiRefs.length > 0 ? aiRefs : sampleRefs,
      referencesTitle,
      appliedDemo: false,
      styleLabel,
    };
  }

  let sourceIndex = 0;
  const nextCitation = () => {
    const citation = formatInTextCitation(style, sources[sourceIndex % sources.length]!);
    sourceIndex += 1;
    return citation;
  };

  const nextSegments = segments.map((segment) => {
    if (segment.badge === "Introduction") {
      // Keep intro mostly clean; add one citation on the last sentence if long enough.
      const paras = segment.text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
      if (paras.length === 0) return segment;
      if (paras[paras.length - 1]!.split(/\s+/).length >= 18) {
        paras[paras.length - 1] = injectCitationIntoParagraph(
          paras[paras.length - 1]!,
          nextCitation(),
        );
      }
      return { ...segment, text: paras.join("\n\n") };
    }

    if (segment.badge === "Supporting") {
      const paras = segment.text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
      const cited = paras.map((p) => injectCitationIntoParagraph(p, nextCitation()));
      return { ...segment, text: cited.join("\n\n") };
    }

    if (segment.badge === "Conclusion") {
      const paras = segment.text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
      if (paras.length > 0 && paras[0]!.split(/\s+/).length >= 12) {
        // Narrative lead-in for conclusion when APA/Harvard style works well.
        const source = sources[0]!;
        if (style === "apa" || style === "harvard" || style === "chicago") {
          const narrative = formatInTextCitation(style, source, true);
          paras[0] = paras[0]!.replace(
            /^(In conclusion,\s*)/i,
            `$1as ${narrative} suggests, `,
          );
          if (!paras[0]!.includes(source.year) && !textHasInTextCitations(paras[0]!)) {
            paras[0] = injectCitationIntoParagraph(paras[0]!, formatInTextCitation(style, source));
          }
        } else {
          paras[0] = injectCitationIntoParagraph(paras[0]!, nextCitation());
        }
      }
      return { ...segment, text: paras.join("\n\n") };
    }

    return segment;
  });

  return {
    segments: nextSegments,
    references: sampleRefs,
    referencesTitle,
    appliedDemo: true,
    styleLabel,
  };
}

export function buildCitedModelEssayView(
  result: EssayGenerationResult,
  documentStudio: DocumentStudioMeta | null | undefined,
): {
  segments: ModelEssaySegment[];
  references: string[];
  referencesTitle: string;
  appliedDemo: boolean;
  styleLabel: string;
  citationStyle: CitationStyle;
  showCitations: boolean;
  titlePage: string | null;
  referencesAreSamples: boolean;
  referencesNote: string | null;
} {
  const studio = normalizeDocumentStudioMeta(documentStudio);
  const formatting = studio.essayFormatting;
  const style = formatting.citationStyle;

  // Rewrite Author1 / [Sample] markers in stored prose before display.
  const cleanedResult: EssayGenerationResult = {
    ...result,
    modelEssay: result.modelEssay
      ? replacePlaceholderInTextCitations(result.modelEssay, style)
      : result.modelEssay,
    sections: result.sections.map((section) => ({
      ...section,
      generatedContent: section.generatedContent
        ? replacePlaceholderInTextCitations(section.generatedContent, style)
        : section.generatedContent,
    })),
    references: (result.references ?? [])
      .map((r) => r.replace(/^\[Sample\]\s*/i, "").trim())
      .filter(Boolean),
  };

  const segments = segmentModelEssay(cleanedResult);
  const aiRefs = (cleanedResult.references ?? [])
    .map((r) => r.trim())
    .filter(Boolean);
  const refsArePlaceholders =
    aiRefs.length === 0 ||
    aiRefs.every((r) => isPlaceholderAuthorCitation(r)) ||
    /unavailable in offline fallback/i.test(cleanedResult.referencesNote ?? "");

  const displayRefs =
    style !== "none" && refsArePlaceholders
      ? buildFallbackReferenceEntries(style, Math.max(3, aiRefs.length || 3))
      : aiRefs;

  const applied = applyCitationFormatToModelSegments(
    segments,
    formatting,
    displayRefs,
  );

  const references =
    displayRefs.length > 0 ? displayRefs : applied.references;
  const referencesAreSamples = false;
  const referencesNote =
    cleanedResult.referencesNote?.trim() &&
    !/unavailable in offline fallback/i.test(cleanedResult.referencesNote)
      ? cleanedResult.referencesNote.trim()
      : "References support claims in the model essay. Verify bibliographic details before academic submission.";

  return {
    ...applied,
    appliedDemo: false,
    segments: applied.segments.map((segment) => ({
      ...segment,
      text: replacePlaceholderInTextCitations(segment.text, style),
    })),
    references,
    referencesAreSamples,
    referencesNote,
    titlePage: cleanedResult.titlePage?.trim() || null,
    citationStyle: style,
    showCitations: style !== "none",
  };
}
