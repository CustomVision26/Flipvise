"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  aiImproveDocumentationAction,
  clearDocumentationOverrideAction,
  saveDocumentationOverrideAction,
} from "@/actions/documentation-admin";
import type { DocumentationAudience, DocumentationContentKind } from "@/db/queries/documentation-overrides";
import {
  docArticlePayloadSchema,
  docPagePayloadSchema,
  type DocArticlePayload,
  type DocPagePayload,
} from "@/lib/documentation-payload-schemas";
import type { DocPage } from "@/lib/documentation-content-types";
import type { DocArticle } from "@/lib/user-documentation-article-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Loader2, Sparkles } from "lucide-react";

export type DocumentationEditTarget =
  | {
      kind: "quick_reference_page";
      audience: DocumentationAudience;
      page: DocPage;
    }
  | {
      kind: "in_depth_article";
      audience: DocumentationAudience;
      page: DocPage;
      article: DocArticle;
    };

function linesToArray(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function arrayToLines(value: string[]): string {
  return value.join("\n");
}

type DocumentationEditSheetProps = {
  target: DocumentationEditTarget | null;
  onClose: () => void;
  onSaved: () => void;
};

export function DocumentationEditSheet({
  target,
  onClose,
  onSaved,
}: DocumentationEditSheetProps) {
  const open = target != null;
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [instruction, setInstruction] = useState(
    "Improve clarity and scannability while keeping all facts accurate.",
  );

  const [pageDraft, setPageDraft] = useState<DocPagePayload | null>(null);
  const [articleDraft, setArticleDraft] = useState<DocArticlePayload | null>(null);
  const [sectionsJson, setSectionsJson] = useState("");
  const [sectionsError, setSectionsError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) {
      setPageDraft(null);
      setArticleDraft(null);
      setSectionsJson("");
      setSectionsError(null);
      return;
    }

    if (target.kind === "quick_reference_page") {
      const { page } = target;
      setPageDraft({
        id: page.id,
        title: page.title,
        route: page.route,
        clerkTab: page.clerkTab,
        purpose: page.purpose,
        howItWorks: [...page.howItWorks],
        requirements: [...page.requirements],
        doNots: [...page.doNots],
      });
      setArticleDraft(null);
      setSectionsJson("");
      return;
    }

    const { article } = target;
    setArticleDraft({
      pageId: article.pageId,
      title: article.title,
      intro: article.intro,
      sections: article.sections,
    });
    setSectionsJson(JSON.stringify(article.sections, null, 2));
    setPageDraft(null);
    setSectionsError(null);
  }, [target]);

  const parseArticleSections = useCallback((): DocArticlePayload | null => {
    if (!articleDraft) return null;
    let sections = articleDraft.sections;
    try {
      sections = JSON.parse(sectionsJson) as DocArticlePayload["sections"];
      setSectionsError(null);
    } catch {
      setSectionsError("Sections must be valid JSON.");
      return null;
    }

    const payload = {
      pageId: articleDraft.pageId,
      title: articleDraft.title,
      intro: articleDraft.intro,
      sections,
    };
    const parsed = docArticlePayloadSchema.safeParse(payload);
    if (!parsed.success) {
      setSectionsError(parsed.error.issues[0]?.message ?? "Invalid article structure.");
      return null;
    }
    return parsed.data;
  }, [articleDraft, sectionsJson]);

  const handleSave = async () => {
    if (!target) return;
    setSaving(true);
    try {
      if (target.kind === "quick_reference_page") {
        if (!pageDraft) return;
        const parsed = docPagePayloadSchema.safeParse(pageDraft);
        if (!parsed.success) {
          toast.error(parsed.error.issues[0]?.message ?? "Invalid page content.");
          return;
        }
        await saveDocumentationOverrideAction({
          audience: target.audience,
          contentKind: "quick_reference_page",
          pageId: target.page.id,
          payload: parsed.data,
        });
      } else {
        const payload = parseArticleSections();
        if (!payload) return;
        await saveDocumentationOverrideAction({
          audience: target.audience,
          contentKind: "in_depth_article",
          pageId: target.page.id,
          payload,
        });
      }
      toast.success("Documentation saved.");
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!target) return;
    setSaving(true);
    try {
      const contentKind: DocumentationContentKind =
        target.kind === "quick_reference_page" ? "quick_reference_page" : "in_depth_article";
      await clearDocumentationOverrideAction({
        audience: target.audience,
        contentKind,
        pageId: target.page.id,
      });
      toast.success("Reverted to built-in documentation.");
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Reset failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleAiImprove = async () => {
    if (!target) return;
    setAiLoading(true);
    try {
      let currentPayload: DocPagePayload | DocArticlePayload;
      if (target.kind === "quick_reference_page") {
        if (!pageDraft) return;
        const parsed = docPagePayloadSchema.safeParse(pageDraft);
        if (!parsed.success) {
          toast.error("Fix validation errors before using AI.");
          return;
        }
        currentPayload = parsed.data;
      } else {
        const payload = parseArticleSections();
        if (!payload) return;
        currentPayload = payload;
      }

      const improved = await aiImproveDocumentationAction({
        audience: target.audience,
        contentKind: target.kind,
        instruction,
        payload: currentPayload,
      });

      if (target.kind === "quick_reference_page") {
        setPageDraft(improved as DocPagePayload);
      } else {
        const article = improved as DocArticlePayload;
        setArticleDraft(article);
        setSectionsJson(JSON.stringify(article.sections, null, 2));
      }
      toast.success("AI suggestion applied — review and save when ready.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI improvement failed.");
    } finally {
      setAiLoading(false);
    }
  };

  const title =
    target?.kind === "quick_reference_page"
      ? `Edit quick reference · ${target.page.title}`
      : target?.kind === "in_depth_article"
        ? `Edit in-depth guide · ${target.page.title}`
        : "Edit documentation";

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            Changes are stored as overrides and appear on /docs and this admin preview. Built-in
            source files are not modified.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-1 py-4">
          <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
            <Label htmlFor="doc-ai-instruction">AI instruction</Label>
            <Textarea
              id="doc-ai-instruction"
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              rows={3}
              className="resize-y"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={aiLoading || saving}
              onClick={handleAiImprove}
              className="gap-2"
            >
              {aiLoading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="size-4" aria-hidden />
              )}
              Improve with AI
            </Button>
          </div>

          {target?.kind === "quick_reference_page" && pageDraft ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="doc-page-title">Title</Label>
                <Input
                  id="doc-page-title"
                  value={pageDraft.title}
                  onChange={(event) =>
                    setPageDraft((prev) => (prev ? { ...prev, title: event.target.value } : prev))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="doc-page-route">Route (optional)</Label>
                <Input
                  id="doc-page-route"
                  value={pageDraft.route ?? ""}
                  onChange={(event) =>
                    setPageDraft((prev) =>
                      prev ? { ...prev, route: event.target.value || undefined } : prev,
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="doc-page-purpose">Purpose</Label>
                <Textarea
                  id="doc-page-purpose"
                  value={pageDraft.purpose}
                  onChange={(event) =>
                    setPageDraft((prev) =>
                      prev ? { ...prev, purpose: event.target.value } : prev,
                    )
                  }
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="doc-page-how">How it works (one item per line)</Label>
                <Textarea
                  id="doc-page-how"
                  value={arrayToLines(pageDraft.howItWorks)}
                  onChange={(event) =>
                    setPageDraft((prev) =>
                      prev ? { ...prev, howItWorks: linesToArray(event.target.value) } : prev,
                    )
                  }
                  rows={5}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="doc-page-req">Requirements (one item per line)</Label>
                <Textarea
                  id="doc-page-req"
                  value={arrayToLines(pageDraft.requirements)}
                  onChange={(event) =>
                    setPageDraft((prev) =>
                      prev ? { ...prev, requirements: linesToArray(event.target.value) } : prev,
                    )
                  }
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="doc-page-dont">Do not (one item per line)</Label>
                <Textarea
                  id="doc-page-dont"
                  value={arrayToLines(pageDraft.doNots)}
                  onChange={(event) =>
                    setPageDraft((prev) =>
                      prev ? { ...prev, doNots: linesToArray(event.target.value) } : prev,
                    )
                  }
                  rows={4}
                />
              </div>
            </div>
          ) : null}

          {target?.kind === "in_depth_article" && articleDraft ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="doc-article-title">Title</Label>
                <Input
                  id="doc-article-title"
                  value={articleDraft.title}
                  onChange={(event) =>
                    setArticleDraft((prev) =>
                      prev ? { ...prev, title: event.target.value } : prev,
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="doc-article-intro">Intro</Label>
                <Textarea
                  id="doc-article-intro"
                  value={articleDraft.intro}
                  onChange={(event) =>
                    setArticleDraft((prev) =>
                      prev ? { ...prev, intro: event.target.value } : prev,
                    )
                  }
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="doc-article-sections">Sections (JSON)</Label>
                <Textarea
                  id="doc-article-sections"
                  value={sectionsJson}
                  onChange={(event) => setSectionsJson(event.target.value)}
                  rows={14}
                  className="font-mono text-xs"
                />
                {sectionsError ? (
                  <p className="text-xs text-destructive">{sectionsError}</p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <SheetFooter className="flex-col gap-2 sm:flex-col">
          <Button type="button" onClick={handleSave} disabled={saving || aiLoading}>
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Save override
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            disabled={saving || aiLoading}
          >
            Revert to built-in
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
