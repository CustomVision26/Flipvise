"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TeacherFieldLabel } from "@/components/teacher-field-label";
import { TeacherTopicFieldHelpContent } from "@/components/teacher-field-help-content";
import { TeacherToolPageShell } from "@/components/teacher-tool-page-shell";
import {
  generateWorksheet,
  type WorksheetInput,
} from "@/lib/teacher-generators";

export function TeacherWorksheetsForm({ backHref = "/teacher" }: { backHref?: string }) {
  const [form, setForm] = useState<WorksheetInput>({
    subject: "",
    gradeLevel: "",
    topic: "",
    worksheetType: "Practice",
    difficultyLevel: "On-level",
  });

  const result = useMemo(() => generateWorksheet(form), [form]);

  return (
    <TeacherToolPageShell
      title="Worksheet Generator"
      description="Create worksheets with student sections and teacher answer keys."
      backHref={backHref}
      result={
        <div className="space-y-4 whitespace-pre-wrap text-foreground">
          <p>{result.instructions}</p>
          <div>
            <p className="font-medium text-foreground">Practice Problems</p>
            <ol className="list-decimal pl-5">
              {result.practiceProblems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </div>
          <div>
            <p className="font-medium text-foreground">Student Worksheet Section</p>
            <p>{result.studentWorksheetSection}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Teacher Answer Key</p>
            <ol className="list-decimal pl-5">
              {result.teacherAnswerKey.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </div>
        </div>
      }
    >
      <TooltipProvider>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gradeLevel">Grade Level</Label>
            <Input
              id="gradeLevel"
              value={form.gradeLevel}
              onChange={(e) => setForm((f) => ({ ...f, gradeLevel: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <TeacherFieldLabel
              htmlFor="topic"
              label="Topic"
              help={<TeacherTopicFieldHelpContent />}
            />
            <Input
              id="topic"
              value={form.topic}
              onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="worksheetType">Worksheet Type</Label>
            <Input
              id="worksheetType"
              value={form.worksheetType}
              onChange={(e) =>
                setForm((f) => ({ ...f, worksheetType: e.target.value }))
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="difficultyLevel">Difficulty Level</Label>
            <Input
              id="difficultyLevel"
              value={form.difficultyLevel}
              onChange={(e) =>
                setForm((f) => ({ ...f, difficultyLevel: e.target.value }))
              }
              required
            />
          </div>
        </div>
      </TooltipProvider>
    </TeacherToolPageShell>
  );
}
