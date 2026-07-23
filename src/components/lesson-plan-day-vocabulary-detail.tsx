"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Loader2, Sparkles } from "lucide-react";
import { generateAllDaysVocabularyDetailAction, generateDayVocabularyDetailAction } from "@/actions/teacher-lesson-plan";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TeacherHelpBalloon } from "@/components/teacher-field-label";
import { TEACHER_CLASS_DAY_OPTIONS } from "@/lib/teacher-class-form";
import {
  formatLessonPlanDayLabel,
  LESSON_PLAN_DAY_OF_WEEK_NONE,
  coerceLessonPlanDayOfWeek,
  lessonPlanDayNumberFromIndex,
} from "@/lib/lesson-plan-weekly-schedule";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type {
  LessonPlanDaySchedule,
  LessonPlanDayVocabularyDetail,
  LessonPlanVocabularyTermDetail,
} from "@/lib/lesson-plan-ai-schema";
import type { LessonPlanActionInput } from "@/lib/lesson-plan-ai-schema";
import { toast } from "sonner";

export type LessonPlanDetailLessonContext = Pick<
  LessonPlanActionInput,
  "subject" | "gradeLevel" | "topic" | "difficultyLevel" | "learningStandard"
> & {
  lessonTitle: string;
};

function linesToArray(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function arrayToLines(items: string[] | undefined | null): string {
  return (items ?? []).join("\n");
}

function DayListTextarea({
  id,
  value,
  onCommit,
  rows,
  hint,
}: {
  id: string;
  value: string[];
  onCommit: (next: string[]) => void;
  rows: number;
  hint: string;
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
    <>
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
          onCommit(linesToArray(text));
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.stopPropagation();
          }
        }}
        rows={rows}
        className="bg-background text-sm text-foreground whitespace-pre-wrap"
      />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </>
  );
}


function VocabularySummaryBox({ terms }: { terms: LessonPlanVocabularyTermDetail[] }) {
  return (
    <div className="rounded-md border border-border bg-muted/40 p-3">
      <p className="text-sm font-medium text-foreground">Vocabulary</p>
      <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
        {terms.map((term) => (
          <li key={term.term}>
            <span className="font-medium text-foreground">{term.term}</span>
            {" — "}
            {term.shortDefinition}
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatVocabularyEntry(term: LessonPlanVocabularyTermDetail): string {
  const name = term.term.trim();
  const definition = term.shortDefinition.replace(/^\s+/u, "").replace(/\s+$/u, "");
  if (!name) return definition;
  if (!definition) return name;
  // Multi-line definitions: term on the first line, details below.
  if (definition.includes("\n")) {
    return `${name}\n${definition}`;
  }
  return `${name} — ${definition}`;
}

function parseVocabularyEntry(
  line: string,
): Pick<LessonPlanVocabularyTermDetail, "term" | "shortDefinition"> {
  // Preserve intentional newlines inside the definition; only trim the ends.
  const normalized = line.replace(/^\s+/u, "").replace(/\s+$/u, "");
  if (!normalized) {
    return { term: "", shortDefinition: "" };
  }

  const separators = [" — ", " – ", " - "] as const;
  for (const separator of separators) {
    const index = normalized.indexOf(separator);
    if (index > 0) {
      return {
        term: normalized.slice(0, index).trim(),
        shortDefinition: normalized.slice(index + separator.length).replace(/^\s+/u, ""),
      };
    }
  }

  // First line = term, remaining lines = definition (Enter after the term name).
  const [firstLine = "", ...rest] = normalized.split("\n");
  if (rest.length > 0) {
    return {
      term: firstLine.trim(),
      shortDefinition: rest.join("\n").replace(/^\s+/u, ""),
    };
  }

  return { term: normalized.trim(), shortDefinition: normalized.trim() };
}

function VocabularyEntryTextarea({
  id,
  term,
  onCommit,
}: {
  id: string;
  term: LessonPlanVocabularyTermDetail;
  onCommit: (line: string) => void;
}) {
  const formatted = formatVocabularyEntry(term);
  const [text, setText] = useState(formatted);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setText(formatted);
    }
  }, [formatted, focused]);

  return (
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
        onCommit(text);
      }}
      onKeyDown={(event) => {
        // Ensure Enter inserts a newline (never treated as a form submit).
        if (event.key === "Enter") {
          event.stopPropagation();
        }
      }}
      rows={4}
      placeholder={"Term — short definition\nMore detail on the next line…"}
      className="bg-background text-sm text-foreground whitespace-pre-wrap"
    />
  );
}

