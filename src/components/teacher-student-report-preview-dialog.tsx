"use client";

import { useEffect, useState } from "react";
import { Download, Pencil, Save, X } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  downloadTeacherStudentReportPdf,
  saveTeacherStudentReportPdf,
} from "@/lib/teacher-student-report-pdf";
import type { TeacherStudentReportDocument } from "@/lib/teacher-student-report-types";

function cloneReportDocument(report: TeacherStudentReportDocument): TeacherStudentReportDocument {
  return {
    ...report,
    filters: { ...report.filters },
    introduction: report.introduction,
    records: report.records.map((record) => ({ ...record })),
    studentSummaries: report.studentSummaries.map((summary) => ({ ...summary })),
  };
}

function ReportReadOnly({ report }: { report: TeacherStudentReportDocument }) {
  const quizCount = report.records.filter((row) => row.source === "Quiz").length;
  const assignmentCount = report.records.filter((row) => row.source === "Assignment").length;

  const activeFilters = [
    report.filters.academicYear.trim() ? `Academic year: ${report.filters.academicYear.trim()}` : null,
    report.filters.termSemester.trim()
      ? `Term / semester: ${report.filters.termSemester.trim()}`
      : null,
    report.filters.week.trim() ? `Week: ${report.filters.week.trim()}` : null,
    report.filters.student.trim() ? `Student: ${report.filters.student.trim()}` : null,
  ].filter((line): line is string => line != null);

  return (
    <div className="space-y-5 text-sm text-foreground">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">{report.title}</h3>
        <p className="text-muted-foreground">Generated {report.generatedAt}</p>
      </div>

      {activeFilters.length > 0 ? (
        <div className="rounded-xl border border-border/70 bg-muted/15 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Report filters
          </p>
          <ul className="mt-2 space-y-1">
            {activeFilters.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border/70 bg-background/60 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total records</p>
          <p className="text-2xl font-semibold">{report.records.length}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-background/60 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Quiz results</p>
          <p className="text-2xl font-semibold">{quizCount}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-background/60 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Manual grades</p>
          <p className="text-2xl font-semibold">{assignmentCount}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-background/60 px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Students and classes</p>
        <ul className="mt-2 space-y-2">
          {report.studentSummaries.map((summary) => (
            <li key={summary.studentLabel}>
              <span className="font-medium">{summary.studentLabel}</span>
              <span className="text-muted-foreground">
                {" "}
                — {summary.classLabel ?? "No class assigned"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {report.introduction.trim() ? (
        <div className="rounded-xl border border-border/70 bg-background/60 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Notes</p>
          <p className="mt-2 whitespace-pre-wrap">{report.introduction}</p>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border/70">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b border-border/70 bg-muted/20 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Student</th>
              <th className="px-4 py-3 font-medium">Class</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Result</th>
              <th className="px-4 py-3 font-medium">Term</th>
              <th className="px-4 py-3 font-medium">Year</th>
              <th className="px-4 py-3 font-medium">Recorded</th>
            </tr>
          </thead>
          <tbody>
            {report.records.map((record) => (
              <tr key={record.key} className="border-b border-border/50 last:border-0 align-top">
                <td className="px-4 py-3 font-medium">{record.studentLabel}</td>
                <td className="px-4 py-3 text-muted-foreground">{record.classLabel ?? "—"}</td>
                <td className="px-4 py-3">{record.source}</td>
                <td className="px-4 py-3">{record.title}</td>
                <td className="px-4 py-3">{record.result}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {record.term}
                  {record.period ? ` · ${record.period}` : ""}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{record.year}</td>
                <td className="px-4 py-3 text-muted-foreground">{record.savedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {report.records.some((record) => record.comment.trim()) ? (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Record comments</p>
          {report.records
            .filter((record) => record.comment.trim())
            .map((record) => (
              <div
                key={`comment-${record.key}`}
                className="rounded-xl border border-border/70 bg-background/60 px-4 py-3"
              >
                <p className="font-medium">
                  {record.studentLabel} — {record.title}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{record.comment}</p>
              </div>
            ))}
        </div>
      ) : null}
    </div>
  );
}

function ReportEditable({
  draft,
  onChange,
}: {
  draft: TeacherStudentReportDocument;
  onChange: (next: TeacherStudentReportDocument) => void;
}) {
  function patch(partial: Partial<TeacherStudentReportDocument>) {
    onChange({ ...draft, ...partial });
  }

  function patchRecord(key: string, comment: string) {
    onChange({
      ...draft,
      records: draft.records.map((record) =>
        record.key === key ? { ...record, comment } : record,
      ),
    });
  }

  return (
    <div className="space-y-5 text-sm text-foreground">
      <div className="space-y-2">
        <Label htmlFor="report-edit-title">Report title</Label>
        <Input
          id="report-edit-title"
          value={draft.title}
          onChange={(event) => patch({ title: event.target.value })}
          className="bg-background text-foreground"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="report-edit-intro">Notes / introduction</Label>
        <Textarea
          id="report-edit-intro"
          value={draft.introduction}
          onChange={(event) => patch({ introduction: event.target.value })}
          rows={4}
          placeholder="Add context, goals, or comments for this report."
          className="bg-background text-foreground"
        />
      </div>

      <div className="space-y-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Record comments</p>
        {draft.records.map((record) => (
          <div key={record.key} className="space-y-2 rounded-xl border border-border/70 p-3">
            <p className="font-medium">
              {record.studentLabel} — {record.title} ({record.result})
            </p>
            <Textarea
              value={record.comment}
              onChange={(event) => patchRecord(record.key, event.target.value)}
              rows={2}
              placeholder="Optional comment for this record"
              className="bg-background text-foreground"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TeacherStudentReportPreviewDialog({
  open,
  onOpenChange,
  report,
  onReportChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: TeacherStudentReportDocument | null;
  onReportChange: (next: TeacherStudentReportDocument) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState<TeacherStudentReportDocument | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSavingPdf, setIsSavingPdf] = useState(false);

  useEffect(() => {
    if (!open) {
      setIsEditing(false);
      setEditDraft(null);
    }
  }, [open]);

  useEffect(() => {
    setIsEditing(false);
    setEditDraft(null);
  }, [report?.generatedAt, report?.records.length]);

  const activeReport = isEditing && editDraft ? editDraft : report;

  function startEditing() {
    if (!report) return;
    setEditDraft(cloneReportDocument(report));
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
    setEditDraft(null);
  }

  function finishEditing() {
    if (!editDraft) return;
    onReportChange(editDraft);
    setIsEditing(false);
    setEditDraft(null);
    toast.success("Report updated", {
      description: "Your edits are ready to download or save as PDF.",
    });
  }

  async function handleDownloadPdf() {
    if (!activeReport) return;
    setIsDownloading(true);
    try {
      await downloadTeacherStudentReportPdf(activeReport);
      toast.success("Report downloaded as PDF.");
    } catch {
      toast.error("Could not download the report PDF.");
    } finally {
      setIsDownloading(false);
    }
  }

  async function handleSavePdf() {
    if (!activeReport) return;
    setIsSavingPdf(true);
    try {
      await saveTeacherStudentReportPdf(activeReport);
      toast.success("Report saved as PDF.");
    } catch {
      toast.error("Could not save the report PDF.");
    } finally {
      setIsSavingPdf(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden sm:max-w-5xl">
        <DialogHeader className="shrink-0 border-b border-border/70 pb-4">
          <DialogTitle>Generated report preview</DialogTitle>
          <DialogDescription>
            Review the report built from your filters and selected records. Edit notes before
            downloading or saving as PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto py-4 pr-1">
          {activeReport ? (
            isEditing && editDraft ? (
              <ReportEditable draft={editDraft} onChange={setEditDraft} />
            ) : (
              <ReportReadOnly report={activeReport} />
            )
          ) : null}
        </div>

        <DialogFooter className="shrink-0 border-t border-border/70 pt-4 sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {isEditing ? (
              <>
                <Button type="button" variant="outline" size="sm" onClick={cancelEditing}>
                  <X className="size-4" aria-hidden />
                  Cancel
                </Button>
                <Button type="button" size="sm" onClick={finishEditing}>
                  Done editing
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={!activeReport}
                onClick={startEditing}
              >
                <Pencil className="size-4" aria-hidden />
                Edit
              </Button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={!activeReport || isDownloading || isEditing}
              onClick={handleDownloadPdf}
            >
              <Download className="size-4" aria-hidden />
              {isDownloading ? "Downloading…" : "Download PDF"}
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-2"
              disabled={!activeReport || isSavingPdf || isEditing}
              onClick={handleSavePdf}
            >
              <Save className="size-4" aria-hidden />
              {isSavingPdf ? "Saving…" : "Save PDF"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
