"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Download, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  previewQuizResultSheetsForRowAction,
  saveQuizResultSheetsAction,
} from "@/actions/quiz-result-sheets";

export type QuizResultSheetsDialogRow = {
  resultId: number;
  teamId: number;
  workspacePlanSlug: string;
  deckName: string;
  memberLabel: string;
  memberEmail: string | null;
};

type SheetPreview = {
  deckName: string;
  questionCount: number;
  questionSheetPdfBase64: string;
  answerKeyPdfBase64: string;
  canSave: boolean;
};

function base64ToBlobUrl(base64: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: "application/pdf" });
  return URL.createObjectURL(blob);
}

function PdfPreviewFrame({ base64, title }: { base64: string; title: string }) {
  const src = useMemo(() => base64ToBlobUrl(base64), [base64]);

  useEffect(() => {
    return () => URL.revokeObjectURL(src);
  }, [src]);

  return (
    <iframe
      title={title}
      src={src}
      className="h-[calc(92vh-13rem)] min-h-[560px] w-full rounded-lg border border-border/70 bg-background"
    />
  );
}

function downloadBase64Pdf(base64: string, fileName: string) {
  const link = document.createElement("a");
  link.href = base64ToBlobUrl(base64);
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export function QuizResultSheetsDialog({
  open,
  onOpenChange,
  row,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: QuizResultSheetsDialogRow | null;
}) {
  const [preview, setPreview] = useState<SheetPreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingPreview, startPreviewTransition] = useTransition();
  const [saving, startSaveTransition] = useTransition();

  useEffect(() => {
    if (!open || !row) {
      setPreview(null);
      setLoadError(null);
      return;
    }

    startPreviewTransition(async () => {
      setLoadError(null);
      try {
        const data = await previewQuizResultSheetsForRowAction({
          resultId: row.resultId,
          teamId: row.teamId,
          workspacePlanSlug: row.workspacePlanSlug,
        });
        setPreview(data);
      } catch (error) {
        setPreview(null);
        setLoadError(error instanceof Error ? error.message : "Could not load quiz sheets.");
      }
    });
  }, [open, row]);

  function handleSave() {
    if (!row || !preview?.canSave) return;

    startSaveTransition(async () => {
      try {
        await saveQuizResultSheetsAction({
          resultId: row.resultId,
          teamId: row.teamId,
          memberLabel: row.memberLabel,
          memberEmail: row.memberEmail,
          label: `${row.deckName} Quiz Sheet`,
        });
        toast.success("Quiz sheets saved", {
          description: "Question sheet and answer key are now in Teacher → Saved Quizzes.",
        });
        onOpenChange(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not save quiz sheets.");
      }
    });
  }

  const safeDeckName = row?.deckName.replace(/[^\w\s-]/g, "").trim() || "quiz";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-7xl flex-col gap-0 overflow-hidden p-0 sm:max-w-7xl">
        <DialogHeader className="space-y-1 border-b border-border/70 px-6 py-4 text-left">
          <DialogTitle>Quiz sheets</DialogTitle>
          <DialogDescription className="text-pretty">
            {row ? (
              <>
                <span className="font-medium text-foreground">{row.deckName}</span>
                {" · "}
                {row.memberLabel}
                {preview ? ` · ${preview.questionCount} questions` : null}
              </>
            ) : (
              "Question sheet and answer key for this quiz attempt."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 py-4">
          {loadingPreview ? (
            <div className="flex min-h-[480px] flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Generating PDF preview…
            </div>
          ) : loadError ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {loadError}
            </div>
          ) : preview ? (
            <Tabs defaultValue="questions" className="flex min-h-0 flex-1 flex-col gap-3">
              <TabsList className="grid w-full shrink-0 grid-cols-2">
                <TabsTrigger value="questions">Question sheet</TabsTrigger>
                <TabsTrigger value="answer-key">Answer key</TabsTrigger>
              </TabsList>
              <TabsContent value="questions" className="mt-0 flex min-h-0 flex-1 flex-col gap-3">
                <PdfPreviewFrame
                  base64={preview.questionSheetPdfBase64}
                  title={`${preview.deckName} question sheet`}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() =>
                    downloadBase64Pdf(
                      preview.questionSheetPdfBase64,
                      `${safeDeckName}_question_sheet.pdf`,
                    )
                  }
                >
                  <Download className="size-3.5" aria-hidden />
                  Download question sheet
                </Button>
              </TabsContent>
              <TabsContent value="answer-key" className="mt-0 flex min-h-0 flex-1 flex-col gap-3">
                <PdfPreviewFrame
                  base64={preview.answerKeyPdfBase64}
                  title={`${preview.deckName} answer key`}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() =>
                    downloadBase64Pdf(
                      preview.answerKeyPdfBase64,
                      `${safeDeckName}_answer_key.pdf`,
                    )
                  }
                >
                  <Download className="size-3.5" aria-hidden />
                  Download answer key
                </Button>
              </TabsContent>
            </Tabs>
          ) : null}
        </div>

        <DialogFooter className="border-t border-border/70 px-6 py-4 sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Double-click a result row anytime to reopen these sheets.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {preview?.canSave ? (
              <Button type="button" disabled={saving || loadingPreview} onClick={handleSave}>
                {saving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className="size-4" aria-hidden />
                    Save to resources
                  </>
                )}
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
