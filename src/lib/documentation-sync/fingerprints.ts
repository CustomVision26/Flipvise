import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { DocPage } from "@/lib/documentation-content-types";
import type { DocArticle } from "@/lib/user-documentation-article-types";

export const DOCUMENTATION_SYNC_VERSION = 1;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function fingerprintWatchPaths(paths: readonly string[], rootDir: string): string {
  const chunks: string[] = [];
  for (const relativePath of [...paths].sort()) {
    const absolutePath = resolve(rootDir, relativePath);
    if (!existsSync(absolutePath)) {
      chunks.push(`${relativePath}:missing`);
      continue;
    }
    const content = readFileSync(absolutePath, "utf8");
    chunks.push(`${relativePath}:${sha256(content)}`);
  }
  return sha256(chunks.join("\n"));
}

export function fingerprintDocumentationContent(
  page: DocPage,
  article: DocArticle | null,
): string {
  return sha256(
    JSON.stringify({
      page: {
        id: page.id,
        title: page.title,
        route: page.route ?? null,
        clerkTab: page.clerkTab ?? null,
        purpose: page.purpose,
        howItWorks: page.howItWorks,
        requirements: page.requirements,
        doNots: page.doNots,
      },
      article: article
        ? {
            pageId: article.pageId,
            title: article.title,
            intro: article.intro,
            sections: article.sections,
          }
        : null,
    }),
  );
}
