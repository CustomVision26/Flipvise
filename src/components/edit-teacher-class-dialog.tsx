"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  getTeacherClassDeckPlanPeriodAction,
  updateTeacherClassAction,
} from "@/actions/teacher-classes";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TeacherClassFormFields } from "@/components/teacher-class-form-fields";
import type { DeckRow } from "@/db/queries/decks";
import type { TeacherClassWithDeck } from "@/db/queries/teacher-classes";
import {
  buildPeriodFieldsForPlanPeriod,
  formatStoredClassPeriods,
  TEACHER_CLASS_DAY_OPTIONS,
  TEACHER_CLASS_DECK_NONE,
} from "@/lib/teacher-class-form";
import { teacherClassDisplayTitle } from "@/lib/teacher-class-links";

type EditTeacherClassDialogProps = {
  cls: TeacherClassWithDeck;
  decks: DeckRow[];
  teamId: number | null;
  planPeriodDaysByDeckId: Record<number, number>;
};

async function resolvePlanPeriodDaysForDeck(
  deckId: number,
  planPeriodDaysByDeckId: Record<number, number>,
): Promise<number | null> {
  const cached = planPeriodDaysByDeckId[deckId];
  if (cached != null) {
    return cached;
  }

  return getTeacherClassDeckPlanPeriodAction({ deckId });
}

function buildInitialDay(
  cls: TeacherClassWithDeck,
  linkedPlanPeriodDays: number | null,
): string {
  if (linkedPlanPeriodDays != null) {
    return String(linkedPlanPeriodDays);
  }

  return TEACHER_CLASS_DAY_OPTIONS.includes(
    cls.day as (typeof TEACHER_CLASS_DAY_OPTIONS)[number],
  )
    ? cls.day
    : "";
}

