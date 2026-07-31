"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { saveEssayFormattedPreviewAction } from "@/actions/essay";
import type { FormattedWrittenEssayPreviewModel } from "@/lib/essay-apa-student-paper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type EssayFormattedPaperPreviewProps = {
  preview: FormattedWrittenEssayPreviewModel;
  documentId: number;
  onPreviewChange?: (preview: FormattedWrittenEssayPreviewModel) => void;
  /** Open the preview textareas immediately (e.g. Formatted papers → Edit). */
  startInEditMode?: boolean;
};

/** Inline APA-style written essay preview (not a PDF). */
export function EssayFormattedPaperPreview({
  preview,
  documentId,
  onPreviewChange,
  startInEditMode = false,
}: EssayFormattedPaperPreviewProps) {
  const [editing, setEditing] = React.useState(startInEditMode);
  const [saving, setSaving] = React.useState(false);
  const [titlePageText, setTitlePageText] = React.useState(
    preview.titlePageLines.join("\n"),
  );
  const [bodyText, setBodyText] = React.useState(preview.paragraphs.join("\n\n"));
  const [referencesText, setReferencesText] = React.useState(
    preview.references.join("\n\n"),
  );

  React.useEffect(() => {
    setTitlePageText(preview.titlePageLines.join("\n"));
    setBodyText(preview.paragraphs.join("\n\n"));
    setReferencesText(preview.references.join("\n\n"));
  }, [preview]);

  async function handleSave() {
    setSaving(true);
    try {
      await saveEssayFormattedPreviewAction({
        documentId,
        bodyTitle: preview.bodyTitle,
        bodyText,
        titlePageText: titlePageText.trim() ? titlePageText : null,
        referencesText,
        referencesNote: preview.referencesNote,
      });
      const nextParagraphs = bodyText
        .split(/\n\s*\n/)
        .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
        .filter(Boolean);
      const nextTitlePage = titlePageText
        .split(/\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      const nextReferences = referencesText
        .split(/\n\s*\n/)
        .map((entry) => entry.replace(/\s*\n\s*/g, " ").trim())
        .filter(Boolean);
      onPreviewChange?.({
        ...preview,
        titlePageLines: nextTitlePage,
        paragraphs: nextParagraphs,
        references: nextReferences,
      });
      setEditing(false);
      toast.success("Saved to Formatted papers");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not save formatted preview",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-foreground">
            Formatted essay preview
          </p>
          <Badge variant="secondary">{preview.citationStyleLabel}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={saving}
            onClick={() => {
              if (editing) {
                setTitlePageText(preview.titlePageLines.join("\n"));
                setBodyText(preview.paragraphs.join("\n\n"));
                setReferencesText(preview.references.join("\n\n"));
                setEditing(false);
                return;
              }
              setEditing(true);
            }}
          >
            {editing ? "Cancel" : "Edit"}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              "Save"
            )}
          </Button>
        </div>
      </div>
      <ScrollArea className="h-[min(28rem,55vh)] rounded-lg border border-border/70 bg-background">
        <article
          className="mx-auto max-w-prose space-y-6 px-5 py-6 text-foreground sm:px-8"
          style={{ fontFamily: '"Times New Roman", Times, serif' }}
        >
          {editing ? (
            <div className="space-y-4">
              {preview.titlePageLines.length > 0 || titlePageText ? (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    Title page
                  </p>
                  <Textarea
                    value={titlePageText}
                    onChange={(e) => setTitlePageText(e.target.value)}
                    rows={6}
                    className="font-serif text-[15px] leading-relaxed"
                  />
                </div>
              ) : null}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  Essay body
                </p>
                <Textarea
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  rows={12}
                  className="min-h-48 font-serif text-[15px] leading-[2]"
                />
              </div>
              {(preview.references.length > 0 || referencesText) && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    {preview.referencesTitle} (blank line between entries)
                  </p>
                  <Textarea
                    value={referencesText}
                    onChange={(e) => setReferencesText(e.target.value)}
                    rows={8}
                    className="font-serif text-[15px] leading-[2]"
                  />
                </div>
              )}
            </div>
          ) : (
            <>
              {preview.titlePageLines.length > 0 ? (
                <header className="space-y-2 text-center text-[15px] leading-relaxed">
                  {preview.titlePageLines.map((line, index) => (
                    <p
                      key={`tp-${index}`}
                      className={
                        index === 0
                          ? "font-bold text-base leading-snug"
                          : undefined
                      }
                    >
                      {line}
                    </p>
                  ))}
                  <Separator className="my-4" />
                </header>
              ) : null}

              <div className="space-y-4 text-[15px] leading-[2]">
                <h2 className="text-center text-base font-bold leading-snug">
                  {preview.bodyTitle}
                </h2>
                {preview.paragraphs.length === 0 ? (
                  <p className="text-muted-foreground">
                    No written essay content is available for this document yet.
                  </p>
                ) : (
                  preview.paragraphs.map((paragraph, index) => (
                    <p
                      key={`p-${index}`}
                      className={
                        preview.indentFirstLine ? "indent-8" : undefined
                      }
                    >
                      {paragraph}
                    </p>
                  ))
                )}
              </div>

              {preview.references.length > 0 ? (
                <section className="space-y-3 pt-2">
                  <Separator />
                  {preview.referencesNote ? (
                    <p className="text-xs italic text-muted-foreground">
                      {preview.referencesNote}
                    </p>
                  ) : null}
                  <h3 className="text-center text-base font-bold">
                    {preview.referencesTitle}
                  </h3>
                  <ul className="space-y-3 text-[15px] leading-[2]">
                    {preview.references.map((entry, index) => (
                      <li key={`ref-${index}`} className="-indent-4 pl-4">
                        {entry}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          )}
        </article>
      </ScrollArea>
    </div>
  );
}
