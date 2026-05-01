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
}

export function ViewQuizResultDialog({
  result,
  triggerLabel = "View Results",
}: ViewQuizResultDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Eye className="size-3.5" aria-hidden />
        {triggerLabel}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl flex flex-col overflow-hidden p-0">
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
