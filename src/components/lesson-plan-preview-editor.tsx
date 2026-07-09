"use client";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
    <div className="space-y-4 text-foreground">
      <div className="space-y-2">
        <p className="font-medium">{result.lessonTitle}</p>
        {unitLabel ? (
          <Badge variant="outline" className="text-foreground">
            {unitLabel}
          </Badge>
        ) : null}
      </div>
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
      {hasWeeklySchedule ? (
        <LessonPlanWeeklySchedulePanel
          schedule={result.weeklySchedule!}
          unitLabel={unitLabel}
          lessonContext={lessonContext}
          onScheduleChange={onWeeklyScheduleChange}
          isGeneratingAllDayDetails={isGeneratingAllDayDetails}
        />
      ) : null}
      <div>
        <p className="font-medium text-foreground">
          {hasWeeklySchedule ? "Vocabulary (full unit)" : "Vocabulary"}
        </p>
        <ul className="list-disc pl-5">
          {result.vocabulary.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      {hasWeeklySchedule ? (
        <div>
          <p className="font-medium text-foreground">Unit pacing overview</p>
          <ul className="list-disc pl-5">
            {result.lessonTimeline.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div>
          <p className="font-medium text-foreground">Lesson Timeline</p>
          <ul className="list-disc pl-5">
            {result.lessonTimeline.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
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