export function EditTeacherClassDialog({
  cls,
  decks,
  teamId,
  planPeriodDaysByDeckId,
}: EditTeacherClassDialogProps) {
  const router = useRouter();
  const initialPlanPeriod = planPeriodDaysByDeckId[cls.deckId] ?? null;
  const initialPeriodState = buildPeriodFieldsForPlanPeriod(
    initialPlanPeriod,
    initialPlanPeriod != null ? cls.period : undefined,
  );
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [isResolvingPlanPeriod, setIsResolvingPlanPeriod] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [academicYear, setAcademicYear] = useState(cls.academicYear);
  const [termSemester, setTermSemester] = useState(cls.termSemester);
  const [week, setWeek] = useState(cls.week);
  const [day, setDay] = useState(
    initialPlanPeriod != null ? initialPeriodState.day : buildInitialDay(cls, initialPlanPeriod),
  );
  const [period, setPeriod] = useState(
    initialPlanPeriod != null ? "" : cls.period,
  );
  const [periods, setPeriods] = useState(initialPeriodState.periods);
  const [deckKey, setDeckKey] = useState(String(cls.deckId));
  const [linkedPlanPeriodDays, setLinkedPlanPeriodDays] = useState<number | null>(
    initialPlanPeriod,
  );

  const selectedDeck =
    deckKey !== TEACHER_CLASS_DECK_NONE
      ? decks.find((deck) => String(deck.id) === deckKey) ?? null
      : null;

  function resetForm() {
    const planPeriod = planPeriodDaysByDeckId[cls.deckId] ?? null;
    const nextPeriodState = buildPeriodFieldsForPlanPeriod(
      planPeriod,
      planPeriod != null ? cls.period : undefined,
    );

    setAcademicYear(cls.academicYear);
    setTermSemester(cls.termSemester);
    setWeek(cls.week);
    setDay(planPeriod != null ? nextPeriodState.day : buildInitialDay(cls, planPeriod));
    setPeriod(planPeriod != null ? "" : cls.period);
    setPeriods(nextPeriodState.periods);
    setDeckKey(String(cls.deckId));
    setLinkedPlanPeriodDays(planPeriod);
    setError(null);
  }

  async function handleDeckChange(value: string) {
    setDeckKey(value);
    setError(null);

    if (value === TEACHER_CLASS_DECK_NONE) {
      setLinkedPlanPeriodDays(null);
      setDay("");
      setPeriod("");
      setPeriods([]);
      return;
    }

    const deckId = Number(value);
    const existingPeriod = deckId === cls.deckId ? cls.period : undefined;

    setIsResolvingPlanPeriod(true);
    try {
      const planPeriod = await resolvePlanPeriodDaysForDeck(deckId, planPeriodDaysByDeckId);
      setLinkedPlanPeriodDays(planPeriod);

      const nextPeriodState = buildPeriodFieldsForPlanPeriod(planPeriod, existingPeriod);
      setDay(nextPeriodState.day);
      setPeriod(nextPeriodState.period);
      setPeriods(nextPeriodState.periods);
    } catch {
      setLinkedPlanPeriodDays(null);
      setDay("");
      setPeriod(existingPeriod ?? "");
      setPeriods([]);
    } finally {
      setIsResolvingPlanPeriod(false);
    }
  }

  function handlePeriodFieldChange(index: number, value: string) {
    setPeriods((current) =>
      current.map((entry, entryIndex) => (entryIndex === index ? value : entry)),
    );
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!isPending) {
      setOpen(nextOpen);
      if (!nextOpen) {
        resetForm();
      }
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!selectedDeck) {
      const message = "Select a deck for this class.";
      setError(message);
      toast.error(message);
      return;
    }

    let submitDay = day;
    let submitPeriod = period;

    if (linkedPlanPeriodDays != null) {
      const trimmedPeriods = periods.map((entry) => entry.trim());
      if (trimmedPeriods.some((entry) => entry.length === 0)) {
        const message = "Enter a value for each period.";
        setError(message);
        toast.error(message);
        return;
      }

      submitDay = String(linkedPlanPeriodDays);
      submitPeriod = formatStoredClassPeriods(trimmedPeriods);
    }

    setIsPending(true);
    try {
      await updateTeacherClassAction({
        classId: cls.id,
        academicYear,
        termSemester,
        week,
        day: submitDay,
        period: submitPeriod,
        deckId: selectedDeck.id,
        teamId,
      });
      setOpen(false);
      resetForm();
      toast.success("Class updated", {
        description: `${teacherClassDisplayTitle({
          ...cls,
          termSemester,
          week,
          deckName: selectedDeck.name,
        })} was saved.`,
      });
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not update class.";
      setError(message);
      toast.error(message);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={isPending}
        aria-label={`Edit class ${teacherClassDisplayTitle(cls)}`}
      >
        <Pencil className="size-3.5" aria-hidden />
        {isPending ? "…" : "Edit"}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="flex max-h-[min(90vh,48rem)] max-w-lg flex-col gap-0 overflow-hidden p-0">
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <DialogHeader className="shrink-0 border-b border-border px-6 py-4 text-left">
              <DialogTitle>Edit class</DialogTitle>
              <DialogDescription>
                Update the schedule details for this class. Linked deck resources stay attached to
                the selected deck.
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <TeacherClassFormFields
                idPrefix={`edit-class-${cls.id}`}
                decks={decks}
                deckKey={deckKey}
                onDeckChange={(value) => void handleDeckChange(value)}
                academicYear={academicYear}
                onAcademicYearChange={setAcademicYear}
                termSemester={termSemester}
                onTermSemesterChange={setTermSemester}
                week={week}
                onWeekChange={setWeek}
                day={day}
                onDayChange={setDay}
                period={period}
                onPeriodChange={setPeriod}
                periods={periods}
                onPeriodFieldChange={handlePeriodFieldChange}
                linkedPlanPeriodDays={linkedPlanPeriodDays}
                isResolvingPlanPeriod={isResolvingPlanPeriod}
                error={error}
              />
            </div>

            <DialogFooter className="mx-0 mb-0 shrink-0 rounded-none border-t border-border bg-background px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending || isResolvingPlanPeriod || decks.length === 0}
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Saving…
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
