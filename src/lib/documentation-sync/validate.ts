import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { ADMIN_DOCUMENTATION_SECTIONS } from "@/data/admin-documentation";
import { ADMIN_DOCUMENTATION_ARTICLES_BY_PAGE_ID } from "@/data/admin-documentation-articles";
import { USER_DOCUMENTATION_SECTIONS } from "@/data/user-documentation";
import { USER_DOCUMENTATION_ARTICLES_BY_PAGE_ID } from "@/data/user-documentation-articles";
import type { DocPage } from "@/lib/documentation-content-types";
import {
  DOCUMENTATION_SYNC_VERSION,
  fingerprintDocumentationContent,
  fingerprintWatchPaths,
} from "@/lib/documentation-sync/fingerprints";
import {
  getDocumentationRegistry,
  type DocumentationAudience,
  type DocumentationRegistryEntry,
} from "@/lib/documentation-sync/registry";
import type { DocArticle } from "@/lib/user-documentation-article-types";

export type DocumentationBaselinePage = {
  watchFingerprint: string;
  docFingerprint: string;
};

export type DocumentationSyncBaseline = {
  version: typeof DOCUMENTATION_SYNC_VERSION;
  updatedAt: string;
  pages: Record<string, DocumentationBaselinePage>;
};

export type DocumentationValidationIssue = {
  level: "error" | "warning";
  code: string;
  message: string;
  pageId?: string;
  audience?: DocumentationAudience;
};

export type DocumentationValidationResult = {
  ok: boolean;
  issues: DocumentationValidationIssue[];
  stalePageIds: string[];
};

const BASELINE_FILENAME = "documentation-sync-baseline.json";

function collectPages(
  sections: { pages: DocPage[] }[],
  audience: DocumentationAudience,
): { page: DocPage; audience: DocumentationAudience }[] {
  return sections.flatMap((section) =>
    section.pages.map((page) => ({ page, audience })),
  );
}

function getArticle(
  audience: DocumentationAudience,
  pageId: string,
): DocArticle | null {
  return audience === "user"
    ? (USER_DOCUMENTATION_ARTICLES_BY_PAGE_ID[pageId] ?? null)
    : (ADMIN_DOCUMENTATION_ARTICLES_BY_PAGE_ID[pageId] ?? null);
}

function loadBaseline(rootDir: string): DocumentationSyncBaseline | null {
  const baselinePath = resolve(rootDir, BASELINE_FILENAME);
  if (!existsSync(baselinePath)) return null;
  return JSON.parse(readFileSync(baselinePath, "utf8")) as DocumentationSyncBaseline;
}

function validateStructure(
  registry: DocumentationRegistryEntry[],
  rootDir: string,
): DocumentationValidationIssue[] {
  const issues: DocumentationValidationIssue[] = [];
  const userPages = collectPages(USER_DOCUMENTATION_SECTIONS, "user");
  const adminPages = collectPages(ADMIN_DOCUMENTATION_SECTIONS, "admin");
  const allPages = [...userPages, ...adminPages];

  const registryIds = new Set(registry.map((entry) => entry.pageId));
  const docIds = new Set(allPages.map(({ page }) => page.id));

  for (const entry of registry) {
    if (!docIds.has(entry.pageId)) {
      issues.push({
        level: "error",
        code: "registry-missing-doc",
        audience: entry.audience,
        pageId: entry.pageId,
        message: `Registry page "${entry.pageId}" is missing from ${entry.audience} documentation sections.`,
      });
    }
    const article = getArticle(entry.audience, entry.pageId);
    if (!article) {
      issues.push({
        level: "error",
        code: "missing-article",
        audience: entry.audience,
        pageId: entry.pageId,
        message: `No in-depth article for ${entry.audience} page "${entry.pageId}".`,
      });
    }
    for (const watchPath of entry.watchPaths) {
      if (!existsSync(resolve(rootDir, watchPath))) {
        issues.push({
          level: "warning",
          code: "missing-watch-path",
          audience: entry.audience,
          pageId: entry.pageId,
          message: `Watch path does not exist for "${entry.pageId}": ${watchPath}`,
        });
      }
    }
  }

  for (const { page, audience } of allPages) {
    if (!registryIds.has(page.id)) {
      issues.push({
        level: "error",
        code: "doc-missing-registry",
        audience,
        pageId: page.id,
        message: `Documentation page "${page.id}" is not represented in the registry.`,
      });
    }
  }

  const duplicateIds = new Map<string, number>();
  for (const { page } of allPages) {
    duplicateIds.set(page.id, (duplicateIds.get(page.id) ?? 0) + 1);
  }
  for (const [pageId, count] of duplicateIds) {
    if (count > 1) {
      issues.push({
        level: "error",
        code: "duplicate-page-id",
        pageId,
        message: `Duplicate documentation page id "${pageId}" appears ${count} times.`,
      });
    }
  }

  return issues;
}

