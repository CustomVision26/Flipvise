import type { EssayCitationStyle } from "@/lib/essay-builder-options";

/** Real published works used when local sample/fallback prose needs citations. */
export type FallbackCiteSource = {
  surname: string;
  initials: string;
  year: number;
  title: string;
  /** Book publisher when set; otherwise treat as journal article. */
  publisher?: string;
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
};

/**
 * Well-known education / learning sources that match the school-focused
 * fallback model-essay prose (not fictional Author1 placeholders).
 */
export const FALLBACK_CITE_SOURCES: FallbackCiteSource[] = [
  {
    surname: "Hattie",
    initials: "J.",
    year: 2009,
    title:
      "Visible learning: A synthesis of over 800 meta-analyses relating to achievement",
    publisher: "Routledge",
  },
  {
    surname: "Dweck",
    initials: "C. S.",
    year: 2006,
    title: "Mindset: The new psychology of success",
    publisher: "Random House",
  },
  {
    surname: "Darling-Hammond",
    initials: "L.",
    year: 2010,
    title:
      "The flat world and education: How America's commitment to equity will determine our future",
    publisher: "Teachers College Press",
  },
  {
    surname: "Bransford",
    initials: "J. D.",
    year: 2000,
    title: "How people learn: Brain, mind, experience, and school",
    publisher: "National Academy Press",
  },
];

export function isPlaceholderAuthorCitation(text: string): boolean {
  return /\bAuthor\d+\b/i.test(text) || /\[Sample\]/i.test(text);
}

/** In-text citation for a fallback source. */
export function formatFallbackInTextCitation(
  style: EssayCitationStyle,
  source: FallbackCiteSource,
  pageHint = 12,
): string {
  if (style === "none") return "";
  if (style === "mla") return ` (${source.surname} ${pageHint})`;
  if (style === "chicago") {
    return ` (${source.surname} ${source.year}, ${pageHint})`;
  }
  return ` (${source.surname}, ${source.year})`;
}

export function formatFallbackReferenceEntry(
  style: EssayCitationStyle,
  source: FallbackCiteSource,
): string {
  if (source.publisher) {
    if (style === "mla") {
      return `${source.surname}, ${source.initials.replace(/\./g, "")}. ${source.title}. ${source.publisher}, ${source.year}.`;
    }
    if (style === "chicago") {
      return `${source.surname}, ${source.initials.replace(/\./g, "")}. ${source.title}. ${source.publisher}, ${source.year}.`;
    }
    if (style === "harvard") {
      return `${source.surname}, ${source.initials} (${source.year}) ${source.title}. ${source.publisher}.`;
    }
    // APA / default
    return `${source.surname}, ${source.initials} (${source.year}). ${source.title}. ${source.publisher}.`;
  }

  const journal = source.journal ?? "Journal of Education";
  const volume = source.volume ?? "12";
  const issue = source.issue ?? "1";
  const pages = source.pages ?? "1–15";
  if (style === "mla") {
    return `${source.surname}, ${source.initials.replace(/\./g, "")}. "${source.title}." ${journal}, vol. ${volume}, no. ${issue}, ${source.year}, pp. ${pages}.`;
  }
  if (style === "chicago") {
    return `${source.surname}, ${source.initials.replace(/\./g, "")}. "${source.title}." ${journal} ${volume}, no. ${issue} (${source.year}): ${pages}.`;
  }
  if (style === "harvard") {
    return `${source.surname}, ${source.initials} (${source.year}) '${source.title}', ${journal}, ${volume}(${issue}), pp. ${pages}.`;
  }
  return `${source.surname}, ${source.initials} (${source.year}). ${source.title}. ${journal}, ${volume}(${issue}), ${pages}.`;
}

export function buildFallbackReferenceEntries(
  style: EssayCitationStyle,
  count = 3,
): string[] {
  if (style === "none") return [];
  const n = Math.min(
    FALLBACK_CITE_SOURCES.length,
    Math.max(2, Math.min(20, count)),
  );
  return FALLBACK_CITE_SOURCES.slice(0, n).map((source) =>
    formatFallbackReferenceEntry(style, source),
  );
}

/**
 * Replace Author1 / Author2 / [Sample] citation markers with real fallback
 * in-text citations so prose matches the fallback reference list.
 */
export function replacePlaceholderInTextCitations(
  text: string,
  style: EssayCitationStyle,
): string {
  if (!text || style === "none") return text;
  let out = text;
  FALLBACK_CITE_SOURCES.forEach((source, index) => {
    const n = index + 1;
    const replacement = formatFallbackInTextCitation(style, source).trim();
    // (Author1, 2020) / (Author1 2020)
    out = out.replace(
      new RegExp(`\\(Author${n},?\\s*\\d{4}[a-z]?\\)`, "gi"),
      replacement,
    );
    // MLA-ish (Author1 12)
    out = out.replace(
      new RegExp(`\\(Author${n}\\s+\\d{1,4}\\)`, "gi"),
      replacement,
    );
  });
  // Any remaining AuthorN markers
  out = out.replace(/\s*\(Author\d+[^)]*\)/gi, "");
  out = out.replace(/\[Sample\]\s*/gi, "");
  return out.replace(/\s{2,}/g, " ").replace(/\s+([.,;:])/g, "$1");
}
