"use client";

import { useMemo, useState } from "react";
import { BookOpen, FileText, Search, X } from "lucide-react";
import type { DocSection } from "@/lib/documentation-content-types";
import type { DocArticle } from "@/lib/user-documentation-article-types";
import {
  searchDocumentation,
  type DocumentationSearchHit,
} from "@/lib/documentation-search";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DocumentationSearchPanelProps = {
  sections: DocSection[];
  getArticle: (pageId: string) => DocArticle | null;
  onNavigate: (targetHash: string) => void;
  className?: string;
  placeholder?: string;
};

function HitKindBadge({ kind }: { kind: DocumentationSearchHit["kind"] }) {
  if (kind === "in-depth") {
    return (
      <Badge
        variant="outline"
        className="shrink-0 gap-1 border-primary/30 bg-primary/10 text-[10px] text-primary"
      >
        <BookOpen className="size-2.5" aria-hidden />
        In-depth
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="shrink-0 gap-1 text-[10px]">
      <FileText className="size-2.5" aria-hidden />
      Quick ref
    </Badge>
  );
}

export function DocumentationSearchPanel({
  sections,
  getArticle,
  onNavigate,
  className,
  placeholder = "Search screens, features, routes, and guides…",
}: DocumentationSearchPanelProps) {
  const [query, setQuery] = useState("");

  const results = useMemo(
    () => searchDocumentation(sections, query, getArticle),
    [sections, query, getArticle],
  );

  const showResults = query.trim().length >= 2;

  function handleSelect(hit: DocumentationSearchHit) {
    onNavigate(hit.targetHash);
    setQuery("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && results[0]) {
      e.preventDefault();
      handleSelect(results[0]);
    }
    if (e.key === "Escape") {
      setQuery("");
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label="Search documentation"
          className="h-11 border-border/70 bg-card/60 pl-9 pr-10 text-sm shadow-sm backdrop-blur-sm"
        />
        {query ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 size-8 -translate-y-1/2 text-muted-foreground"
            onClick={() => setQuery("")}
            aria-label="Clear search"
          >
            <X className="size-4" aria-hidden />
          </Button>
        ) : null}
      </div>

      {showResults ? (
        <div
          className="overflow-hidden rounded-xl border border-border/70 bg-card/80 shadow-md ring-1 ring-border/30 backdrop-blur-sm"
          role="listbox"
          aria-label="Documentation search results"
        >
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No matches for &ldquo;{query.trim()}&rdquo;. Try a screen name, route, or feature
              (e.g. inbox, team admin, pricing).
            </p>
          ) : (
            <ul className="max-h-[min(24rem,50vh)] divide-y divide-border/50 overflow-y-auto">
              {results.map((hit) => (
                <li key={`${hit.targetHash}-${hit.kind}`}>
                  <button
                    type="button"
                    role="option"
                    className="flex w-full flex-col gap-1.5 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                    onClick={() => handleSelect(hit)}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{hit.pageTitle}</span>
                      <HitKindBadge kind={hit.kind} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {hit.sectionTitle}
                      {hit.routeLabel ? (
                        <>
                          <span aria-hidden> · </span>
                          <span className="font-mono">{hit.routeLabel}</span>
                        </>
                      ) : null}
                    </p>
                    <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                      {hit.snippet}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : query.trim().length === 1 ? (
        <p className="text-xs text-muted-foreground">Type at least 2 characters to search.</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Search quick references and in-depth guides for any customer-facing screen or admin tool.
        </p>
      )}
    </div>
  );
}
