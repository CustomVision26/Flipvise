"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TeacherPreviewSection } from "@/components/teacher-tool-page-shell";
import type { LessonPlanResult } from "@/lib/teacher-generators";
import type { LessonPlanDaySchedule } from "@/lib/lesson-plan-ai-schema";
import { formatUnitPacingLabel } from "@/lib/lesson-plan-weekly-schedule";
import { LessonPlanWeeklySchedulePanel } from "@/components/lesson-plan-day-vocabulary-detail";
import type { LessonPlanDetailLessonContext } from "@/components/lesson-plan-day-vocabulary-detail";

export type LessonPlanUnitContext = {
  planPeriodDays: number;
  lessonDuration: string;
};

export type { LessonPlanDetailLessonContext };

function compactLines(text: string): string[] {
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
  const formatted = arrayToLines(value);
  const [text, setText] = useState(formatted);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setText(formatted);
    }
  }, [formatted, focused]);

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-foreground">
        {label}
      </Label>
      <Textarea
        id={id}
        value={focused ? text : formatted}
        onFocus={() => {
          setFocused(true);
          setText(formatted);
        }}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => {
          setFocused(false);
          onChange(compactLines(text));
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.stopPropagation();
          }
        }}
        rows={rows}
        className="bg-background text-foreground whitespace-pre-wrap"
      />
      <p className="text-xs text-muted-foreground">One item per line</p>
    </div>
  );
}

