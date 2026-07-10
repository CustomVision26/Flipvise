"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TeacherFieldLabel } from "@/components/teacher-field-label";
import type { DeckRow } from "@/db/queries/decks";
import {
  formatPlanPeriodLabel,
  periodOfTheDayLabel,
  periodPlaceholder,
  TEACHER_CLASS_DAY_OPTIONS,
  TEACHER_CLASS_DECK_NONE,
  TEACHER_CLASS_TERM_OPTIONS,
} from "@/lib/teacher-class-form";

const PERIOD_OF_THE_DAY_HELP = (
  <>
    <p className="mb-1 font-semibold">Timetable period for this day</p>
    <p>
      Enter the class period slot from your school schedule (e.g. Period 1, Block A,
      or 9:00–9:45 AM).
    </p>
  </>
);

const PLAN_PERIOD_CLASS_HELP = (
  <>
    <p className="mb-1 font-semibold">Unit length from your lesson plan</p>
    <p>
      Pulled from the linked lesson plan. Each school day in the unit gets its own
      period-of-the-day field below.
    </p>
  </>
);

type TeacherClassFormFieldsProps = {
  idPrefix: string;
  decks: DeckRow[];
  deckKey: string;
  onDeckChange: (value: string) => void;
  academicYear: string;
  onAcademicYearChange: (value: string) => void;
  termSemester: string;
  onTermSemesterChange: (value: string) => void;
  week: string;
  onWeekChange: (value: string) => void;
  day: string;
  onDayChange: (value: string) => void;
  period: string;
  onPeriodChange: (value: string) => void;
  periods: string[];
  onPeriodFieldChange: (index: number, value: string) => void;
  linkedPlanPeriodDays: number | null;
  isResolvingPlanPeriod?: boolean;
  error: string | null;
};

export function TeacherClassFormFields({
  idPrefix,
  decks,
  deckKey,
  onDeckChange,
  academicYear,
  onAcademicYearChange,
  termSemester,
  onTermSemesterChange,
  week,
  onWeekChange,
  day,
  onDayChange,
  period,
  onPeriodChange,
  periods,
  onPeriodFieldChange,
  linkedPlanPeriodDays,
  isResolvingPlanPeriod = false,
  error,
}: TeacherClassFormFieldsProps) {
  const selectedDeck =
    deckKey !== TEACHER_CLASS_DECK_NONE
      ? decks.find((deck) => String(deck.id) === deckKey) ?? null
      : null;

  const hasLinkedLessonPlan = linkedPlanPeriodDays != null;

  return (
    <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-deck`}>Deck</Label>
        <Select
          value={deckKey}
          onValueChange={(value) => onDeckChange(value ?? TEACHER_CLASS_DECK_NONE)}
          disabled={decks.length === 0}
        >
          <SelectTrigger id={`${idPrefix}-deck`} className="h-10 w-full bg-background">
            <SelectValue placeholder="Select a deck">
              {selectedDeck?.name ?? "Select a deck"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent nestedInModal>
            {decks.map((deck) => (
              <SelectItem key={deck.id} value={String(deck.id)}>
                {deck.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-academic-year`}>Academic year</Label>
        <Input
          id={`${idPrefix}-academic-year`}
          value={academicYear}
          onChange={(e) => onAcademicYearChange(e.target.value)}
          placeholder="2025–2026"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-term`}>Term / semester</Label>
        <Select value={termSemester} onValueChange={(value) => onTermSemesterChange(value ?? "")}>
          <SelectTrigger id={`${idPrefix}-term`} className="w-full">
            <SelectValue placeholder="Select term" />
          </SelectTrigger>
          <SelectContent>
            {TEACHER_CLASS_TERM_OPTIONS.map((term) => (
              <SelectItem key={term} value={term}>
                {term}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-week`}>Week</Label>
        <Input
          id={`${idPrefix}-week`}
          value={week}
          onChange={(e) => onWeekChange(e.target.value)}
          placeholder="Week 1"
          required
        />
      </div>

      <div className="space-y-2">
        {hasLinkedLessonPlan ? (
          <TeacherFieldLabel
            htmlFor={`${idPrefix}-day`}
            label="Plan period"
            help={PLAN_PERIOD_CLASS_HELP}
          />
        ) : (
          <Label htmlFor={`${idPrefix}-day`}>Day</Label>
        )}
        {hasLinkedLessonPlan ? (
          <Input
            id={`${idPrefix}-day`}
            value={formatPlanPeriodLabel(linkedPlanPeriodDays)}
            readOnly
            className="bg-muted/40"
          />
        ) : (
          <Select value={day} onValueChange={(value) => onDayChange(value ?? "")}>
            <SelectTrigger id={`${idPrefix}-day`} className="w-full">
              <SelectValue
                placeholder={isResolvingPlanPeriod ? "Checking lesson plan…" : "Select day"}
              />
            </SelectTrigger>
            <SelectContent>
              {TEACHER_CLASS_DAY_OPTIONS.map((weekday) => (
                <SelectItem key={weekday} value={weekday}>
                  {weekday}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {hasLinkedLessonPlan ? (
        <div className="space-y-3 sm:col-span-2">
          {periods.map((periodValue, index) => {
            const fieldId = `${idPrefix}-period-${index + 1}`;
            const fieldLabel = periodOfTheDayLabel(index + 1);
            return (
              <div key={fieldId} className="space-y-2">
                <TeacherFieldLabel
                  htmlFor={fieldId}
                  label={fieldLabel}
                  help={PERIOD_OF_THE_DAY_HELP}
                />
                <Input
                  id={fieldId}
                  value={periodValue}
                  onChange={(e) => onPeriodFieldChange(index, e.target.value)}
                  placeholder={periodPlaceholder(index + 1)}
                  required
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2 sm:col-span-2">
          <TeacherFieldLabel
            htmlFor={`${idPrefix}-period`}
            label="Period of the day"
            help={PERIOD_OF_THE_DAY_HELP}
          />
          <Input
            id={`${idPrefix}-period`}
            value={period}
            onChange={(e) => onPeriodChange(e.target.value)}
            placeholder={periodPlaceholder(1)}
            required
            disabled={isResolvingPlanPeriod}
          />
        </div>
      )}

      {error ? (
        <p className="text-sm text-destructive sm:col-span-2" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
