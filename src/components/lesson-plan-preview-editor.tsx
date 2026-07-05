"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { LessonPlanResult } from "@/lib/teacher-generators";

function linesToArray(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function arrayToLines(items: string[]): string {
  return items.join("\n");
}

function ArrayFieldEditor({
  id,
  label,
  value,
  onChange,
  rows = 4,
}: {
  id: string;
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  rows?: number;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-foreground">
        {label}
      </Label>
      <Textarea
        id={id}
        value={arrayToLines(value)}
        onChange={(event) => onChange(linesToArray(event.target.value))}
        rows={rows}
        className="bg-background text-foreground"
      />
      <p className="text-xs text-muted-foreground">One item per line</p>
    </div>
  );
}

function LessonPlanReadOnly({ result }: { result: LessonPlanResult }) {
  return (
    <div className="space-y-4 text-foreground">
      <p className="font-medium">{result.lessonTitle}</p>
      <div>
        <p className="font-medium text-foreground">Learning Objectives</p>
        <ul className="list-disc pl-5">
          {result.learningObjectives.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div>
        <p className="font-medium text-foreground">Materials Needed</p>
        <ul className="list-disc pl-5">
          {result.materialsNeeded.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div>
        <p className="font-medium text-foreground">Vocabulary</p>
        <ul className="list-disc pl-5">
          {result.vocabulary.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div>
        <p className="font-medium text-foreground">Lesson Timeline</p>
        <ul className="list-disc pl-5">
          {result.lessonTimeline.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <p>
        <span className="font-medium text-foreground">Warm-Up: </span>
        {result.warmUpActivity}
      </p>
      <div>
        <p className="font-medium text-foreground">Main Teaching Steps</p>
        <ul className="list-disc pl-5">
          {result.mainTeachingSteps.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <p>
        <span className="font-medium text-foreground">Classroom Activity: </span>
        {result.classroomActivity}
      </p>
      <div>
        <p className="font-medium text-foreground">Assessment Questions</p>
        <ul className="list-disc pl-5">
          {result.assessmentQuestions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <p>
        <span className="font-medium text-foreground">Homework: </span>
        {result.homework}
      </p>
      <div>
        <p className="font-medium text-foreground">Differentiated Instruction</p>
        <ul className="list-disc pl-5">
          {result.differentiatedInstruction.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <p>
        <span className="font-medium text-foreground">Teacher Notes: </span>
        {result.teacherNotes}
      </p>
    </div>
  );
}

function LessonPlanEditable({
  draft,
  onChange,
}: {
  draft: LessonPlanResult;
  onChange: (next: LessonPlanResult) => void;
}) {
  function patch(partial: Partial<LessonPlanResult>) {
    onChange({ ...draft, ...partial });
  }

  return (
    <div className="space-y-4 text-foreground">
      <div className="space-y-2">
        <Label htmlFor="edit-lesson-title">Lesson title</Label>
        <Input
          id="edit-lesson-title"
          value={draft.lessonTitle}
          onChange={(event) => patch({ lessonTitle: event.target.value })}
          className="bg-background"
        />
      </div>
      <ArrayFieldEditor
        id="edit-learning-objectives"
        label="Learning Objectives"
        value={draft.learningObjectives}
        onChange={(learningObjectives) => patch({ learningObjectives })}
        rows={5}
      />
      <ArrayFieldEditor
        id="edit-materials"
        label="Materials Needed"
        value={draft.materialsNeeded}
        onChange={(materialsNeeded) => patch({ materialsNeeded })}
      />
      <ArrayFieldEditor
        id="edit-vocabulary"
        label="Vocabulary"
        value={draft.vocabulary}
        onChange={(vocabulary) => patch({ vocabulary })}
        rows={6}
      />
      <ArrayFieldEditor
        id="edit-timeline"
        label="Lesson Timeline"
        value={draft.lessonTimeline}
        onChange={(lessonTimeline) => patch({ lessonTimeline })}
      />
      <div className="space-y-2">
        <Label htmlFor="edit-warm-up">Warm-Up</Label>
        <Textarea
          id="edit-warm-up"
          value={draft.warmUpActivity}
          onChange={(event) => patch({ warmUpActivity: event.target.value })}
          rows={3}
          className="bg-background text-foreground"
        />
      </div>
      <ArrayFieldEditor
        id="edit-main-steps"
        label="Main Teaching Steps"
        value={draft.mainTeachingSteps}
        onChange={(mainTeachingSteps) => patch({ mainTeachingSteps })}
        rows={6}
      />
      <div className="space-y-2">
        <Label htmlFor="edit-classroom-activity">Classroom Activity</Label>
        <Textarea
          id="edit-classroom-activity"
          value={draft.classroomActivity}
          onChange={(event) => patch({ classroomActivity: event.target.value })}
          rows={3}
          className="bg-background text-foreground"
        />
      </div>
      <ArrayFieldEditor
        id="edit-assessment"
        label="Assessment Questions"
        value={draft.assessmentQuestions}
        onChange={(assessmentQuestions) => patch({ assessmentQuestions })}
      />
      <div className="space-y-2">
        <Label htmlFor="edit-homework">Homework</Label>
        <Textarea
          id="edit-homework"
          value={draft.homework}
          onChange={(event) => patch({ homework: event.target.value })}
          rows={3}
          className="bg-background text-foreground"
        />
      </div>
      <ArrayFieldEditor
        id="edit-differentiated"
        label="Differentiated Instruction"
        value={draft.differentiatedInstruction}
        onChange={(differentiatedInstruction) => patch({ differentiatedInstruction })}
      />
      <div className="space-y-2">
        <Label htmlFor="edit-teacher-notes">Teacher Notes</Label>
        <Textarea
          id="edit-teacher-notes"
          value={draft.teacherNotes}
          onChange={(event) => patch({ teacherNotes: event.target.value })}
          rows={4}
          className="bg-background text-foreground"
        />
      </div>
    </div>
  );
}

export function LessonPlanPreviewEditor({
  result,
  isEditing,
  editDraft,
  onEditDraftChange,
}: {
  result: LessonPlanResult;
  isEditing: boolean;
  editDraft: LessonPlanResult | null;
  onEditDraftChange: (next: LessonPlanResult) => void;
}) {
  if (isEditing && editDraft) {
    return <LessonPlanEditable draft={editDraft} onChange={onEditDraftChange} />;
  }
  return <LessonPlanReadOnly result={result} />;
}

export function cloneLessonPlanResult(result: LessonPlanResult): LessonPlanResult {
  return {
    ...result,
    learningObjectives: [...result.learningObjectives],
    materialsNeeded: [...result.materialsNeeded],
    vocabulary: [...result.vocabulary],
    lessonTimeline: [...result.lessonTimeline],
    mainTeachingSteps: [...result.mainTeachingSteps],
    assessmentQuestions: [...result.assessmentQuestions],
    differentiatedInstruction: [...result.differentiatedInstruction],
  };
}