function LessonPlanReadOnly({
  result,
  unitContext,
  lessonContext,
  onWeeklyScheduleChange,
  isGeneratingAllDayDetails,
}: {
  result: LessonPlanResult;
  unitContext?: LessonPlanUnitContext;
  lessonContext?: LessonPlanDetailLessonContext;
  onWeeklyScheduleChange?: (next: LessonPlanDaySchedule[]) => void;
  isGeneratingAllDayDetails?: boolean;
}) {
  const hasWeeklySchedule =
    result.weeklySchedule && result.weeklySchedule.length > 0;
  const unitLabel =
    unitContext && unitContext.planPeriodDays > 1
      ? formatUnitPacingLabel(unitContext.planPeriodDays, unitContext.lessonDuration)
      : undefined;

  return (
    <div className="space-y-3 text-foreground">
      <TeacherPreviewSection title={result.lessonTitle} accent="violet">
        {unitLabel ? (
          <Badge variant="outline" className="border-violet-300/40 bg-violet-500/10 text-foreground">
            {unitLabel}
          </Badge>
        ) : (
          <p className="text-muted-foreground">Lesson plan</p>
        )}
      </TeacherPreviewSection>
      <TeacherPreviewSection title="Learning Objectives" accent="emerald">
        <ul className="list-disc space-y-1.5 pl-5 marker:text-emerald-300">
          {result.learningObjectives.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </TeacherPreviewSection>
      <TeacherPreviewSection title="Materials Needed" accent="amber">
        <ul className="list-disc space-y-1.5 pl-5 marker:text-amber-300">
          {result.materialsNeeded.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </TeacherPreviewSection>
      {hasWeeklySchedule ? (
        <LessonPlanWeeklySchedulePanel
          schedule={result.weeklySchedule!}
          unitLabel={unitLabel}
          lessonContext={lessonContext}
          onScheduleChange={onWeeklyScheduleChange}
          isGeneratingAllDayDetails={isGeneratingAllDayDetails}
          useFiveEModel={Boolean(result.jamaicaNscGuidelinesApplied)}
        />
      ) : null}
      <TeacherPreviewSection
        title={hasWeeklySchedule ? "Vocabulary (full unit)" : "Vocabulary"}
        accent="sky"
      >
        <ul className="list-disc space-y-1.5 pl-5 marker:text-sky-300">
          {result.vocabulary.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </TeacherPreviewSection>
      <TeacherPreviewSection
        title={hasWeeklySchedule ? "Unit pacing overview" : "Lesson Timeline"}
        accent="cyan"
      >
        <ul className="list-disc space-y-1.5 pl-5 marker:text-cyan-300">
          {result.lessonTimeline.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </TeacherPreviewSection>
      <TeacherPreviewSection title="Warm-Up" accent="rose">
        <p>{result.warmUpActivity}</p>
      </TeacherPreviewSection>
      <TeacherPreviewSection title="Main Teaching Steps" accent="violet">
        <ul className="list-disc space-y-1.5 pl-5 marker:text-violet-300">
          {result.mainTeachingSteps.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </TeacherPreviewSection>
      <TeacherPreviewSection title="Classroom Activity" accent="emerald">
        <p>{result.classroomActivity}</p>
      </TeacherPreviewSection>
      <TeacherPreviewSection title="Assessment Questions" accent="amber">
        <ul className="list-disc space-y-1.5 pl-5 marker:text-amber-300">
          {result.assessmentQuestions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </TeacherPreviewSection>
      <TeacherPreviewSection title="Homework" accent="sky">
        <p>{result.homework}</p>
      </TeacherPreviewSection>
      <TeacherPreviewSection title="Differentiated Instruction" accent="rose">
        <ul className="list-disc space-y-1.5 pl-5 marker:text-rose-300">
          {result.differentiatedInstruction.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </TeacherPreviewSection>
      <TeacherPreviewSection title="Teacher Notes" accent="cyan">
        <p>{result.teacherNotes}</p>
      </TeacherPreviewSection>
    </div>
  );
}

function LessonPlanEditable({
  draft,
  onChange,
  unitContext,
  lessonContext,
}: {
  draft: LessonPlanResult;
  onChange: (next: LessonPlanResult) => void;
  unitContext?: LessonPlanUnitContext;
  lessonContext?: LessonPlanDetailLessonContext;
}) {
  function patch(partial: Partial<LessonPlanResult>) {
    onChange({ ...draft, ...partial });
  }

  const hasWeeklySchedule =
    draft.weeklySchedule && draft.weeklySchedule.length > 0;
  const unitLabel =
    unitContext && unitContext.planPeriodDays > 1
      ? formatUnitPacingLabel(unitContext.planPeriodDays, unitContext.lessonDuration)
      : undefined;

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
        {unitLabel ? (
          <Badge variant="outline" className="text-foreground">
            {unitLabel}
          </Badge>
        ) : null}
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
      {hasWeeklySchedule ? (
        <LessonPlanWeeklySchedulePanel
          schedule={draft.weeklySchedule!}
          unitLabel={unitLabel}
          lessonContext={lessonContext}
          onScheduleChange={(weeklySchedule) => patch({ weeklySchedule })}
          useFiveEModel={Boolean(draft.jamaicaNscGuidelinesApplied)}
        />
      ) : null}
      <ArrayFieldEditor
        id="edit-vocabulary"
        label={hasWeeklySchedule ? "Vocabulary (full unit list)" : "Vocabulary"}
        value={draft.vocabulary}
        onChange={(vocabulary) => patch({ vocabulary })}
        rows={6}
      />
      {hasWeeklySchedule ? (
        <ArrayFieldEditor
          id="edit-unit-timeline"
          label="Unit pacing overview"
          value={draft.lessonTimeline}
          onChange={(lessonTimeline) => patch({ lessonTimeline })}
        />
      ) : (
        <ArrayFieldEditor
          id="edit-timeline"
          label="Lesson Timeline"
          value={draft.lessonTimeline}
          onChange={(lessonTimeline) => patch({ lessonTimeline })}
        />
      )}
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
  unitContext,
  lessonContext,
  onResultChange,
  isGeneratingAllDayDetails,
}: {
  result: LessonPlanResult;
  isEditing: boolean;
  editDraft: LessonPlanResult | null;
  onEditDraftChange: (next: LessonPlanResult) => void;
  unitContext?: LessonPlanUnitContext;
  lessonContext?: LessonPlanDetailLessonContext;
  onResultChange?: (next: LessonPlanResult) => void;
  isGeneratingAllDayDetails?: boolean;
}) {
  function handleWeeklyScheduleChange(next: LessonPlanDaySchedule[]) {
    const nextResult = {
      ...(isEditing && editDraft ? editDraft : result),
      weeklySchedule: next,
    };
    if (isEditing && editDraft) {
      onEditDraftChange(nextResult);
    } else {
      onResultChange?.(nextResult);
    }
  }

  if (isEditing && editDraft) {
    return (
      <LessonPlanEditable
        draft={editDraft}
        onChange={onEditDraftChange}
        unitContext={unitContext}
        lessonContext={lessonContext}
      />
    );
  }
  return (
    <LessonPlanReadOnly
      result={result}
      unitContext={unitContext}
      lessonContext={lessonContext}
      onWeeklyScheduleChange={handleWeeklyScheduleChange}
      isGeneratingAllDayDetails={isGeneratingAllDayDetails}
    />
  );
}

export function cloneLessonPlanResult(result: LessonPlanResult): LessonPlanResult {
  return {
    ...result,
    learningObjectives: [...result.learningObjectives],
    materialsNeeded: [...result.materialsNeeded],
    vocabulary: [...result.vocabulary],
    lessonTimeline: [...result.lessonTimeline],
    weeklySchedule: result.weeklySchedule?.map((day) => ({
      ...day,
      vocabulary: [...day.vocabulary],
      lessonTimeline: [...day.lessonTimeline],
      vocabularyDetail: day.vocabularyDetail
        ? {
            ...day.vocabularyDetail,
            terms: day.vocabularyDetail.terms.map((term) => ({ ...term })),
            additionalVocabulary: day.vocabularyDetail.additionalVocabulary?.map(
              (term) => ({ ...term }),
            ),
            mainConcept: day.vocabularyDetail.mainConcept
              ? { ...day.vocabularyDetail.mainConcept }
              : undefined,
            fiveEBreakdown: day.vocabularyDetail.fiveEBreakdown
              ? {
                  ...day.vocabularyDetail.fiveEBreakdown,
                  phases: day.vocabularyDetail.fiveEBreakdown.phases.map(
                    (phase) => ({
                      ...phase,
                      vocabularyFocus: [...phase.vocabularyFocus],
                      teacherMoves: [...phase.teacherMoves],
                      studentMoves: [...phase.studentMoves],
                    }),
                  ),
                }
              : undefined,
            process: day.vocabularyDetail.process
              ? {
                  ...day.vocabularyDetail.process,
                  steps: day.vocabularyDetail.process.steps.map((step) => ({
                    ...step,
                    bullets: [...step.bullets],
                  })),
                }
              : undefined,
            learningGoal: day.vocabularyDetail.learningGoal
              ? {
                  ...day.vocabularyDetail.learningGoal,
                  objectives: [...day.vocabularyDetail.learningGoal.objectives],
                }
              : undefined,
          }
        : undefined,
    })),
    mainTeachingSteps: [...result.mainTeachingSteps],
    assessmentQuestions: [...result.assessmentQuestions],
    differentiatedInstruction: [...result.differentiatedInstruction],
  };
}
