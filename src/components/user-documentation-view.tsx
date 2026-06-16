"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  USER_DOCUMENTATION_SECTIONS,
  type DocPage,
  type DocSection,
} from "@/data/user-documentation";
import {
  getUserDocumentationArticle,
  hasUserDocumentationArticle,
  USER_DOCUMENTATION_ARTICLE_COUNT,
} from "@/data/user-documentation-articles";
import { DocumentationSearchPanel } from "@/components/documentation-search-panel";
import {
  docArticleHash,
  parseDocArticleHash,
  type DocArticle,
  type DocArticleSection,
} from "@/lib/user-documentation-article-types";
import { PublicPageIntro } from "@/components/public-page-intro";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { buttonVariants } from "@/components/ui/button-variants";
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
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
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

function resolveDocPageById(pageId: string): { section: DocSection; page: DocPage } | null {
  for (const section of USER_DOCUMENTATION_SECTIONS) {
    const page = section.pages.find((p) => p.id === pageId);
    if (page) return { section, page };
  }
  return null;
}

function resolveDocTarget(id: string): DocTarget | null {
  if (!id) return null;

  const articlePageId = parseDocArticleHash(id);
  if (articlePageId) {
    const resolved = resolveDocPageById(articlePageId);
    const article = getUserDocumentationArticle(articlePageId);
    if (resolved && article) {
      return {
        type: "article",
        section: resolved.section,
        page: resolved.page,
        article,
      };
    }
    return null;
  }

  const resolved = resolveDocPageById(id);
  if (resolved) return { type: "page", ...resolved };

  const section = USER_DOCUMENTATION_SECTIONS.find((s) => s.id === id);
  if (!section) return null;

  if (section.pages.length === 1) {
    return { type: "page", section, page: section.pages[0] };
  }

  return { type: "section", section };
}

