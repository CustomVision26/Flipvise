"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  deleteEssayDocumentAction,
  getEssayDocumentPdfDataAction,
  renameEssayDocumentAction,
} from "@/actions/essay";
import { essayTypeLabel } from "@/lib/essay-ai-schema";
import { downloadEssayDocumentDocx } from "@/lib/essay-document-docx";
import { downloadEssayDocumentPdf } from "@/lib/essay-prompt-pdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export type EssayDocumentListItem = {
  id: number;
  title: string;
  subject: string;
  gradeLevel: string;
  essayType: string;
};

type EssayDocumentsListProps = {
  documents: EssayDocumentListItem[];
};

export function EssayDocumentsList({ documents }: EssayDocumentsListProps) {
  const router = useRouter();
  const [renameId, setRenameId] = React.useState<number | null>(null);
  const [renameTitle, setRenameTitle] = React.useState("");
  const [renamePending, setRenamePending] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<number | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);
  const [pdfId, setPdfId] = React.useState<number | null>(null);
  const [docxId, setDocxId] = React.useState<number | null>(null);

  const renameDoc = documents.find((d) => d.id === renameId) ?? null;
  const deleteDoc = documents.find((d) => d.id === deleteId) ?? null;

  function openEssay(documentId: number) {
    router.push(`/dashboard/ai-doc-studio/ai-essay/${documentId}?edit=1`);
  }

  function openRename(doc: EssayDocumentListItem) {
    setRenameTitle(doc.title);
    setRenameId(doc.id);
  }

  async function handleRename(event: React.FormEvent) {
    event.preventDefault();
    if (renameId == null) return;
    const title = renameTitle.trim();
    if (!title) {
      toast.error("Enter a title for this essay.");
      return;
    }
    setRenamePending(true);
    try {
      await renameEssayDocumentAction({ documentId: renameId, title });
      toast.success("Essay renamed");
      setRenameId(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not rename essay");
    } finally {
      setRenamePending(false);
    }
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
      await downloadEssayDocumentPdf(payload);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open PDF");
    } finally {
      setPdfId(null);
    }
  }

  async function handleDownloadDocx(documentId: number) {
    setDocxId(documentId);
    try {
      const payload = await getEssayDocumentPdfDataAction({ documentId });
      downloadEssayDocumentDocx(payload);
      toast.success("Word document ready");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not download Word document",
      );
    } finally {
      setDocxId(null);
    }
  }

  if (documents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No essays yet.{" "}
        <button
          type="button"
          className="underline"
          onClick={() => router.push("/dashboard/ai-doc-studio/ai-essay/generate")}
        >
          Generate one
        </button>
        .
      </p>
    );
  }

  return (
    <>
      <ul className="space-y-2">
        {documents.map((doc) => (
          <li key={doc.id}>
            <div
              role="link"
              tabIndex={0}
              onDoubleClick={() => openEssay(doc.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openEssay(doc.id);
                }
              }}
              className="flex flex-col gap-3 rounded-md border border-border/60 px-3 py-3 text-sm transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">{doc.title}</p>
                <p className="text-muted-foreground">
                  {doc.subject} · {doc.gradeLevel} ·{" "}
                  {essayTypeLabel(doc.essayType)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={pdfId === doc.id || docxId === doc.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleViewPdf(doc.id);
                  }}
                >
                  {pdfId === doc.id ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Download className="size-3.5" aria-hidden />
                  )}
                  View in PDF
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={pdfId === doc.id || docxId === doc.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDownloadDocx(doc.id);
                  }}
                >
                  {docxId === doc.id ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Download className="size-3.5" aria-hidden />
                  )}
                  Download DOCX
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    openRename(doc);
                  }}
                >
                  <Pencil className="size-3.5" aria-hidden />
                  Rename
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="gap-1.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEssay(doc.id);
                  }}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteId(doc.id);
                  }}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  Delete
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <Dialog
        open={renameId != null}
        onOpenChange={(open) => {
          if (!open && !renamePending) setRenameId(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename essay</DialogTitle>
            <DialogDescription>
              Update the title shown in My Essays and on the writing page.
            </DialogDescription>
          </DialogHeader>
          <form
            id="rename-essay-form"
            onSubmit={(e) => void handleRename(e)}
            className="space-y-3"
          >
            <div className="space-y-1.5">
              <Label htmlFor="rename-essay-title">Title</Label>
              <Input
                id="rename-essay-title"
                value={renameTitle}
                onChange={(e) => setRenameTitle(e.target.value)}
                maxLength={512}
                disabled={renamePending}
                autoFocus
                placeholder={renameDoc?.title ?? "Essay title"}
              />
            </div>
          </form>
          <DialogFooter>
            <DialogClose
              render={<Button variant="outline" type="button" />}
              disabled={renamePending}
            >
              Cancel
            </DialogClose>
            <Button
              type="submit"
              form="rename-essay-form"
              disabled={renamePending}
            >
              {renamePending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : (
                "Save title"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
