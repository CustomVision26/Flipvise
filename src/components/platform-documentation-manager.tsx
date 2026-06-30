"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { getDocumentationContentAction } from "@/actions/documentation-admin";
import type { EffectiveDocumentationContent } from "@/lib/documentation-effective-content";
import type { DocumentationAudience } from "@/db/queries/documentation-overrides";
import type { DocPage } from "@/lib/documentation-content-types";
import type { DocArticle } from "@/lib/user-documentation-article-types";
import { AdminDocumentationView } from "@/components/admin-documentation-view";
import { UserDocumentationView } from "@/components/user-documentation-view";
import {
  DocumentationContentProvider,
  DocumentationEditProvider,
  type DocumentationContentValue,
} from "@/components/documentation-content-context";
import {
  DocumentationEditSheet,
  type DocumentationEditTarget,
} from "@/components/documentation-edit-sheet";
import { DocumentationAgentPanel } from "@/components/documentation-agent-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";

function toContentValue(
  audience: DocumentationAudience,
  content: EffectiveDocumentationContent,
): DocumentationContentValue {
  return {
    audience,
    sections: content.sections,
    articleCount: content.articleCount,
    getArticle: (pageId: string) => content.articlesByPageId[pageId] ?? null,
    hasArticle: (pageId: string) => pageId in content.articlesByPageId,
  };
}

export function PlatformDocumentationManager({ headerSlot }: { headerSlot?: ReactNode }) {
  const [tab, setTab] = useState<DocumentationAudience>("admin");
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adminContent, setAdminContent] = useState<EffectiveDocumentationContent | null>(null);
  const [userContent, setUserContent] = useState<EffectiveDocumentationContent | null>(null);
  const [editTarget, setEditTarget] = useState<DocumentationEditTarget | null>(null);

  const loadContent = useCallback(async () => {
    setLoading(true);
    try {
      const [admin, user] = await Promise.all([
        getDocumentationContentAction({ audience: "admin" }),
        getDocumentationContentAction({ audience: "user" }),
      ]);
      setAdminContent(admin);
      setUserContent(user);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadContent();
  }, [loadContent]);

  const activeContent = tab === "admin" ? adminContent : userContent;

  const contentValue = useMemo(
    () => (activeContent ? toContentValue(tab, activeContent) : null),
    [activeContent, tab],
  );

  const editValue = useMemo(() => {
    if (!editMode || !contentValue) return null;
    return {
      enabled: true,
      onEditPage: (page: DocPage) => {
        setEditTarget({
          kind: "quick_reference_page",
          audience: contentValue.audience,
          page,
        });
      },
      onEditArticle: ({ page, article }: { page: DocPage; article: DocArticle }) => {
        setEditTarget({
          kind: "in_depth_article",
          audience: contentValue.audience,
          page,
          article,
        });
      },
    };
  }, [contentValue, editMode]);

  return (
    <div className="space-y-4">
      {headerSlot}

      <DocumentationAgentPanel onApplied={() => void loadContent()} />

      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(value as DocumentationAudience);
          if (typeof window !== "undefined") {
            window.history.replaceState(null, "", window.location.pathname);
          }
        }}
        className="gap-4"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="admin">Admin documentation</TabsTrigger>
            <TabsTrigger value="user">User documentation</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/40 px-3 py-2">
            <Switch
              id="documentation-edit-mode"
              checked={editMode}
              onCheckedChange={setEditMode}
            />
            <Label htmlFor="documentation-edit-mode" className="text-sm text-foreground">
              Edit mode
            </Label>
          </div>
        </div>

        {loading || !contentValue ? (
          <Skeleton className="h-64 w-full bg-muted/30" />
        ) : (
          <DocumentationContentProvider value={contentValue}>
            <DocumentationEditProvider value={editValue}>
              <TabsContent value="admin" className="mt-0">
                {tab === "admin" ? <AdminDocumentationView embedded /> : null}
              </TabsContent>
              <TabsContent value="user" className="mt-0">
                {tab === "user" ? <UserDocumentationView embedded /> : null}
              </TabsContent>
            </DocumentationEditProvider>
          </DocumentationContentProvider>
        )}
      </Tabs>

      <DocumentationEditSheet
        target={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={() => void loadContent()}
      />
    </div>
  );
}
