"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  TeacherManualGradesPanel,
  type TeacherManualGradesPanelHandle,
} from "@/components/teacher-manual-grades-panel";
import { TeacherStudentReportPreviewDialog } from "@/components/teacher-student-report-preview-dialog";
import { teamAdminCardClass } from "@/components/team-admin-panel-styles";
import type { TeacherClassWithDeck } from "@/db/queries/teacher-classes";
import type { TeacherRegisteredStudentWithClass } from "@/db/queries/teacher-registered-students";
import type { SavedHomeworkAssignmentOption } from "@/db/queries/saved-homework";
import type { TeacherManualGradeQuizOption } from "@/db/queries/teacher-manual-grades";
import type { TeacherStudentProgressRow } from "@/db/queries/teacher-student-progress";
import type { TeacherManualGradeRow } from "@/db/schema";
import { teacherClassDisplayTitle } from "@/lib/teacher-class-links";
import {
  buildDefaultReportTitle,
  cleanStudentReportRecordTitle,
  type TeacherStudentReportDocument,
} from "@/lib/teacher-student-report-types";
import { cn } from "@/lib/utils";

type TeacherStudentReportsPanelProps = {
  manualGrades: TeacherManualGradeRow[];
  teamId: number | null;
  teamMemberId: number | null;
  isPersonalEducation?: boolean;
  isEducationTeamWorkspace?: boolean;
  registeredStudents?: TeacherRegisteredStudentWithClass[];
  personalClasses?: TeacherClassWithDeck[];
  savedHomeworkAssignments?: SavedHomeworkAssignmentOption[];
  savedQuizOptions?: TeacherManualGradeQuizOption[];
  quizResultRows?: TeacherStudentProgressRow[];
};

type ReportRow = {
  key: string;
  gradeId: number;
  studentLabel: string;
  studentEmail: string | null;
  classLabel: string | null;
  source: "Quiz" | "Assignment";
  title: string;
  subject: string | null;
  result: string;
  term: string;
  year: string;
  period: string | null;
  savedAt: string;
  recordedAt: number;
};

function formatDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function resolveClassLabelForStudent(
  studentName: string,
  studentEmail: string | null,
  registeredStudents: TeacherRegisteredStudentWithClass[],
  personalClasses: TeacherClassWithDeck[],
): string | null {
  const student = registeredStudents.find(
    (item) =>
      item.fullName === studentName &&
      (studentEmail == null || item.email === studentEmail),
  );
  if (student?.classId == null) return null;

  const cls = personalClasses.find((item) => item.id === student.classId);
  if (!cls) return null;

  return teacherClassDisplayTitle(cls);
}

function buildReportDocument(
  selectedRows: ReportRow[],
  filters: {
    academicYear: string;
    termSemester: string;
    period: string;
    studentName: string;
  },
  existingReport: TeacherStudentReportDocument | null,
): TeacherStudentReportDocument {
  const studentSummaries = [...new Map(
    selectedRows.map((row) => [
      `${row.studentLabel}::${row.studentEmail ?? ""}`,
      { studentLabel: row.studentLabel, classLabel: row.classLabel },
    ]),
  ).values()].sort((a, b) => a.studentLabel.localeCompare(b.studentLabel));

  const commentByKey = new Map(
    existingReport?.records.map((record) => [record.key, record.comment]) ?? [],
  );

  return {
    title: existingReport?.title ?? buildDefaultReportTitle({
      academicYear: filters.academicYear,
      termSemester: filters.termSemester,
      week: filters.period,
      student: filters.studentName,
    }),
    generatedAt: formatDate(new Date()),
    filters: {
      academicYear: filters.academicYear,
      termSemester: filters.termSemester,
      week: filters.period,
      student: filters.studentName,
    },
    introduction: existingReport?.introduction ?? "",
    studentSummaries,
    records: [...selectedRows]
      .sort((a, b) => b.recordedAt - a.recordedAt)
      .map((row) => ({
      key: row.key,
      studentLabel: row.studentLabel,
      classLabel: row.classLabel,
      source: row.source,
      title: row.title,
      result: row.result,
      term: row.term,
      year: row.year,
      period: row.period,
      savedAt: row.savedAt,
      comment: commentByKey.get(row.key) ?? "",
    })),
  };
}

