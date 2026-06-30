"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ADMIN_DOCUMENTATION_SECTIONS } from "@/data/admin-documentation";
import {
  ADMIN_DOCUMENTATION_ARTICLE_COUNT,
  getAdminDocumentationArticle,
  hasAdminDocumentationArticle,
} from "@/data/admin-documentation-articles";
import { DocumentationSearchPanel } from "@/components/documentation-search-panel";
import { DocumentationMobileBack } from "@/components/documentation-mobile-back";
import type { DocPage, DocSection } from "@/lib/documentation-content-types";
import {
  docArticleHash,
  parseDocArticleHash,
  type DocArticle,
  type DocArticleSection,
} from "@/lib/user-documentation-article-types";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { buttonVariants } from "@/components/ui/button-variants";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useClientMounted } from "@/lib/use-client-mounted";
import { useDocumentationMobileNav, documentationContentPanelClass, documentationTocAsideClass } from "@/lib/use-documentation-mobile-nav";
import { cn } from "@/lib/utils";
import {
  useDocumentationContentOptional,
  useDocumentationEditOptional,
} from "@/components/documentation-content-context";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  Pencil,
  XCircle,
} from "lucide-react";

type DocTarget =
  | { type: "overview" }
  | { type: "section"; section: DocSection }
  | { type: "page"; section: DocSection; page: DocPage }
  | { type: "article"; section: DocSection; page: DocPage; article: DocArticle };

