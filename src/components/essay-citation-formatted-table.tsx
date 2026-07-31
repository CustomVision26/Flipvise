"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Pencil, Trash2 } from "lucide-react";
import {
  deleteEssayDocumentAction,
  getEssayDocumentPdfDataAction,
} from "@/actions/essay";
import { essayTypeLabel } from "@/lib/essay-ai-schema";
import { citationStyleDisplayLabel } from "@/lib/essay-model-citation-demo";
import type { EssayCitationStyle } from "@/lib/essay-builder-options";
import { downloadEssayDocumentPdf } from "@/lib/essay-prompt-pdf";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export type CitationFormattedEssayRow = {
  id: number;
  title: string;
  subject: string;
  gradeLevel: string;
  essayType: string;
  citationStyle: Exclude<EssayCitationStyle, "none">;
  savedAt: string | null;
};

type EssayCitationFormattedTableProps = {
  documents: CitationFormattedEssayRow[];
};

function formatSavedAt(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function EssayCitationFormattedTable({
  documents,
}: EssayCitationFormattedTableProps) {
  const router = useRouter();
  const [deleteId, setDeleteId] = React.useState<number | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);
  const [pdfId, setPdfId] = React.useState<number | null>(null);

  const deleteDoc = documents.find((d) => d.id === deleteId) ?? null;

  function openEdit(documentId: number) {
    router.push(
      `/dashboard/essay/citation-formatting?tab=format&essayId=${documentId}&edit=1`,
    );
  }

  async function handleDelete() {
    if (deleteId == null) return;
    setDeletePending(true);
    try {
      await deleteEssayDocumentAction({ documentId: deleteId });
      toast.success("Essay deleted");
      setDeleteId(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete essay");
    } finally {
      setDeletePending(false);
    }
  }

  async function handleViewPdf(documentId: number) {
    setPdfId(documentId);
    try {
      const payload = await getEssayDocumentPdfDataAction({ documentId });
      const snapshot =
        payload.documentStudio?.essayFormatting.formattedEssayPreview ?? null;
      if (snapshot) {
        await downloadEssayDocumentPdf({
          ...payload,
          title: snapshot.bodyTitle || payload.title,
          pdfMode: "writtenOnly",
          writtenSections: {},
          result: {
            ...payload.result,
            titlePage: snapshot.titlePageText,
            modelEssay: snapshot.bodyText,
            references: snapshot.references,
            referencesNote: snapshot.referencesNote,
            referencesAreSamples: false,
            sections: payload.result.sections.map((section) => ({
              ...section,
              generatedContent: "",
            })),
          },
        });
        return;
      }
      await downloadEssayDocumentPdf({
        ...payload,
        pdfMode: "writtenOnly",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open PDF");
    } finally {
      setPdfId(null);
    }
  }

  if (documents.length === 0) {
    return (
      <div className="rounded-lg border border-border/50 bg-muted/15 px-5 py-10 text-center">
        <p className="text-sm font-medium text-foreground">
          No formatted papers yet
        </p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          On the Format essay tab, apply a citation style and save the
          formatted preview to add a paper here.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-border/60">
        <div className="hidden border-b border-border/50 bg-muted/30 px-4 py-2.5 text-xs font-medium tracking-wide text-muted-foreground uppercase sm:grid sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)_auto] sm:gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.55fr)_minmax(0,0.55fr)_auto]">
          <span>Paper</span>
          <span className="hidden lg:inline">Citation</span>
          <span className="hidden lg:inline">Saved</span>
          <span className="text-right sm:col-start-2 lg:col-start-4">
            Actions
          </span>
        </div>

        <ul className="divide-y divide-border/50">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="px-4 py-4 transition-colors hover:bg-muted/20"
            >
              <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.55fr)_minmax(0,0.55fr)_auto] lg:items-center lg:gap-4">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-start gap-2">
                    <p className="text-sm font-medium leading-snug text-foreground">
                      {doc.title}
                    </p>
                    <Badge
                      variant="outline"
                      className="shrink-0 font-normal lg:hidden"
                    >
                      {citationStyleDisplayLabel(doc.citationStyle)}
                    </Badge>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {doc.subject} · {doc.gradeLevel} ·{" "}
                    {essayTypeLabel(doc.essayType)}
                  </p>
                  <p className="text-xs text-muted-foreground lg:hidden">
                    Saved {formatSavedAt(doc.savedAt)}
                  </p>
                </div>

                <div className="hidden lg:block">
                  <Badge variant="secondary" className="font-normal">
                    {citationStyleDisplayLabel(doc.citationStyle)}
                  </Badge>
                </div>

                <p className="hidden text-sm text-muted-foreground lg:block">
                  {formatSavedAt(doc.savedAt)}
                </p>

                <div className="flex flex-wrap items-center gap-2 lg:justify-end lg:whitespace-nowrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 whitespace-nowrap"
                    onClick={() => openEdit(doc.id)}
                  >
                    <Pencil className="size-3.5 shrink-0" aria-hidden />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 whitespace-nowrap text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setDeleteId(doc.id)}
                  >
                    <Trash2 className="size-3.5 shrink-0" aria-hidden />
                    Delete
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 whitespace-nowrap"
                    disabled={pdfId === doc.id}
                    onClick={() => void handleViewPdf(doc.id)}
                  >
                    {pdfId === doc.id ? (
                      <Loader2
                        className="size-3.5 shrink-0 animate-spin"
                        aria-hidden
                      />
                    ) : (
                      <Download className="size-3.5 shrink-0" aria-hidden />
                    )}
                    View in PDF
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <AlertDialog
        open={deleteId != null}
        onOpenChange={(open) => {
          if (!open && !deletePending) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete &ldquo;{deleteDoc?.title ?? "this essay"}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the essay, drafts, feedback, and any
              assignments. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deletePending}
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
            >
              {deletePending ? "Deleting…" : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
