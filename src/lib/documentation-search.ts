import type { DocSection } from "@/lib/documentation-content-types";
import type { DocArticle } from "@/lib/user-documentation-article-types";
import { docArticleHash } from "@/lib/user-documentation-article-types";

export type DocumentationSearchHitKind = "quick-reference" | "in-depth";

export type DocumentationSearchHit = {
  pageId: string;
  sectionTitle: string;
  pageTitle: string;
  routeLabel: string | null;
  kind: DocumentationSearchHitKind;
  snippet: string;
  targetHash: string;
  score: number;
};

function normalize(text: string): string {
  return text.toLowerCase().trim();
}

function extractSnippet(text: string, matchIndex: number, matchLen: number): string {
  const start = Math.max(0, matchIndex - 36);
  const end = Math.min(text.length, matchIndex + matchLen + 48);
  let snippet = text.slice(start, end).replace(/\s+/g, " ").trim();
  if (start > 0) snippet = `…${snippet}`;
  if (end < text.length) snippet = `${snippet}…`;
  return snippet;
}

function scoreText(haystack: string, query: string): { score: number; snippet: string } | null {
  const h = normalize(haystack);
  const q = normalize(query);
  if (!q) return null;

  const idx = h.indexOf(q);
  if (idx >= 0) {
    let score = 12;
    if (h === q) score += 24;
    else if (h.startsWith(q)) score += 8;
    return { score, snippet: extractSnippet(haystack, idx, q.length) };
  }

  const words = q.split(/\s+/).filter(Boolean);
  if (words.length > 1 && words.every((w) => h.includes(w))) {
    const firstIdx = h.indexOf(words[0]!);
    return {
      score: 6 + words.length,
      snippet: extractSnippet(haystack, Math.max(0, firstIdx), 24),
    };
  }

  return null;
}

function articleTextChunks(article: DocArticle): { label: string; text: string }[] {
  const chunks: { label: string; text: string }[] = [
    { label: "In-depth intro", text: article.intro },
    { label: "In-depth title", text: article.title },
  ];
  for (const section of article.sections) {
    chunks.push({ label: section.title, text: section.title });
    for (const paragraph of section.paragraphs ?? []) {
      chunks.push({ label: section.title, text: paragraph });
    }
    for (const bullet of section.bullets ?? []) {
      chunks.push({ label: section.title, text: bullet });
    }
    for (const header of section.table?.headers ?? []) {
      chunks.push({ label: section.title, text: header });
    }
    for (const row of section.table?.rows ?? []) {
      for (const cell of row) {
        chunks.push({ label: section.title, text: cell });
      }
    }
  }
  return chunks;
}

function routeLabelForPage(page: DocSection["pages"][number]): string | null {
  if (page.route) return page.route;
  if (page.clerkTab) return `Account menu → ${page.clerkTab}`;
  return null;
}

function bestChunkMatch(
  chunks: { label: string; text: string }[],
  query: string,
  titleBoost?: string,
): { score: number; snippet: string; label: string } | null {
  let best: { score: number; snippet: string; label: string } | null = null;

  if (titleBoost) {
    const titleMatch = scoreText(titleBoost, query);
    if (titleMatch) {
      best = { ...titleMatch, score: titleMatch.score + 18, label: "Title" };
    }
  }

  for (const chunk of chunks) {
    const match = scoreText(chunk.text, query);
    if (match && (!best || match.score > best.score)) {
      best = { ...match, label: chunk.label };
    }
  }

  return best;
}

/** Search quick-reference pages and optional in-depth articles across documentation sections. */
export function searchDocumentation(
  sections: DocSection[],
  query: string,
  getArticle: (pageId: string) => DocArticle | null,
  limit = 14,
): DocumentationSearchHit[] {
  const q = query.trim();
  if (q.length < 2) return [];

  const hits: DocumentationSearchHit[] = [];

  for (const section of sections) {
    for (const page of section.pages) {
      const routeLabel = routeLabelForPage(page);

      const quickChunks: { label: string; text: string }[] = [
        { label: "Purpose", text: page.purpose },
        ...page.howItWorks.map((text) => ({ label: "How it works", text })),
        ...page.requirements.map((text) => ({ label: "Requirements", text })),
        ...page.doNots.map((text) => ({ label: "Do not", text })),
      ];
      if (page.route) quickChunks.push({ label: "Route", text: page.route });
      if (page.clerkTab) {
        quickChunks.push({ label: "Account menu", text: page.clerkTab });
      }

      const quickMatch = bestChunkMatch(quickChunks, q, page.title);
      if (quickMatch) {
        hits.push({
          pageId: page.id,
          sectionTitle: section.title,
          pageTitle: page.title,
          routeLabel,
          kind: "quick-reference",
          snippet:
            quickMatch.label === "Title"
              ? page.purpose.length > 140
                ? `${page.purpose.slice(0, 140)}…`
                : page.purpose
              : quickMatch.snippet,
          targetHash: page.id,
          score: quickMatch.score,
        });
      }

      const article = getArticle(page.id);
      if (article) {
        const articleMatch = bestChunkMatch(articleTextChunks(article), q, article.title);
        if (articleMatch) {
          hits.push({
            pageId: page.id,
            sectionTitle: section.title,
            pageTitle: page.title,
            routeLabel,
            kind: "in-depth",
            snippet: articleMatch.snippet,
            targetHash: docArticleHash(page.id),
            score: articleMatch.score,
          });
        }
      }
    }
  }

  return hits
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.pageTitle.localeCompare(b.pageTitle) ||
        a.kind.localeCompare(b.kind),
    )
    .slice(0, limit);
}
