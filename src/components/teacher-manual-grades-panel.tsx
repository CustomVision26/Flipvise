"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createTeacherManualGradeAction,
  deleteTeacherManualGradeAction,
} from "@/actions/teacher-manual-grades";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { teamAdminCardClass } from "@/components/team-admin-panel-styles";
import type { TeacherManualGradeRow } from "@/db/schema";
import { cn } from "@/lib/utils";

type TeacherManualGradesPanelProps = {
  grades: TeacherManualGradeRow[];
  teamId: number | null;
  isPersonalEducation?: boolean;
};

const EMPTY_FORM = {
  studentName: "",
  studentEmail: "",
  assignmentTitle: "",
  grade: "",
  maxGrade: "",
  subject: "",
  academicYear: "",
  termSemester: "",
  period: "",
  notes: "",
};

export function TeacherManualGradesPanel({
  grades: initialGrades,
  teamId,
  isPersonalEducation = false,
}: TeacherManualGradesPanelProps) {
  const router = useRouter();
  const [grades, setGrades] = useState(initialGrades);
  const [showForm, setShowForm] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    setGrades(initialGrades);
  }, [initialGrades]);

  const distinctYears = useMemo(
    () => [...new Set(grades.map((grade) => grade.academicYear))],
    [grades],
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isPersonalEducation && teamId == null) {
      toast.error("Open Student Progress from an education workspace to add grades.");
      return;
    }

    setIsPending(true);
    try {
      await createTeacherManualGradeAction({
        ...form,
        ...(teamId != null ? { teamId } : {}),
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      toast.success("Manual grade saved.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save grade.");
    } finally {
      setIsPending(false);
    }
  }

  async function handleDelete(gradeId: number) {
    setDeletingId(gradeId);
    try {
      await deleteTeacherManualGradeAction(gradeId);
      setGrades((current) => current.filter((grade) => grade.id !== gradeId));
      toast.success("Grade removed.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove grade.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card className={cn(teamAdminCardClass, "overflow-visible backdrop-blur-sm")}>
      <CardHeader className="gap-3 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">Manual grades</CardTitle>
            <CardDescription>
              {isPersonalEducation
                ? "Record assignment grades for your registered students when results are entered outside Flipvise quizzes."
                : "Record assignment grades for workspace students when results are entered outside Flipvise quizzes."}
            </CardDescription>
          </div>
          <Button
            type="button"
            size="sm"
            className="h-9 shrink-0 gap-2"
            onClick={() => setShowForm((open) => !open)}
          >
            <Plus className="size-4" aria-hidden />
            {showForm ? "Hide form" : "Add grade"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm ? (
          <form
            onSubmit={handleSubmit}
            className="grid gap-4 rounded-xl border border-border/70 bg-muted/15 p-4 sm:grid-cols-2"
          >
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="manual-grade-student-name">Student name</Label>
              <Input
                id="manual-grade-student-name"
                value={form.studentName}
                onChange={(e) => setForm((f) => ({ ...f, studentName: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-grade-student-email">Student email (optional)</Label>
              <Input
                id="manual-grade-student-email"
                type="email"
                value={form.studentEmail}
                onChange={(e) => setForm((f) => ({ ...f, studentEmail: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-grade-subject">Subject (optional)</Label>
              <Input
                id="manual-grade-subject"
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="manual-grade-assignment">Assignment</Label>
              <Input
                id="manual-grade-assignment"
                value={form.assignmentTitle}
                onChange={(e) =>
                  setForm((f) => ({ ...f, assignmentTitle: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-grade-grade">Grade</Label>
              <Input
                id="manual-grade-grade"
                value={form.grade}
                onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))}
                placeholder="e.g. 88 or B+"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-grade-max">Out of (optional)</Label>
              <Input
                id="manual-grade-max"
                value={form.maxGrade}
                onChange={(e) => setForm((f) => ({ ...f, maxGrade: e.target.value }))}
                placeholder="e.g. 100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-grade-year">Academic year</Label>
              <Input
                id="manual-grade-year"
                value={form.academicYear}
                onChange={(e) => setForm((f) => ({ ...f, academicYear: e.target.value }))}
                placeholder="e.g. 2025–2026"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-grade-term">Term / semester</Label>
              <Input
                id="manual-grade-term"
                value={form.termSemester}
                onChange={(e) => setForm((f) => ({ ...f, termSemester: e.target.value }))}
                placeholder="e.g. Fall 2025"
                required
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="manual-grade-period">Period (optional)</Label>
              <Input
                id="manual-grade-period"
                value={form.period}
                onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="manual-grade-notes">Notes (optional)</Label>
              <Textarea
                id="manual-grade-notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={isPending} className="gap-2">
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Plus className="size-4" aria-hidden />
                )}
                Save grade
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : null}

        {grades.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
            No manual grades yet.
            {distinctYears.length > 0
              ? ` Academic years on file: ${distinctYears.join(", ")}.`
              : " Click Add grade to record assignment results."}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/70">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-border/70 bg-muted/20 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 font-medium">Assignment</th>
                  <th className="px-4 py-3 font-medium">Grade</th>
                  <th className="px-4 py-3 font-medium">Term</th>
                  <th className="px-4 py-3 font-medium">Year</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {grades.map((grade) => (
                  <tr key={grade.id} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">{grade.studentName}</div>
                      {grade.studentEmail ? (
                        <div className="text-xs text-muted-foreground">{grade.studentEmail}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div>{grade.assignmentTitle}</div>
                      {grade.subject ? (
                        <div className="text-xs text-muted-foreground">{grade.subject}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      {grade.grade}
                      {grade.maxGrade ? ` / ${grade.maxGrade}` : ""}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {grade.termSemester}
                      {grade.period ? ` · ${grade.period}` : ""}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{grade.academicYear}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={deletingId === grade.id}
                        onClick={() => void handleDelete(grade.id)}
                      >
                        {deletingId === grade.id ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : (
                          <Trash2 className="size-4" aria-hidden />
                        )}
                        <span className="sr-only">Remove grade</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
