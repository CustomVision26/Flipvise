import { ADMIN_DOCUMENTATION_SECTIONS } from "@/data/admin-documentation";
import { USER_DOCUMENTATION_SECTIONS } from "@/data/user-documentation";
import type { DocPage } from "@/lib/documentation-content-types";
import { routeToAppPagePath } from "@/lib/documentation-sync/route-to-watch-path";
import {
  ADMIN_DOC_SHARED_WATCH_PATHS,
  ADMIN_DOC_SUPPLEMENTAL_WATCH_PATHS,
  USER_DOC_SUPPLEMENTAL_WATCH_PATHS,
} from "@/lib/documentation-sync/watch-paths";

export type DocumentationAudience = "user" | "admin";

export type DocumentationRegistryEntry = {
  audience: DocumentationAudience;
  pageId: string;
  sectionId: string;
  title: string;
  route?: string;
  clerkTab?: string;
  watchPaths: string[];
};

function uniquePaths(paths: readonly string[]): string[] {
  return [...new Set(paths.filter(Boolean))].sort();
}

function resolveWatchPaths(
  page: DocPage,
  audience: DocumentationAudience,
): string[] {
  const supplemental =
    audience === "user"
      ? (USER_DOC_SUPPLEMENTAL_WATCH_PATHS[page.id] ?? [])
      : [
          ...ADMIN_DOC_SHARED_WATCH_PATHS,
          ...(ADMIN_DOC_SUPPLEMENTAL_WATCH_PATHS[page.id] ?? []),
        ];

  const fromRoute = routeToAppPagePath(page.route);
  return uniquePaths([...(fromRoute ? [fromRoute] : []), ...supplemental]);
}

function flattenSections(audience: DocumentationAudience): DocumentationRegistryEntry[] {
  const sections =
    audience === "user" ? USER_DOCUMENTATION_SECTIONS : ADMIN_DOCUMENTATION_SECTIONS;

  return sections.flatMap((section) =>
    section.pages.map((page) => ({
      audience,
      pageId: page.id,
      sectionId: section.id,
      title: page.title,
      route: page.route,
      clerkTab: page.clerkTab,
      watchPaths: resolveWatchPaths(page, audience),
    })),
  );
}

export function getDocumentationRegistry(): DocumentationRegistryEntry[] {
  return [...flattenSections("user"), ...flattenSections("admin")];
}

export function getDocumentationRegistryByPageId(): Map<string, DocumentationRegistryEntry> {
  return new Map(getDocumentationRegistry().map((entry) => [entry.pageId, entry]));
}
