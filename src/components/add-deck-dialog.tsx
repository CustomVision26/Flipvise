"use client";

import * as React from "react";
import Link from "next/link";
import { HelpCircle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { createDeckAction } from "@/actions/decks";

interface AddDeckDialogProps {
  triggerLabel?: string;
  isAtLimit?: boolean;
}

export function AddDeckDialog({ triggerLabel = "+ New Deck", isAtLimit = false }: AddDeckDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const name = (form.elements.namedItem("name") as HTMLInputElement).value.trim();
    const description = (
      form.elements.namedItem("description") as HTMLTextAreaElement
    ).value.trim();

    if (!name) {
      setError("Deck name is required.");
      return;
    }

    setIsPending(true);
    try {
      await createDeckAction({ name, description: description || undefined });
      setOpen(false);
      form.reset();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!isPending) {
      setOpen(nextOpen);
      if (!nextOpen) setError(null);
    }
  }

  if (isAtLimit) {
    return (
      <Link href="/pricing" className={buttonVariants({ variant: "outline" })}>
        Upgrade to Pro for more decks
      </Link>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button className="text-xs sm:text-sm h-9 sm:h-10 px-3 sm:px-4" />}>{triggerLabel}</DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md mx-4 sm:mx-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Create a new deck</DialogTitle>
          <DialogDescription className="text-sm">
            Give your deck a name and an optional description.
          </DialogDescription>
        </DialogHeader>

        <TooltipProvider>
          <form id="add-deck-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="deck-name">Name</Label>
                <Tooltip>
                  <TooltipTrigger type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                    <HelpCircle className="h-4 w-4" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <p className="font-semibold mb-1">Examples:</p>
                    <ul className="space-y-1 text-xs">
                      <li>• Mathematics</li>
                      <li>• Jamaica's History</li>
                      <li>• Spanish Vocabulary</li>
                    </ul>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="deck-name"
                name="name"
                placeholder="e.g. Spanish Vocabulary"
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="deck-description">Description (optional)</Label>
                <Tooltip>
                  <TooltipTrigger type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                    <HelpCircle className="h-4 w-4" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <p className="font-semibold mb-1">Be specific to help AI understand:</p>
                    <ul className="space-y-1.5 text-xs">
                      <li>
                        <span className="font-medium">Mathematics</span>
                        <br />
                        → Algebra, Geometry, or Calculus
                      </li>
                      <li>
                        <span className="font-medium">Jamaica's History</span>
                        <br />
                        → Learning the 20th century history of Jamaica
                      </li>
                    </ul>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Textarea
                id="deck-description"
                name="description"
                placeholder="What would you like to learn?"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </form>
        </TooltipProvider>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" type="button" />}>
            Cancel
          </DialogClose>
          <Button type="submit" form="add-deck-form" disabled={isPending}>
            {isPending ? "Creating…" : "Create Deck"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
