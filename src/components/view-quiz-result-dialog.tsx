"use client";

import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { QuizResultDetailView, type QuizResultSummary } from "./quiz-result-detail-view";

export type { QuizResultSummary };

interface ViewQuizResultDialogProps {
  result: QuizResultSummary;
  triggerLabel?: string;
  compact?: boolean;
}

export function ViewQuizResultDialog({
  result,
  triggerLabel = "View Results",
  compact = false,
}: ViewQuizResultDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={
          compact
            ? "h-8 gap-1.5 text-xs"
            : "h-9 w-full gap-2 sm:w-auto"
        }
        onClick={() => setOpen(true)}
      >
        <Eye className="size-4" aria-hidden />
        {triggerLabel}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[calc(100dvh-0.5rem)] w-[calc(100%-0.5rem)] max-w-3xl flex-col overflow-hidden p-0 sm:h-[min(92vh,56rem)] sm:max-h-[92vh] sm:w-full">
          <QuizResultDetailView
            variant="dialog"
            result={result}
            onClose={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
