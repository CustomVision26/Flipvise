"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createTeacherClassAction } from "@/actions/teacher-classes";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DeckRow } from "@/db/queries/decks";

const DAY_OPTIONS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const TERM_OPTIONS = [
  "Fall",
  "Spring",
  "Summer",
  "Semester 1",
  "Semester 2",
  "Trimester 1",
  "Trimester 2",
  "Trimester 3",
] as const;

const DECK_NONE = "__none__";

type CreateTeacherClassDialogProps = {
  decks: DeckRow[];
  teamId: number | null;
};

export function CreateTeacherClassDialog({
  decks,
  teamId,
}: CreateTeacherClassDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [academicYear, setAcademicYear] = useState("");
  const [termSemester, setTermSemester] = useState("");
  const [week, setWeek] = useState("");
  const [day, setDay] = useState("");
  const [period, setPeriod] = useState("");
  const [deckKey, setDeckKey] = useState(DECK_NONE);

  const selectedDeck =
    deckKey !== DECK_NONE ? decks.find((deck) => String(deck.id) === deckKey) ?? null : null;

  function resetForm() {
    setAcademicYear("");
    setTermSemester("");
    setWeek("");
    setDay("");
    setPeriod("");
    setDeckKey(DECK_NONE);
    setError(null);
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
      setError("Select a deck for this class.");
      return;
    }

    setIsPending(true);
    try {
      await createTeacherClassAction({
        academicYear,
        termSemester,
        week,
        day,
        period,
        deckId: selectedDeck.id,
        teamId,
      });
      setOpen(false);
      resetForm();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create class.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button type="button" disabled={decks.length === 0}>
            Create class
          </Button>
        }
      />
      <DialogContent className="max-w-lg gap-0 p-0">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="border-b border-border px-6 py-4 text-left">
            <DialogTitle>Create class</DialogTitle>
            <DialogDescription>
              Link a deck to a schedule slot. You can open lesson plans, homework, and other
              materials from the class card after saving.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="class-deck">Deck</Label>
              <Select
                value={deckKey}
                onValueChange={(value) => setDeckKey(value ?? DECK_NONE)}
                disabled={decks.length === 0}
              >
                <SelectTrigger id="class-deck" className="h-10 w-full bg-background">
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
              <Label htmlFor="class-academic-year">Academic year</Label>
              <Input
                id="class-academic-year"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                placeholder="2025–2026"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="class-term">Term / semester</Label>
              <Select value={termSemester} onValueChange={(value) => setTermSemester(value ?? "")}>
                <SelectTrigger id="class-term" className="w-full">
                  <SelectValue placeholder="Select term" />
                </SelectTrigger>
                <SelectContent>
                  {TERM_OPTIONS.map((term) => (
                    <SelectItem key={term} value={term}>
                      {term}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="class-week">Week</Label>
              <Input
                id="class-week"
                value={week}
                onChange={(e) => setWeek(e.target.value)}
                placeholder="Week 1"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="class-day">Day</Label>
              <Select value={day} onValueChange={(value) => setDay(value ?? "")}>
                <SelectTrigger id="class-day" className="w-full">
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {DAY_OPTIONS.map((weekday) => (
                    <SelectItem key={weekday} value={weekday}>
                      {weekday}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="class-period">Period</Label>
              <Input
                id="class-period"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder="Period 1"
                required
              />
            </div>

            {error ? (
              <p className="text-sm text-destructive sm:col-span-2" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <DialogFooter className="border-t border-border px-6 py-4">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || decks.length === 0}>
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