function validateStaleDocs(
  registry: DocumentationRegistryEntry[],
  rootDir: string,
  baseline: DocumentationSyncBaseline | null,
  checkStale: boolean,
): { issues: DocumentationValidationIssue[]; stalePageIds: string[] } {
  const issues: DocumentationValidationIssue[] = [];
  const stalePageIds: string[] = [];

  if (!checkStale) return { issues, stalePageIds };

  if (!baseline) {
    issues.push({
      level: "error",
      code: "missing-baseline",
      message: `Missing ${BASELINE_FILENAME}. Run: npm run docs:baseline`,
    });
    return { issues, stalePageIds };
  }

  if (baseline.version !== DOCUMENTATION_SYNC_VERSION) {
    issues.push({
      level: "error",
      code: "baseline-version-mismatch",
      message: `Baseline version ${baseline.version} does not match tooling version ${DOCUMENTATION_SYNC_VERSION}. Run: npm run docs:baseline`,
    });
  }

  for (const entry of registry) {
    const page =
      entry.audience === "user"
        ? USER_DOCUMENTATION_SECTIONS.flatMap((section) => section.pages).find(
            (candidate) => candidate.id === entry.pageId,
          )
        : ADMIN_DOCUMENTATION_SECTIONS.flatMap((section) => section.pages).find(
            (candidate) => candidate.id === entry.pageId,
          );

    if (!page) continue;

    const article = getArticle(entry.audience, entry.pageId);
    const watchFingerprint = fingerprintWatchPaths(entry.watchPaths, rootDir);
    const docFingerprint = fingerprintDocumentationContent(page, article);
    const stored = baseline.pages[entry.pageId];

    if (!stored) {
      issues.push({
        level: "error",
        code: "baseline-missing-page",
        audience: entry.audience,
        pageId: entry.pageId,
        message: `Baseline missing page "${entry.pageId}". Run: npm run docs:baseline`,
      });
      continue;
    }

    const watchChanged = stored.watchFingerprint !== watchFingerprint;
    const docChanged = stored.docFingerprint !== docFingerprint;

    if (watchChanged && !docChanged) {
      stalePageIds.push(entry.pageId);
      issues.push({
        level: "error",
        code: "stale-documentation",
        audience: entry.audience,
        pageId: entry.pageId,
        message:
          `UI/feature sources changed for "${entry.pageId}" but documentation is unchanged. ` +
          `Update src/data/${entry.audience === "user" ? "user" : "admin"}-documentation.ts and the matching article, then run: npm run docs:baseline`,
      });
    }
  }

  return { issues, stalePageIds };
}

export function buildDocumentationBaseline(rootDir: string): DocumentationSyncBaseline {
  const registry = getDocumentationRegistry();
  const pages: Record<string, DocumentationBaselinePage> = {};

  for (const entry of registry) {
    const page =
      entry.audience === "user"
        ? USER_DOCUMENTATION_SECTIONS.flatMap((section) => section.pages).find(
            (candidate) => candidate.id === entry.pageId,
          )
        : ADMIN_DOCUMENTATION_SECTIONS.flatMap((section) => section.pages).find(
            (candidate) => candidate.id === entry.pageId,
          );
    if (!page) continue;

    const article = getArticle(entry.audience, entry.pageId);
    pages[entry.pageId] = {
      watchFingerprint: fingerprintWatchPaths(entry.watchPaths, rootDir),
      docFingerprint: fingerprintDocumentationContent(page, article),
    };
  }

  return {
    version: DOCUMENTATION_SYNC_VERSION,
    updatedAt: new Date().toISOString(),
    pages,
  };
}

export function validateDocumentationSync(options: {
  rootDir: string;
  checkStale?: boolean;
}): DocumentationValidationResult {
  const registry = getDocumentationRegistry();
  const structuralIssues = validateStructure(registry, options.rootDir);
  const { issues: staleIssues, stalePageIds } = validateStaleDocs(
    registry,
    options.rootDir,
    loadBaseline(options.rootDir),
    options.checkStale ?? true,
  );

  const issues = [...structuralIssues, ...staleIssues];
  const hasErrors = issues.some((issue) => issue.level === "error");

  return {
    ok: !hasErrors,
    issues,
    stalePageIds,
  };
}

export function listStaleDocumentationPages(rootDir: string): string[] {
  return validateDocumentationSync({ rootDir, checkStale: true }).stalePageIds;
}