export function TeacherStudentReportsPanel({
  manualGrades,
  teamId,
  teamMemberId,
  isPersonalEducation = false,
  isEducationTeamWorkspace = false,
  registeredStudents = [],
  personalClasses = [],
  savedHomeworkAssignments = [],
  savedQuizOptions = [],
  quizResultRows = [],
}: TeacherStudentReportsPanelProps) {
  const manualGradesRef = useRef<TeacherManualGradesPanelHandle>(null);
  const [showAddGradeForm, setShowAddGradeForm] = useState(false);
  const [deletingGradeId, setDeletingGradeId] = useState<number | null>(null);
  const [academicYear, setAcademicYear] = useState("");
  const [termSemester, setTermSemester] = useState("");
  const [period, setPeriod] = useState("");
  const [studentName, setStudentName] = useState("");
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(new Set());
  const [reportDocument, setReportDocument] = useState<TeacherStudentReportDocument | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const reportRows = useMemo(() => {
    const rows: ReportRow[] = [];

    for (const grade of manualGrades) {
      const isQuiz = grade.gradeType === "quiz";
      rows.push({
        key: `manual-${grade.id}`,
        gradeId: grade.id,
        studentLabel: grade.studentName,
        studentEmail: grade.studentEmail,
        classLabel: resolveClassLabelForStudent(
          grade.studentName,
          grade.studentEmail,
          registeredStudents,
          personalClasses,
        ),
        source: isQuiz ? "Quiz" : "Assignment",
        title: isQuiz
          ? cleanStudentReportRecordTitle(grade.assignmentTitle)
          : grade.assignmentTitle,
        subject: grade.subject ?? null,
        result: isQuiz
          ? `${grade.grade}%`
          : grade.maxGrade
            ? `${grade.grade} / ${grade.maxGrade}`
            : grade.grade,
        term: grade.termSemester,
        year: grade.academicYear,
        period: grade.period,
        savedAt: formatDate(grade.createdAt),
        recordedAt: grade.createdAt.getTime(),
      });
    }

    return rows.sort((a, b) => b.recordedAt - a.recordedAt);
  }, [manualGrades, registeredStudents, personalClasses]);

  const filteredRows = useMemo(() => {
    const yearQ = academicYear.trim().toLowerCase();
    const termQ = termSemester.trim().toLowerCase();
    const periodQ = period.trim().toLowerCase();
    const studentQ = studentName.trim().toLowerCase();

    return reportRows.filter((row) => {
      if (yearQ && !row.year.toLowerCase().includes(yearQ)) return false;
      if (termQ && !row.term.toLowerCase().includes(termQ)) return false;
      if (periodQ && !(row.period ?? "").toLowerCase().includes(periodQ)) return false;
      if (studentQ && !row.studentLabel.toLowerCase().includes(studentQ)) return false;
      return true;
    });
  }, [reportRows, academicYear, termSemester, period, studentName]);

  useEffect(() => {
    setSelectedRowKeys(new Set(filteredRows.map((row) => row.key)));
    setPreviewOpen(false);
  }, [filteredRows]);

  const selectedRows = useMemo(
    () => filteredRows.filter((row) => selectedRowKeys.has(row.key)),
    [filteredRows, selectedRowKeys],
  );

  const allFilteredSelected =
    filteredRows.length > 0 && filteredRows.every((row) => selectedRowKeys.has(row.key));
  const someFilteredSelected = filteredRows.some((row) => selectedRowKeys.has(row.key));

  function toggleRow(key: string, checked: boolean) {
    setSelectedRowKeys((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
    setPreviewOpen(false);
  }

  function toggleAllFiltered(checked: boolean) {
    setSelectedRowKeys(
      checked ? new Set(filteredRows.map((row) => row.key)) : new Set(),
    );
    setPreviewOpen(false);
  }

  function handleGenerate() {
    if (selectedRows.length === 0) {
      toast.error("Select at least one record to include in the report.");
      return;
    }

    const nextReport = buildReportDocument(
      selectedRows,
      { academicYear, termSemester, period, studentName },
      reportDocument,
    );
    setReportDocument(nextReport);
    setPreviewOpen(true);
  }

  return (
    <>
      <Card className={cn(teamAdminCardClass, "overflow-visible backdrop-blur-sm")}>
        <CardHeader className="gap-3 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base">Reports</CardTitle>
              <CardDescription>
                Add manual grades, filter records, select the rows to include, then generate a
                combined report with class information for each student.
              </CardDescription>
            </div>
            <Button
              type="button"
              size="sm"
              className="h-9 shrink-0 gap-2"
              onClick={() => setShowAddGradeForm((open) => !open)}
            >
              <Plus className="size-4" aria-hidden />
              {showAddGradeForm ? "Hide form" : "Add grade"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <TeacherManualGradesPanel
            ref={manualGradesRef}
            variant="embedded"
            showForm={showAddGradeForm}
            onShowFormChange={setShowAddGradeForm}
            onDeletingIdChange={setDeletingGradeId}
            grades={manualGrades}
            teamId={teamId}
            teamMemberId={teamMemberId}
            isPersonalEducation={isPersonalEducation}
            isEducationTeamWorkspace={isEducationTeamWorkspace}
            registeredStudents={registeredStudents}
            personalClasses={personalClasses}
            savedHomeworkAssignments={savedHomeworkAssignments}
            savedQuizOptions={savedQuizOptions}
            quizResultRows={quizResultRows}
          />

          <div className="grid gap-4 rounded-xl border border-border/70 bg-muted/15 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="report-academic-year">Academic year</Label>
              <Input
                id="report-academic-year"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                placeholder="e.g. 2025–2026"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-term">Term / semester</Label>
              <Input
                id="report-term"
                value={termSemester}
                onChange={(e) => setTermSemester(e.target.value)}
                placeholder="e.g. Fall 2025"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-period">Week</Label>
              <Input
                id="report-period"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder="e.g. Week 2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-student">Student</Label>
              <Input
                id="report-student"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Filter by student name"
              />
            </div>
          </div>

          {filteredRows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
              No manual grade records match these filters. Click Add grade to record assignment
              results.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Select the records to include in the report ({selectedRows.length} of{" "}
                  {filteredRows.length} selected).
                </p>
                {selectedRows.length > 0 ? (
                  <Button type="button" className="gap-2" onClick={handleGenerate}>
                    <FileText className="size-4" aria-hidden />
                    Generate report
                  </Button>
                ) : null}
              </div>
              <div className="overflow-x-auto rounded-xl border border-border/70">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="border-b border-border/70 bg-muted/20 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="w-10 px-4 py-3">
                        <Checkbox
                          checked={allFilteredSelected}
                          indeterminate={someFilteredSelected && !allFilteredSelected}
                          onCheckedChange={(checked) => toggleAllFiltered(checked === true)}
                          aria-label="Select all filtered records"
                        />
                      </th>
                      <th className="px-4 py-3 font-medium">Student</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Title</th>
                      <th className="px-4 py-3 font-medium">Result</th>
                      <th className="px-4 py-3 font-medium">Term</th>
                      <th className="px-4 py-3 font-medium">Year</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => {
                      const isSelected = selectedRowKeys.has(row.key);
                      const grade = manualGrades.find((item) => item.id === row.gradeId);
                      return (
                        <tr
                          key={row.key}
                          className={cn(
                            "border-b border-border/50 last:border-0",
                            isSelected && "bg-muted/10",
                          )}
                        >
                          <td className="px-4 py-3">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) =>
                                toggleRow(row.key, checked === true)
                              }
                              aria-label={`Include ${row.studentLabel} ${row.title} in report`}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium">{row.studentLabel}</div>
                            {row.studentEmail ? (
                              <div className="text-xs text-muted-foreground">{row.studentEmail}</div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{row.source}</td>
                          <td className="px-4 py-3">
                            <div>{row.title}</div>
                            {row.subject ? (
                              <div className="text-xs text-muted-foreground">{row.subject}</div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">{row.result}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {row.term}
                            {row.period ? ` · ${row.period}` : ""}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{row.year}</td>
                          <td className="px-4 py-3 text-right">
                            {grade ? (
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={deletingGradeId === grade.id}
                                  onClick={() => manualGradesRef.current?.openEditDialog(grade)}
                                >
                                  <Pencil className="size-4" aria-hidden />
                                  <span className="sr-only">Edit grade for {row.studentLabel}</span>
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  disabled={deletingGradeId === grade.id}
                                  onClick={() => void manualGradesRef.current?.deleteGrade(grade.id)}
                                >
                                  {deletingGradeId === grade.id ? (
                                    <Loader2 className="size-4 animate-spin" aria-hidden />
                                  ) : (
                                    <Trash2 className="size-4" aria-hidden />
                                  )}
                                  <span className="sr-only">Remove grade</span>
                                </Button>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <TeacherStudentReportPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        report={reportDocument}
        onReportChange={setReportDocument}
      />
    </>
  );
}
