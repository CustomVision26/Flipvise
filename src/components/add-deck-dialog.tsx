"use client";

import * as React from "react";
import Link from "next/link";
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
      <DialogTrigger render={<Button />}>{triggerLabel}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a new deck</DialogTitle>
          <DialogDescription>
            Give your deck a name and an optional description.
          </DialogDescription>
        </DialogHeader>

        <form id="add-deck-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="deck-name">Name</Label>
            <Input
              id="deck-name"
              name="name"
              placeholder="e.g. Spanish Vocabulary"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="deck-description">Description (optional)</Label>
            <Textarea
              id="deck-description"
              name="description"
              placeholder="What is this deck about?"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>

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
