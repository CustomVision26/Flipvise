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
  TEACHER_CLASS_MONTH_OPTIONS,
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

const fieldControlClassName = "h-11 w-full bg-background text-sm";

type TeacherClassMemberOption = {
  userId: string;
  label: string;
};

type TeacherClassFormFieldsProps = {
  idPrefix: string;
  decks: DeckRow[];
  memberOptions?: TeacherClassMemberOption[];
  selectedMemberUserId?: string;
  onMemberChange?: (userId: string) => void;
  deckKey: string;
  onDeckChange: (value: string) => void;
  academicYear: string;
  onAcademicYearChange: (value: string) => void;
  termSemester: string;
  onTermSemesterChange: (value: string) => void;
  week: string;
  onWeekChange: (value: string) => void;
  month: string;
  onMonthChange: (value: string) => void;
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
  memberOptions,
  selectedMemberUserId,
  onMemberChange,
  deckKey,
  onDeckChange,
  academicYear,
  onAcademicYearChange,
  termSemester,
  onTermSemesterChange,
  week,
  onWeekChange,
  month,
  onMonthChange,
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
  const selectedMember =
    memberOptions?.find((member) => member.userId === selectedMemberUserId) ?? null;

  return (
    <div className="flex flex-col gap-8 px-8 py-7">
      <section className="grid gap-5 sm:grid-cols-2">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase sm:col-span-2">
          Class materials
        </h3>
        {memberOptions && memberOptions.length > 0 && onMemberChange ? (
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`${idPrefix}-member`} className="text-sm font-medium">
              Workspace owner or team admin
            </Label>
            <Select
              value={selectedMemberUserId}
              onValueChange={(value) => {
                if (value) onMemberChange(value);
              }}
            >
              <SelectTrigger id={`${idPrefix}-member`} className={fieldControlClassName}>
                <SelectValue placeholder="Select a member">
                  {selectedMember?.label ?? "Select a member"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent nestedInModal>
                {memberOptions.map((member) => (
                  <SelectItem key={member.userId} value={member.userId}>
                    {member.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`${idPrefix}-deck`} className="text-sm font-medium">
            Deck
          </Label>
          <Select
            value={deckKey}
            onValueChange={(value) => onDeckChange(value ?? TEACHER_CLASS_DECK_NONE)}
            disabled={decks.length === 0}
          >
            <SelectTrigger id={`${idPrefix}-deck`} className={fieldControlClassName}>
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
          {memberOptions && decks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No decks with a linked lesson plan for this member.
            </p>
          ) : null}
        </div>
      </section>

      <section className="grid gap-5 sm:grid-cols-2">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase sm:col-span-2">
          Academic schedule
        </h3>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-academic-year`} className="text-sm font-medium">
            Academic year
          </Label>
          <Input
            id={`${idPrefix}-academic-year`}
            value={academicYear}
            onChange={(e) => onAcademicYearChange(e.target.value)}
            placeholder="2025–2026"
            className={fieldControlClassName}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-term`} className="text-sm font-medium">
            Term / semester
          </Label>
          <Select value={termSemester} onValueChange={(value) => onTermSemesterChange(value ?? "")}>
            <SelectTrigger id={`${idPrefix}-term`} className={fieldControlClassName}>
              <SelectValue placeholder="Select term" />
            </SelectTrigger>
            <SelectContent nestedInModal>
              {TEACHER_CLASS_TERM_OPTIONS.map((term) => (
                <SelectItem key={term} value={term}>
                  {term}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-week`} className="text-sm font-medium">
            Week
          </Label>
          <Input
            id={`${idPrefix}-week`}
            value={week}
            onChange={(e) => onWeekChange(e.target.value)}
            placeholder="Week 1"
            className={fieldControlClassName}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-month`} className="text-sm font-medium">
            Month
          </Label>
          <Select value={month} onValueChange={(value) => onMonthChange(value ?? "")}>
            <SelectTrigger id={`${idPrefix}-month`} className={fieldControlClassName}>
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent nestedInModal>
              {TEACHER_CLASS_MONTH_OPTIONS.map((monthName) => (
                <SelectItem key={monthName} value={monthName}>
                  {monthName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          {hasLinkedLessonPlan ? (
            <TeacherFieldLabel
              htmlFor={`${idPrefix}-day`}
              label="Plan period"
              help={PLAN_PERIOD_CLASS_HELP}
            />
          ) : (
            <Label htmlFor={`${idPrefix}-day`} className="text-sm font-medium">
              Day
            </Label>
          )}
          {hasLinkedLessonPlan ? (
            <Input
              id={`${idPrefix}-day`}
              value={formatPlanPeriodLabel(linkedPlanPeriodDays)}
              readOnly
              className="h-11 bg-muted/40 text-sm"
            />
          ) : (
            <Select value={day} onValueChange={(value) => onDayChange(value ?? "")}>
              <SelectTrigger id={`${idPrefix}-day`} className={fieldControlClassName}>
                <SelectValue
                  placeholder={isResolvingPlanPeriod ? "Checking lesson plan…" : "Select day"}
                />
              </SelectTrigger>
              <SelectContent nestedInModal>
                {TEACHER_CLASS_DAY_OPTIONS.map((weekday) => (
                  <SelectItem key={weekday} value={weekday}>
                    {weekday}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </section>

      <section className="grid gap-5 sm:grid-cols-2">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase sm:col-span-2">
          Timetable
        </h3>
        {hasLinkedLessonPlan ? (
          periods.map((periodValue, index) => {
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
                  className={fieldControlClassName}
                  required
                />
              </div>
            );
          })
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
              className={fieldControlClassName}
              required
              disabled={isResolvingPlanPeriod}
            />
          </div>
        )}
      </section>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
