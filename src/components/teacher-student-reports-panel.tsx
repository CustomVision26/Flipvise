"use client";

import { useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { teamAdminCardClass } from "@/components/team-admin-panel-styles";
import type { TeacherStudentProgressRow } from "@/db/queries/teacher-student-progress";
import type { TeacherManualGradeRow } from "@/db/schema";
import { cn } from "@/lib/utils";

type TeacherStudentReportsPanelProps = {
  quizRows: TeacherStudentProgressRow[];
  manualGrades: TeacherManualGradeRow[];
};

type ReportRow = {
  key: string;
  studentLabel: string;
  source: "Quiz" | "Assignment";
  title: string;
  result: string;
  term: string;
  year: string;
  period: string | null;
  savedAt: string;
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

export function TeacherStudentReportsPanel({
  quizRows,
  manualGrades,
}: TeacherStudentReportsPanelProps) {
  const [academicYear, setAcademicYear] = useState("");
  const [termSemester, setTermSemester] = useState("");
  const [period, setPeriod] = useState("");
  const [studentName, setStudentName] = useState("");
  const [generated, setGenerated] = useState(false);

  const reportRows = useMemo(() => {
    const rows: ReportRow[] = [];

    for (const row of quizRows) {
      rows.push({
        key: `quiz-${row.resultId}`,
        studentLabel: row.memberName ?? row.memberEmail ?? "Member",
        source: "Quiz",
        title: `${row.subject} — ${row.topic}`,
        result: `${row.percent}%`,
        term: row.schedule?.termSemester ?? "—",
        year: row.schedule?.academicYear ?? "—",
        period: row.schedule?.period ?? null,
        savedAt: formatDate(row.savedAt),
      });
    }

    for (const grade of manualGrades) {
      rows.push({
        key: `manual-${grade.id}`,
        studentLabel: grade.studentName,
        source: "Assignment",
        title: grade.assignmentTitle,
        result: grade.maxGrade ? `${grade.grade} / ${grade.maxGrade}` : grade.grade,
        term: grade.termSemester,
        year: grade.academicYear,
        period: grade.period,
        savedAt: formatDate(grade.createdAt),
      });
    }

    return rows.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }, [quizRows, manualGrades]);

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

  const quizCount = filteredRows.filter((row) => row.source === "Quiz").length;
  const assignmentCount = filteredRows.filter((row) => row.source === "Assignment").length;

  return (
    <Card className={cn(teamAdminCardClass, "overflow-visible backdrop-blur-sm")}>
      <CardHeader className="gap-3 pb-4">
        <div className="space-y-1">
          <CardTitle className="text-base">Reports</CardTitle>
          <CardDescription>
            Generate a combined report of quiz results and manual assignment grades for a
            term, period, or academic year.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
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
            <Label htmlFor="report-period">Period</Label>
            <Input
              id="report-period"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder="e.g. Period 2"
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
          <div className="sm:col-span-2 lg:col-span-4">
            <Button
              type="button"
              className="gap-2"
              onClick={() => setGenerated(true)}
            >
              <FileText className="size-4" aria-hidden />
              Generate report
            </Button>
          </div>
        </div>

        {generated ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border/70 bg-muted/10 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Total records
                </p>
                <p className="text-2xl font-semibold">{filteredRows.length}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/10 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Quiz results
                </p>
                <p className="text-2xl font-semibold">{quizCount}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/10 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Manual grades
                </p>
                <p className="text-2xl font-semibold">{assignmentCount}</p>
              </div>
            </div>

            {filteredRows.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
                No quiz or assignment records match this report period.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border/70">
                <table className="w-full min-w-[960px] text-left text-sm">
                  <thead className="border-b border-border/70 bg-muted/20 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Student</th>
                      <th className="px-4 py-3 font-medium">Source</th>
                      <th className="px-4 py-3 font-medium">Title</th>
                      <th className="px-4 py-3 font-medium">Result</th>
                      <th className="px-4 py-3 font-medium">Term</th>
                      <th className="px-4 py-3 font-medium">Year</th>
                      <th className="px-4 py-3 font-medium">Recorded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => (
                      <tr key={row.key} className="border-b border-border/50 last:border-0">
                        <td className="px-4 py-3 font-medium">{row.studentLabel}</td>
                        <td className="px-4 py-3">{row.source}</td>
                        <td className="px-4 py-3">{row.title}</td>
                        <td className="px-4 py-3">{row.result}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {row.term}
                          {row.period ? ` · ${row.period}` : ""}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{row.year}</td>
                        <td className="px-4 py-3 text-muted-foreground">{row.savedAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
            Choose a term, period, or academic year, then click Generate report.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