function EditableVocabularySummaryBox({
  terms,
  onChange,
  idPrefix,
}: {
  terms: LessonPlanVocabularyTermDetail[];
  onChange: (next: LessonPlanVocabularyTermDetail[]) => void;
  idPrefix: string;
}) {
  function updateEntry(termIndex: number, line: string) {
    const parsed = parseVocabularyEntry(line);
    onChange(
      terms.map((term, index) =>
        index === termIndex
          ? {
              ...term,
              term: parsed.term,
              shortDefinition: parsed.shortDefinition,
              definition: parsed.shortDefinition || term.definition,
            }
          : term,
      ),
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/40 p-3">
      <p className="text-sm font-medium text-foreground">Vocabulary</p>
      <p className="text-xs text-muted-foreground">
        Press Enter for a new line. Use <span className="font-medium">Term — definition</span>{" "}
        on the first line, or put the definition on the lines below the term.
      </p>
      {terms.map((term, termIndex) => (
        <div key={`${idPrefix}-term-${termIndex}`} className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-term-${termIndex}`} className="sr-only">
            Vocabulary entry {termIndex + 1}
          </Label>
          <VocabularyEntryTextarea
            id={`${idPrefix}-term-${termIndex}`}
            term={term}
            onCommit={(line) => updateEntry(termIndex, line)}
          />
        </div>
      ))}
    </div>
  );
}

function VocabularyTermBlock({ term }: { term: LessonPlanVocabularyTermDetail }) {
  return (
    <li className="space-y-1">
      <p className="text-sm text-foreground">
        <span className="font-semibold">{term.term}</span>
        {" — "}
        {term.definition}
      </p>
      {term.example ? (
        <p className="text-sm italic text-muted-foreground">{term.example}</p>
      ) : null}
    </li>
  );
}

export function LessonPlanDayVocabularyDetailContent({
  detail,
  learningStandard,
}: {
  detail: LessonPlanDayVocabularyDetail;
  learningStandard?: string;
}) {
  const pepAligned = Boolean(learningStandard?.trim() && /pep/i.test(learningStandard));
  const additionalHeading = pepAligned
    ? "Vocabulary (PEP-Aligned)"
    : "Additional Vocabulary";

  return (
    <div className="space-y-6 text-foreground">
      <VocabularySummaryBox terms={detail.terms} />

      <p className="text-sm leading-relaxed text-muted-foreground">{detail.contextIntro}</p>

      <div className="space-y-3">
        <p className="text-base font-semibold text-foreground">Vocabulary</p>
        <ul className="list-disc space-y-4 pl-5">
          {detail.terms.map((term) => (
            <VocabularyTermBlock key={term.term} term={term} />
          ))}
        </ul>
      </div>

      {detail.mainConcept ? (
        <div className="space-y-2">
          <p className="text-base font-semibold text-foreground">
            {detail.mainConcept.heading}
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {detail.mainConcept.body}
          </p>
        </div>
      ) : null}

      {detail.process ? (
        <div className="space-y-3">
          <p className="text-base font-semibold text-foreground">{detail.process.heading}</p>
          <ol className="list-decimal space-y-4 pl-5">
            {detail.process.steps.map((step) => (
              <li key={step.stepNumber} className="space-y-1.5">
                <p className="text-sm font-semibold text-foreground">{step.title}</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {step.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {detail.learningGoal ? (
        <div className="space-y-2">
          <p className="text-base font-semibold text-foreground">
            {detail.learningGoal.heading}
          </p>
          {detail.learningGoal.intro ? (
            <p className="text-sm text-muted-foreground">{detail.learningGoal.intro}</p>
          ) : null}
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {detail.learningGoal.objectives.map((objective) => (
              <li key={objective}>{objective}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {detail.additionalVocabulary && detail.additionalVocabulary.length > 0 ? (
        <div className="space-y-3">
          <p className="text-base font-semibold text-foreground">
            {additionalHeading}
          </p>
          <ul className="list-disc space-y-3 pl-5">
            {detail.additionalVocabulary.map((term) => (
              <VocabularyTermBlock key={`${term.term}-additional`} term={term} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function LessonPlanWeeklySchedulePanel({
  schedule,
  unitLabel,
  lessonContext,
  onScheduleChange,
  isGeneratingAllDayDetails = false,
  editable = Boolean(onScheduleChange),
}: {
  schedule: LessonPlanDaySchedule[];
  unitLabel?: string;
  lessonContext?: LessonPlanDetailLessonContext;
  onScheduleChange?: (next: LessonPlanDaySchedule[]) => void;
  isGeneratingAllDayDetails?: boolean;
  editable?: boolean;
}) {
  const [detailDayIndex, setDetailDayIndex] = useState<number | null>(null);
  const [generatingDayIndex, setGeneratingDayIndex] = useState<number | null>(null);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);

  const isBulkBusy = isGeneratingAll || isGeneratingAllDayDetails;
  const daysMissingDetail = schedule.filter((day) => !day.vocabularyDetail).length;
  const expandAllButtonLabel =
    daysMissingDetail === 0
      ? "Re-expand all day vocabulary (AI)"
      : "Expand all day vocabulary (AI)";
  const expandAllButtonTooltip =
    daysMissingDetail === 0
      ? "Replace expanded definitions, examples, process steps, and learning goals on every day with fresh AI content."
      : `Use AI to write full definitions, examples, process steps, and learning goals for ${daysMissingDetail} day${daysMissingDetail === 1 ? "" : "s"} that still need expanded vocabulary.`;

  const detailDay =
    detailDayIndex != null ? schedule[detailDayIndex] ?? null : null;

  async function generateAllDaysDetail() {
    if (!lessonContext) {
      toast.error("Lesson context is missing — regenerate the lesson plan and try again.");
      return;
    }

    const daysToGenerate = schedule.filter((day) => !day.vocabularyDetail);
    const targetDays = daysToGenerate.length > 0 ? daysToGenerate : schedule;

    setIsGeneratingAll(true);
    try {
      const details = await generateAllDaysVocabularyDetailAction({
        ...lessonContext,
        days: targetDays.map((day) => ({
          dayLabel: day.dayLabel,
          dailyFocus: day.dailyFocus,
          vocabulary: day.vocabulary,
        })),
      });

      const detailByLabel = new Map(
        targetDays.map((day, index) => [day.dayLabel, details[index]!]),
      );
      const nextSchedule = schedule.map((day) => ({
        ...day,
        vocabularyDetail: detailByLabel.get(day.dayLabel) ?? day.vocabularyDetail,
      }));
      onScheduleChange?.(nextSchedule);
      toast.success("Detailed vocabulary generated for all days", {
        description: `Expanded vocabulary is ready for ${targetDays.length} day${targetDays.length === 1 ? "" : "s"}.`,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not generate detailed vocabulary for all days.",
      );
    } finally {
      setIsGeneratingAll(false);
    }
  }

  async function generateDetailForDay(dayIndex: number, openAfter = true) {
    if (!lessonContext) {
      toast.error("Lesson context is missing — regenerate the lesson plan and try again.");
      return;
    }

    const day = schedule[dayIndex];
    if (!day) return;

    setGeneratingDayIndex(dayIndex);
    try {
      const detail = await generateDayVocabularyDetailAction({
        ...lessonContext,
        dayLabel: day.dayLabel,
        dailyFocus: day.dailyFocus,
        vocabulary: day.vocabulary,
      });

      const nextSchedule = schedule.map((entry, index) =>
        index === dayIndex ? { ...entry, vocabularyDetail: detail } : entry,
      );
      onScheduleChange?.(nextSchedule);
      toast.success("Detailed vocabulary generated", {
        description: `${day.dayLabel} now has expanded definitions, process steps, and learning goals.`,
      });
      if (openAfter) {
        setDetailDayIndex(dayIndex);
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not generate detailed vocabulary.",
      );
    } finally {
      setGeneratingDayIndex(null);
    }
  }

  function openDayDetail(dayIndex: number) {
    const day = schedule[dayIndex];
    if (!day) return;
    if (day.vocabularyDetail) {
      setDetailDayIndex(dayIndex);
      return;
    }
    void generateDetailForDay(dayIndex, true);
  }

  function updateSchedule(next: LessonPlanDaySchedule[]) {
    onScheduleChange?.(next);
  }

  function updateDay(dayIndex: number, patch: Partial<LessonPlanDaySchedule>) {
    updateSchedule(
      schedule.map((day, index) => (index === dayIndex ? { ...day, ...patch } : day)),
    );
  }

  function updateDayOfWeek(dayIndex: number, value: string | null) {
    const day = schedule[dayIndex];
    if (!day) return;

    const dayOfWeek = coerceLessonPlanDayOfWeek(value);
    updateDay(dayIndex, {
      dayOfWeek,
      dayLabel: formatLessonPlanDayLabel(
        lessonPlanDayNumberFromIndex(dayIndex),
        dayOfWeek,
      ),
    });
  }

  function updateDayVocabularyTerms(
    dayIndex: number,
    terms: LessonPlanVocabularyTermDetail[],
  ) {
    const day = schedule[dayIndex];
    if (!day) return;

    const vocabulary = terms
      .map((term) => term.term.trim())
      .filter(Boolean);

    updateDay(dayIndex, {
      vocabulary: vocabulary.length > 0 ? vocabulary : day.vocabulary,
      vocabularyDetail: day.vocabularyDetail
        ? {
            ...day.vocabularyDetail,
            terms: terms.map((term) => ({
              ...term,
              definition: term.definition.trim() || term.shortDefinition,
            })),
          }
        : day.vocabularyDetail,
    });
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-foreground">Daily Schedule</p>
            <TeacherHelpBalloon
              label="Daily Schedule"
              help={
                <>
                  <p className="mb-2">
                    Each day is numbered (Day 1, Day 2, …). In edit mode you can optionally add a
                    day of the week beside the number, e.g. Day 1 (Saturday).
                  </p>
                  <p className="mb-2">
                    Click a day or <strong>View detail</strong> to open expanded AI vocabulary with
                    definitions, examples, and learning goals.
                  </p>
                  <p>
                    Use <strong>Expand all day vocabulary (AI)</strong> to generate or refresh
                    expanded vocabulary for every day at once. Edits here are saved with your
                    lesson plan.
                  </p>
                </>
              }
            />
            {unitLabel ? (
              <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
                {unitLabel}
              </span>
            ) : null}
          </div>
          {lessonContext ? (
            <Tooltip>
              <TooltipTrigger render={<span />}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5"
                  disabled={isBulkBusy || generatingDayIndex != null}
                  onClick={() => void generateAllDaysDetail()}
                >
                  {isBulkBusy ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Sparkles className="size-3.5" aria-hidden />
                  )}
                  <span className="text-xs">{expandAllButtonLabel}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed">
                {expandAllButtonTooltip}
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>

        {isBulkBusy ? (
          <p className="text-sm text-muted-foreground" role="status">
            Generating detailed vocabulary for all days…
          </p>
        ) : null}

        {schedule.map((day, dayIndex) => {
          const isGenerating = generatingDayIndex === dayIndex || isBulkBusy;
          const hasDetail = Boolean(day.vocabularyDetail);
          const dayNumber = lessonPlanDayNumberFromIndex(dayIndex);
          const displayDayLabel = formatLessonPlanDayLabel(dayNumber, day.dayOfWeek);

          return (
            <div
              key={`schedule-day-${dayIndex}`}
              className="space-y-3 rounded-md border border-border p-3"
            >
              <div className="flex items-start justify-between gap-2">
                {editable ? (
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openDayDetail(dayIndex)}
                      className="group flex items-center gap-1 text-left"
                    >
                      <p className="font-medium text-foreground underline-offset-4 group-hover:underline">
                        {displayDayLabel}
                      </p>
                      <ChevronRight
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                    </button>
                    <Select
                      value={day.dayOfWeek ?? LESSON_PLAN_DAY_OF_WEEK_NONE}
                      onValueChange={(value) => updateDayOfWeek(dayIndex, value)}
                    >
                      <SelectTrigger
                        id={`day-${dayIndex}-weekday`}
                        className="h-8 w-[190px] bg-background text-xs"
                        aria-label={`Day of week for ${displayDayLabel}`}
                      >
                        <SelectValue placeholder="Day of week (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={LESSON_PLAN_DAY_OF_WEEK_NONE}>
                          No day of week
                        </SelectItem>
                        {TEACHER_CLASS_DAY_OPTIONS.map((weekday) => (
                          <SelectItem key={weekday} value={weekday}>
                            {weekday}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => openDayDetail(dayIndex)}
                    className="group flex min-w-0 flex-1 items-center gap-1 text-left"
                  >
                    <p className="font-medium text-foreground underline-offset-4 group-hover:underline">
                      {day.dayLabel}
                    </p>
                    <ChevronRight
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  </button>
                )}
                {lessonContext ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 shrink-0 px-2 text-xs"
                    disabled={isGenerating}
                    onClick={() => openDayDetail(dayIndex)}
                  >
                    {isGenerating && !hasDetail ? "Generating…" : "View detail"}
                  </Button>
                ) : null}
              </div>

              {editable ? (
                <div className="space-y-2">
                  <Label htmlFor={`day-${dayIndex}-focus`} className="text-sm text-foreground">
                    Daily focus
                  </Label>
                  <Textarea
                    id={`day-${dayIndex}-focus`}
                    value={day.dailyFocus}
                    onChange={(event) =>
                      updateDay(dayIndex, { dailyFocus: event.target.value })
                    }
                    rows={2}
                    className="bg-background text-sm text-foreground"
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{day.dailyFocus}</p>
              )}

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Vocabulary</p>

                {editable ? (
                  day.vocabularyDetail ? (
                    <EditableVocabularySummaryBox
                      idPrefix={`day-${dayIndex}`}
                      terms={day.vocabularyDetail.terms}
                      onChange={(terms) => updateDayVocabularyTerms(dayIndex, terms)}
                    />
                  ) : (
                    <>
                      <DayListTextarea
                        id={`day-${dayIndex}-vocabulary`}
                        value={day.vocabulary}
                        onCommit={(vocabulary) => updateDay(dayIndex, { vocabulary })}
                        rows={4}
                        hint="One term per line"
                      />
                    </>
                  )
                ) : day.vocabularyDetail ? (
                  <div className="mt-2">
                    <VocabularySummaryBox terms={day.vocabularyDetail.terms} />
                  </div>
                ) : (
                  <ul className="mt-2 list-disc pl-5 text-sm">
                    {day.vocabulary.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Class timeline</p>
                {editable ? (
                  <DayListTextarea
                    id={`day-${dayIndex}-timeline`}
                    value={day.lessonTimeline}
                    onCommit={(lessonTimeline) => updateDay(dayIndex, { lessonTimeline })}
                    rows={5}
                    hint="One activity per line"
                  />
                ) : (
                  <ul className="mt-1 list-disc pl-5 text-sm">
                    {day.lessonTimeline.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Sheet
        open={detailDayIndex != null}
        onOpenChange={(open) => {
          if (!open) setDetailDayIndex(null);
        }}
      >
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-xl">
          {detailDay?.vocabularyDetail ? (
            <>
              <SheetHeader className="border-b border-border px-6 py-4 text-left">
                <SheetTitle className="text-foreground">
                  {detailDay.dayLabel} — Vocabulary detail
                </SheetTitle>
                <SheetDescription>{detailDay.dailyFocus}</SheetDescription>
              </SheetHeader>
              <div className="overflow-y-auto px-6 py-5">
                <LessonPlanDayVocabularyDetailContent
                  detail={detailDay.vocabularyDetail}
                  learningStandard={lessonContext?.learningStandard}
                />
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