function DocPagePanel({
  page,
  onOpenArticle,
}: {
  page: DocPage;
  onOpenArticle?: (pageId: string) => void;
}) {
  const locationLabel = page.route
    ? page.route
    : page.clerkTab
      ? `Account menu → ${page.clerkTab}`
      : null;
  const showArticleLink = hasUserDocumentationArticle(page.id);

  return (
    <div className="space-y-5 text-sm leading-relaxed">
      {locationLabel ? (
        <p className="inline-flex rounded-md border border-border/60 bg-muted/30 px-2.5 py-1 font-mono text-xs text-muted-foreground">
          {locationLabel}
        </p>
      ) : null}

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
                  <th
                    key={header}
                    className="px-3 py-2 font-medium text-foreground whitespace-nowrap"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.table.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-border/40 last:border-0">
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className="px-3 py-2 align-top text-muted-foreground"
                    >
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
}: {
  section: DocSection;
  page: DocPage;
  article: DocArticle;
  onSelect: (id: string) => void;
}) {
  const showSectionBack = section.pages.length > 1;

  return (
    <Card className="border-primary/20 bg-card/50 shadow-none ring-1 ring-primary/15">
      <CardHeader className="gap-2 border-b border-border/50 pb-4">
        <button
          type="button"
          onClick={() => onSelect(page.id)}
          className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" aria-hidden />
          {showSectionBack ? `${section.title} · Quick reference` : "Quick reference"}
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
            <BookOpen className="size-3" aria-hidden />
            In-depth guide
          </span>
        </div>
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

function PageLocationMeta({ page }: { page: DocPage }) {
  if (page.route) {
    return (
      <p className="font-mono text-xs text-muted-foreground">{page.route}</p>
    );
  }
  if (page.clerkTab) {
    return (
      <p className="text-xs text-muted-foreground">
        Account menu → {page.clerkTab}
      </p>
    );
  }
  return null;
}

function DocContentSkeleton() {
  return (
    <Card className="border-border/70 bg-card/50 shadow-none ring-1 ring-border/40">
      <CardHeader className="gap-2 border-b border-border/50 pb-4">
        <Skeleton className="h-6 w-48 bg-muted/40" />
        <Skeleton className="h-4 w-full max-w-md bg-muted/30" />
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        <Skeleton className="h-4 w-full bg-muted/30" />
        <Skeleton className="h-4 w-5/6 bg-muted/30" />
        <Skeleton className="h-32 w-full bg-muted/20" />
      </CardContent>
    </Card>
  );
}

function PlanLimitsCard() {
  const tiers = [
    { name: "Free", decks: "2 decks", cards: "5 cards / deck" },
    { name: "Pro", decks: "10 decks", cards: "30 cards / deck" },
    {
      name: "Pro Plus / team",
      decks: "15 decks",
      cards: "52 cards / deck",
    },
  ] as const;

  return (
    <Card className="border-primary/20 bg-primary/5 shadow-none ring-1 ring-primary/15">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">
          Quick plan limits (personal)
        </CardTitle>
        <CardDescription>
          Deck and card caps for individual workspaces.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-border/60">
          {tiers.map((tier) => (
            <div key={tier.name} className="space-y-1 px-0 sm:px-4 sm:first:pl-0 sm:last:pr-0">
              <p className="text-sm font-medium text-foreground">{tier.name}</p>
              <p className="text-sm text-muted-foreground">{tier.decks}</p>
              <p className="text-xs text-muted-foreground">{tier.cards}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function NeedHelpCard({ onSelect }: { onSelect: (id: string) => void }) {
  return (
    <Card className="border-border/70 bg-card/50 shadow-none ring-1 ring-border/40">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Need help?</CardTitle>
        <CardDescription>
          Start a live chat on Contact Us, browse categorized tickets in the Help Center when
          signed in, or read the guides below.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Link
          href="/contact"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Contact Us (live chat)
        </Link>
        <button
          type="button"
          className={buttonVariants({ variant: "outline", size: "sm" })}
          onClick={() => onSelect("contact-us-page")}
        >
          Contact Us guide
        </button>
        <button
          type="button"
          className={buttonVariants({ variant: "outline", size: "sm" })}
          onClick={() => onSelect("help-center-overview")}
        >
          Help Center guide
        </button>
      </CardContent>
    </Card>
  );
}

type DocumentationTocProps = {
  activeId: string | null;
  onSelect: (id: string) => void;
};

function isDocPageActive(pageId: string, activeId: string | null): boolean {
  if (!activeId) return false;
  if (activeId === pageId) return true;
  return parseDocArticleHash(activeId) === pageId;
}

function DocumentationToc({ activeId, onSelect }: DocumentationTocProps) {
  const openArticle = (pageId: string) => onSelect(docArticleHash(pageId));

  return (
    <nav aria-label="Documentation sections" className="space-y-5">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        On this page
      </p>
      <div className="space-y-4">
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

        {USER_DOCUMENTATION_SECTIONS.map((section) => {
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
                      {hasUserDocumentationArticle(page.id) ? (
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
      </div>
    </nav>
  );
}

type DocContentPanelProps = {
  target: DocTarget;
  onSelect: (id: string) => void;
};

function DocContentPanel({ target, onSelect }: DocContentPanelProps) {
  const openArticle = (pageId: string) => onSelect(docArticleHash(pageId));

  if (target.type === "overview") {
    return (
      <div className="space-y-6">
        <PlanLimitsCard />
        <Card className="border-border/70 bg-card/50 shadow-none ring-1 ring-border/40">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Browse the guide</CardTitle>
            <CardDescription>
              Pick a section from the sidebar for a quick reference on each screen. Every topic
              also has a standalone in-depth guide with detailed explanations, tables, and
              workflows — open via Read in-depth guide or the sidebar In-depth guide link.
            </CardDescription>
          </CardHeader>
        </Card>
        <NeedHelpCard onSelect={onSelect} />
      </div>
    );
  }

  if (target.type === "article") {
    return (
      <DocArticlePanel
        section={target.section}
        page={target.page}
        article={target.article}
        onSelect={onSelect}
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
              <AccordionItem
                key={page.id}
                value={page.id}
                className="border-border/50 px-1"
              >
                <AccordionTrigger className="rounded-md px-2 py-3 text-foreground hover:bg-muted/30 hover:no-underline">
                  <span className="flex min-w-0 flex-col items-start gap-1 text-left">
                    <span className="font-medium">{page.title}</span>
                    <PageLocationMeta page={page} />
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-2 pb-4">
                  <DocPagePanel page={page} onOpenArticle={openArticle} />
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
        <DocPagePanel page={page} onOpenArticle={openArticle} />
      </CardContent>
    </Card>
  );
}

export function UserDocumentationView() {
  const mounted = useClientMounted();
  const [activeId, setActiveId] = useState<string | null>(null);

  const selectTarget = useCallback((id: string) => {
    const nextId = id || null;
    setActiveId(nextId);
    const hash = nextId ? `#${nextId}` : "";
    window.history.replaceState(null, "", `${window.location.pathname}${hash}`);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const syncFromHash = () => {
      const id = hashFromLocation();
      setActiveId(id || null);
    };

    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, [mounted]);

  const target = useMemo((): DocTarget => {
    if (!activeId) return { type: "overview" };
    return resolveDocTarget(activeId) ?? { type: "overview" };
  }, [activeId]);

  const topicCount = useMemo(
    () =>
      USER_DOCUMENTATION_SECTIONS.reduce((count, section) => count + section.pages.length, 0),
    [],
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-10">
      <PublicPageIntro
        badge="User guide"
        title="Flipvise Documentation"
        description="Quick reference and in-depth guides for every customer-facing screen — purpose, workflows, plan requirements, and restrictions."
      />

      {mounted ? (
        <DocumentationSearchPanel
          sections={USER_DOCUMENTATION_SECTIONS}
          getArticle={getUserDocumentationArticle}
          onNavigate={selectTarget}
        />
      ) : (
        <Skeleton className="h-11 w-full rounded-md bg-muted/30" />
      )}

      <div className="grid items-start gap-8 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)] xl:gap-10">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div
            className={cn(
              "rounded-xl border border-border/70 bg-card/40 p-4 ring-1 ring-border/30",
              "max-h-[calc(100vh-6rem)] overflow-y-auto lg:p-5",
            )}
          >
            {mounted ? (
              <DocumentationToc activeId={activeId} onSelect={selectTarget} />
            ) : (
              <div className="space-y-3">
                <Skeleton className="h-4 w-24 bg-muted/40" />
                <Skeleton className="h-8 w-full bg-muted/30" />
                <Skeleton className="h-8 w-full bg-muted/30" />
                <Skeleton className="h-8 w-5/6 bg-muted/30" />
              </div>
            )}
          </div>
        </aside>

        <article className="min-w-0 space-y-6">
          {mounted ? (
            <DocContentPanel target={target} onSelect={selectTarget} />
          ) : (
            <DocContentSkeleton />
          )}

          {mounted && target.type !== "overview" ? (
            <p className="pb-4 text-center text-xs text-muted-foreground">
              {topicCount} quick references · {USER_DOCUMENTATION_ARTICLE_COUNT} in-depth guides ·
              Updated for the current Flipvise UI
            </p>
          ) : null}
        </article>
      </div>
    </div>
  );
}