function hashFromLocation() {
  if (typeof window === "undefined") return "";
  return window.location.hash.replace(/^#/, "");
}

function resolveDocPageById(
  sections: DocSection[],
  pageId: string,
): { section: DocSection; page: DocPage } | null {
  for (const section of sections) {
    const page = section.pages.find((p) => p.id === pageId);
    if (page) return { section, page };
  }
  return null;
}

function resolveDocTarget(
  sections: DocSection[],
  getArticle: (pageId: string) => DocArticle | null,
  id: string,
): DocTarget | null {
  if (!id) return null;

  const articlePageId = parseDocArticleHash(id);
  if (articlePageId) {
    const resolved = resolveDocPageById(sections, articlePageId);
    const article = getArticle(articlePageId);
    if (resolved && article) {
      return { type: "article", ...resolved, article };
    }
    return null;
  }

  const resolved = resolveDocPageById(sections, id);
  if (resolved) return { type: "page", ...resolved };

  const section = sections.find((s) => s.id === id);
  if (!section) return null;
  if (section.pages.length === 1) {
    return { type: "page", section, page: section.pages[0] };
  }
  return { type: "section", section };
}

function isDocPageActive(pageId: string, activeId: string | null): boolean {
  if (!activeId) return false;
  if (activeId === pageId) return true;
  return parseDocArticleHash(activeId) === pageId;
}

function PageLocationMeta({ page }: { page: DocPage }) {
  if (page.route) {
    return <p className="font-mono text-xs text-muted-foreground">{page.route}</p>;
  }
  return null;
}

function DocPagePanel({
  page,
  onOpenArticle,
  hasArticle,
  onEditPage,
}: {
  page: DocPage;
  onOpenArticle?: (pageId: string) => void;
  hasArticle: (pageId: string) => boolean;
  onEditPage?: (page: DocPage) => void;
}) {
  const showArticleLink = hasArticle(page.id);

  return (
    <div className="space-y-5 text-sm leading-relaxed">
      {onEditPage ? (
        <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => onEditPage(page)}>
          <Pencil className="size-3.5" aria-hidden />
          Edit quick reference
        </Button>
      ) : null}
      <PageLocationMeta page={page} />
      {showArticleLink && onOpenArticle ? (
        <button
          type="button"
          onClick={() => onOpenArticle(page.id)}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "inline-flex h-9 items-center gap-2 border-primary/25 bg-primary/5 text-foreground hover:bg-primary/10",
          )}
        >
          <BookOpen className="size-3.5 text-primary" aria-hidden />
          Read in-depth guide
        </button>
      ) : null}
      <section className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground">
          Purpose
        </h4>
        <p className="text-muted-foreground">{page.purpose}</p>
      </section>
      <Separator className="bg-border/60" />
      <section className="space-y-2.5">
        <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-foreground">
          <CheckCircle2 className="size-3.5 text-primary" aria-hidden />
          How it works
        </h4>
        <ul className="space-y-2 text-muted-foreground">
          {page.howItWorks.map((item) => (
            <li key={item} className="flex gap-2.5">
              <span className="mt-2 size-1 shrink-0 rounded-full bg-primary/70" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>
      <Separator className="bg-border/60" />
      <section className="space-y-2.5">
        <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-foreground">
          <AlertCircle className="size-3.5 text-amber-400/90" aria-hidden />
          Requirements
        </h4>
        <ul className="space-y-2 text-muted-foreground">
          {page.requirements.map((item) => (
            <li key={item} className="flex gap-2.5">
              <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/50" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3.5">
        <h4 className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-destructive">
          <XCircle className="size-3.5" aria-hidden />
          Do not
        </h4>
        <ul className="space-y-2 text-destructive/85">
          {page.doNots.map((item) => (
            <li key={item} className="flex gap-2.5">
              <span className="mt-2 size-1 shrink-0 rounded-full bg-destructive/50" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function DocArticleSectionBody({ section }: { section: DocArticleSection }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold tracking-tight text-foreground">{section.title}</h3>
      {section.paragraphs?.map((paragraph) => (
        <p key={paragraph} className="text-muted-foreground">
          {paragraph}
        </p>
      ))}
      {section.bullets && section.bullets.length > 0 ? (
        <ul className="space-y-2 text-muted-foreground">
          {section.bullets.map((item) => (
            <li key={item} className="flex gap-2.5">
              <span className="mt-2 size-1 shrink-0 rounded-full bg-primary/70" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {section.table ? (
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full min-w-[20rem] text-left text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                {section.table.headers.map((header) => (
                  <th key={header} className="px-3 py-2 font-medium text-foreground whitespace-nowrap">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.table.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-border/40 last:border-0">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-3 py-2 align-top text-muted-foreground">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function DocArticlePanel({
  section,
  page,
  article,
  onSelect,
  onEditArticle,
}: {
  section: DocSection;
  page: DocPage;
  article: DocArticle;
  onSelect: (id: string) => void;
  onEditArticle?: (args: { page: DocPage; article: DocArticle }) => void;
}) {
  const showSectionBack = section.pages.length > 1;
  return (
    <Card className="border-primary/20 bg-card/50 shadow-none ring-1 ring-primary/15">
      <CardHeader className="gap-2 border-b border-border/50 pb-4">
        {onEditArticle ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit gap-2"
            onClick={() => onEditArticle({ page, article })}
          >
            <Pencil className="size-3.5" aria-hidden />
            Edit in-depth guide
          </Button>
        ) : null}
        <button
          type="button"
          onClick={() => onSelect(page.id)}
          className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" aria-hidden />
          {showSectionBack ? `${section.title} · Quick reference` : "Quick reference"}
        </button>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
          <BookOpen className="size-3" aria-hidden />
          In-depth guide
        </span>
        <CardTitle className="text-xl font-semibold sm:text-2xl">{article.title}</CardTitle>
        <PageLocationMeta page={page} />
        <CardDescription className="text-sm leading-relaxed">{article.intro}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8 pt-6">
        {article.sections.map((articleSection, index) => (
          <div key={articleSection.id} className="space-y-8">
            {index > 0 ? <Separator className="bg-border/60" /> : null}
            <DocArticleSectionBody section={articleSection} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function AdminDocToc({
  sections,
  hasArticle,
  activeId,
  onSelect,
}: {
  sections: DocSection[];
  hasArticle: (pageId: string) => boolean;
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  const openArticle = (pageId: string) => onSelect(docArticleHash(pageId));

  return (
    <nav aria-label="Admin documentation" className="space-y-4">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Topics
      </p>
      <button
        type="button"
        onClick={() => onSelect("")}
        className={cn(
          "block w-full rounded-md px-2 py-1.5 text-left text-sm font-medium transition-colors hover:bg-muted/40",
          !activeId && "bg-muted/60 text-foreground",
        )}
      >
        Overview
      </button>
      {sections.map((section) => {
        const sectionActive =
          activeId === section.id ||
          section.pages.some((page) => isDocPageActive(page.id, activeId));
        return (
          <div key={section.id} className="space-y-1.5">
            <button
              type="button"
              onClick={() => onSelect(section.id)}
              className={cn(
                "block w-full rounded-md px-2 py-1.5 text-left text-sm font-medium transition-colors hover:bg-muted/40",
                sectionActive && activeId === section.id && "bg-muted/60 text-foreground",
                sectionActive && activeId !== section.id && "text-foreground",
              )}
            >
              {section.title}
            </button>
            <ul className="space-y-0.5 border-l border-border/60 pl-3">
              {section.pages.map((page) => {
                const pageActive = isDocPageActive(page.id, activeId);
                const articleActive =
                  activeId != null && parseDocArticleHash(activeId) === page.id;
                return (
                  <li key={page.id} className="space-y-0.5">
                    <button
                      type="button"
                      onClick={() => onSelect(page.id)}
                      className={cn(
                        "block w-full rounded-md px-2 py-1 text-left text-xs leading-snug transition-colors hover:bg-muted/30 hover:text-foreground",
                        pageActive && !articleActive
                          ? "bg-primary/10 font-medium text-foreground"
                          : pageActive
                            ? "font-medium text-foreground"
                            : "text-muted-foreground",
                      )}
                    >
                      {page.title}
                    </button>
                    {hasArticle(page.id) ? (
                      <button
                        type="button"
                        onClick={() => openArticle(page.id)}
                        className={cn(
                          "flex w-full items-center gap-1 rounded-md px-2 py-0.5 text-left text-[10px] leading-snug transition-colors hover:bg-primary/10 hover:text-foreground",
                          articleActive
                            ? "bg-primary/15 font-medium text-primary"
                            : "text-muted-foreground/90",
                        )}
                      >
                        <BookOpen className="size-2.5 shrink-0" aria-hidden />
                        In-depth guide
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function AdminDocContentPanel({
  sections,
  hasArticle,
  target,
  onSelect,
  onEditPage,
  onEditArticle,
}: {
  sections: DocSection[];
  hasArticle: (pageId: string) => boolean;
  target: DocTarget;
  onSelect: (id: string) => void;
  onEditPage?: (page: DocPage) => void;
  onEditArticle?: (args: { page: DocPage; article: DocArticle }) => void;
}) {
  const openArticle = (pageId: string) => onSelect(docArticleHash(pageId));

  if (target.type === "overview") {
    return (
      <Card className="border-border/70 bg-card/50 shadow-none ring-1 ring-border/40">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Platform admin guide</CardTitle>
          <CardDescription>
            Quick references for every Admin Menu section, plus in-depth guides for workflows,
            billing, support, plans, and affiliates. Only platform administrators can view this
            documentation.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Pick a topic from the left sidebar. Use <strong className="text-foreground">Read
            in-depth guide</strong> on any page for detailed tables, role rules, and operational
            checklists.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (target.type === "article") {
    return (
      <DocArticlePanel
        section={target.section}
        page={target.page}
        article={target.article}
        onSelect={onSelect}
        onEditArticle={onEditArticle}
      />
    );
  }

  if (target.type === "section") {
    const { section } = target;
    return (
      <Card className="border-border/70 bg-card/50 shadow-none ring-1 ring-border/40">
        <CardHeader className="gap-1 border-b border-border/50 pb-4">
          <CardTitle className="text-lg font-semibold">{section.title}</CardTitle>
          <CardDescription>{section.description}</CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <Accordion className="gap-1">
            {section.pages.map((page) => (
              <AccordionItem key={page.id} value={page.id} className="border-border/50 px-1">
                <AccordionTrigger className="rounded-md px-2 py-3 text-foreground hover:bg-muted/30 hover:no-underline">
                  <span className="flex min-w-0 flex-col items-start gap-1 text-left">
                    <span className="font-medium">{page.title}</span>
                    <PageLocationMeta page={page} />
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-2 pb-4">
                  <DocPagePanel
                    page={page}
                    onOpenArticle={openArticle}
                    hasArticle={hasArticle}
                    onEditPage={onEditPage}
                  />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    );
  }

  const { section, page } = target;
  const showSectionBack = section.pages.length > 1;
  return (
    <Card className="border-border/70 bg-card/50 shadow-none ring-1 ring-border/40">
      <CardHeader className="gap-2 border-b border-border/50 pb-4">
        {showSectionBack ? (
          <button
            type="button"
            onClick={() => onSelect(section.id)}
            className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-3.5" aria-hidden />
            {section.title}
          </button>
        ) : (
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {section.title}
          </p>
        )}
        <CardTitle className="text-lg font-semibold">{page.title}</CardTitle>
        <PageLocationMeta page={page} />
      </CardHeader>
      <CardContent className="pt-5">
        <DocPagePanel
          page={page}
          onOpenArticle={openArticle}
          hasArticle={hasArticle}
          onEditPage={onEditPage}
        />
      </CardContent>
    </Card>
  );
}

export function AdminDocumentationView({
  headerSlot,
  embedded = false,
}: {
  headerSlot?: ReactNode;
  embedded?: boolean;
}) {
  const contentCtx = useDocumentationContentOptional();
  const editCtx = useDocumentationEditOptional();
  const sections = contentCtx?.sections ?? ADMIN_DOCUMENTATION_SECTIONS;
  const getArticle = contentCtx?.getArticle ?? getAdminDocumentationArticle;
  const hasArticle = contentCtx?.hasArticle ?? hasAdminDocumentationArticle;
  const articleCount = contentCtx?.articleCount ?? ADMIN_DOCUMENTATION_ARTICLE_COUNT;
  const onEditPage = editCtx?.enabled ? editCtx.onEditPage : undefined;
  const onEditArticle = editCtx?.enabled ? editCtx.onEditArticle : undefined;

  const mounted = useClientMounted();
  const [activeId, setActiveId] = useState<string | null>(null);

  const {
    mobileContentOpen,
    showMobileBack,
    openMobileContent,
    closeMobileContent,
  } = useDocumentationMobileNav({ mounted, activeId });

  const selectTarget = useCallback((id: string) => {
    const nextId = id || null;
    setActiveId(nextId);
    const hash = nextId ? `#${nextId}` : "";
    window.history.replaceState(null, "", `${window.location.pathname}${hash}`);
    openMobileContent();
  }, [openMobileContent]);

  useEffect(() => {
    if (!mounted) return;
    const syncFromHash = () => setActiveId(hashFromLocation() || null);
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, [mounted]);

  const target = useMemo((): DocTarget => {
    if (!activeId) return { type: "overview" };
    return resolveDocTarget(sections, getArticle, activeId) ?? { type: "overview" };
  }, [activeId, getArticle, sections]);

  const topicCount = useMemo(
    () => sections.reduce((n, s) => n + s.pages.length, 0),
    [sections],
  );

  return (
    <div className={cn("space-y-4", !embedded && "space-y-4")}>
      {headerSlot}
      {mounted ? (
        <DocumentationSearchPanel
          sections={sections}
          getArticle={getArticle}
          onNavigate={selectTarget}
          placeholder="Search admin screens, tools, and guides…"
        />
      ) : null}
      <div className="grid items-start gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <aside
          className={cn(
            "lg:sticky lg:top-4 lg:self-start",
            documentationTocAsideClass(mobileContentOpen, mounted),
          )}
        >
          <div className="max-h-[calc(100vh-8rem)] overflow-y-auto rounded-xl border border-border/70 bg-card/40 p-4 ring-1 ring-border/30">
            {mounted ? (
              <AdminDocToc
                sections={sections}
                hasArticle={hasArticle}
                activeId={activeId}
                onSelect={selectTarget}
              />
            ) : (
              <Skeleton className="h-40 w-full bg-muted/30" />
            )}
          </div>
        </aside>
        <div className={cn("min-w-0 space-y-4", documentationContentPanelClass(mobileContentOpen, mounted))}>
          {showMobileBack ? (
            <DocumentationMobileBack onClick={closeMobileContent} />
          ) : null}
          {mounted ? (
            <AdminDocContentPanel
              sections={sections}
              hasArticle={hasArticle}
              target={target}
              onSelect={selectTarget}
              onEditPage={onEditPage}
              onEditArticle={onEditArticle}
            />
          ) : (
            <Skeleton className="h-64 w-full bg-muted/30" />
          )}
          {mounted && target.type !== "overview" ? (
            <p className="text-center text-xs text-muted-foreground">
              {topicCount} quick references · {articleCount} in-depth guides
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
