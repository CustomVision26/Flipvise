"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  clearAllEssayDocumentsAction,
  clearAllEssayFeedbackAction,
} from "@/actions/essay";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type EssayOverviewRecentDoc = {
  id: number;
  title: string;
  subject: string;
  updatedAt: string | Date;
};

export type EssayOverviewRecentFeedback = {
  id: number;
  documentId: number;
  createdAt: string | Date;
  result: {
    overallScore: number;
    strengths: string[];
  };
};

type EssayOverviewRecentPanelsProps = {
  recentEssays: EssayOverviewRecentDoc[];
  essayCount: number;
  recentFeedback: EssayOverviewRecentFeedback[];
  feedbackCount: number;
};

function formatRecordDateTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function EssayOverviewRecentPanels({
  recentEssays,
  essayCount,
  recentFeedback,
  feedbackCount,
}: EssayOverviewRecentPanelsProps) {
  const router = useRouter();
  const [clearTarget, setClearTarget] = React.useState<
    "essays" | "feedback" | null
  >(null);
  const [pending, setPending] = React.useState(false);

  async function handleClearConfirm() {
    if (!clearTarget) return;
    setPending(true);
    try {
      if (clearTarget === "essays") {
        const result = await clearAllEssayDocumentsAction();
        toast.success(
          result.deleted === 0
            ? "No essays to clear"
            : `Cleared ${result.deleted} essay${result.deleted === 1 ? "" : "s"}`,
        );
      } else {
        const result = await clearAllEssayFeedbackAction();
        toast.success(
          result.deleted === 0
            ? "No feedback to clear"
            : `Cleared ${result.deleted} feedback record${result.deleted === 1 ? "" : "s"}`,
        );
      }
      setClearTarget(null);
      router.refresh();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not clear records.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <CardTitle>Recent Essays</CardTitle>
            <Badge variant="secondary" className="tabular-nums">
              {essayCount}
            </Badge>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={essayCount === 0 || pending}
            onClick={() => setClearTarget("essays")}
          >
            <Trash2 className="size-3.5" aria-hidden />
            Clear all
          </Button>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {recentEssays.length === 0 ? (
            <p className="text-muted-foreground">No essays yet.</p>
          ) : (
            recentEssays.map((doc) => (
              <Link
                key={doc.id}
                href={`/dashboard/ai-doc-studio/ai-essay/${doc.id}`}
                className="block rounded-md border border-border/60 px-3 py-2.5 hover:bg-muted/40"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="font-medium text-foreground">{doc.title}</span>
                  <time
                    className="shrink-0 text-xs tabular-nums text-muted-foreground"
                    dateTime={
                      doc.updatedAt instanceof Date
                        ? doc.updatedAt.toISOString()
                        : String(doc.updatedAt)
                    }
                  >
                    {formatRecordDateTime(doc.updatedAt)}
                  </time>
                </div>
                <p className="mt-0.5 text-muted-foreground">{doc.subject}</p>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <CardTitle>Recent AI Feedback</CardTitle>
            <Badge variant="secondary" className="tabular-nums">
              {feedbackCount}
            </Badge>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={feedbackCount === 0 || pending}
            onClick={() => setClearTarget("feedback")}
          >
            <Trash2 className="size-3.5" aria-hidden />
            Clear all
          </Button>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {recentFeedback.length === 0 ? (
            <p className="text-muted-foreground">No feedback yet.</p>
          ) : (
            recentFeedback.map((fb) => (
              <Link
                key={fb.id}
                href={`/dashboard/ai-doc-studio/ai-essay/${fb.documentId}`}
                className="block rounded-md border border-border/60 px-3 py-2.5 hover:bg-muted/40"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="font-medium text-foreground">
                    Score {fb.result.overallScore}/100
                  </span>
                  <time
                    className="shrink-0 text-xs tabular-nums text-muted-foreground"
                    dateTime={
                      fb.createdAt instanceof Date
                        ? fb.createdAt.toISOString()
                        : String(fb.createdAt)
                    }
                  >
                    {formatRecordDateTime(fb.createdAt)}
                  </time>
                </div>
                <p className="mt-0.5 text-muted-foreground">
                  {fb.result.strengths[0] ?? "View feedback"}
                </p>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={clearTarget != null}
        onOpenChange={(open) => {
          if (!open && !pending) setClearTarget(null);
        }}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {clearTarget === "essays"
                ? "Clear all essays?"
                : "Clear all AI feedback?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {clearTarget === "essays"
                ? `This permanently deletes all ${essayCount} essay${essayCount === 1 ? "" : "s"} you own, including drafts, feedback, and assignments linked to them. This cannot be undone.`
                : `This permanently deletes all ${feedbackCount} AI feedback record${feedbackCount === 1 ? "" : "s"}. Your essays and drafts are kept. This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void handleClearConfirm();
              }}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                "Clear all"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
