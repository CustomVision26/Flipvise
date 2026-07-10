export type DefinitionItem = {
  term: string;
  definition: string;
};

export type ParsedPassageBody = {
  intro: string | null;
  paragraphs: string[];
  definitions: DefinitionItem[];
};

export type ParsedCardFront =
  | {
      kind: "reading-passage";
      passage: ParsedPassageBody;
      question: string;
    }
  | {
      kind: "plain";
      text: string;
    };


const SKIP_DEFINITION_TERMS = new Set([
  "During",
  "The",
  "Students",
  "This",
  "Every",
  "While",
  "Because",
  "When",
  "What",
  "How",
  "Why",
  "Passage",
  "Question",
]);

const DEFINITION_MARKER =
  /\b([A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+)*)\s*(?::\s*|\s[—–-]\s+)/g;

/** Cleans common punctuation and spacing issues in generated card text. */
export function polishCardText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]*[—–-][ \t]*[—–-][ \t]*/g, " — ")
    .split("\n")
    .map((line) =>
      line
        .replace(/\.\.+/g, ".")
        .replace(/\.,/g, ".")
        .replace(/,\./g, ".")
        .replace(/\.\?/g, "?")
        .replace(/\?\.+/g, "?")
        .replace(/:\s*\./g, ":")
        .replace(/[ \t]{2,}/g, " ")
        .trim(),
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type DefinitionMarkerMatch = {
  term: string;
  index: number;
  markerLength: number;
};

function findDefinitionMarkers(text: string): DefinitionMarkerMatch[] {
  const matches: DefinitionMarkerMatch[] = [];

  for (const match of text.matchAll(DEFINITION_MARKER)) {
    const term = match[1]?.trim() ?? "";
    if (!term || SKIP_DEFINITION_TERMS.has(term) || term.split(/\s+/).length > 5) {
      continue;
    }

    matches.push({
      term,
      index: match.index ?? 0,
      markerLength: match[0].length,
    });
  }

  return matches;
}

function splitDefinitionAndTrailing(rawDefinition: string): {
  definition: string;
  trailing: string | null;
} {
  const trimmed = rawDefinition.trim();
  if (!trimmed) {
    return { definition: "", trailing: null };
  }

  const narrativeMatch = trimmed.match(
    /^([\s\S]*?)\.\s+((?:The teacher|Students|Every|While|During|In class|Learners|Classmates|Together)\b[\s\S]*)$/i,
  );

  if (narrativeMatch?.[1] && narrativeMatch[2]) {
    return {
      definition: `${narrativeMatch[1].trim()}.`,
      trailing: narrativeMatch[2].trim(),
    };
  }

  return { definition: trimmed.replace(/\.\s*$/, "").trim(), trailing: null };
}

function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Detects labeled definition lines such as "Obtuse Angle: ..." or "Caribbean Sea — ...". */
export function parseDefinitionItems(text: string): ParsedPassageBody {
  const polished = polishCardText(text);
  const matches = findDefinitionMarkers(polished);

  if (matches.length === 0) {
    const paragraphs = splitIntoParagraphs(polished);
    return {
      intro: paragraphs.length > 1 ? paragraphs[0] ?? null : null,
      paragraphs: paragraphs.length > 1 ? paragraphs.slice(1) : paragraphs,
      definitions: [],
    };
  }

  const firstIndex = matches[0]?.index ?? 0;
  const intro = polished.slice(0, firstIndex).trim() || null;
  const definitions: DefinitionItem[] = [];
  const trailingParagraphs: string[] = [];

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index]!;
    const start = match.index + match.markerLength;
    const end =
      index + 1 < matches.length
        ? matches[index + 1]!.index
        : polished.length;
    const rawDefinition = polished.slice(start, end).trim();
    const isLast = index === matches.length - 1;
    const { definition, trailing } = isLast
      ? splitDefinitionAndTrailing(rawDefinition)
      : { definition: rawDefinition.replace(/\.\s*$/, "").trim(), trailing: null };

    if (definition) {
      definitions.push({
        term: match.term,
        definition,
      });
    }

    if (trailing) {
      trailingParagraphs.push(...splitIntoParagraphs(trailing));
    }
  }

  return {
    intro,
    paragraphs: trailingParagraphs,
    definitions,
  };
}

function parsePassageBody(rawPassage: string): ParsedPassageBody {
  return parseDefinitionItems(polishCardText(rawPassage));
}

function tryReadingPassageMatch(raw: string): { passage: string; question: string } | null {
  const patterns = [
    /^Passage\s*\n+([\s\S]*?)\n+Question\s*\n+([\s\S]*)$/i,
    /^Passage\s*\n([\s\S]*?)\nQuestion\s*\n([\s\S]*)$/i,
    /^Passage\s+([\s\S]+?)\s+Question\s+([\s\S]+)$/i,
    /^([\s\S]*?)\n+Question\s*\n+([\s\S]*)$/i,
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (!match?.[1] || !match[2]) continue;
    const passage = match[1].trim();
    const question = match[2].trim();
    if (passage.length > 0 && question.length > 0 && !/^passage$/i.test(passage)) {
      return { passage, question };
    }
  }

  return null;
}

function tryTrailingQuestion(text: string): { passage: string; question: string } | null {
  const paragraphs = splitIntoParagraphs(text);
  if (paragraphs.length < 2) return null;

  const last = paragraphs[paragraphs.length - 1] ?? "";
  if (!last.endsWith("?")) return null;

  const passage = paragraphs.slice(0, -1).join("\n\n").trim();
  if (!passage) return null;

  return { passage, question: last };
}

/** Parses reading-passage card fronts into structured passage + question sections. */
export function parseCardFront(raw: string): ParsedCardFront {
  const polished = polishCardText(raw);
  if (!polished) {
    return { kind: "plain", text: "" };
  }

  const readingPassage =
    tryReadingPassageMatch(polished) ?? tryTrailingQuestion(polished);
  if (readingPassage) {
    return {
      kind: "reading-passage",
      passage: parsePassageBody(readingPassage.passage),
      question: polishCardText(readingPassage.question),
    };
  }

  return { kind: "plain", text: polished };
}

export function hasStructuredPassageBody(body: ParsedPassageBody): boolean {
  return (
    body.definitions.length > 0 ||
    Boolean(body.intro?.trim()) ||
    body.paragraphs.length > 1
  );
}
