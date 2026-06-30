import { ADMIN_DOCUMENTATION_SECTIONS } from "@/data/admin-documentation";
import {
  ADMIN_DOCUMENTATION_ARTICLES_BY_PAGE_ID,
} from "@/data/admin-documentation-articles";
import { USER_DOCUMENTATION_SECTIONS } from "@/data/user-documentation";
import {
  USER_DOCUMENTATION_ARTICLES_BY_PAGE_ID,
} from "@/data/user-documentation-articles";
import {
  listDocumentationOverrides,
  type DocumentationAudience,
  type DocumentationContentKind,
} from "@/db/queries/documentation-overrides";
import type { DocPage, DocSection } from "@/lib/documentation-content-types";
import type { DocArticle } from "@/lib/user-documentation-article-types";
import {
  docArticlePayloadSchema,
  docPagePayloadSchema,
  pageAdditionPayloadSchema,
  pageRemovalPayloadSchema,
  sectionAdditionPayloadSchema,
  sectionMetadataPayloadSchema,
  type PageAdditionPayload,
  type SectionMetadataPayload,
} from "@/lib/documentation-payload-schemas";

export type EffectiveDocumentationContent = {
  sections: DocSection[];
  articlesByPageId: Record<string, DocArticle>;
  articleCount: number;
};

function mergeDocPage(base: DocPage, override: DocPage | undefined): DocPage {
  if (!override) return base;
  return { ...base, ...override, id: base.id };
}

function insertPageInSection(
  pages: DocPage[],
  addition: PageAdditionPayload,
): DocPage[] {
  const next = [...pages, addition.page];
  if (!addition.insertAfterPageId) return next;
  const without = pages.filter((page) => page.id !== addition.page.id);
  const index = without.findIndex((page) => page.id === addition.insertAfterPageId);
  if (index < 0) return [...without, addition.page];
  const ordered = [...without];
  ordered.splice(index + 1, 0, addition.page);
  return ordered;
}

function applySectionMetadata(
  section: DocSection,
  metadata: SectionMetadataPayload | undefined,
): DocSection {
  if (!metadata) return section;
  return {
    ...section,
    id: section.id,
    title: metadata.title,
    description: metadata.description,
  };
}

function applyRowsToDocumentation(
  audience: DocumentationAudience,
  baseSections: DocSection[],
  baseArticles: Readonly<Record<string, DocArticle>>,
  rows: Awaited<ReturnType<typeof listDocumentationOverrides>>,
): EffectiveDocumentationContent {
  const pageOverrides = new Map<string, DocPage>();
  const articleOverrides = new Map<string, DocArticle>();
  const pageAdditions = new Map<string, PageAdditionPayload>();
  const pageRemovals = new Set<string>();
  const sectionAdditions: DocSection[] = [];
  const sectionMetadata = new Map<string, SectionMetadataPayload>();

  for (const row of rows) {
    switch (row.contentKind as DocumentationContentKind) {
      case "quick_reference_page": {
        const page = docPagePayloadSchema.safeParse(row.payload);
        if (page.success) pageOverrides.set(row.pageId, page.data);
        break;
      }
      case "in_depth_article": {
        const article = docArticlePayloadSchema.safeParse(row.payload);
        if (article.success) articleOverrides.set(row.pageId, article.data);
        break;
      }
      case "page_addition": {
        const addition = pageAdditionPayloadSchema.safeParse(row.payload);
        if (addition.success) pageAdditions.set(row.pageId, addition.data);
        break;
      }
      case "page_removal": {
        pageRemovalPayloadSchema.safeParse(row.payload);
        pageRemovals.add(row.pageId);
        break;
      }
      case "section_addition": {
        const addition = sectionAdditionPayloadSchema.safeParse(row.payload);
        if (addition.success) sectionAdditions.push(addition.data.section);
        break;
      }
      case "section_metadata": {
        const metadata = sectionMetadataPayloadSchema.safeParse(row.payload);
        if (metadata.success) sectionMetadata.set(row.pageId, metadata.data);
        break;
      }
      default:
        break;
    }
  }

  const sections = baseSections.map((section) => {
    const withMeta = applySectionMetadata(section, sectionMetadata.get(section.id));
    let pages = withMeta.pages
      .filter((page) => !pageRemovals.has(page.id))
      .map((page) => mergeDocPage(page, pageOverrides.get(page.id)));

    for (const addition of pageAdditions.values()) {
      if (addition.sectionId !== section.id) continue;
      if (pages.some((page) => page.id === addition.page.id)) {
        pages = pages.map((page) =>
          page.id === addition.page.id ? mergeDocPage(page, addition.page) : page,
        );
      } else {
        pages = insertPageInSection(pages, addition);
      }
    }

    return { ...withMeta, pages };
  });

  for (const addedSection of sectionAdditions) {
    const withMeta = applySectionMetadata(addedSection, sectionMetadata.get(addedSection.id));
    const pages = withMeta.pages
      .filter((page) => !pageRemovals.has(page.id))
      .map((page) => mergeDocPage(page, pageOverrides.get(page.id)));
    if (!sections.some((section) => section.id === withMeta.id)) {
      sections.push({ ...withMeta, pages });
    }
  }

  const articlesByPageId: Record<string, DocArticle> = { ...baseArticles };
  for (const [pageId, article] of articleOverrides) {
    articlesByPageId[pageId] = article;
  }

  return {
    sections,
    articlesByPageId,
    articleCount: Object.keys(articlesByPageId).length,
  };
}

async function buildEffectiveContent(
  audience: DocumentationAudience,
  baseSections: DocSection[],
  baseArticles: Readonly<Record<string, DocArticle>>,
): Promise<EffectiveDocumentationContent> {
  const rows = await listDocumentationOverrides(audience);
  return applyRowsToDocumentation(audience, baseSections, baseArticles, rows);
}

export async function getEffectiveUserDocumentationContent(): Promise<EffectiveDocumentationContent> {
  return buildEffectiveContent(
    "user",
    USER_DOCUMENTATION_SECTIONS,
    USER_DOCUMENTATION_ARTICLES_BY_PAGE_ID,
  );
}

export async function getEffectiveAdminDocumentationContent(): Promise<EffectiveDocumentationContent> {
  return buildEffectiveContent(
    "admin",
    ADMIN_DOCUMENTATION_SECTIONS,
    ADMIN_DOCUMENTATION_ARTICLES_BY_PAGE_ID,
  );
}
