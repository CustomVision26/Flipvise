"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2 } from "lucide-react";
import { getEssayDocumentPdfDataAction } from "@/actions/essay";
import { essayTypeLabel } from "@/lib/essay-ai-schema";
import type { EssayCitationStyle } from "@/lib/essay-builder-options";
import { citationStyleDisplayLabel } from "@/lib/essay-model-citation-demo";
import { downloadEssayDocumentDocx } from "@/lib/essay-document-docx";
import { downloadEssayDocumentPdf } from "@/lib/essay-prompt-pdf";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export type CitedFormattedEssayItem = {
  documentId: number;
  title: string;
  subject: string;
  gradeLevel: string;
  essayType: string;
  citationStyle: Exclude<EssayCitationStyle, "none">;
  updatedAt: string;
};

type EssayCitedFormattedPoolProps = {
  essays: CitedFormattedEssayItem[];
};

export function EssayCitedFormattedPool({
  essays,
}: EssayCitedFormattedPoolProps) {
  const router = useRouter();
  const [pdfId, setPdfId] = React.useState<number | null>(null);
  const [docxId, setDocxId] = React.useState<number | null>(null);

  async function handlePdf(documentId: number) {
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

  async function handleDocx(documentId: number) {
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

  if (essays.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No cited and formatted essays yet. Open{" "}
        <button
          type="button"
          className="underline"
          onClick={() => router.push("/dashboard/essay/citation-formatting")}
        >
          Citation &amp; Formatting
        </button>{" "}
        to select an essay and apply a citation style.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-foreground">
          Cited &amp; formatted essay pool
        </p>
        <p className="text-xs text-muted-foreground">
          Essays that already have a citation style and formatting metadata
          applied.
        </p>
      </div>
      <ul className="space-y-2">
        {essays.map((essay) => (
          <li
            key={essay.documentId}
            className="flex flex-col gap-3 rounded-md border border-border/60 px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-foreground">{essay.title}</p>
                <Badge variant="secondary">
                  {citationStyleDisplayLabel(essay.citationStyle)}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                {essay.subject} · {essay.gradeLevel} ·{" "}
                {essayTypeLabel(essay.essayType)}
              </p>
              <p className="text-xs text-muted-foreground">
                Updated {new Date(essay.updatedAt).toLocaleString()}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 shrink-0">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pdfId === essay.documentId}
                onClick={() => void handlePdf(essay.documentId)}
              >
                {pdfId === essay.documentId ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Download className="size-3.5" aria-hidden />
                )}
                PDF
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={docxId === essay.documentId}
                onClick={() => void handleDocx(essay.documentId)}
              >
                {docxId === essay.documentId ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Download className="size-3.5" aria-hidden />
                )}
                DOCX
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  router.push(`/dashboard/essay/${essay.documentId}`)
                }
              >
                Open
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
