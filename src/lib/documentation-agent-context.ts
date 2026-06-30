import type { EffectiveDocumentationContent } from "@/lib/documentation-effective-content";
import type { DocumentationAudience } from "@/db/queries/documentation-overrides";
import {
  USER_DOC_SUPPLEMENTAL_WATCH_PATHS,
  ADMIN_DOC_SUPPLEMENTAL_WATCH_PATHS,
} from "@/lib/documentation-sync/watch-paths";

export type DocumentationAgentContext = {
  audience: DocumentationAudience;
  documentation: EffectiveDocumentationContent;
  supplementalWatchPaths: Readonly<Record<string, readonly string[]>>;
};

export function buildDocumentationAgentContext(
  audience: DocumentationAudience,
  documentation: EffectiveDocumentationContent,
): DocumentationAgentContext {
  return {
    audience,
    documentation,
    supplementalWatchPaths:
      audience === "user" ? USER_DOC_SUPPLEMENTAL_WATCH_PATHS : ADMIN_DOC_SUPPLEMENTAL_WATCH_PATHS,
  };
}

export function serializeDocumentationForAgent(context: DocumentationAgentContext): string {
  const { documentation, supplementalWatchPaths } = context;
  const payload = {
    sections: documentation.sections.map((section) => ({
      id: section.id,
      title: section.title,
      description: section.description,
      pages: section.pages.map((page) => ({
        id: page.id,
        title: page.title,
        route: page.route,
        clerkTab: page.clerkTab,
        purpose: page.purpose,
        howItWorks: page.howItWorks,
        requirements: page.requirements,
        doNots: page.doNots,
        supplementalSourcePaths: supplementalWatchPaths[page.id] ?? [],
        article: documentation.articlesByPageId[page.id] ?? null,
      })),
    })),
  };
  return JSON.stringify(payload, null, 2);
}
