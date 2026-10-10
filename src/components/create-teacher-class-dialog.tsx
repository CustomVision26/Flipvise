"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  createTeacherClassAction,
  getTeacherClassDeckPlanPeriodAction,
} from "@/actions/teacher-classes";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TeacherClassFormFields } from "@/components/teacher-class-form-fields";
import type { DeckRow } from "@/db/queries/decks";
import type { OwnerTeamAdminDeckPickerPayload } from "@/db/queries/teacher-owner-pickers";
import { looksLikeClerkUserId } from "@/lib/clerk-user-display";
import { adminDisplayLabel } from "@/lib/owner-team-admin-picker";
import type { TeamAdminQuizPickerOption } from "@/db/queries/saved-lesson-plans";
import {
  buildPeriodFieldsForPlanPeriod,
  formatStoredClassPeriods,
  TEACHER_CLASS_DECK_NONE,
} from "@/lib/teacher-class-form";

type CreateTeacherClassDialogProps = {
  decks: DeckRow[];
  teamId: number | null;
  planPeriodDaysByDeckId: Record<number, number>;
  ownerDeckPicker?: OwnerTeamAdminDeckPickerPayload | null;
  lessonPlanDeckIds?: number[];
};

function classMemberFieldLabel(admin: TeamAdminQuizPickerOption): string {
  const name = admin.name?.trim() ?? "";
  return adminDisplayLabel({
    ...admin,
    name: name && !looksLikeClerkUserId(name) ? name : null,
  });
}

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

export function CreateTeacherClassDialog({
  decks,
  teamId,
  planPeriodDaysByDeckId,
  ownerDeckPicker = null,
  lessonPlanDeckIds = [],
}: CreateTeacherClassDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [isResolvingPlanPeriod, setIsResolvingPlanPeriod] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [academicYear, setAcademicYear] = useState("");
  const [termSemester, setTermSemester] = useState("");
  const [week, setWeek] = useState("");
  const [day, setDay] = useState("");
  const [period, setPeriod] = useState("");
  const [periods, setPeriods] = useState<string[]>([]);
  const [deckKey, setDeckKey] = useState(TEACHER_CLASS_DECK_NONE);
  const [linkedPlanPeriodDays, setLinkedPlanPeriodDays] = useState<number | null>(null);

  const isPlanOwner = ownerDeckPicker?.isWorkspaceOwner === true;
  const memberOptions = useMemo(
    () =>
      isPlanOwner
        ? (ownerDeckPicker?.teamAdmins ?? []).map((admin) => ({
            userId: admin.userId,
            label: classMemberFieldLabel(admin),
          }))
        : [],
    [isPlanOwner, ownerDeckPicker?.teamAdmins],
  );
  const defaultMemberUserId =
    ownerDeckPicker?.teamAdmins.find((admin) => admin.isWorkspaceOwner)?.userId ??
    memberOptions[0]?.userId ??
    "";
  const [selectedMemberUserId, setSelectedMemberUserId] = useState(defaultMemberUserId);
  const lessonPlanDeckIdSet = useMemo(
    () => new Set(lessonPlanDeckIds),
    [lessonPlanDeckIds],
  );
  const visibleDecks = useMemo(() => {
    if (!isPlanOwner) return decks;
    const memberDecks = ownerDeckPicker?.itemsByAdminUserId[selectedMemberUserId] ?? [];
    return memberDecks.filter((deck) => lessonPlanDeckIdSet.has(deck.id));
  }, [
    decks,
    isPlanOwner,
    lessonPlanDeckIdSet,
    ownerDeckPicker?.itemsByAdminUserId,
    selectedMemberUserId,
  ]);

  const selectedDeck =
    deckKey !== TEACHER_CLASS_DECK_NONE
      ? visibleDecks.find((deck) => String(deck.id) === deckKey) ?? null
      : null;

  function resetForm() {
    setAcademicYear("");
    setTermSemester("");
    setWeek("");
    setDay("");
    setPeriod("");
    setPeriods([]);
    setDeckKey(TEACHER_CLASS_DECK_NONE);
    setSelectedMemberUserId(defaultMemberUserId);
    setLinkedPlanPeriodDays(null);
    setError(null);
  }

  function handleMemberChange(userId: string) {
    setSelectedMemberUserId(userId);
    setDeckKey(TEACHER_CLASS_DECK_NONE);
    setLinkedPlanPeriodDays(null);
    setDay("");
    setPeriod("");
    setPeriods([]);
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
    setIsResolvingPlanPeriod(true);
    try {
      const planPeriod = await resolvePlanPeriodDaysForDeck(deckId, planPeriodDaysByDeckId);
      setLinkedPlanPeriodDays(planPeriod);

      const nextPeriodState = buildPeriodFieldsForPlanPeriod(planPeriod);
      setDay(nextPeriodState.day);
      setPeriod(nextPeriodState.period);
      setPeriods(nextPeriodState.periods);
    } catch {
      setLinkedPlanPeriodDays(null);
      setDay("");
      setPeriod("");
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
      await createTeacherClassAction({
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
      toast.success("Class created", {
        description: "Your new class is ready in the class list.",
      });
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not create class.";
      setError(message);
      toast.error(message);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button type="button" disabled={!isPlanOwner && decks.length === 0}>
            Create class
          </Button>
        }
      />
      <DialogContent className="flex max-h-[min(92vh,56rem)] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <DialogHeader className="shrink-0 gap-2 border-b border-border px-8 py-6 text-left">
            <DialogTitle className="text-xl font-semibold tracking-tight">Create class</DialogTitle>
            <DialogDescription className="max-w-2xl text-sm leading-6">
              Link a deck to a schedule slot. You can open lesson plans, homework, and other
              materials from the class card after saving.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <TeacherClassFormFields
              idPrefix="create-class"
              decks={visibleDecks}
              memberOptions={isPlanOwner ? memberOptions : undefined}
              selectedMemberUserId={selectedMemberUserId}
              onMemberChange={isPlanOwner ? handleMemberChange : undefined}
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

          <DialogFooter className="mx-0 mb-0 shrink-0 gap-3 rounded-none border-t border-border bg-muted/30 px-8 py-5 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="min-w-28"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="lg"
              className="min-w-36"
              disabled={isPending || isResolvingPlanPeriod || visibleDecks.length === 0}
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Creating…
                </>
              ) : (
                "Create class"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
