/** Structured in-depth help article linked to a {@link DocPage} by `pageId`. */
export type DocArticleSection = {
  id: string;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  table?: {
    headers: string[];
    rows: string[][];
  };
};

export type DocArticle = {
  /** Matches `DocPage.id` in `user-documentation.ts`. */
  pageId: string;
  title: string;
  intro: string;
  sections: DocArticleSection[];
};

export const DOC_ARTICLE_HASH_PREFIX = "article-";

export function docArticleHash(pageId: string): string {
  return `${DOC_ARTICLE_HASH_PREFIX}${pageId}`;
}

export function parseDocArticleHash(hash: string): string | null {
  const id = hash.replace(/^#/, "");
  if (!id.startsWith(DOC_ARTICLE_HASH_PREFIX)) return null;
  const pageId = id.slice(DOC_ARTICLE_HASH_PREFIX.length);
  return pageId.length > 0 ? pageId : null;
}
