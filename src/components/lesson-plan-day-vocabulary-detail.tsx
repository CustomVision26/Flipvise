"use client";

import { useState } from "react";
import { ChevronRight, Loader2, Sparkles } from "lucide-react";
import { generateAllDaysVocabularyDetailAction, generateDayVocabularyDetailAction } from "@/actions/teacher-lesson-plan";
import { Button } from "@/components/ui/button";
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
}: {
  detail: LessonPlanDayVocabularyDetail;
}) {
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
            Additional Vocabulary
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
}: {
  schedule: LessonPlanDaySchedule[];
  unitLabel?: string;
  lessonContext?: LessonPlanDetailLessonContext;
  onScheduleChange?: (next: LessonPlanDaySchedule[]) => void;
  isGeneratingAllDayDetails?: boolean;
}) {
  const [detailDayIndex, setDetailDayIndex] = useState<number | null>(null);
  const [generatingDayIndex, setGeneratingDayIndex] = useState<number | null>(null);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);

  const isBulkBusy = isGeneratingAll || isGeneratingAllDayDetails;
  const daysMissingDetail = schedule.filter((day) => !day.vocabularyDetail).length;

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

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-foreground">Daily Schedule</p>
            {unitLabel ? (
              <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
                {unitLabel}
              </span>
            ) : null}
          </div>
          {lessonContext ? (
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
              <span className="text-xs">
                {daysMissingDetail === 0 ? "Regenerate all days" : "AI detail — all days"}
              </span>
            </Button>
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

          return (
            <div
              key={day.dayLabel}
              className="space-y-3 rounded-md border border-border p-3"
            >
              <div className="flex items-start justify-between gap-2">
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

              <p className="text-sm text-muted-foreground">{day.dailyFocus}</p>

              <div>
                <p className="text-sm font-medium text-foreground">Vocabulary</p>

                {day.vocabularyDetail ? (
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

              <div>
                <p className="text-sm font-medium text-foreground">Class timeline</p>
                <ul className="mt-1 list-disc pl-5 text-sm">
                  {day.lessonTimeline.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
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
                <LessonPlanDayVocabularyDetailContent detail={detailDay.vocabularyDetail} />
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
