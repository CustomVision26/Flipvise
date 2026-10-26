import {
  DOCS_UI_GUIDES,
  DOCS_UI_GUIDE_ORDER,
  type DocsUiGuideId,
} from "@/lib/flipvise-ui-guides";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "can",
  "do",
  "does",
  "for",
  "from",
  "help",
  "how",
  "i",
  "in",
  "into",
  "is",
  "it",
  "me",
  "my",
  "of",
  "on",
  "or",
  "please",
  "show",
  "the",
  "this",
  "to",
  "want",
  "what",
  "when",
  "where",
  "with",
  "you",
  "your",
]);

/** Words that describe the same task, so a question can match a guide title. */
const WORD_CLUSTERS: readonly (readonly string[])[] = [
  ["add", "create", "new", "make"],
  ["deck", "decks"],
  ["card", "cards", "flashcard", "flashcards"],
  ["signin", "login"],
  ["signup", "register"],
  ["mcq", "multiple", "choice"],
  ["import", "source", "upload"],
  ["workspace", "team"],
  ["invite", "invitation"],
  ["member", "members"],
  ["student", "students"],
  ["class", "classes"],
  ["homework", "assignment"],
  ["grade", "grades", "score"],
  ["quiz", "test", "exam"],
  ["lesson", "lessons"],
  ["worksheet", "worksheets"],
  ["price", "pricing", "plan", "plans"],
  ["subscribe", "checkout", "subscription", "payment", "pay"],
  ["receipt", "invoice"],
  ["generate", "ai"],
  ["timer", "timed", "clock"],
  ["privilege", "privileges", "permission", "permissions"],
  ["assign", "assignment"],
  ["link", "connect"],
];

const SYNONYMS = new Map<string, readonly string[]>();
for (const cluster of WORD_CLUSTERS) {
  for (const word of cluster) {
    const existing = SYNONYMS.get(word) ?? [];
    SYNONYMS.set(word, [...new Set([...existing, ...cluster])]);
  }
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

function expand(token: string): Set<string> {
  const words = new Set<string>([token]);
  for (const synonym of SYNONYMS.get(token) ?? []) words.add(synonym);
  for (const word of [...words]) {
    if (word.endsWith("s") && word.length > 3) words.add(word.slice(0, -1));
    else words.add(`${word}s`);
  }
  return words;
}

type GuideIndex = {
  id: DocsUiGuideId;
  titleTokens: Set<string>;
  summaryTokens: Set<string>;
};

const GUIDE_INDEX: readonly GuideIndex[] = DOCS_UI_GUIDE_ORDER.map((id) => {
  const guide = DOCS_UI_GUIDES[id];
  return {
    id,
    titleTokens: new Set(tokenize(guide.title)),
    summaryTokens: new Set(tokenize(guide.summary)),
  };
});

function tokensCover(tokens: Set<string>, expanded: Set<string>): boolean {
  for (const token of tokens) {
    if (expanded.has(token)) return true;
  }
  return false;
}

function scoreGuide(guide: GuideIndex, queryTokens: readonly string[]): number {
  const expandedQuery = new Set<string>();
  for (const token of queryTokens) {
    for (const word of expand(token)) expandedQuery.add(word);
  }

  let titleHits = 0;
  for (const token of guide.titleTokens) {
    if (expandedQuery.has(token)) titleHits += 1;
  }
  const titleCoverage =
    guide.titleTokens.size === 0 ? 0 : titleHits / guide.titleTokens.size;

  let score = titleCoverage * 30;
  let covered = 0;

  for (const token of queryTokens) {
    const words = expand(token);
    if (tokensCover(guide.titleTokens, words)) {
      score += 10;
      covered += 1;
    } else if (tokensCover(guide.summaryTokens, words)) {
      score += 6;
      covered += 1;
    }
  }

  if (covered === queryTokens.length) score += 20;
  return score;
}

/**
 * Guides whose title or summary answers the question, best match first.
 * An empty question returns null so the full catalog stays visible.
 */
export function searchDocsUiGuides(question: string): DocsUiGuideId[] | null {
  const queryTokens = tokenize(question);
  if (question.trim().length === 0) return null;
  if (queryTokens.length === 0) return [];

  const ranked = GUIDE_INDEX.map((guide) => ({
    id: guide.id,
    score: scoreGuide(guide, queryTokens),
  }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  const best = ranked[0]?.score ?? 0;
  if (best < 16) return [];
  const cutoff = best * 0.78;
  return ranked.filter((row) => row.score >= cutoff).map((row) => row.id);
}
